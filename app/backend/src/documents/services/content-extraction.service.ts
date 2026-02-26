import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, Language } from '../entities/document.entity';

const franc = require('franc');

export interface ExtractedContent {
  entities: Array<{
    type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'email' | 'phone' | 'url' | 'product' | 'skill';
    text: string;
    confidence: number;
    context: string;
    startIndex: number;
    endIndex: number;
    metadata?: {
      title?: string;
      department?: string;
      industry?: string;
      currency?: string;
      format?: string;
    };
  }>;
  keywords: Array<{
    text: string;
    relevance: number;
    category: string;
    frequency: number;
    positions: number[];
  }>;
  sentiment: {
    overall: {
      score: number;
      label: 'positive' | 'negative' | 'neutral';
      confidence: number;
    };
    aspects?: Array<{
      aspect: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
      text: string;
    }>;
  };
  topics: Array<{
    topic: string;
    confidence: number;
    keywords: string[];
    relevance: number;
  }>;
  relationships: Array<{
    type: 'works_for' | 'located_in' | 'part_of' | 'related_to' | 'mentions' | 'reports_to';
    source: string;
    target: string;
    confidence: number;
    context: string;
  }>;
  summary: {
    short: string;
    medium: string;
    long: string;
    keyPoints: string[];
    bulletPoints: string[];
  };
  metadata: {
    processingTime: number;
    algorithm: string;
    version: string;
    confidence: number;
    language: Language;
    wordCount: number;
    characterCount: number;
  };
}

export interface ExtractionOptions {
  extractEntities?: boolean;
  extractKeywords?: boolean;
  extractSentiment?: boolean;
  extractTopics?: boolean;
  extractRelationships?: boolean;
  generateSummary?: boolean;
  language?: Language;
  maxKeywords?: number;
  minKeywordRelevance?: number;
  sentimentGranularity?: 'document' | 'sentence' | 'aspect';
}

@Injectable()
export class ContentExtractionService {
  private readonly logger = new Logger(ContentExtractionService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly configService: ConfigService,
  ) { }

