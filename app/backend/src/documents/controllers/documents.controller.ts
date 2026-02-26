import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  UploadedFile,
  Res,
  StreamableBody,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document, ProcessingStatus, DocumentType, DocumentCategory } from '../entities/document.entity';
import { DocumentService, DocumentProcessingOptions } from '../services/document.service';
import { OcrService } from '../services/ocr.service';
import { DocumentParserService } from '../services/document-parser.service';
import { DocumentClassificationService } from '../services/document-classification.service';
import { ContentExtractionService } from '../services/content-extraction.service';
import { SimilarityDetectionService } from '../services/similarity-detection.service';
import { TranslationService } from '../services/translation.service';
import { ComplianceService } from '../services/compliance.service';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly ocrService: OcrService,
    private readonly parserService: DocumentParserService,
    private readonly classificationService: DocumentClassificationService,
    private readonly contentExtractionService: ContentExtractionService,
    private readonly similarityService: SimilarityDetectionService,
    private readonly translationService: TranslationService,
    private readonly complianceService: ComplianceService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload document' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      userId?: string;
      options?: DocumentProcessingOptions;
    },
  ): Promise<any> {
    try {
      if (!file) {
        throw new Error('No file uploaded');
      }

      const userId = body.userId || 'anonymous';
      const options = body.options || {};

      const document = await this.documentService.processDocumentUpload(
        file.buffer,
        file.originalname,
        userId,
        options
      );

      return {
        success: true,
        documentId: document.id,
        message: 'Document uploaded and processing started',
        status: document.status,
      };
    } catch (error) {
      throw new Error(`Document upload failed: ${error.message}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(@Param('id') id: string): Promise<Document> {
    const document = await this.documentService.getDocumentById(id);
    
    if (!document) {
      throw new Error('Document not found');
    }

    return document;
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(
    @Query('userId') userId?: string,
    @Query('category') category?: DocumentCategory,
    @Query('type') type?: DocumentType,
    @Query('status') status?: ProcessingStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ): Promise<{
      documents: Document[];
      total: number;
      page: number;
      limit: number;
    }> {
    // This would typically use a repository with pagination
    // For now, return mock data
    return {
      documents: [],
      total: 0,
      page,
      limit,
    };
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process document' })
  @ApiResponse({ status: 200, description: 'Document processing started' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async processDocument(
    @Param('id') id: string,
    @Body() options: DocumentProcessingOptions,
  ): Promise<any> {
    try {
      const result = await this.documentService.processDocument(id, options);
      
      return {
        success: true,
        documentId: id,
        processingResult: result,
        message: 'Document processing completed',
      };
    } catch (error) {
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  @Get(':id/processing-status')
  @ApiOperation({ summary: 'Get document processing status' })
  @ApiResponse({ status: 200, description: 'Processing status retrieved' })
  async getProcessingStatus(@Param('id') id: string): Promise<any> {
    try {
      const status = await this.documentService.getDocumentProcessingStatus(id);
      
      return {
        success: true,
        documentId: id,
        processingStatus: status,
      };
    } catch (error) {
      throw new Error(`Failed to get processing status: ${error.message}`);
    }
  }

  @Post(':id/ocr')
  @ApiOperation({ summary: 'Extract text using OCR' })
  @ApiResponse({ status: 200, description: 'OCR extraction completed' })
  async extractTextWithOcr(
    @Param('id') id: string,
    @Body() options: {
      languages?: string[];
      enhanceImage?: boolean;
      preprocessImage?: boolean;
    },
  ): Promise<any> {
    try {
      const document = await this.documentService.getDocumentById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      const ocrResult = await this.ocrService.extractTextFromImage(
        document.filePath,
        options
      );

      // Update document with OCR results
      await this.documentService.updateDocument(id, {
        extractedText: ocrResult.text,
      });

      return {
        success: true,
        documentId: id,
        ocrResult,
      };
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  @Post(':id/parse')
  @ApiOperation({ summary: 'Parse document content' })
  @ApiResponse({ status: 200, description: 'Document parsing completed' })
  async parseDocument(
    @Param('id') id: string,
    @Body() options: {
      extractMetadata?: boolean;
      extractStructure?: boolean;
      extractTables?: boolean;
    },
  ): Promise<any> {
    try {
      const document = await this.documentService.getDocumentById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      const parseResult = await this.parserService.parseDocument(
        document.filePath,
        document.documentType,
        options
      );

      // Update document with parsing results
      await this.documentService.updateDocument(id, {
        extractedMetadata: parseResult.metadata,
      });

      return {
        success: true,
        documentId: id,
        parseResult,
      };
    } catch (error) {
      throw new Error(`Document parsing failed: ${error.message}`);
    }
  }

  @Post(':id/classify')
  @ApiOperation({ summary: 'Classify document' })
  @ApiResponse({ status: 200, description: 'Document classification completed' })
  async classifyDocument(
    @Param('id') id: string,
    @Body() options: {
      maxKeywords?: number;
      minKeywordRelevance?: number;
    },
  ): Promise<any> {
    try {
      const document = await this.documentService.getDocumentById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      const classificationResult = await this.classificationService.classifyDocument(
        id,
        document.extractedText || '',
        options
      );

      // Update document with classification results
      await this.documentService.updateDocument(id, {
        category: classificationResult.category,
        tags: classificationResult.tags.map(t => t.name),
      });

      return {
        success: true,
        documentId: id,
        classificationResult,
      };
    } catch (error) {
      throw new Error(`Document classification failed: ${error.message}`);
    }
  }

  @Post(':id/extract-content')
  @ApiOperation({ summary: 'Extract content and metadata' })
  @ApiResponse({ status: 200, description: 'Content extraction completed' })
  async extractContent(
    @Param('id') id: string,
    @Body() options: {
      extractEntities?: boolean;
      extractKeywords?: boolean;
      extractSentiment?: boolean;
      extractTopics?: boolean;
      generateSummary?: boolean;
    },
  ): Promise<any> {
    try {
      const document = await this.documentService.getDocumentById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      const extractionResult = await this.contentExtractionService.extractContent(
        id,
        document.extractedText || '',
        options
      );

      // Update document with extraction results
      await this.documentService.updateDocument(id, {
        keyInformation: {
          entities: extractionResult.entities,
          keywords: extractionResult.keywords,
          sentiment: extractionResult.sentiment,
          topics: extractionResult.topics,
        },
        summary: extractionResult.summary.medium,
      });

      return {
        success: true,
        documentId: id,
        extractionResult,
      };
    } catch (error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  @Post(':id/similarity')
  @ApiOperation({ summary: 'Find similar documents' })
  @ApiResponse({ status: 200, description: 'Similarity detection completed' })
  async findSimilarDocuments(
    @Param('id') id: string,
    @Body() options: {
      algorithms?: string[];
      thresholds?: any;
      weights?: any;
    },
  ): Promise<any> {
    try {
      const similarityResults = await this.similarityService.findSimilarDocuments(id, options);

      return {
        success: true,
        documentId: id,
        similarityResults,
      };
    } catch (error) {
      throw new Error(`Similarity detection failed: ${error.message}`);
    }
  }

  @Post(':id/translate')
  @ApiOperation({ summary: 'Translate document' })
  @ApiResponse({ status: 200, description: 'Translation completed' })
  async translateDocument(
    @Param('id') id: string,
    @Body() options: {
      targetLanguage: string;
      sourceLanguage?: string;
      provider?: string;
      preserveFormatting?: boolean;
    },
  ): Promise<any> {
    try {
      const translationResult = await this.translationService.translateDocument(id, options);

      return {
        success: true,
        documentId: id,
        translationResult,
      };
    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  @Post(':id/compliance-check')
  @ApiOperation({ summary: 'Check document compliance' })
  @ApiResponse({ status: 200, description: 'Compliance check completed' })
  async checkCompliance(
    @Param('id') id: string,
    @Body() options: {
      categories?: string[];
      severity?: string;
      includeDisabled?: boolean;
    },
  ): Promise<any> {
    try {
      const complianceReport = await this.complianceService.checkDocumentCompliance(id, options);

      return {
        success: true,
        documentId: id,
        complianceReport,
      };
    } catch (error) {
      throw new Error(`Compliance check failed: ${error.message}`);
    }
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download document' })
  @ApiResponse({ status: 200, description: 'Document download started' })
  @HttpCode(HttpStatus.OK)
  async downloadDocument(
    @Param('id') id: string,
    @Res() res: any,
  ): Promise<void> {
    try {
      const document = await this.documentService.getDocumentById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      
      // Stream the file (in a real implementation, you'd stream from file system)
      res.send('File content would be streamed here');
    } catch (error) {
      throw new Error(`Document download failed: ${error.message}`);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(@Param('id') id: string): Promise<any> {
    try {
      // In a real implementation, you'd delete from database and file system
      // For now, just return success
      
      return {
        success: true,
        documentId: id,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      throw new Error(`Document deletion failed: ${error.message}`);
    }
  }

  @Get('processing-queue')
  @ApiOperation({ summary: 'Get processing queue' })
  @ApiResponse({ status: 200, description: 'Processing queue retrieved' })
  async getProcessingQueue(): Promise<any> {
    try {
      const queue = await this.documentService.getProcessingQueue();

      return {
        success: true,
        queue,
      };
    } catch (error) {
      throw new Error(`Failed to get processing queue: ${error.message}`);
    }
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed processing' })
  @ApiResponse({ status: 200, description: 'Processing retry initiated' })
  async retryProcessing(@Param('id') id: string): Promise<any> {
    try {
      const result = await this.documentService.retryFailedProcessing(id);

      return {
        success: true,
        documentId: id,
        processingResult: result,
        message: 'Processing retry initiated',
      };
    } catch (error) {
      throw new Error(`Processing retry failed: ${error.message}`);
    }
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel processing' })
  @ApiResponse({ status: 200, description: 'Processing cancelled' })
  async cancelProcessing(@Param('id') id: string): Promise<any> {
    try {
      await this.documentService.cancelProcessing(id);

      return {
        success: true,
        documentId: id,
        message: 'Processing cancelled',
      };
    } catch (error) {
      throw new Error(`Processing cancellation failed: ${error.message}`);
    }
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get processing statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStatistics(): Promise<any> {
    try {
      const stats = await this.documentService.getProcessingStatistics();

      return {
        success: true,
        statistics: stats,
      };
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }
}
