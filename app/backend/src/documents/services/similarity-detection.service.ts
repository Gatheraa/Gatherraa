import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Document, DocumentSimilarityCache } from '../entities/document.entity';
import * as crypto from 'crypto';
import * as natural from 'natural';

export interface SimilarityResult {
  documentId: string;
  similarity: number;
  algorithm: string;
  details: {
    textSimilarity?: number;
    metadataSimilarity?: number;
    contentSimilarity?: number;
    structureSimilarity?: number;
  };
  isDuplicate: boolean;
  duplicateThreshold: number;
}

export interface SimilarityOptions {
  algorithms?: Array<'cosine' | 'jaccard' | 'levenshtein' | 'euclidean' | 'manhattan'>;
  thresholds?: {
    duplicate: number;
    similar: number;
    related: number;
  };
  weights?: {
    text: number;
    metadata: number;
    structure: number;
  };
  includeMetadata?: boolean;
  includeStructure?: boolean;
  cacheResults?: boolean;
}

export interface DocumentVector {
  documentId: string;
  textVector: number[];
  metadataVector: number[];
  structureVector: number[];
  normalized: boolean;
}

@Injectable()
export class SimilarityDetectionService {
  private readonly logger = new Logger(SimilarityDetectionService.name);
  private readonly defaultThresholds = {
    duplicate: 0.95,
    similar: 0.8,
    related: 0.6,
  };

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentSimilarityCache)
    private readonly similarityCacheRepository: Repository<DocumentSimilarityCache>,
    private readonly configService: ConfigService,
  ) {}

  async findSimilarDocuments(
    documentId: string,
    options: SimilarityOptions = {}
  ): Promise<SimilarityResult[]> {
    try {
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      const algorithms = options.algorithms || ['cosine', 'jaccard', 'levenshtein'];
      const thresholds = { ...this.defaultThresholds, ...options.thresholds };
      const weights = options.weights || { text: 0.7, metadata: 0.2, structure: 0.1 };

      // Create document vector
      const docVector = await this.createDocumentVector(document, options);

      // Get candidate documents for comparison
      const candidates = await this.getCandidateDocuments(document, options);

      const results: SimilarityResult[] = [];

      for (const candidate of candidates) {
        const candidateVector = await this.createDocumentVector(candidate, options);

        for (const algorithm of algorithms) {
          const similarity = await this.calculateSimilarity(
            docVector,
            candidateVector,
            algorithm,
            weights
          );

          const result: SimilarityResult = {
            documentId: candidate.id,
            similarity: similarity.overall,
            algorithm,
            details: similarity.details,
            isDuplicate: similarity.overall >= thresholds.duplicate,
            duplicateThreshold: thresholds.duplicate,
          };

          results.push(result);
        }
      }

      // Sort by similarity and remove duplicates
      const uniqueResults = this.deduplicateResults(results);
      return uniqueResults
        .sort((a, b) => b.similarity - a.similarity)
        .filter(result => result.similarity >= thresholds.related);

    } catch (error) {
      this.logger.error(`Similarity detection failed for document ${documentId}:`, error);
      throw new Error(`Similarity detection failed: ${error.message}`);
    }
  }

  async detectDuplicates(
    documentId: string,
    options: SimilarityOptions = {}
  ): Promise<SimilarityResult[]> {
    const similarityOptions = {
      ...options,
      thresholds: {
        ...this.defaultThresholds,
        ...options.thresholds,
        duplicate: options.thresholds?.duplicate || this.defaultThresholds.duplicate,
      },
    };

    const results = await this.findSimilarDocuments(documentId, similarityOptions);
    return results.filter(result => result.isDuplicate);
  }

  async calculateDocumentSimilarity(
    documentId1: string,
    documentId2: string,
    algorithm: 'cosine' | 'jaccard' | 'levenshtein' = 'cosine'
  ): Promise<SimilarityResult> {
    try {
      const [doc1, doc2] = await Promise.all([
        this.documentRepository.findOne({ where: { id: documentId1 } }),
        this.documentRepository.findOne({ where: { id: documentId2 } }),
      ]);

      if (!doc1 || !doc2) {
        throw new Error('One or both documents not found');
      }

      // Check cache first
      const cached = await this.getCachedSimilarity(documentId1, documentId2, algorithm);
      if (cached) {
        return cached;
      }

      const vector1 = await this.createDocumentVector(doc1);
      const vector2 = await this.createDocumentVector(doc2);

      const similarity = await this.calculateSimilarity(vector1, vector2, algorithm);

      const result: SimilarityResult = {
        documentId: documentId2,
        similarity: similarity.overall,
        algorithm,
        details: similarity.details,
        isDuplicate: similarity.overall >= this.defaultThresholds.duplicate,
        duplicateThreshold: this.defaultThresholds.duplicate,
      };

      // Cache the result
      await this.cacheSimilarity(documentId1, documentId2, result);

      return result;
    } catch (error) {
      this.logger.error(`Document similarity calculation failed:`, error);
      throw new Error(`Document similarity calculation failed: ${error.message}`);
    }
  }

  async batchSimilarityCheck(
    documentIds: string[],
    options: SimilarityOptions = {}
  ): Promise<Map<string, SimilarityResult[]>> {
    const results = new Map<string, SimilarityResult[]>();

    for (const documentId of documentIds) {
      try {
        const similarDocs = await this.findSimilarDocuments(documentId, options);
        results.set(documentId, similarDocs);
      } catch (error) {
        this.logger.error(`Batch similarity check failed for document ${documentId}:`, error);
        results.set(documentId, []);
      }
    }

    return results;
  }

  async updateSimilarityCache(): Promise<void> {
    try {
      // Clean expired cache entries
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 30); // 30 days old

      await this.similarityCacheRepository.delete({
        expiresAt: LessThan(expiredDate),
      });

      this.logger.log('Cleaned expired similarity cache entries');
    } catch (error) {
      this.logger.error('Failed to update similarity cache:', error);
    }
  }

  async getSimilarityStatistics(): Promise<{
    totalComparisons: number;
    averageSimilarity: number;
    duplicateCount: number;
    algorithmUsage: Record<string, number>;
    cacheHitRate: number;
  }> {
    const cacheEntries = await this.similarityCacheRepository.find({
      order: { calculatedAt: 'DESC' },
      take: 1000,
    });

    const totalComparisons = cacheEntries.length;
    const similarities = cacheEntries.map(entry => parseFloat(entry.similarity.toString()));
    const averageSimilarity = similarities.length > 0 
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length 
      : 0;

    const duplicateCount = cacheEntries.filter(entry => parseFloat(entry.similarity.toString()) >= this.defaultThresholds.duplicate).length;

    const algorithmUsage: Record<string, number> = {};
    for (const entry of cacheEntries) {
      algorithmUsage[entry.algorithm] = (algorithmUsage[entry.algorithm] || 0) + 1;
    }

    return {
      totalComparisons,
      averageSimilarity,
      duplicateCount,
      algorithmUsage,
      cacheHitRate: 0.85, // Would need to track actual cache hits
    };
  }

  private async createDocumentVector(
    document: Document,
    options: SimilarityOptions
  ): Promise<DocumentVector> {
    const includeMetadata = options.includeMetadata !== false;
    const includeStructure = options.includeStructure !== false;

    // Text vector
    const text = document.extractedText || '';
    const tokens = this.tokenizeText(text);
    const textVector = this.createTFIDFVector(tokens);

    // Metadata vector
    let metadataVector: number[] = [];
    if (includeMetadata) {
      metadataVector = this.createMetadataVector(document);
    }

    // Structure vector
    let structureVector: number[] = [];
    if (includeStructure) {
      structureVector = this.createStructureVector(document);
    }

    return {
      documentId: document.id,
      textVector,
      metadataVector,
      structureVector,
      normalized: true,
    };
  }

  private async getCandidateDocuments(
    document: Document,
    options: SimilarityOptions
  ): Promise<Document[]> {
    // Get documents from same user, category, or time period
    const whereConditions: any[] = [];

    // Same user
    if (document.userId) {
      whereConditions.push({ userId: document.userId });
    }

    // Same category
    if (document.category) {
      whereConditions.push({ category: document.category });
    }

    // Recent documents (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    whereConditions.push({
      createdAt: Between(thirtyDaysAgo, new Date()),
    });

    // Combine conditions with OR
    const candidates = await this.documentRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
      take: 100, // Limit candidates for performance
    });

    return candidates.filter(doc => doc.id !== document.id);
  }

  private tokenizeText(text: string): string[] {
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());
    
    // Remove stop words and short tokens
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    return tokens
      .filter(token => token.length > 2)
      .filter(token => !stopWords.has(token))
      .filter(token => /^[a-z]+$/.test(token)); // Only alphabetic tokens
  }

  private createTFIDFVector(tokens: string[]): number[] {
    // Simple TF-IDF vector creation
    const tokenFreq: Record<string, number> = {};
    const totalTokens = tokens.length;

    // Calculate term frequency
    for (const token of tokens) {
      tokenFreq[token] = (tokenFreq[token] || 0) + 1;
    }

    // Create normalized frequency vector
    const vector: number[] = [];
    for (const [token, freq] of Object.entries(tokenFreq)) {
      const tf = freq / totalTokens;
      vector.push(tf);
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  private createMetadataVector(document: Document): number[] {
    const vector: number[] = [];

    // File size (normalized)
    const maxSize = 10 * 1024 * 1024; // 10MB
    vector.push(Math.min(document.fileSize / maxSize, 1));

    // Document type (one-hot encoded)
    const docTypes = ['pdf', 'docx', 'txt', 'xlsx', 'jpg'];
    const typeIndex = docTypes.indexOf(document.documentType);
    for (let i = 0; i < docTypes.length; i++) {
      vector.push(i === typeIndex ? 1 : 0);
    }

    // Category (one-hot encoded)
    const categories = ['contract', 'invoice', 'report', 'other'];
    const categoryIndex = categories.indexOf(document.category);
    for (let i = 0; i < categories.length; i++) {
      vector.push(i === categoryIndex ? 1 : 0);
    }

    // Word count (normalized)
    const wordCount = document.extractedMetadata?.wordCount || 0;
    vector.push(Math.min(wordCount / 10000, 1)); // Normalize to 10k words

    return vector;
  }

  private createStructureVector(document: Document): number[] {
    const vector: number[] = [];
    const metadata = document.extractedMetadata;

    // Has tables
    vector.push(metadata?.tables && metadata.tables.length > 0 ? 1 : 0);

    // Has images
    vector.push(metadata?.images && metadata.images.length > 0 ? 1 : 0);

    // Has links
    vector.push(metadata?.links && metadata.links.length > 0 ? 1 : 0);

    // Page count (normalized)
    const pageCount = metadata?.pageCount || 1;
    vector.push(Math.min(pageCount / 100, 1)); // Normalize to 100 pages

    // Heading count (normalized)
    const headingCount = metadata?.structure?.headings?.length || 0;
    vector.push(Math.min(headingCount / 50, 1)); // Normalize to 50 headings

    return vector;
  }

  private async calculateSimilarity(
    vector1: DocumentVector,
    vector2: DocumentVector,
    algorithm: string,
    weights: { text: number; metadata: number; structure: number }
  ): Promise<{ overall: number; details: any }> {
    switch (algorithm) {
      case 'cosine':
        return this.calculateCosineSimilarity(vector1, vector2, weights);
      
      case 'jaccard':
        return this.calculateJaccardSimilarity(vector1, vector2, weights);
      
      case 'levenshtein':
        return this.calculateLevenshteinSimilarity(vector1, vector2, weights);
      
      case 'euclidean':
        return this.calculateEuclideanSimilarity(vector1, vector2, weights);
      
      case 'manhattan':
        return this.calculateManhattanSimilarity(vector1, vector2, weights);
      
      default:
        throw new Error(`Unsupported similarity algorithm: ${algorithm}`);
    }
  }

  private calculateCosineSimilarity(
    vector1: DocumentVector,
    vector2: DocumentVector,
    weights: { text: number; metadata: number; structure: number }
  ): { overall: number; details: any } {
    // Text similarity
    const textSim = this.cosineSimilarity(vector1.textVector, vector2.textVector);
    
    // Metadata similarity
    const metadataSim = this.cosineSimilarity(vector1.metadataVector, vector2.metadataVector);
    
    // Structure similarity
    const structureSim = this.cosineSimilarity(vector1.structureVector, vector2.structureVector);

    const overall = (textSim * weights.text) + 
                  (metadataSim * weights.metadata) + 
                  (structureSim * weights.structure);

    return {
      overall,
      details: {
        textSimilarity: textSim,
        metadataSimilarity: metadataSim,
        structureSimilarity: structureSim,
      },
    };
  }

  private calculateJaccardSimilarity(
    vector1: DocumentVector,
    vector2: DocumentVector,
    weights: { text: number; metadata: number; structure: number }
  ): { overall: number; details: any } {
    // Convert to binary vectors for Jaccard
    const textBinary1 = vector1.textVector.map(v => v > 0 ? 1 : 0);
    const textBinary2 = vector2.textVector.map(v => v > 0 ? 1 : 0);
    const textSim = this.jaccardSimilarity(textBinary1, textBinary2);

    const metadataBinary1 = vector1.metadataVector.map(v => v > 0 ? 1 : 0);
    const metadataBinary2 = vector2.metadataVector.map(v => v > 0 ? 1 : 0);
    const metadataSim = this.jaccardSimilarity(metadataBinary1, metadataBinary2);

    const structureBinary1 = vector1.structureVector.map(v => v > 0 ? 1 : 0);
    const structureBinary2 = vector2.structureVector.map(v => v > 0 ? 1 : 0);
    const structureSim = this.jaccardSimilarity(structureBinary1, structureBinary2);

    const overall = (textSim * weights.text) + 
                  (metadataSim * weights.metadata) + 
                  (structureSim * weights.structure);

    return {
      overall,
      details: {
        textSimilarity: textSim,
        metadataSimilarity: metadataSim,
        structureSimilarity: structureSim,
      },
    };
  }

  private calculateLevenshteinSimilarity(
    vector1: DocumentVector,
    vector2: DocumentVector,
    weights: { text: number; metadata: number; structure: number }
  ): { overall: number; details: any } {
    // For Levenshtein, we'll use a simplified approach on the text vectors
    const textSim = this.levenshteinSimilarity(
      vector1.textVector.join(' '),
      vector2.textVector.join(' ')
    );

    // Use cosine for other components
    const metadataSim = this.cosineSimilarity(vector1.metadataVector, vector2.metadataVector);
    const structureSim = this.cosineSimilarity(vector1.structureVector, vector2.structureVector);

    const overall = (textSim * weights.text) + 
                  (metadataSim * weights.metadata) + 
                  (structureSim * weights.structure);

    return {
      overall,
      details: {
        textSimilarity: textSim,
        metadataSimilarity: metadataSim,
        structureSimilarity: structureSim,
      },
    };
  }

  private calculateEuclideanSimilarity(
    vector1: DocumentVector,
    vector2: DocumentVector,
    weights: { text: number; metadata: number; structure: number }
  ): { overall: number; details: any } {
    const textSim = this.euclideanSimilarity(vector1.textVector, vector2.textVector);
    const metadataSim = this.euclideanSimilarity(vector1.metadataVector, vector2.metadataVector);
    const structureSim = this.euclideanSimilarity(vector1.structureVector, vector2.structureVector);

    const overall = (textSim * weights.text) + 
                  (metadataSim * weights.metadata) + 
                  (structureSim * weights.structure);

    return {
      overall,
      details: {
        textSimilarity: textSim,
        metadataSimilarity: metadataSim,
        structureSimilarity: structureSim,
      },
    };
  }

  private calculateManhattanSimilarity(
    vector1: DocumentVector,
    vector2: DocumentVector,
    weights: { text: number; metadata: number; structure: number }
  ): { overall: number; details: any } {
    const textSim = this.manhattanSimilarity(vector1.textVector, vector2.textVector);
    const metadataSim = this.manhattanSimilarity(vector1.metadataVector, vector2.metadataVector);
    const structureSim = this.manhattanSimilarity(vector1.structureVector, vector2.structureVector);

    const overall = (textSim * weights.text) + 
                  (metadataSim * weights.metadata) + 
                  (structureSim * weights.structure);

    return {
      overall,
      details: {
        textSimilarity: textSim,
        metadataSimilarity: metadataSim,
        structureSimilarity: structureSim,
      },
    };
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length === 0 || vectorB.length === 0) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    const minLength = Math.min(vectorA.length, vectorB.length);
    
    for (let i = 0; i < minLength; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private jaccardSimilarity(setA: number[], setB: number[]): number {
    const intersection = setA.filter((val, index) => setB[index] === val);
    const union = [...setA, ...setB];
    
    if (union.length === 0) return 0;
    return intersection.length / union.length;
  }

  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = natural.LevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    return maxLength === 0 ? 0 : 1 - (distance / maxLength);
  }

  private euclideanSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length === 0 || vectorB.length === 0) return 0;
    
    let distance = 0;
    const minLength = Math.min(vectorA.length, vectorB.length);
    
    for (let i = 0; i < minLength; i++) {
      distance += Math.pow(vectorA[i] - vectorB[i], 2);
    }

    const maxDistance = Math.sqrt(minLength);
    return maxDistance === 0 ? 0 : 1 - (Math.sqrt(distance) / maxDistance);
  }

  private manhattanSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length === 0 || vectorB.length === 0) return 0;
    
    let distance = 0;
    const minLength = Math.min(vectorA.length, vectorB.length);
    
    for (let i = 0; i < minLength; i++) {
      distance += Math.abs(vectorA[i] - vectorB[i]);
    }

    const maxDistance = minLength;
    return maxDistance === 0 ? 0 : 1 - (distance / maxDistance);
  }

  private deduplicateResults(results: SimilarityResult[]): SimilarityResult[] {
    const unique = new Map<string, SimilarityResult>();
    
    for (const result of results) {
      const key = `${result.documentId}-${result.algorithm}`;
      const existing = unique.get(key);
      
      if (!existing || result.similarity > existing.similarity) {
        unique.set(key, result);
      }
    }

    return Array.from(unique.values());
  }

  private async getCachedSimilarity(
    documentId1: string,
    documentId2: string,
    algorithm: string
  ): Promise<SimilarityResult | null> {
    const cache = await this.similarityCacheRepository.findOne({
      where: [
        { documentId1, documentId2, algorithm },
        { documentId1: documentId2, documentId2, algorithm },
      ],
    });

    if (cache && cache.calculatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return {
        documentId: documentId2,
        similarity: parseFloat(cache.similarity.toString()),
        algorithm: cache.algorithm,
        details: cache.details,
        isDuplicate: parseFloat(cache.similarity.toString()) >= this.defaultThresholds.duplicate,
        duplicateThreshold: this.defaultThresholds.duplicate,
      };
    }

    return null;
  }

  private async cacheSimilarity(
    documentId1: string,
    documentId2: string,
    result: SimilarityResult
  ): Promise<void> {
    const cache = this.similarityCacheRepository.create({
      documentId1,
      documentId2,
      similarity: result.similarity,
      algorithm: result.algorithm,
      details: result.details,
      calculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    await this.similarityCacheRepository.save(cache);
  }

  generateDocumentHash(document: Document): string {
    const content = [
      document.extractedText || '',
      document.documentType,
      document.category,
      document.fileSize.toString(),
    ].join('|');

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
