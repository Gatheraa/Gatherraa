import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentProcessingJob, ProcessingStatus, DocumentType, DocumentCategory } from '../entities/document.entity';
import { OcrService } from './ocr.service';
import { DocumentParserService } from './document-parser.service';
import { DocumentClassificationService } from './document-classification.service';
import { ContentExtractionService } from './content-extraction.service';
import { SimilarityDetectionService } from './similarity-detection.service';
import { TranslationService } from './translation.service';
import { ComplianceService } from './compliance.service';

export interface DocumentProcessingOptions {
  enableOcr?: boolean;
  enableParsing?: boolean;
  enableClassification?: boolean;
  enableContentExtraction?: boolean;
  enableSimilarityDetection?: boolean;
  enableTranslation?: boolean;
  enableComplianceCheck?: boolean;
  targetLanguages?: string[];
  ocrOptions?: any;
  classificationOptions?: any;
  extractionOptions?: any;
  similarityOptions?: any;
  translationOptions?: any;
  complianceOptions?: any;
}

export interface ProcessingResult {
  documentId: string;
  status: ProcessingStatus;
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    error?: string;
    details?: any;
  }>;
  summary: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalProcessingTime: number;
  success: boolean;
  };
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentProcessingJob)
    private readonly processingJobRepository: Repository<DocumentProcessingJob>,
    private readonly ocrService: OcrService,
    private readonly parserService: DocumentParserService,
    private readonly classificationService: DocumentClassificationService,
    private readonly contentExtractionService: ContentExtractionService,
    private readonly similarityService: SimilarityDetectionService,
    private readonly translationService: TranslationService,
    private readonly complianceService: ComplianceService,
    private readonly configService: ConfigService,
  ) {}

  async processDocument(
    documentId: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update document status to processing
      await this.documentRepository.update(documentId, {
        status: ProcessingStatus.PARSING,
        processingStatus: ProcessingStatus.PENDING,
      });

      // Create processing job
      const job = await this.createProcessingJob(documentId, 'full_processing');

      const steps: ProcessingResult['steps'] = [];
      let totalProcessingTime = 0;
      let hasFailures = false;

      // Step 1: OCR (if image or PDF)
      if (options.enableOcr !== false && this.requiresOcr(document)) {
        const ocrStep = await this.processOcrStep(document, options, job.id);
        steps.push(ocrStep);
        if (ocrStep.status === 'failed') hasFailures = true;
      }

      // Step 2: Document Parsing
      if (options.enableParsing !== false) {
        const parseStep = await this.processParsingStep(document, options, job.id);
        steps.push(parseStep);
        if (parseStep.status === 'failed') hasFailures = true;
      }

      // Step 3: Classification
      if (options.enableClassification !== false) {
        const classifyStep = await this.processClassificationStep(document, options, job.id);
        steps.push(classifyStep);
        if (classifyStep.status === 'failed') hasFailures = true;
      }

      // Step 4: Content Extraction
      if (options.enableContentExtraction !== false) {
        const extractStep = await this.processExtractionStep(document, options, job.id);
        steps.push(extractStep);
        if (extractStep.status === 'failed') hasFailures = true;
      }

      // Step 5: Similarity Detection
      if (options.enableSimilarityDetection !== false) {
        const similarityStep = await this.processSimilarityStep(document, options, job.id);
        steps.push(similarityStep);
        if (similarityStep.status === 'failed') hasFailures = true;
      }

      // Step 6: Translation
      if (options.enableTranslation !== false && options.targetLanguages && options.targetLanguages.length > 0) {
        const translationStep = await this.processTranslationStep(document, options, job.id);
        steps.push(translationStep);
        if (translationStep.status === 'failed') hasFailures = true;
      }

      // Step 7: Compliance Check
      if (options.enableComplianceCheck !== false) {
        const complianceStep = await this.processComplianceStep(document, options, job.id);
        steps.push(complianceStep);
        if (complianceStep.status === 'failed') hasFailures = true;
      }

      totalProcessingTime = Date.now() - startTime;

      // Update final document status
      const finalStatus = hasFailures ? ProcessingStatus.FAILED : ProcessingStatus.COMPLETED;
      await this.documentRepository.update(documentId, {
        status: finalStatus,
        processingStatus: finalStatus,
      });

      // Update job status
      await this.updateProcessingJob(job.id, {
        status: finalStatus,
        completedAt: new Date(),
        result: {
          steps,
          summary: {
            totalSteps: steps.length,
            completedSteps: steps.filter(s => s.status === 'completed').length,
            failedSteps: steps.filter(s => s.status === 'failed').length,
            totalProcessingTime,
            success: !hasFailures,
          },
        },
      });

      const result: ProcessingResult = {
        documentId,
        status: finalStatus,
        steps,
        summary: {
          totalSteps: steps.length,
          completedSteps: steps.filter(s => s.status === 'completed').length,
          failedSteps: steps.filter(s => s.status === 'failed').length,
          totalProcessingTime,
          success: !hasFailures,
        },
      };

      this.logger.log(`Document processing completed for ${documentId}: ${finalStatus}`);
      return result;

    } catch (error) {
      this.logger.error(`Document processing failed for ${documentId}:`, error);
      
      // Update document status to failed
      await this.documentRepository.update(documentId, {
        status: ProcessingStatus.FAILED,
        processingStatus: ProcessingStatus.FAILED,
      });

      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  async processDocumentUpload(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    options: DocumentProcessingOptions = {}
  ): Promise<Document> {
    try {
      // Detect document type
      const documentType = await this.parserService.detectDocumentType(originalName);
      
      // Generate file hash
      const crypto = require('crypto');
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Create document record
      const document = this.documentRepository.create({
        userId,
        originalName,
        fileName: `${Date.now()}-${originalName}`,
        filePath: `/uploads/${userId}/${Date.now()}-${originalName}`,
        fileHash,
        fileSize: fileBuffer.length,
        documentType,
        mimeType: this.getMimeType(originalName),
        status: ProcessingStatus.UPLOADING,
        processingStatus: ProcessingStatus.PENDING,
        uploadedFrom: 'api',
        uploadMetadata: {
          ipAddress: '127.0.0.1', // Would be extracted from request
          userAgent: 'DocumentService',
          source: 'api',
        },
      });

      const savedDocument = await this.documentRepository.save(document);

      // Start async processing
      this.processDocument(savedDocument.id, options).catch(error => {
        this.logger.error(`Async processing failed for document ${savedDocument.id}:`, error);
      });

      this.logger.log(`Document uploaded and processing started: ${savedDocument.id}`);
      return savedDocument;

    } catch (error) {
      this.logger.error('Document upload failed:', error);
      throw new Error(`Document upload failed: ${error.message}`);
    }
  }

  async getDocumentProcessingStatus(documentId: string): Promise<ProcessingResult> {
    const job = await this.processingJobRepository.findOne({
      where: { documentId },
      order: { createdAt: 'DESC' },
      relations: ['document'],
    });

    if (!job) {
      throw new Error(`Processing job not found for document: ${documentId}`);
    }

    const steps = job.result?.steps || [];
    const summary = job.result?.summary || {
      totalSteps: steps.length,
      completedSteps: steps.filter(s => s.status === 'completed').length,
      failedSteps: steps.filter(s => s.status === 'failed').length,
      totalProcessingTime: 0,
      success: job.status === ProcessingStatus.COMPLETED,
    };

    return {
      documentId,
      status: job.status,
      steps,
      summary,
    };
  }

  async retryFailedProcessing(documentId: string): Promise<ProcessingResult> {
    const job = await this.processingJobRepository.findOne({
      where: { documentId, status: ProcessingStatus.FAILED },
      order: { createdAt: 'DESC' },
    });

    if (!job) {
      throw new Error(`No failed processing job found for document: ${documentId}`);
    }

    // Check retry count
    if (job.retryCount >= job.maxRetries) {
      throw new Error(`Maximum retries exceeded for document: ${documentId}`);
    }

    // Update job for retry
    await this.updateProcessingJob(job.id, {
      status: ProcessingStatus.PENDING,
      retryCount: job.retryCount + 1,
      scheduledAt: new Date(),
    });

    // Start processing again
    return this.processDocument(documentId, job.parameters);
  }

  async getProcessingQueue(): Promise<{
    pending: DocumentProcessingJob[];
    processing: DocumentProcessingJob[];
    failed: DocumentProcessingJob[];
  }> {
    const [pending, processing, failed] = await Promise.all([
      this.processingJobRepository.find({
        where: { status: ProcessingStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 50,
      }),
      this.processingJobRepository.find({
        where: { status: ProcessingStatus.PARSING },
        order: { createdAt: 'ASC' },
        take: 50,
      }),
      this.processingJobRepository.find({
        where: { status: ProcessingStatus.FAILED },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    ]);

    return { pending, processing, failed };
  }

  async cancelProcessing(documentId: string): Promise<void> {
    const job = await this.processingJobRepository.findOne({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });

    if (!job) {
      throw new Error(`Processing job not found for document: ${documentId}`);
    }

    // Update job status to cancelled
    await this.updateProcessingJob(job.id, {
      status: ProcessingStatus.FAILED,
      completedAt: new Date(),
      result: {
        error: 'Processing cancelled by user',
      },
    });

    // Update document status
    await this.documentRepository.update(documentId, {
      status: ProcessingStatus.FAILED,
      processingStatus: ProcessingStatus.FAILED,
    });

    this.logger.log(`Processing cancelled for document: ${documentId}`);
  }

  async getProcessingStatistics(): Promise<{
    totalDocuments: number;
    processingStatuses: Record<ProcessingStatus, number>;
    averageProcessingTime: number;
    successRate: number;
    queueLength: number;
  }> {
    const [totalDocuments, processingStats] = await Promise.all([
      this.documentRepository.count(),
      this.documentRepository
        .createQueryBuilder('document')
        .select('processingStatus')
        .addSelect('COUNT(*)', 'count')
        .groupBy('processingStatus')
        .getRawMany(),
    ]);

    const statusCounts: Record<ProcessingStatus, number> = {} as any;
    let totalProcessingTime = 0;
    let processingCount = 0;

    for (const stat of processingStats) {
      const status = stat.processingStatus as ProcessingStatus;
      statusCounts[status] = parseInt(stat.count);
    }

    // Calculate average processing time (would need to track this properly)
    const successCount = statusCounts[ProcessingStatus.COMPLETED] || 0;
    const failedCount = statusCounts[ProcessingStatus.FAILED] || 0;
    const successRate = (successCount + failedCount) > 0 ? successCount / (successCount + failedCount) : 0;

    const queueLength = await this.processingJobRepository.count({
      where: { status: ProcessingStatus.PENDING },
    });

    return {
      totalDocuments,
      processingStatuses: statusCounts,
      averageProcessingTime,
      successRate,
      queueLength,
    };
  }

  private requiresOcr(document: Document): boolean {
    return [
      DocumentType.IMAGE,
      DocumentType.PDF,
      DocumentType.DOC,
      DocumentType.DOCX,
    ].includes(document.documentType);
  }

  private async processOcrStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      await this.updateProcessingJob(jobId, {
        status: ProcessingStatus.PARSING,
        startedAt: new Date(),
      });

      let ocrResult;
      if (document.documentType === DocumentType.IMAGE) {
        ocrResult = await this.ocrService.extractTextFromImage(
          document.filePath,
          options.ocrOptions
        );
      } else if (document.documentType === DocumentType.PDF) {
        const ocrResults = await this.ocrService.extractTextFromPdf(
          document.filePath,
          options.ocrOptions
        );
        ocrResult = {
          text: ocrResults.map(r => r.text).join('\n'),
          confidence: ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length,
          processingTime: ocrResults.reduce((sum, r) => sum + r.processingTime, 0),
        };
      } else {
        ocrResult = { text: '', confidence: 0, processingTime: 0 };
      }

      // Update document with OCR results
      await this.documentRepository.update(document.id, {
        extractedText: ocrResult.text,
        processingMetrics: {
          ...document.processingMetrics,
          ocrProcessingTime: ocrResult.processingTime,
        },
      });

      return {
        name: 'OCR',
        status: 'completed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: ocrResult,
      };

    } catch (error) {
      return {
        name: 'OCR',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processParsingStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      const parseResult = await this.parserService.parseDocument(
        document.filePath,
        document.documentType,
        {
          extractMetadata: true,
          extractStructure: true,
          extractTables: true,
        }
      );

      // Update document with parsing results
      await this.documentRepository.update(document.id, {
        extractedMetadata: parseResult.metadata,
        processingMetrics: {
          ...document.processingMetrics,
          parsingTime: Date.now() - startTime,
        },
      });

      return {
        name: 'Parsing',
        status: 'completed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: parseResult,
      };

    } catch (error) {
      return {
        name: 'Parsing',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processClassificationStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      const classificationResult = await this.classificationService.classifyDocument(
        document.id,
        document.extractedText || '',
        options.classificationOptions
      );

      // Update document with classification results
      await this.documentRepository.update(document.id, {
        category: classificationResult.category,
        tags: classificationResult.tags.map(t => t.name),
        processingMetrics: {
          ...document.processingMetrics,
          classificationTime: Date.now() - startTime,
        },
      });

      return {
        name: 'Classification',
        status: 'completed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: classificationResult,
      };

    } catch (error) {
      return {
        name: 'Classification',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processExtractionStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      const extractionResult = await this.contentExtractionService.extractContent(
        document.id,
        document.extractedText || '',
        options.extractionOptions
      );

      // Update document with extraction results
      await this.documentRepository.update(document.id, {
        keyInformation: {
          entities: extractionResult.entities,
          keywords: extractionResult.keywords,
          sentiment: extractionResult.sentiment,
          topics: extractionResult.topics,
        },
        summary: extractionResult.summary.medium,
        processingMetrics: {
          ...document.processingMetrics,
          extractionTime: Date.now() - startTime,
        },
      });

      return {
        name: 'Content Extraction',
        status: 'completed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: extractionResult,
      };

    } catch (error) {
      return {
        name: 'Content Extraction',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processSimilarityStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      const similarityResults = await this.similarityService.findSimilarDocuments(
        document.id,
        options.similarityOptions
      );

      // Update document with similarity results
      await this.documentRepository.update(document.id, {
        similarityData: {
          documentHashes: [
            { algorithm: 'sha256', hash: document.fileHash },
          ],
          similarDocuments: similarityResults.map(r => ({
            documentId: r.documentId,
            similarity: r.similarity,
            algorithm: r.algorithm,
          })),
          isDuplicate: similarityResults.some(r => r.isDuplicate),
          duplicateOf: similarityResults.find(r => r.isDuplicate)?.documentId,
        },
        processingMetrics: {
          ...document.processingMetrics,
          similarityTime: Date.now() - startTime,
        },
      });

      return {
        name: 'Similarity Detection',
        status: 'completed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: similarityResults,
      };

    } catch (error) {
      return {
        name: 'Similarity Detection',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processTranslationStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      const translationResults = await this.translationService.translateDocumentToMultipleLanguages(
        document.id,
        options.targetLanguages?.map(lang => this.mapLanguageToEnum(lang)) || []
      );

      // Update document with translation results
      await this.documentRepository.update(document.id, {
        translationData: {
          originalLanguage: translationResults[0]?.sourceLanguage || 'unknown',
          availableTranslations: translationResults.map(r => ({
            language: r.targetLanguage,
            translatedText: r.translatedText,
            translatedAt: new Date(),
            translatedBy: r.provider,
          })),
        },
        processingMetrics: {
          ...document.processingMetrics,
          translationTime: Date.now() - startTime,
        },
      });

      return {
        name: 'Translation',
        status: 'completed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: translationResults,
      };

    } catch (error) {
      return {
        name: 'Translation',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processComplianceStep(
    document: Document,
    options: DocumentProcessingOptions,
    jobId: string
  ): Promise<ProcessingResult['steps'][0]> {
    const startTime = Date.now();
    
    try {
      const complianceReport = await this.complianceService.checkDocumentCompliance(
        document.id,
        options.complianceOptions
      );

      return {
        name: 'Compliance Check',
        status: complianceReport.overallStatus === 'compliant' ? 'completed' : 'warning',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        details: complianceReport,
      };

    } catch (error) {
      return {
        name: 'Compliance Check',
        status: 'failed',
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async createProcessingJob(
    documentId: string,
    jobType: string
  ): Promise<DocumentProcessingJob> {
    const job = this.processingJobRepository.create({
      documentId,
      jobType,
      status: ProcessingStatus.PENDING,
      maxRetries: 3,
      parameters: {},
    });

    return this.processingJobRepository.save(job);
  }

  private async updateProcessingJob(
    jobId: string,
    updates: Partial<DocumentProcessingJob>
  ): Promise<void> {
    await this.processingJobRepository.update(jobId, updates);
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private mapLanguageToEnum(lang: string): any {
    const languageMap: Record<string, any> = {
      'en': 'EN',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT',
      'ru': 'RU',
      'ja': 'JA',
      'ko': 'KO',
      'zh': 'ZH',
      'ar': 'AR',
    };

    return languageMap[lang.toLowerCase()] || 'UNKNOWN';
  }

  async cleanupExpiredJobs(): Promise<void> {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 7); // 7 days old

    const result = await this.processingJobRepository.delete({
      createdAt: LessThan(expiredDate),
      status: ProcessingStatus.FAILED,
    });

    this.logger.log(`Cleaned up ${result.affected} expired processing jobs`);
  }
}