  async extractContent(
    documentId: string,
    text: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      const result: ExtractedContent = {
        entities: [],
        keywords: [],
        sentiment: {
          overall: {
            score: 0,
            label: 'neutral',
            confidence: 0,
          },
        },
        topics: [],
        relationships: [],
        summary: {
          short: '',
          medium: '',
          long: '',
          keyPoints: [],
          bulletPoints: [],
        },
        metadata: {
          processingTime: 0,
          algorithm: 'hybrid-nlp',
          version: '1.0',
          confidence: 0,
          language: Language.UNKNOWN,
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
        },
      };

      // Detect language
      result.metadata.language = await this.detectLanguage(text);

      // Extract entities
      if (options.extractEntities !== false) {
        result.entities = await this.extractEntities(text, result.metadata.language);
      }

      // Extract keywords
      if (options.extractKeywords !== false) {
        result.keywords = await this.extractKeywords(
          text,
          options.maxKeywords || 50,
          options.minKeywordRelevance || 0.1
        );
      }

      // Analyze sentiment
      if (options.extractSentiment !== false) {
        result.sentiment = await this.analyzeSentiment(
          text,
          options.sentimentGranularity || 'document'
        );
      }

      // Extract topics
      if (options.extractTopics !== false) {
        result.topics = await this.extractTopics(text, result.metadata.language);
      }

      // Extract relationships
      if (options.extractRelationships !== false) {
        result.relationships = await this.extractRelationships(text, result.entities);
      }

      // Generate summary
      if (options.generateSummary !== false) {
        result.summary = await this.generateSummary(text, options);
      }

      // Calculate overall confidence
      result.metadata.confidence = this.calculateOverallConfidence(result);
      result.metadata.processingTime = Date.now() - startTime;

      // Update document with extracted content
      await this.updateDocumentWithExtractedContent(documentId, result);

      return result;
    } catch (error) {
      this.logger.error(`Content extraction failed for document ${documentId}:`, error);
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  async extractEntities(text: string, language: Language): Promise<ExtractedContent['entities']> {
    const entities: ExtractedContent['entities'] = [];

    // Extract persons
    const persons = this.extractPersons(text);
    entities.push(...persons);

    // Extract organizations
    const organizations = this.extractOrganizations(text);
    entities.push(...organizations);

    // Extract locations
    const locations = this.extractLocations(text);
    entities.push(...locations);

    // Extract dates
    const dates = this.extractDates(text);
    entities.push(...dates);

    // Extract amounts
    const amounts = this.extractAmounts(text);
    entities.push(...amounts);

    // Extract emails
    const emails = this.extractEmails(text);
    entities.push(...emails);

    // Extract phone numbers
    const phones = this.extractPhones(text);
    entities.push(...phones);

    // Extract URLs
    const urls = this.extractUrls(text);
    entities.push(...urls);

    // Extract products (domain-specific)
    const products = this.extractProducts(text);
    entities.push(...products);

    // Extract skills (domain-specific)
    const skills = this.extractSkills(text);
    entities.push(...skills);

    return entities.sort((a, b) => b.confidence - a.confidence);
  }

  async extractKeywords(
    text: string,
    maxKeywords: number,
    minRelevance: number
  ): Promise<ExtractedContent['keywords']> {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);

    // Calculate word frequencies and positions
    const wordFreq: Record<string, { count: number; positions: number[] }> = {};
    let position = 0;

    for (const word of words) {
      if (!stopWords.has(word)) {
        if (!wordFreq[word]) {
          wordFreq[word] = { count: 0, positions: [] };
        }
        wordFreq[word].count++;
        wordFreq[word].positions.push(position);
      }
      position++;
    }

    // Calculate TF-IDF-like relevance scores
    const totalWords = words.length;
    const keywords: ExtractedContent['keywords'] = [];

    for (const [word, data] of Object.entries(wordFreq)) {
      const tf = data.count / totalWords;
      const idf = Math.log(totalWords / data.count); // Simplified IDF
      const relevance = tf * idf;

      if (relevance >= minRelevance) {
        keywords.push({
          text: word,
          relevance,
          category: this.categorizeKeyword(word),
          frequency: data.count,
          positions: data.positions,
        });
      }
    }

    return keywords
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxKeywords);
  }

  async analyzeSentiment(
    text: string,
    granularity: 'document' | 'sentence' | 'aspect' = 'document'
  ): Promise<ExtractedContent['sentiment']> {
    // Simple sentiment analysis using keyword approach
    const positiveWords = new Set([
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
      'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied',
      'success', 'successful', 'achieve', 'accomplish', 'complete', 'finished'
    ]);

    const negativeWords = new Set([
      'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'hate',
      'dislike', 'angry', 'frustrated', 'disappointed', 'sad', 'upset',
      'fail', 'failure', 'failed', 'error', 'mistake', 'problem', 'issue'
    ]);

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.has(word)) positiveCount++;
      if (negativeWords.has(word)) negativeCount++;
    }

    const totalSentimentWords = positiveCount + negativeCount;
    let score = 0;
    let label: 'positive' | 'negative' | 'neutral' = 'neutral';
    let confidence = 0;

    if (totalSentimentWords > 0) {
      score = (positiveCount - negativeCount) / totalSentimentWords;
      confidence = Math.min(totalSentimentWords / 10, 1); // More words = higher confidence

      if (score > 0.1) label = 'positive';
      else if (score < -0.1) label = 'negative';
      else label = 'neutral';
    }

    const result: ExtractedContent['sentiment'] = {
      overall: {
        score: Math.max(-1, Math.min(1, score)),
        label,
        confidence,
      },
    };

    // Aspect-based sentiment if requested
    if (granularity === 'aspect') {
      result.aspects = await this.extractAspectSentiment(text);
    }

    return result;
  }

  async extractTopics(text: string, language: Language): Promise<ExtractedContent['topics']> {
    // Simple topic extraction using keyword clustering
    const keywords = await this.extractKeywords(text, 100, 0.05);
    const topics: ExtractedContent['topics'] = [];

    // Group keywords into topics based on co-occurrence
    const topicGroups = this.clusterKeywordsIntoTopics(keywords, text);

    for (const group of topicGroups) {
      if (group.keywords.length >= 2) {
        const topic = {
          topic: group.name,
          confidence: group.confidence,
          keywords: group.keywords.map(k => k.text),
          relevance: group.relevance,
        };
        topics.push(topic);
      }
    }

    return topics.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  async extractRelationships(
    text: string,
    entities: ExtractedContent['entities']
  ): Promise<ExtractedContent['relationships']> {
    const relationships: ExtractedContent['relationships'] = [];

    // Simple relationship extraction based on patterns
    const patterns = [
      {
        type: 'works_for' as const,
        regex: /(\w+(?:\s+\w+)*)\s+(?:works?|is\s+working|is\s+employed)\s+(?:at|for|in)\s+(\w+(?:\s+\w+)*)/gi,
      },
      {
        type: 'located_in' as const,
        regex: /(\w+(?:\s+\w+)*)\s+(?:is\s+)?(?:located|based)\s+(?:in|at)\s+(\w+(?:\s+\w+)*)/gi,
      },
      {
        type: 'reports_to' as const,
        regex: /(\w+(?:\s+\w+)*)\s+(?:reports?\s+to|is\s+(?:the\s+)?(?:manager|supervisor)\s+of)\s+(\w+(?:\s+\w+)*)/gi,
      },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const source = match[1].trim();
        const target = match[2].trim();
        const context = match[0];

        // Verify both entities exist in our extracted entities
        const sourceEntity = entities.find(e => e.text.toLowerCase() === source.toLowerCase());
        const targetEntity = entities.find(e => e.text.toLowerCase() === target.toLowerCase());

        if (sourceEntity && targetEntity) {
          relationships.push({
            type: pattern.type,
            source: sourceEntity.text,
            target: targetEntity.text,
            confidence: 0.7, // Base confidence for pattern matching
            context,
          });
        }
      }
    }

    return relationships;
  }

  async generateSummary(
    text: string,
    options: ExtractionOptions
  ): Promise<ExtractedContent['summary']> {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length === 0) {
      return {
        short: '',
        medium: '',
        long: '',
        keyPoints: [],
        bulletPoints: [],
      };
    }

    // Calculate sentence scores based on position, length, and keyword frequency
    const sentenceScores = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/);
      const positionScore = 1 - (index / sentences.length); // Earlier sentences get higher scores
      const lengthScore = Math.min(words.length / 20, 1); // Prefer medium-length sentences
      const keywordScore = this.calculateKeywordScore(sentence);

      return {
        sentence: sentence.trim(),
        score: (positionScore * 0.3) + (lengthScore * 0.3) + (keywordScore * 0.4),
        index,
      };
    });

    // Sort by score
    sentenceScores.sort((a, b) => b.score - a.score);

    // Generate different summary lengths
    const shortSummary = sentenceScores
      .slice(0, Math.min(2, sentenceScores.length))
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence)
      .join('. ');

    const mediumSummary = sentenceScores
      .slice(0, Math.min(5, sentenceScores.length))
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence)
      .join('. ');

    const longSummary = sentenceScores
      .slice(0, Math.min(10, sentenceScores.length))
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence)
      .join('. ');

    // Extract key points
    const keyPoints = sentenceScores
      .slice(0, 5)
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence);

    // Generate bullet points
    const bulletPoints = keyPoints.map(point => `• ${point}`);

    return {
      short: shortSummary,
      medium: mediumSummary,
      long: longSummary,
      keyPoints,
      bulletPoints,
    };
  }

  private async detectLanguage(text: string): Promise<Language> {
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

  private extractPersons(text: string): ExtractedContent['entities'] {
    const entities: ExtractedContent['entities'] = [];

    // Simple person name patterns
    const patterns = [
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // First Last [Middle]
      /\b(Mr|Mrs|Ms|Dr|Prof)\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // Titles
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1] || match[2];
        entities.push({
          type: 'person',
          text: name,
          confidence: 0.8,
          context: this.getContext(text, match.index, 50),
          startIndex: match.index,
          endIndex: match.index + name.length,
        });
      }
    }

    return entities;
  }

  const entities: ExtractedContent['entities'] = [];

  // Common organization indicators
  const orgIndicators = ['Inc', 'Corp', 'LLC', 'Ltd', 'Company', 'Corporation', 'University', 'Institute'];

  for(const indicator of orgIndicators) {
    const pattern = new RegExp(`\\b([A-Z][a-zA-Z\\s&]+${indicator})\\b`, 'g');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        type: 'organization',
        text: match[1],
        confidence: 0.9,
        context: this.getContext(text, match.index, 50),
        startIndex: match.index,
        endIndex: match.index + match[1].length,
      });
    }
  }

    return entities;
  }

  private extractLocations(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];

  // Simple location patterns
  const patterns = [
    /\b([A-Z][a-z]+,\s*[A-Z]{2})\b/g, // City, State
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+,\s*[A-Z]{2})\b/g, // City Name, State
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        type: 'location',
        text: match[1],
        confidence: 0.7,
        context: this.getContext(text, match.index, 50),
        startIndex: match.index,
        endIndex: match.index + match[1].length,
      });
    }
  }

  return entities;
}

  private extractDates(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];

  const patterns = [
    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g, // MM/DD/YYYY
    /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g, // YYYY/MM/DD
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi, // Month DD, YYYY
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        type: 'date',
        text: match[1],
        confidence: 0.9,
        context: this.getContext(text, match.index, 50),
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        metadata: { format: 'date' },
      });
    }
  }

  return entities;
}

  private extractAmounts(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];

  const patterns = [
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, // $1,234.56
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(USD|EUR|GBP|CAD)/gi, // 1,234.56 USD
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = match[1] || match[0];
      entities.push({
        type: 'amount',
        text: amount,
        confidence: 0.95,
        context: this.getContext(text, match.index, 50),
        startIndex: match.index,
        endIndex: match.index + amount.length,
        metadata: {
          currency: match[2] || 'USD',
          format: 'currency'
        },
      });
    }
  }

  return entities;
}

  private extractEmails(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];
  const pattern = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    entities.push({
      type: 'email',
      text: match[1],
      confidence: 0.98,
      context: this.getContext(text, match.index, 50),
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      metadata: { format: 'email' },
    });
  }

  return entities;
}

  private extractPhones(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];
  const pattern = /\b((?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})\b/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    entities.push({
      type: 'phone',
      text: match[1],
      confidence: 0.9,
      context: this.getContext(text, match.index, 50),
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      metadata: { format: 'phone' },
    });
  }

  return entities;
}

  private extractUrls(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];
  const pattern = /\b((?:https?:\/\/)?(?:www\.)?[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}(?:\/[^\s]*)?)\b/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    entities.push({
      type: 'url',
      text: match[1],
      confidence: 0.95,
      context: this.getContext(text, match.index, 50),
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      metadata: { format: 'url' },
    });
  }

  return entities;
}

  private extractProducts(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];

  // Real estate specific products
  const productKeywords = [
    'property', 'house', 'apartment', 'condo', 'townhouse', 'villa',
    'land', 'lot', 'commercial', 'residential', 'investment'
  ];

  for (const keyword of productKeywords) {
    const pattern = new RegExp(`\\b(${keyword})\\b`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        type: 'product',
        text: match[1],
        confidence: 0.7,
        context: this.getContext(text, match.index, 50),
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        metadata: { category: 'real-estate' },
      });
    }
  }

  return entities;
}

  private extractSkills(text: string): ExtractedContent['entities'] {
  const entities: ExtractedContent['entities'] = [];

  // Business/technical skills
  const skillKeywords = [
    'management', 'leadership', 'communication', 'negotiation', 'analysis',
    'marketing', 'sales', 'finance', 'accounting', 'project management',
    'development', 'programming', 'design', 'consulting'
  ];

  for (const skill of skillKeywords) {
    const pattern = new RegExp(`\\b(${skill})\\b`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        type: 'skill',
        text: match[1],
        confidence: 0.6,
        context: this.getContext(text, match.index, 50),
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        metadata: { category: 'skill' },
      });
    }
  }

  return entities;
}

  private getContext(text: string, index: number, windowSize: number): string {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(text.length, index + windowSize);
  return text.substring(start, end);
}

  private categorizeKeyword(keyword: string): string {
  const categories = {
    business: ['business', 'company', 'corporate', 'enterprise', 'organization'],
    financial: ['money', 'payment', 'cost', 'price', 'budget', 'financial'],
    legal: ['contract', 'agreement', 'legal', 'law', 'regulation', 'compliance'],
    technical: ['software', 'system', 'technology', 'digital', 'online', 'web'],
    realEstate: ['property', 'real', 'estate', 'house', 'building', 'land'],
  };

  for (const [category, words] of Object.entries(categories)) {
    if (words.some(word => keyword.includes(word))) {
      return category;
    }
  }

  return 'general';
}

  private calculateKeywordScore(sentence: string): number {
  const importantWords = ['important', 'significant', 'key', 'main', 'primary', 'essential', 'critical'];
  const words = sentence.toLowerCase().split(/\s+/);

  return words.filter(word => importantWords.includes(word)).length / words.length;
}

  private clusterKeywordsIntoTopics(
  keywords: ExtractedContent['keywords'],
  text: string
): Array < { name: string; keywords: ExtractedContent['keywords']; confidence: number; relevance: number } > {
  // Simple clustering based on word co-occurrence
  const topics: Array<{ name: string; keywords: ExtractedContent['keywords']; confidence: number; relevance: number }> =[];

// Group keywords by category
const categoryGroups: Record<string, ExtractedContent['keywords']> = {};

for (const keyword of keywords) {
  const category = keyword.category;
  if (!categoryGroups[category]) {
    categoryGroups[category] = [];
  }
  categoryGroups[category].push(keyword);
}

// Create topics from category groups
for (const [category, groupKeywords] of Object.entries(categoryGroups)) {
  if (groupKeywords.length >= 2) {
    const avgRelevance = groupKeywords.reduce((sum, k) => sum + k.relevance, 0) / groupKeywords.length;
    const confidence = Math.min(groupKeywords.length / 10, 1);

    topics.push({
      name: category,
      keywords: groupKeywords,
      confidence,
      relevance: avgRelevance,
    });
  }
}

return topics;
  }

  private async extractAspectSentiment(text: string): Promise < ExtractedContent['sentiment']['aspects'] > {
  // Simplified aspect-based sentiment
  const aspects: ExtractedContent['sentiment']['aspects'] = [];

  const aspectPatterns = [
    { aspect: 'price', keywords: ['price', 'cost', 'expensive', 'cheap', 'affordable'] },
    { aspect: 'quality', keywords: ['quality', 'good', 'bad', 'excellent', 'poor'] },
    { aspect: 'service', keywords: ['service', 'support', 'help', 'staff', 'customer'] },
  ];

  for(const pattern of aspectPatterns) {
    const regex = new RegExp(`\\b(${pattern.keywords.join('|')})\\b.*`, 'gi');
    const matches = text.match(regex);

    if (matches) {
      const aspectText = matches[0];
      const sentiment = await this.analyzeSentiment(aspectText, 'document');

      aspects.push({
        aspect: pattern.aspect,
        sentiment: sentiment.overall.label,
        confidence: sentiment.overall.confidence,
        text: aspectText,
      });
    }
  }

    return aspects;
}

  private calculateOverallConfidence(result: ExtractedContent): number {
  const confidences = [
    result.entities.length > 0 ? 0.8 : 0,
    result.keywords.length > 0 ? 0.8 : 0,
    result.sentiment.overall.confidence,
    result.topics.length > 0 ? 0.7 : 0,
    result.summary.short.length > 0 ? 0.7 : 0,
  ];

  const validConfidences = confidences.filter(c => c > 0);
  return validConfidences.length > 0
    ? validConfidences.reduce((sum, c) => sum + c, 0) / validConfidences.length
    : 0;
}

  private async updateDocumentWithExtractedContent(
  documentId: string,
  extractedContent: ExtractedContent
): Promise < void> {
  await this.documentRepository.update(documentId, {
    keyInformation: {
      entities: extractedContent.entities,
      keywords: extractedContent.keywords,
      sentiment: extractedContent.sentiment,
      topics: extractedContent.topics,
    },
    summary: extractedContent.summary.medium,
  });
}
}
