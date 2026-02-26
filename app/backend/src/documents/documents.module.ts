import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { Document, DocumentProcessingJob, DocumentSimilarityCache } from './entities/document.entity';

// Services
import { DocumentService } from './services/document.service';
import { OcrService } from './services/ocr.service';
import { DocumentParserService } from './services/document-parser.service';
import { DocumentClassificationService } from './services/document-classification.service';
import { ContentExtractionService } from './services/content-extraction.service';
import { SimilarityDetectionService } from './services/similarity-detection.service';
import { TranslationService } from './services/translation.service';
import { ComplianceService } from './services/compliance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentProcessingJob,
      DocumentSimilarityCache,
    ]),
    ConfigModule,
  ],
  providers: [
    DocumentService,
    OcrService,
    DocumentParserService,
    DocumentClassificationService,
    ContentExtractionService,
    SimilarityDetectionService,
    TranslationService,
    ComplianceService,
  ],
  exports: [
    DocumentService,
    OcrService,
    DocumentParserService,
    DocumentClassificationService,
    ContentExtractionService,
    SimilarityDetectionService,
    TranslationService,
    ComplianceService,
  ],
})
export class DocumentsModule {}
