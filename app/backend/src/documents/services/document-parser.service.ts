import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import * as csv from 'csv-parser';
import { createReadStream } from 'fs';
import { DocumentType, DocumentCategory } from '../entities/document.entity';

export interface ParsedContent {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creationDate?: Date;
    modificationDate?: Date;
    pageCount?: number;
    wordCount?: number;
    characterCount?: number;
    tables?: Array<{
      title: string;
      rows: number;
      columns: number;
      data: any[][];
    }>;
    images?: Array<{
      index: number;
      width: number;
      height: number;
      format: string;
      size: number;
    }>;
    links?: Array<{
      text: string;
      url: string;
      type: 'internal' | 'external';
    }>;
    annotations?: Array<{
      type: string;
      content: string;
      page?: number;
      coordinates?: { x: number; y: number; width: number; height: number };
    }>;
    customProperties?: Record<string, any>;
  };
  structure?: {
    headings?: Array<{
      level: number;
      text: string;
      page?: number;
    }>;
    paragraphs?: Array<{
      text: string;
      page?: number;
    }>;
    lists?: Array<{
      type: 'ordered' | 'unordered';
      items: string[];
      page?: number;
    }>;
  };
  tables?: Array<{
    name: string;
    headers: string[];
    rows: any[][];
    page?: number;
  }>;
}

