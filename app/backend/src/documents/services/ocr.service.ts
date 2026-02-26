import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, Worker } from 'tesseract.js';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import { Language } from '../entities/document.entity';

export interface OcrResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  lines: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  paragraphs: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  language: string;
  processingTime: number;
}

export interface OcrOptions {
  languages?: Language[];
  enhanceImage?: boolean;
  preprocessImage?: boolean;
  detectTables?: boolean;
  preserveLayout?: boolean;
  outputFormat?: 'text' | 'hocr' | 'pdf';
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private workers: Map<string, Worker> = new Map();
  private readonly maxWorkers = 4;
  private workerQueue: Array<{
    id: string;
    resolve: (worker: Worker) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(private readonly configService: ConfigService) {
    this.initializeWorkers();
  }

  private async initializeWorkers(): Promise<void> {
    const languages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'rus'];
    
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = await createWorker();
        await worker.loadLanguage(languages.join('+'));
        await worker.initialize(languages.join('+'));
        
        const workerId = `worker-${i}`;
        this.workers.set(workerId, worker);
        this.logger.log(`OCR worker ${workerId} initialized`);
      } catch (error) {
        this.logger.error(`Failed to initialize OCR worker ${i}:`, error);
      }
    }
  }

  async extractTextFromImage(
    imagePath: string,
    options: OcrOptions = {}
  ): Promise<OcrResult> {
    const startTime = Date.now();
    
    try {
      // Preprocess image if requested
      let processedImagePath = imagePath;
      if (options.preprocessImage || options.enhanceImage) {
        processedImagePath = await this.preprocessImage(imagePath, options);
      }

      // Get worker from pool
      const worker = await this.getWorker();
      
      try {
        // Set languages
        const languages = this.mapLanguagesToTesseract(options.languages || [Language.EN]);
        await worker.setParameters({
          tessedit_ocr_engine_mode: '3', // Neural net LSTM
          tessedit_pageseg_mode: options.preserveLayout ? '6' : '3',
          preserve_interword_spaces: '1',
          tessedit_create_hocr: options.outputFormat === 'hocr' ? '1' : '0',
          tessedit_create_pdf: options.outputFormat === 'pdf' ? '1' : '0',
        });

        // Perform OCR
        const { data } = await worker.recognize(processedImagePath, languages.join('+'));
        
        const processingTime = Date.now() - startTime;
        
        const result: OcrResult = {
          text: data.text,
          confidence: data.confidence,
          words: data.words?.map(word => ({
            text: word.text,
            confidence: word.confidence,
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1,
            },
          })) || [],
          lines: data.lines?.map(line => ({
            text: line.text,
            confidence: line.confidence,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1,
            },
          })) || [],
          paragraphs: data.paragraphs?.map(paragraph => ({
            text: paragraph.text,
            confidence: paragraph.confidence,
            bbox: {
              x0: paragraph.bbox.x0,
              y0: paragraph.bbox.y0,
              x1: paragraph.bbox.x1,
              y1: paragraph.bbox.y1,
            },
          })) || [],
          language: this.detectLanguageFromConfidence(data),
          processingTime,
        };

        // Detect tables if requested
        if (options.detectTables) {
          result.text = await this.extractTables(processedImagePath, result.text);
        }

        return result;
      } finally {
        this.releaseWorker(worker);
      }
    } catch (error) {
      this.logger.error('OCR extraction failed:', error);
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  async extractTextFromPdf(
    pdfPath: string,
    options: OcrOptions = {}
  ): Promise<OcrResult[]> {
    const pdf2pic = require('pdf2pic');
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const convert = pdf2pic.fromPath(pdfPath, {
        density: 300,
        saveFilename: 'page',
        savePath: path.dirname(pdfPath),
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Get page count
      const pageImages = await convert.bulk(-1, { responseType: 'buffer' });
      const results: OcrResult[] = [];

      for (let i = 0; i < pageImages.length; i++) {
        const pageImagePath = path.join(path.dirname(pdfPath), `page-${i + 1}.png`);
        
        try {
          const pageResult = await this.extractTextFromImage(pageImagePath, options);
          results.push(pageResult);
        } catch (error) {
          this.logger.warn(`Failed to extract text from page ${i + 1}:`, error);
        } finally {
          // Clean up temporary page image
          try {
            await fs.unlink(pageImagePath);
          } catch (cleanupError) {
            this.logger.warn(`Failed to clean up page image ${pageImagePath}:`, cleanupError);
          }
        }
      }

      return results;
    } catch (error) {
      this.logger.error('PDF OCR extraction failed:', error);
      throw new Error(`PDF OCR extraction failed: ${error.message}`);
    }
  }

  async extractTextFromMultiPageDocument(
    documentPath: string,
    documentType: string,
    options: OcrOptions = {}
  ): Promise<OcrResult[]> {
    switch (documentType.toLowerCase()) {
      case 'pdf':
        return this.extractTextFromPdf(documentPath, options);
      
      case 'tiff':
      case 'tif':
        return this.extractTextFromMultiPageImage(documentPath, options);
      
      default:
        // Single page document
        const result = await this.extractTextFromImage(documentPath, options);
        return [result];
    }
  }

  async detectLanguage(text: string): Promise<Language> {
    const franc = require('franc');
    const isoCode = franc(text);
    
    const languageMap: Record<string, Language> = {
      'eng': Language.EN,
      'spa': Language.ES,
      'fra': Language.FR,
      'deu': Language.DE,
      'ita': Language.IT,
      'por': Language.PT,
      'rus': Language.RU,
      'jpn': Language.JA,
      'kor': Language.KO,
      'cmn': Language.ZH,
      'ara': Language.AR,
    };

    return languageMap[isoCode] || Language.UNKNOWN;
  }

  async enhanceImageQuality(imagePath: string): Promise<string> {
    const outputPath = imagePath.replace(/(\.[^.]+)$/, '_enhanced$1');
    
    try {
      await sharp(imagePath)
        .resize(null, 2000, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .sharpen({
          sigma: 1,
          flat: 1,
          jagged: 2,
        })
        .normalize()
        .threshold(128)
        .toFile(outputPath);
      
      return outputPath;
    } catch (error) {
      this.logger.error('Image enhancement failed:', error);
      return imagePath;
    }
  }

  async preprocessImage(imagePath: string, options: OcrOptions): Promise<string> {
    const outputPath = imagePath.replace(/(\.[^.]+)$/, '_preprocessed$1');
    
    try {
      let pipeline = sharp(imagePath);

      // Convert to grayscale
      pipeline = pipeline.greyscale();

      // Enhance contrast
      if (options.enhanceImage) {
        pipeline = pipeline.normalize();
      }

      // Remove noise
      pipeline = pipeline.median(3);

      // Threshold for better OCR
      pipeline = pipeline.threshold(128);

      // Resize for optimal OCR
      pipeline = pipeline.resize(null, 2000, { 
        withoutEnlargement: true,
        fit: 'inside'
      });

      await pipeline.toFile(outputPath);
      
      return outputPath;
    } catch (error) {
      this.logger.error('Image preprocessing failed:', error);
      return imagePath;
    }
  }

  private async getWorker(): Promise<Worker> {
    return new Promise((resolve, reject) => {
      // Find available worker
      for (const [id, worker] of this.workers.entries()) {
        if (worker && !this.isWorkerBusy(id)) {
          this.markWorkerBusy(id);
          resolve(worker);
          return;
        }
      }

      // Add to queue if no workers available
      this.workerQueue.push({
        id: `queue-${Date.now()}`,
        resolve,
        reject,
      });
    });
  }

  private releaseWorker(worker: Worker): Promise<void> {
    // Find worker ID and mark as available
    for (const [id, w] of this.workers.entries()) {
      if (w === worker) {
        this.markWorkerAvailable(id);
        
        // Process queue
        if (this.workerQueue.length > 0) {
          const next = this.workerQueue.shift();
          if (next) {
            this.markWorkerBusy(id);
            next.resolve(worker);
          }
        }
        break;
      }
    }
    
    return Promise.resolve();
  }

  private isWorkerBusy(workerId: string): boolean {
    // Simple implementation - in production, use proper tracking
    return false;
  }

  private markWorkerBusy(workerId: string): void {
    // Mark worker as busy
  }

  private markWorkerAvailable(workerId: string): void {
    // Mark worker as available
  }

  private mapLanguagesToTesseract(languages: Language[]): string[] {
    const languageMap: Record<Language, string> = {
      [Language.EN]: 'eng',
      [Language.ES]: 'spa',
      [Language.FR]: 'fra',
      [Language.DE]: 'deu',
      [Language.IT]: 'ita',
      [Language.PT]: 'por',
      [Language.RU]: 'rus',
      [Language.JA]: 'jpn',
      [Language.KO]: 'kor',
      [Language.ZH]: 'chi_sim',
      [Language.AR]: 'ara',
      [Language.UNKNOWN]: 'eng',
    };

    return languages.map(lang => languageMap[lang] || 'eng');
  }

  private detectLanguageFromConfidence(data: any): string {
    // Tesseract doesn't provide reliable language detection
    // This is a placeholder - in production, use a separate language detection library
    return 'eng';
  }

  private async extractTables(imagePath: string, text: string): Promise<string> {
    // Simplified table detection - in production, use specialized table extraction
    // This is a placeholder implementation
    const lines = text.split('\n');
    const tableLines: string[] = [];
    
    for (const line of lines) {
      // Simple heuristic for table rows (multiple tabs or spaces)
      if (line.includes('\t') || line.split(/\s{3,}/).length > 2) {
        tableLines.push(line);
      }
    }
    
    if (tableLines.length > 0) {
      return text + '\n\n[TABLE DETECTED]\n' + tableLines.join('\n');
    }
    
    return text;
  }

  private async extractTextFromMultiPageImage(
    imagePath: string,
    options: OcrOptions
  ): Promise<OcrResult[]> {
    const sharp = require('sharp');
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const metadata = await sharp(imagePath).metadata();
      const results: OcrResult[] = [];
      
      if (metadata.pages && metadata.pages > 1) {
        // Process each page
        for (let i = 0; i < metadata.pages; i++) {
          const pageImagePath = imagePath.replace(/(\.[^.]+)$/, `_page_${i}$1`);
          
          try {
            await sharp(imagePath, { page: i }).toFile(pageImagePath);
            const pageResult = await this.extractTextFromImage(pageImagePath, options);
            results.push(pageResult);
          } catch (error) {
            this.logger.warn(`Failed to extract text from page ${i + 1}:`, error);
          } finally {
            // Clean up temporary page image
            try {
              await fs.unlink(pageImagePath);
            } catch (cleanupError) {
              this.logger.warn(`Failed to clean up page image ${pageImagePath}:`, cleanupError);
            }
          }
        }
      } else {
        // Single page image
        const result = await this.extractTextFromImage(imagePath, options);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      this.logger.error('Multi-page image OCR extraction failed:', error);
      throw new Error(`Multi-page image OCR extraction failed: ${error.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Terminate all workers
    for (const [id, worker] of this.workers.entries()) {
      try {
        await worker.terminate();
        this.logger.log(`OCR worker ${id} terminated`);
      } catch (error) {
        this.logger.error(`Failed to terminate OCR worker ${id}:`, error);
      }
    }
    this.workers.clear();
  }
}
