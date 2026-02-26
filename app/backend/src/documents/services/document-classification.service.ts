import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentCategory, DocumentType } from '../entities/document.entity';
import { Tag } from '../../tags/entities/tag.entity';

export interface ClassificationResult {
  category: DocumentCategory;
  confidence: number;
  tags: Array<{
    name: string;
    confidence: number;
    category: string;
  }>;
  metadata: {
    processingTime: number;
    algorithm: string;
    version: string;
    features: string[];
  };
}

export interface ClassificationFeatures {
  textLength: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  keywordDensity: Record<string, number>;
  namedEntities: Array<{
    text: string;
    type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'email' | 'phone';
    confidence: number;
  }>;
  structure: {
    hasHeadings: boolean;
    hasTables: boolean;
    hasLists: boolean;
    hasImages: boolean;
  };
  language: string;
  readabilityScore: number;
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  category: 'content' | 'format' | 'purpose' | 'domain' | 'security';
  autoApply: boolean;
}

@Injectable()
export class DocumentClassificationService {
  private readonly logger = new Logger(DocumentClassificationService.name);
  
  // Category classification models
  private readonly categoryKeywords: Record<DocumentCategory, {
    keywords: string[];
    patterns: RegExp[];
    weight: number;
  }> = {
    [DocumentCategory.CONTRACT]: {
      keywords: [
        'contract', 'agreement', 'terms', 'conditions', 'clause', 'party', 'signature',
        'obligation', 'liability', 'warranty', 'indemnity', 'governing law',
        'termination', 'breach', 'confidentiality', 'non-disclosure', 'nda'
      ],
      patterns: [
        /agreement\s+between/gi,
        /terms\s+and\s+conditions/gi,
        /governing\s+law/gi,
        /confidential\s+information/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.INVOICE]: {
      keywords: [
        'invoice', 'bill', 'payment', 'due', 'amount', 'total', 'tax', 'customer',
        'vendor', 'supplier', 'invoice number', 'due date', 'subtotal', 'grand total',
        'billing', 'account', 'balance', 'credit', 'debit'
      ],
      patterns: [
        /invoice\s+#?\d+/gi,
        /due\s+date/gi,
        /total\s+amount/gi,
        /tax\s+amount/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.RECEIPT]: {
      keywords: [
        'receipt', 'proof of purchase', 'transaction', 'paid', 'cash', 'credit card',
        'debit card', 'payment method', 'change', 'subtotal', 'tax', 'total',
        'store', 'register', 'cashier', 'customer copy'
      ],
      patterns: [
        /receipt/gi,
        /proof\s+of\s+purchase/gi,
        /payment\s+method/gi,
        /change\s+due/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.ID_DOCUMENT]: {
      keywords: [
        'passport', 'driver license', 'identification', 'id card', 'birth certificate',
        'social security', 'national id', 'identity document', 'photo id',
        'date of birth', 'place of birth', 'expiration', 'issued'
      ],
      patterns: [
        /passport\s+no/gi,
        /driver\s+license/gi,
        /identification\s+card/gi,
        /date\s+of\s+birth/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.FINANCIAL_STATEMENT]: {
      keywords: [
        'balance sheet', 'income statement', 'cash flow', 'financial', 'revenue', 'expenses',
        'assets', 'liabilities', 'equity', 'profit', 'loss', 'statement',
        'quarterly', 'annual report', 'earnings', 'financial position'
      ],
      patterns: [
        /balance\s+sheet/gi,
        /income\s+statement/gi,
        /cash\s+flow/gi,
        /financial\s+statement/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.LEGAL_DOCUMENT]: {
      keywords: [
        'legal', 'court', 'lawsuit', 'attorney', 'judge', 'verdict', 'ruling',
        'plaintiff', 'defendant', 'complaint', 'motion', 'hearing', 'testimony',
        'evidence', 'witness', 'jurisdiction', 'statute', 'regulation'
      ],
      patterns: [
        /court\s+order/gi,
        /legal\s+notice/gi,
        /attorney\s+client/gi,
        /jurisdiction/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.REPORT]: {
      keywords: [
        'report', 'analysis', 'findings', 'conclusion', 'recommendation', 'summary',
        'executive summary', 'methodology', 'results', 'discussion', 'appendix',
        'research', 'study', 'investigation', 'assessment', 'evaluation'
      ],
      patterns: [
        /executive\s+summary/gi,
        /findings\s+and\s+recommendations/gi,
        /methodology/gi,
        /conclusion/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.PRESENTATION]: {
      keywords: [
        'slide', 'presentation', 'powerpoint', 'deck', 'presenter', 'audience',
        'bullet points', 'slides', 'visual aids', 'talking points', 'agenda',
        'overview', 'introduction', 'conclusion', 'questions'
      ],
      patterns: [
        /slide\s+\d+/gi,
        /presentation\s+deck/gi,
        /talking\s+points/gi,
        /bullet\s+points/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.SPREADSHEET]: {
      keywords: [
        'spreadsheet', 'excel', 'sheet', 'row', 'column', 'formula', 'cell',
        'worksheet', 'workbook', 'data', 'calculation', 'function', 'chart',
        'graph', 'pivot table', 'vlookup', 'sum', 'average'
      ],
      patterns: [
        /spreadsheet/gi,
        /excel\s+file/gi,
        /pivot\s+table/gi,
        /vlookup/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.EMAIL]: {
      keywords: [
        'email', 'message', 'from:', 'to:', 'subject:', 'sent:', 'received:',
        'cc:', 'bcc:', 'attachment', 'forward', 'reply', 'thread', 'conversation',
        'inbox', 'outbox', 'draft', 'signature'
      ],
      patterns: [
        /from:\s*.+/gi,
        /to:\s*.+/gi,
        /subject:\s*.+/gi,
        /sent:\s*.+/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.IMAGE]: {
      keywords: [
        'image', 'photo', 'picture', 'jpg', 'png', 'gif', 'bmp', 'tiff',
        'photograph', 'screenshot', 'diagram', 'chart', 'graph', 'illustration',
        'visual', 'graphic', 'pixel', 'resolution'
      ],
      patterns: [
        /\.(jpg|jpeg|png|gif|bmp|tiff)$/gi,
        /image\s+file/gi,
        /photo\s+capture/gi
      ],
      weight: 1.0
    },
    [DocumentCategory.OTHER]: {
      keywords: [],
      patterns: [],
      weight: 0.1
    }
  };

  // Tag classification categories
  private readonly tagCategories = {
    content: [
      'financial', 'legal', 'technical', 'medical', 'educational', 'marketing',
      'personal', 'business', 'academic', 'research', 'creative'
    ],
    format: [
      'structured', 'unstructured', 'tabular', 'narrative', 'multimedia',
      'interactive', 'static', 'dynamic', 'archived', 'draft'
    ],
    purpose: [
      'reference', 'transaction', 'communication', 'documentation', 'analysis',
      'presentation', 'approval', 'compliance', 'audit', 'training'
    ],
    domain: [
      'real-estate', 'finance', 'healthcare', 'technology', 'legal',
      'education', 'government', 'retail', 'manufacturing', 'consulting'
    ],
    security: [
      'confidential', 'public', 'internal', 'restricted', 'classified',
      'sensitive', 'personal-data', 'pii', 'phi', 'proprietary'
    ]
  };

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly configService: ConfigService,
  ) {}

  async classifyDocument(
    documentId: string,
    content: string,
    metadata?: any
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    try {
      const features = await this.extractFeatures(content, metadata);
      const category = await this.classifyCategory(features);
      const tags = await this.suggestTags(features, category);
      
      const processingTime = Date.now() - startTime;
      
      const result: ClassificationResult = {
        category: category.category,
        confidence: category.confidence,
        tags,
        metadata: {
          processingTime,
          algorithm: 'hybrid-keyword-ml',
          version: '1.0',
          features: Object.keys(features),
        },
      };

      // Update document with classification results
      await this.updateDocumentClassification(documentId, result);
      
      return result;
    } catch (error) {
      this.logger.error(`Document classification failed for ${documentId}:`, error);
      throw new Error(`Document classification failed: ${error.message}`);
    }
  }

  async extractFeatures(text: string, metadata?: any): Promise<ClassificationFeatures> {
    const cleanText = text.toLowerCase().trim();
    
    // Basic text statistics
    const textLength = cleanText.length;
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;

    // Keyword density
    const keywordDensity = this.calculateKeywordDensity(words);

    // Named entity extraction
    const namedEntities = this.extractNamedEntities(cleanText);

    // Structure analysis
    const structure = this.analyzeStructure(text, metadata);

    // Language detection
    const language = await this.detectLanguage(cleanText);

    // Readability score
    const readabilityScore = this.calculateReadabilityScore(text);

    return {
      textLength,
      wordCount,
      sentenceCount,
      paragraphCount,
      keywordDensity,
      namedEntities,
      structure,
      language,
      readabilityScore,
    };
  }

  async classifyCategory(features: ClassificationFeatures): Promise<{
    category: DocumentCategory;
    confidence: number;
  }> {
    const scores: Record<DocumentCategory, number> = {} as any;
    
    // Calculate scores for each category
    for (const [category, config] of Object.entries(this.categoryKeywords)) {
      let score = 0;
      
      // Keyword matching
      for (const keyword of config.keywords) {
        if (features.keywordDensity[keyword]) {
          score += features.keywordDensity[keyword] * config.weight;
        }
      }
      
      // Pattern matching
      const text = Object.keys(features.keywordDensity).join(' ');
      for (const pattern of config.patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length * config.weight * 2; // Patterns have higher weight
        }
      }
      
      // Named entity bonuses
      if (category === DocumentCategory.CONTRACT && features.namedEntities.some(e => e.type === 'organization')) {
        score += 0.5;
      }
      if (category === DocumentCategory.ID_DOCUMENT && features.namedEntities.some(e => e.type === 'person')) {
        score += 0.5;
      }
      if (category === DocumentCategory.FINANCIAL_STATEMENT && features.namedEntities.some(e => e.type === 'amount')) {
        score += 0.5;
      }
      
      scores[category as DocumentCategory] = score;
    }

    // Find best category
    let bestCategory = DocumentCategory.OTHER;
    let bestScore = 0;
    let totalScore = 0;
    
    for (const [category, score] of Object.entries(scores)) {
      totalScore += score;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as DocumentCategory;
      }
    }

    // Calculate confidence
    const confidence = totalScore > 0 ? bestScore / totalScore : 0;
    
    return {
      category: bestCategory,
      confidence: Math.min(confidence, 1.0),
    };
  }

  async suggestTags(
    features: ClassificationFeatures,
    categoryResult: { category: DocumentCategory; confidence: number }
  ): Promise<Array<{ name: string; confidence: number; category: string }>> {
    const tags: Array<{ name: string; confidence: number; category: string }> = [];
    
    // Content-based tags
    for (const [keyword, density] of Object.entries(features.keywordDensity)) {
      if (density > 0.01 && keyword.length > 3) { // Significant keywords
        const tagCategory = this.categorizeTag(keyword);
        tags.push({
          name: keyword,
          confidence: density,
          category: tagCategory,
        });
      }
    }

    // Entity-based tags
    for (const entity of features.namedEntities) {
      if (entity.confidence > 0.7) {
        tags.push({
          name: entity.text.toLowerCase(),
          confidence: entity.confidence * 0.8,
          category: 'content',
        });
      }
    }

    // Structure-based tags
    if (features.structure.hasTables) {
      tags.push({
        name: 'contains-tables',
        confidence: 0.9,
        category: 'format',
      });
    }
    if (features.structure.hasImages) {
      tags.push({
        name: 'contains-images',
        confidence: 0.9,
        category: 'format',
      });
    }
    if (features.structure.hasLists) {
      tags.push({
        name: 'contains-lists',
        confidence: 0.8,
        category: 'format',
      });
    }

    // Language tags
    if (features.language !== 'unknown') {
      tags.push({
        name: `lang-${features.language}`,
        confidence: 0.95,
        category: 'format',
      });
    }

    // Category-specific tags
    const categoryTags = this.getCategorySpecificTags(categoryResult.category);
    for (const tag of categoryTags) {
      tags.push({
        name: tag,
        confidence: categoryResult.confidence * 0.7,
        category: 'content',
      });
    }

    // Sort by confidence and limit
    return tags
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
  }

  async autoTagDocument(
    documentId: string,
    tags: Array<{ name: string; confidence: number; category: string }>
  ): Promise<void> {
    try {
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
        relations: ['tagEntities'],
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Filter tags by confidence threshold
      const confidenceThreshold = this.configService.get<number>('DOCUMENT_TAGGING_CONFIDENCE_THRESHOLD', 0.7);
      const highConfidenceTags = tags.filter(tag => tag.confidence >= confidenceThreshold);

      // Create or find tag entities
      const tagEntities: Tag[] = [];
      for (const tagData of highConfidenceTags) {
        let tag = await this.tagRepository.findOne({
          where: { name: tagData.name },
        });

        if (!tag) {
          tag = this.tagRepository.create({
            name: tagData.name,
            category: tagData.category,
            color: this.generateTagColor(tagData.category),
          });
          tag = await this.tagRepository.save(tag);
        }

        tagEntities.push(tag);
      }

      // Update document tags
      document.tagEntities = [...(document.tagEntities || []), ...tagEntities];
      await this.documentRepository.save(document);

      this.logger.log(`Auto-tagged document ${documentId} with ${tagEntities.length} tags`);
    } catch (error) {
      this.logger.error(`Auto-tagging failed for document ${documentId}:`, error);
      throw error;
    }
  }

  async batchClassifyDocuments(documentIds: string[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (const documentId of documentIds) {
      try {
        const document = await this.documentRepository.findOne({
          where: { id: documentId },
        });

        if (document && document.extractedText) {
          const result = await this.classifyDocument(
            documentId,
            document.extractedText,
            document.extractedMetadata
          );
          results.push(result);
        }
      } catch (error) {
        this.logger.error(`Batch classification failed for document ${documentId}:`, error);
      }
    }

    return results;
  }

  async getClassificationStatistics(): Promise<{
    totalDocuments: number;
    categoryDistribution: Record<DocumentCategory, number>;
    tagDistribution: Record<string, number>;
    averageConfidence: number;
    processingMetrics: {
      averageProcessingTime: number;
      totalProcessed: number;
      successRate: number;
    };
  }> {
    const documents = await this.documentRepository.find({
      select: ['category', 'tags'],
    });

    const categoryDistribution: Record<DocumentCategory, number> = {} as any;
    const tagDistribution: Record<string, number> = {};
    let totalConfidence = 0;
    let processedCount = 0;

    for (const doc of documents) {
      // Category distribution
      categoryDistribution[doc.category] = (categoryDistribution[doc.category] || 0) + 1;

      // Tag distribution
      if (doc.tags) {
        for (const tag of doc.tags) {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        }
      }
    }

    return {
      totalDocuments: documents.length,
      categoryDistribution,
      tagDistribution,
      averageConfidence: processedCount > 0 ? totalConfidence / processedCount : 0,
      processingMetrics: {
        averageProcessingTime: 0, // Would need to track this in database
        totalProcessed: processedCount,
        successRate: 1.0,
      },
    };
  }

  private calculateKeywordDensity(words: string[]): Record<string, number> {
    const wordCount = words.length;
    const density: Record<string, number> = {};
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    // Count word frequencies
    const frequencies: Record<string, number> = {};
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z0-9]/g, '');
      if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
        frequencies[cleanWord] = (frequencies[cleanWord] || 0) + 1;
      }
    }

    // Calculate density
    for (const [word, count] of Object.entries(frequencies)) {
      density[word] = count / wordCount;
    }

    return density;
  }

  private extractNamedEntities(text: string): Array<{
    text: string;
    type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'email' | 'phone';
    confidence: number;
  }> {
    const entities: Array<{
      text: string;
      type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'email' | 'phone';
      confidence: number;
    }> = [];

    // Email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    for (const email of emails) {
      entities.push({
        text: email,
        type: 'email',
        confidence: 0.95,
      });
    }

    // Phone numbers
    const phoneRegex = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;
    const phones = text.match(phoneRegex) || [];
    for (const phone of phones) {
      entities.push({
        text: phone,
        type: 'phone',
        confidence: 0.9,
      });
    }

    // Dates
    const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g;
    const dates = text.match(dateRegex) || [];
    for (const date of dates) {
      entities.push({
        text: date,
        type: 'date',
        confidence: 0.8,
      });
    }

    // Amounts
    const amountRegex = /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD)/gi;
    const amounts = text.match(amountRegex) || [];
    for (const amount of amounts) {
      entities.push({
        text: amount,
        type: 'amount',
        confidence: 0.85,
      });
    }

    return entities;
  }

  private analyzeStructure(text: string, metadata?: any): {
    hasHeadings: boolean;
    hasTables: boolean;
    hasLists: boolean;
    hasImages: boolean;
  } {
    return {
      hasHeadings: /\b[A-Z][A-Z\s]{2,}\b|\d+\.\s+[A-Z]/.test(text),
      hasTables: /\t{2,}|\s{3,}\s+\w+\s+\s{3,}/.test(text),
      hasLists: /^\s*[-•*]\s+/m.test(text) || /^\s*\d+\.\s+/m.test(text),
      hasImages: metadata?.images && metadata.images.length > 0,
    };
  }

  private async detectLanguage(text: string): Promise<string> {
    const franc = require('franc');
    const isoCode = franc(text);
    
    const languageMap: Record<string, string> = {
      'eng': 'english',
      'spa': 'spanish',
      'fra': 'french',
      'deu': 'german',
      'ita': 'italian',
      'por': 'portuguese',
      'rus': 'russian',
      'jpn': 'japanese',
      'kor': 'korean',
      'cmn': 'chinese',
      'ara': 'arabic',
    };

    return languageMap[isoCode] || 'unknown';
  }

  private calculateReadabilityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Flesch Reading Ease Score
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private categorizeTag(keyword: string): string {
    // Simple categorization based on keyword
    if (this.tagCategories.content.includes(keyword)) return 'content';
    if (this.tagCategories.format.includes(keyword)) return 'format';
    if (this.tagCategories.purpose.includes(keyword)) return 'purpose';
    if (this.tagCategories.domain.includes(keyword)) return 'domain';
    if (this.tagCategories.security.includes(keyword)) return 'security';
    
    // Default categorization
    if (keyword.includes('confidential') || keyword.includes('sensitive')) return 'security';
    if (keyword.includes('report') || keyword.includes('analysis')) return 'purpose';
    if (keyword.includes('table') || keyword.includes('chart')) return 'format';
    
    return 'content';
  }

  private getCategorySpecificTags(category: DocumentCategory): string[] {
    const categoryTags: Record<DocumentCategory, string[]> = {
      [DocumentCategory.CONTRACT]: ['legal-binding', 'agreement', 'terms'],
      [DocumentCategory.INVOICE]: ['billing', 'payment-required', 'vendor'],
      [DocumentCategory.RECEIPT]: ['proof-of-payment', 'transaction-record'],
      [DocumentCategory.ID_DOCUMENT]: ['personal-identification', 'identity-verification'],
      [DocumentCategory.FINANCIAL_STATEMENT]: ['financial-data', 'accounting'],
      [DocumentCategory.LEGAL_DOCUMENT]: ['legal', 'court-document'],
      [DocumentCategory.REPORT]: ['analysis', 'findings'],
      [DocumentCategory.PRESENTATION]: ['slides', 'visual-content'],
      [DocumentCategory.SPREADSHEET]: ['data-table', 'calculations'],
      [DocumentCategory.EMAIL]: ['communication', 'message'],
      [DocumentCategory.IMAGE]: ['visual-content', 'graphic'],
      [DocumentCategory.OTHER]: ['unclassified'],
    };

    return categoryTags[category] || [];
  }

  private generateTagColor(category: string): string {
    const colorMap: Record<string, string> = {
      content: '#3B82F6', // blue
      format: '#10B981', // green
      purpose: '#F59E0B', // amber
      domain: '#8B5CF6', // purple
      security: '#EF4444', // red
    };

    return colorMap[category] || '#6B7280'; // gray
  }

  private async updateDocumentClassification(
    documentId: string,
    result: ClassificationResult
  ): Promise<void> {
    await this.documentRepository.update(documentId, {
      category: result.category,
      tags: result.tags.map(tag => tag.name),
    });

    // Auto-apply high-confidence tags
    await this.autoTagDocument(documentId, result.tags);
  }
}