export interface ParseOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractMetadata?: boolean;
  extractStructure?: boolean;
  preserveFormatting?: boolean;
  maxFileSize?: number;
  timeout?: number;
}

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);
  private readonly supportedTypes = new Set([
    DocumentType.PDF,
    DocumentType.DOCX,
    DocumentType.DOC,
    DocumentType.XLSX,
    DocumentType.XLS,
    DocumentType.CSV,
    DocumentType.TXT,
    DocumentType.JSON,
    DocumentType.XML,
    DocumentType.HTML,
  ]);

  constructor(private readonly configService: ConfigService) {}

  async parseDocument(
    filePath: string,
    documentType: DocumentType,
    options: ParseOptions = {}
  ): Promise<ParsedContent> {
    const startTime = Date.now();
    
    try {
      if (!this.supportedTypes.has(documentType)) {
        throw new Error(`Unsupported document type: ${documentType}`);
      }

      let result: ParsedContent;

      switch (documentType) {
        case DocumentType.PDF:
          result = await this.parsePdf(filePath, options);
          break;
        case DocumentType.DOCX:
          result = await this.parseDocx(filePath, options);
          break;
        case DocumentType.DOC:
          result = await this.parseDoc(filePath, options);
          break;
        case DocumentType.XLSX:
        case DocumentType.XLS:
          result = await this.parseExcel(filePath, options);
          break;
        case DocumentType.CSV:
          result = await this.parseCsv(filePath, options);
          break;
        case DocumentType.TXT:
          result = await this.parseText(filePath, options);
          break;
        case DocumentType.JSON:
          result = await this.parseJson(filePath, options);
          break;
        case DocumentType.XML:
          result = await this.parseXml(filePath, options);
          break;
        case DocumentType.HTML:
          result = await this.parseHtml(filePath, options);
          break;
        default:
          throw new Error(`Parser not implemented for type: ${documentType}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Document parsed in ${processingTime}ms: ${documentType}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse document ${filePath}:`, error);
      throw new Error(`Document parsing failed: ${error.message}`);
    }
  }

  async parsePdf(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    
    try {
      const pdfData = await pdfParse(buffer, {
        // Custom options for better parsing
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      const result: ParsedContent = {
        text: pdfData.text,
        metadata: {
          title: pdfData.info?.Title,
          author: pdfData.info?.Author,
          subject: pdfData.info?.Subject,
          keywords: pdfData.info?.Keywords?.split(',').map(k => k.trim()).filter(k => k),
          creationDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined,
          modificationDate: pdfData.info?.ModDate ? new Date(pdfData.info.ModDate) : undefined,
          pageCount: pdfData.numpages,
          wordCount: this.countWords(pdfData.text),
          characterCount: pdfData.text.length,
        },
      };

      // Extract tables if requested
      if (options.extractTables) {
        result.tables = await this.extractPdfTables(buffer);
      }

      // Extract structure if requested
      if (options.extractStructure) {
        result.structure = this.extractPdfStructure(pdfData.text);
      }

      return result;
    } catch (error) {
      this.logger.error('PDF parsing failed:', error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  async parseDocx(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    
    try {
      const result = await mammoth.extractRawText({ buffer });
      const htmlResult = options.preserveFormatting 
        ? await mammoth.convertToHtml({ buffer })
        : null;

      const parsedContent: ParsedContent = {
        text: result.value,
        metadata: {
          wordCount: this.countWords(result.value),
          characterCount: result.value.length,
        },
      };

      // Extract structure from HTML if available
      if (htmlResult && options.extractStructure) {
        parsedContent.structure = this.extractHtmlStructure(htmlResult.value);
      }

      // Extract tables if requested
      if (options.extractTables) {
        const tablesResult = await mammoth.extractTables({ buffer });
        parsedContent.tables = tablesResult.value.map((table, index) => ({
          name: `Table ${index + 1}`,
          headers: table[0] || [],
          rows: table.slice(1),
        }));
      }

      return parsedContent;
    } catch (error) {
      this.logger.error('DOCX parsing failed:', error);
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  async parseDoc(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    // For legacy .doc files, we would need antiword or similar
    // For now, we'll return a basic text extraction
    const fs = require('fs').promises;
    
    try {
      // This is a placeholder - in production, use proper .doc parsing library
      const buffer = await fs.readFile(filePath);
      const text = buffer.toString('latin1'); // Basic extraction
      
      return {
        text,
        metadata: {
          wordCount: this.countWords(text),
          characterCount: text.length,
        },
      };
    } catch (error) {
      this.logger.error('DOC parsing failed:', error);
      throw new Error(`DOC parsing failed: ${error.message}`);
    }
  }

  async parseExcel(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheets: string[] = workbook.SheetNames;
      let allText = '';
      const tables: ParsedContent['tables'] = [];

      for (const sheetName of sheets) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          // Convert to text
          const sheetText = jsonData
            .map((row: any) => Array.isArray(row) ? row.join('\t') : String(row))
            .join('\n');
          
          allText += `Sheet: ${sheetName}\n${sheetText}\n\n`;

          // Add as table
          if (options.extractTables && jsonData.length > 1) {
            tables.push({
              name: sheetName,
              headers: jsonData[0] || [],
              rows: jsonData.slice(1),
            });
          }
        }
      }

      return {
        text: allText.trim(),
        metadata: {
          wordCount: this.countWords(allText),
          characterCount: allText.length,
        },
        tables: options.extractTables ? tables : undefined,
      };
    } catch (error) {
      this.logger.error('Excel parsing failed:', error);
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  async parseCsv(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const headers: string[] = [];
      let isFirstRow = true;

      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          if (isFirstRow) {
            headers.push(...Object.keys(data));
            isFirstRow = false;
          }
          results.push(Object.values(data));
        })
        .on('end', () => {
          const text = results
            .map(row => Array.isArray(row) ? row.join('\t') : String(row))
            .join('\n');

          const parsedContent: ParsedContent = {
            text,
            metadata: {
              wordCount: this.countWords(text),
              characterCount: text.length,
            },
          };

          if (options.extractTables && results.length > 0) {
            parsedContent.tables = [{
              name: 'CSV Data',
              headers,
              rows: results,
            }];
          }

          resolve(parsedContent);
        })
        .on('error', (error) => {
          this.logger.error('CSV parsing failed:', error);
          reject(new Error(`CSV parsing failed: ${error.message}`));
        });
    });
  }

  async parseText(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    const fs = require('fs').promises;
    
    try {
      const text = await fs.readFile(filePath, 'utf8');
      
      const result: ParsedContent = {
        text,
        metadata: {
          wordCount: this.countWords(text),
          characterCount: text.length,
        },
      };

      // Extract basic structure
      if (options.extractStructure) {
        result.structure = this.extractTextStructure(text);
      }

      return result;
    } catch (error) {
      this.logger.error('Text parsing failed:', error);
      throw new Error(`Text parsing failed: ${error.message}`);
    }
  }

  async parseJson(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    const fs = require('fs').promises;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const jsonData = JSON.parse(content);
      
      const text = JSON.stringify(jsonData, null, 2);
      
      return {
        text,
        metadata: {
          wordCount: this.countWords(text),
          characterCount: text.length,
          customProperties: {
            dataType: Array.isArray(jsonData) ? 'array' : typeof jsonData,
            keys: typeof jsonData === 'object' && jsonData !== null ? Object.keys(jsonData) : [],
          },
        },
      };
    } catch (error) {
      this.logger.error('JSON parsing failed:', error);
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  async parseXml(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    const fs = require('fs').promises;
    const xml2js = require('xml2js');
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      const result = await xml2js.parseStringPromise(content, {
        explicitArray: true,
        ignoreAttrs: false,
        mergeAttrs: true,
      });
      
      const text = JSON.stringify(result, null, 2);
      
      return {
        text,
        metadata: {
          wordCount: this.countWords(text),
          characterCount: text.length,
          customProperties: {
            rootElements: Object.keys(result),
          },
        },
      };
    } catch (error) {
      this.logger.error('XML parsing failed:', error);
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  async parseHtml(filePath: string, options: ParseOptions = {}): Promise<ParsedContent> {
    const fs = require('fs').promises;
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const dom = new JSDOM(content);
      const document = dom.window.document;
      
      // Extract text content
      const text = document.body?.textContent || '';
      
      const result: ParsedContent = {
        text,
        metadata: {
          title: document.title,
          wordCount: this.countWords(text),
          characterCount: text.length,
        },
      };

      // Extract structure
      if (options.extractStructure) {
        result.structure = this.extractHtmlStructure(content);
      }

      // Extract links
      const links: Array<{ text: string; url: string; type: 'internal' | 'external' }> = [];
      const linkElements = document.querySelectorAll('a[href]');
      linkElements.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          links.push({
            text: link.textContent || '',
            url: href,
            type: href.startsWith('http') ? 'external' : 'internal',
          });
        }
      });

      if (links.length > 0) {
        result.metadata.links = links;
      }

      // Extract images
      if (options.extractImages) {
        const images: Array<{ index: number; width: number; height: number; format: string; size: number }> = [];
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach((img, index) => {
          images.push({
            index,
            width: parseInt(img.getAttribute('width') || '0'),
            height: parseInt(img.getAttribute('height') || '0'),
            format: img.getAttribute('src')?.split('.').pop() || 'unknown',
            size: 0, // Would need additional request to get actual size
          });
        });

        if (images.length > 0) {
          result.metadata.images = images;
        }
      }

      return result;
    } catch (error) {
      this.logger.error('HTML parsing failed:', error);
      throw new Error(`HTML parsing failed: ${error.message}`);
    }
  }

  async detectDocumentType(filePath: string): Promise<DocumentType> {
    const path = require('path');
    const fileType = require('file-type');
    const fs = require('fs').promises;
    
    try {
      // First try by file extension
      const ext = path.extname(filePath).toLowerCase();
      const extMap: Record<string, DocumentType> = {
        '.pdf': DocumentType.PDF,
        '.docx': DocumentType.DOCX,
        '.doc': DocumentType.DOC,
        '.xlsx': DocumentType.XLSX,
        '.xls': DocumentType.XLS,
        '.csv': DocumentType.CSV,
        '.txt': DocumentType.TXT,
        '.json': DocumentType.JSON,
        '.xml': DocumentType.XML,
        '.html': DocumentType.HTML,
        '.htm': DocumentType.HTML,
        '.png': DocumentType.IMAGE,
        '.jpg': DocumentType.IMAGE,
        '.jpeg': DocumentType.IMAGE,
        '.gif': DocumentType.IMAGE,
        '.bmp': DocumentType.IMAGE,
        '.tiff': DocumentType.IMAGE,
        '.tif': DocumentType.IMAGE,
      };

      if (extMap[ext]) {
        return extMap[ext];
      }

      // Try by file signature
      const buffer = await fs.readFile(filePath);
      const type = await fileType.fromBuffer(buffer);
      
      if (type) {
        const mimeMap: Record<string, DocumentType> = {
          'application/pdf': DocumentType.PDF,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentType.DOCX,
          'application/msword': DocumentType.DOC,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocumentType.XLSX,
          'application/vnd.ms-excel': DocumentType.XLS,
          'text/csv': DocumentType.CSV,
          'text/plain': DocumentType.TXT,
          'application/json': DocumentType.JSON,
          'application/xml': DocumentType.XML,
          'text/html': DocumentType.HTML,
          'image/png': DocumentType.IMAGE,
          'image/jpeg': DocumentType.IMAGE,
          'image/gif': DocumentType.IMAGE,
          'image/bmp': DocumentType.IMAGE,
          'image/tiff': DocumentType.IMAGE,
        };

        return mimeMap[type.mime] || DocumentType.UNKNOWN;
      }

      return DocumentType.UNKNOWN;
    } catch (error) {
      this.logger.error('Document type detection failed:', error);
      return DocumentType.UNKNOWN;
    }
  }

  async categorizeDocument(content: ParsedContent, documentType: DocumentType): Promise<DocumentCategory> {
    const text = content.text.toLowerCase();
    const title = content.metadata.title?.toLowerCase() || '';
    
    // Simple keyword-based categorization
    const categoryKeywords: Record<DocumentCategory, string[]> = {
      [DocumentCategory.CONTRACT]: ['contract', 'agreement', 'terms', 'conditions', 'clause', 'party', 'signature'],
      [DocumentCategory.INVOICE]: ['invoice', 'bill', 'payment', 'due', 'amount', 'total', 'tax', 'customer'],
      [DocumentCategory.RECEIPT]: ['receipt', 'proof of purchase', 'transaction', 'paid', 'cash', 'credit card'],
      [DocumentCategory.ID_DOCUMENT]: ['passport', 'driver license', 'identification', 'id card', 'birth certificate'],
      [DocumentCategory.FINANCIAL_STATEMENT]: ['balance sheet', 'income statement', 'cash flow', 'financial', 'revenue', 'expenses'],
      [DocumentCategory.LEGAL_DOCUMENT]: ['legal', 'court', 'lawsuit', 'attorney', 'judge', 'verdict', 'ruling'],
      [DocumentCategory.REPORT]: ['report', 'analysis', 'findings', 'conclusion', 'recommendation', 'summary'],
      [DocumentCategory.PRESENTATION]: ['slide', 'presentation', 'powerpoint', 'deck', 'presenter'],
      [DocumentCategory.SPREADSHEET]: ['spreadsheet', 'excel', 'sheet', 'row', 'column', 'formula'],
      [DocumentCategory.EMAIL]: ['email', 'message', 'from:', 'to:', 'subject:', 'sent:', 'received:'],
      [DocumentCategory.IMAGE]: ['image', 'photo', 'picture', 'jpg', 'png', 'gif'],
      [DocumentCategory.OTHER]: [],
    };

    // Calculate scores for each category
    const scores: Record<DocumentCategory, number> = {} as any;
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      
      for (const keyword of keywords) {
        if (text.includes(keyword)) score += 1;
        if (title.includes(keyword)) score += 2; // Title matches are weighted higher
      }
      
      scores[category as DocumentCategory] = score;
    }

    // Find category with highest score
    let bestCategory = DocumentCategory.OTHER;
    let bestScore = 0;
    
    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as DocumentCategory;
      }
    }

    return bestCategory;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private async extractPdfTables(buffer: Buffer): Promise<ParsedContent['tables']> {
    // This is a simplified implementation
    // In production, use specialized PDF table extraction libraries
    const tables: ParsedContent['tables'] = [];
    
    // Look for table-like structures in the text
    const lines = buffer.toString().split('\n');
    const tableLines: string[] = [];
    
    for (const line of lines) {
      // Simple heuristic for table rows
      if (line.includes('\t') || line.split(/\s{3,}/).length > 2) {
        tableLines.push(line);
      }
    }
    
    if (tableLines.length > 2) {
      tables.push({
        name: 'Extracted Table',
        headers: tableLines[0].split(/\s{2,}/),
        rows: tableLines.slice(1).map(line => line.split(/\s{2,}/)),
      });
    }
    
    return tables;
  }

  private extractPdfStructure(text: string): ParsedContent['structure'] {
    const lines = text.split('\n');
    const headings: Array<{ level: number; text: string; page?: number }> = [];
    const paragraphs: Array<{ text: string; page?: number }> = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length === 0) continue;
      
      // Detect headings (simple heuristic)
      if (trimmed.length < 100 && (
        /^[A-Z\s]+$/.test(trimmed) ||
        /^\d+\.\s/.test(trimmed) ||
        /^[IVXLCDM]+\.\s/.test(trimmed)
      )) {
        const level = this.detectHeadingLevel(trimmed);
        headings.push({ level, text: trimmed });
      } else if (trimmed.length > 20) {
        paragraphs.push({ text: trimmed });
      }
    }
    
    return { headings, paragraphs };
  }

  private extractHtmlStructure(html: string): ParsedContent['structure'] {
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const headings: Array<{ level: number; text: string; page?: number }> = [];
    const paragraphs: Array<{ text: string; page?: number }> = [];
    
    // Extract headings
    for (let i = 1; i <= 6; i++) {
      const elements = document.querySelectorAll(`h${i}`);
      elements.forEach(element => {
        headings.push({
          level: i,
          text: element.textContent || '',
        });
      });
    }
    
    // Extract paragraphs
    const pElements = document.querySelectorAll('p');
    pElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.length > 0) {
        paragraphs.push({ text });
      }
    });
    
    return { headings, paragraphs };
  }

  private extractTextStructure(text: string): ParsedContent['structure'] {
    const lines = text.split('\n');
    const headings: Array<{ level: number; text: string; page?: number }> = [];
    const paragraphs: Array<{ text: string; page?: number }> = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length === 0) continue;
      
      // Detect headings
      if (trimmed.length < 100 && (
        /^[A-Z\s]+$/.test(trimmed) ||
        /^\d+\.\s/.test(trimmed) ||
        /^[IVXLCDM]+\.\s/.test(trimmed)
      )) {
        const level = this.detectHeadingLevel(trimmed);
        headings.push({ level, text: trimmed });
      } else if (trimmed.length > 20) {
        paragraphs.push({ text: trimmed });
      }
    }
    
    return { headings, paragraphs };
  }

  private detectHeadingLevel(text: string): number {
    if (/^[IVXLCDM]+\.\s/.test(text)) return 1;
    if (/^\d+\.\s/.test(text)) return 2;
    if (/^\d+\.\d+\s/.test(text)) return 3;
    if (/^\d+\.\d+\.\d+\s/.test(text)) return 4;
    return 2;
  }
}
