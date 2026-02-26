import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, Language } from '../entities/document.entity';
import axios from 'axios';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  confidence: number;
  provider: string;
  processingTime: number;
  metadata?: {
    alternatives?: Array<{
      text: string;
      confidence: number;
    }>;
    detectedLanguage?: Language;
    detectionConfidence?: number;
  };
}

export interface TranslationOptions {
  targetLanguage: Language;
  sourceLanguage?: Language;
  provider?: 'google' | 'azure' | 'aws' | 'deepl';
  preserveFormatting?: boolean;
  preserveHtml?: boolean;
  alternatives?: boolean;
  quality?: 'draft' | 'professional' | 'premium';
}

export interface LanguageDetectionResult {
  detectedLanguage: Language;
  confidence: number;
  alternatives: Array<{
    language: Language;
    confidence: number;
  }>;
  processingTime: number;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly supportedLanguages = new Set([
    Language.EN, Language.ES, Language.FR, Language.DE, Language.IT, Language.PT,
    Language.RU, Language.JA, Language.KO, Language.ZH, Language.AR
  ]);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly configService: ConfigService,
  ) {}

  async translateDocument(
    documentId: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    
    try {
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      const text = document.extractedText || '';
      if (!text.trim()) {
        throw new Error('Document has no text content to translate');
      }

      // Detect source language if not provided
      const sourceLanguage = options.sourceLanguage || 
        (await this.detectLanguage(text)).detectedLanguage;

      // Perform translation
      const translation = await this.performTranslation(text, {
        ...options,
        sourceLanguage,
      });

      const processingTime = Date.now() - startTime;

      // Update document with translation
      await this.updateDocumentTranslation(documentId, translation, options);

      const result: TranslationResult = {
        originalText: text,
        translatedText: translation.text,
        sourceLanguage,
        targetLanguage: options.targetLanguage,
        confidence: translation.confidence,
        provider: translation.provider,
        processingTime,
        metadata: {
          alternatives: translation.alternatives,
          detectedLanguage: sourceLanguage,
        },
      };

      this.logger.log(`Document ${documentId} translated successfully`);
      return result;

    } catch (error) {
      this.logger.error(`Document translation failed for ${documentId}:`, error);
      throw new Error(`Document translation failed: ${error.message}`);
    }
  }

  async translateText(
    text: string,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    
    try {
      // Detect source language if not provided
      const sourceLanguage = options.sourceLanguage || 
        (await this.detectLanguage(text)).detectedLanguage;

      // Perform translation
      const translation = await this.performTranslation(text, {
        ...options,
        sourceLanguage,
      });

      const processingTime = Date.now() - startTime;

      return {
        originalText: text,
        translatedText: translation.text,
        sourceLanguage,
        targetLanguage: options.targetLanguage,
        confidence: translation.confidence,
        provider: translation.provider,
        processingTime,
        metadata: {
          alternatives: translation.alternatives,
          detectedLanguage: sourceLanguage,
        },
      };

    } catch (error) {
      this.logger.error('Text translation failed:', error);
      throw new Error(`Text translation failed: ${error.message}`);
    }
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Use multiple detection methods for better accuracy
      const [francResult, azureResult, googleResult] = await Promise.allSettled([
        this.detectLanguageWithFranc(text),
        this.detectLanguageWithAzure(text),
        this.detectLanguageWithGoogle(text),
      ]);

      const results = [
        francResult.status === 'fulfilled' ? francResult.value : null,
        azureResult.status === 'fulfilled' ? azureResult.value : null,
        googleResult.status === 'fulfilled' ? googleResult.value : null,
      ].filter(result => result !== null);

      // Combine results using weighted voting
      const combinedResult = this.combineDetectionResults(results);
      combinedResult.processingTime = Date.now() - startTime;

      return combinedResult;

    } catch (error) {
      this.logger.error('Language detection failed:', error);
      throw new Error(`Language detection failed: ${error.message}`);
    }
  }

  async getSupportedLanguages(): Promise<{
    languages: Array<{
      code: Language;
      name: string;
      nativeName: string;
      supported: boolean;
    }>;
    providers: Array<{
      name: string;
      languages: Language[];
    }>;
  }> {
    const languageMap: Record<Language, { name: string; nativeName: string }> = {
      [Language.EN]: { name: 'English', nativeName: 'English' },
      [Language.ES]: { name: 'Spanish', nativeName: 'Español' },
      [Language.FR]: { name: 'French', nativeName: 'Français' },
      [Language.DE]: { name: 'German', nativeName: 'Deutsch' },
      [Language.IT]: { name: 'Italian', nativeName: 'Italiano' },
      [Language.PT]: { name: 'Portuguese', nativeName: 'Português' },
      [Language.RU]: { name: 'Russian', nativeName: 'Русский' },
      [Language.JA]: { name: 'Japanese', nativeName: '日本語' },
      [Language.KO]: { name: 'Korean', nativeName: '한국어' },
      [Language.ZH]: { name: 'Chinese', nativeName: '中文' },
      [Language.AR]: { name: 'Arabic', nativeName: 'العربية' },
      [Language.UNKNOWN]: { name: 'Unknown', nativeName: 'Unknown' },
    };

    const languages = Object.entries(languageMap).map(([code, info]) => ({
      code: code as Language,
      name: info.name,
      nativeName: info.nativeName,
      supported: this.supportedLanguages.has(code as Language),
    }));

    const providers = [
      {
        name: 'Google Translate',
        languages: Array.from(this.supportedLanguages),
      },
      {
        name: 'Azure Translator',
        languages: Array.from(this.supportedLanguages),
      },
      {
        name: 'AWS Translate',
        languages: Array.from(this.supportedLanguages),
      },
      {
        name: 'DeepL',
        languages: [Language.EN, Language.ES, Language.FR, Language.DE, Language.IT, Language.PT, Language.RU, Language.JA],
      },
    ];

    return { languages, providers };
  }

  async batchTranslate(
    texts: string[],
    options: TranslationOptions
  ): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    
    for (const text of texts) {
      try {
        const result = await this.translateText(text, options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Batch translation failed for text: ${text.substring(0, 50)}...`, error);
        // Continue with other texts
      }
    }

    return results;
  }

  async translateDocumentToMultipleLanguages(
    documentId: string,
    targetLanguages: Language[]
  ): Promise<TranslationResult[]> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const text = document.extractedText || '';
    if (!text.trim()) {
      throw new Error('Document has no text content to translate');
    }

    const sourceLanguage = (await this.detectLanguage(text)).detectedLanguage;
    const results: TranslationResult[] = [];

    for (const targetLanguage of targetLanguages) {
      try {
        const result = await this.translateText(text, {
          targetLanguage,
          sourceLanguage,
        });
        results.push(result);
      } catch (error) {
        this.logger.error(`Translation to ${targetLanguage} failed:`, error);
      }
    }

    // Update document with all translations
    await this.updateDocumentWithMultipleTranslations(documentId, results);

    return results;
  }

  private async performTranslation(
    text: string,
    options: TranslationOptions & { sourceLanguage: Language }
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    alternatives?: Array<{
      text: string;
      confidence: number;
    }>;
  }> {
    const provider = options.provider || 'google';

    switch (provider) {
      case 'google':
        return this.translateWithGoogle(text, options);
      case 'azure':
        return this.translateWithAzure(text, options);
      case 'aws':
        return this.translateWithAWS(text, options);
      case 'deepl':
        return this.translateWithDeepL(text, options);
      default:
        throw new Error(`Unsupported translation provider: ${provider}`);
    }
  }

  private async translateWithGoogle(
    text: string,
    options: TranslationOptions & { sourceLanguage: Language }
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    alternatives?: Array<{
      text: string;
      confidence: number;
    }>;
  }> {
    const apiKey = this.configService.get<string>('GOOGLE_TRANSLATE_API_KEY');
    if (!apiKey) {
      throw new Error('Google Translate API key not configured');
    }

    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2`,
        {
          q: text,
          source: this.mapLanguageToISO(options.sourceLanguage),
          target: this.mapLanguageToISO(options.targetLanguage),
          format: options.preserveHtml ? 'html' : 'text',
          model: options.quality === 'premium' ? 'base' : 'nmt',
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const translation = response.data.data.translations[0];

      return {
        text: translation.translatedText,
        confidence: 0.9, // Google doesn't provide confidence scores
        provider: 'google',
        alternatives: options.alternatives ? [
          {
            text: translation.translatedText,
            confidence: 0.9,
          },
        ] : undefined,
      };

    } catch (error) {
      this.logger.error('Google Translate API error:', error);
      throw new Error(`Google Translate failed: ${error.message}`);
    }
  }

  private async translateWithAzure(
    text: string,
    options: TranslationOptions & { sourceLanguage: Language }
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    alternatives?: Array<{
      text: string;
      confidence: number;
    }>;
  }> {
    const apiKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');
    const region = this.configService.get<string>('AZURE_TRANSLATOR_REGION', 'global');
    
    if (!apiKey) {
      throw new Error('Azure Translator API key not configured');
    }

    try {
      const response = await axios.post(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0`,
        {
          text: [text],
          from: this.mapLanguageToISO(options.sourceLanguage),
          to: this.mapLanguageToISO(options.targetLanguage),
          textType: options.preserveHtml ? 'html' : 'plain',
          includeAlternatives: options.alternatives ? 'true' : 'false',
        },
        {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Ocp-Apim-Subscription-Region': region,
            'Content-Type': 'application/json',
          },
        }
      );

      const translation = response.data[0];

      return {
        text: translation.translations[0].text,
        confidence: translation.translations[0].confidence || 0.8,
        provider: 'azure',
        alternatives: translation.translations[0].alternatives,
      };

    } catch (error) {
      this.logger.error('Azure Translator API error:', error);
      throw new Error(`Azure Translator failed: ${error.message}`);
    }
  }

  private async translateWithAWS(
    text: string,
    options: TranslationOptions & { sourceLanguage: Language }
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    alternatives?: Array<{
      text: string;
      confidence: number;
    }>;
  }> {
    const accessKey = this.configService.get<string>('AWS_TRANSLATE_ACCESS_KEY');
    const secretKey = this.configService.get<string>('AWS_TRANSLATE_SECRET_KEY');
    const region = this.configService.get<string>('AWS_TRANSLATE_REGION', 'us-east-1');

    if (!accessKey || !secretKey) {
      throw new Error('AWS Translate credentials not configured');
    }

    try {
      const AWS = require('aws-sdk');
      const translate = new AWS.Translate({
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        region,
      });

      const params = {
        Text: text,
        SourceLanguageCode: this.mapLanguageToISO(options.sourceLanguage),
        TargetLanguageCode: this.mapLanguageToISO(options.targetLanguage),
      };

      const result = await translate.translateText(params).promise();

      return {
        text: result.TranslatedText,
        confidence: 0.85, // AWS doesn't provide confidence scores
        provider: 'aws',
      };

    } catch (error) {
      this.logger.error('AWS Translate API error:', error);
      throw new Error(`AWS Translate failed: ${error.message}`);
    }
  }

  private async translateWithDeepL(
    text: string,
    options: TranslationOptions & { sourceLanguage: Language }
  ): Promise<{
    text: string;
    confidence: number;
    provider: string;
    alternatives?: Array<{
      text: string;
      confidence: number;
    }>;
  }> {
    const apiKey = this.configService.get<string>('DEEPL_API_KEY');
    
    if (!apiKey) {
      throw new Error('DeepL API key not configured');
    }

    try {
      const response = await axios.post(
        'https://api-free.deepl.com/v2/translate',
        {
          text: [text],
          source_lang: this.mapLanguageToDeepL(options.sourceLanguage),
          target_lang: this.mapLanguageToDeepL(options.targetLanguage),
          preserve_formatting: options.preserveFormatting ? '1' : '0',
          formality: options.quality === 'professional' ? 'more' : 'default',
        },
        {
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const translation = response.data.translations[0];

      return {
        text: translation.text,
        confidence: 0.95, // DeepL provides high quality translations
        provider: 'deepl',
      };

    } catch (error) {
      this.logger.error('DeepL API error:', error);
      throw new Error(`DeepL translation failed: ${error.message}`);
    }
  }

  private async detectLanguageWithFranc(text: string): Promise<{
    detectedLanguage: Language;
    confidence: number;
  }> {
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

    const detectedLanguage = languageMap[isoCode] || Language.UNKNOWN;
    
    // Simple confidence calculation based on text length and detection certainty
    const confidence = Math.min(text.length / 100, 1.0);

    return { detectedLanguage, confidence };
  }

  private async detectLanguageWithAzure(text: string): Promise<{
    detectedLanguage: Language;
    confidence: number;
  }> {
    const apiKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');
    const region = this.configService.get<string>('AZURE_TRANSLATOR_REGION', 'global');

    if (!apiKey) {
      return { detectedLanguage: Language.UNKNOWN, confidence: 0 };
    }

    try {
      const response = await axios.post(
        `https://api.cognitive.microsofttranslator.com/detect?api-version=3.0`,
        {
          text: [text],
        },
        {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Ocp-Apim-Subscription-Region': region,
            'Content-Type': 'application/json',
          },
        }
      );

      const detection = response.data[0];
      const languageMap: Record<string, Language> = {
        'en': Language.EN,
        'es': Language.ES,
        'fr': Language.FR,
        'de': Language.DE,
        'it': Language.IT,
        'pt': Language.PT,
        'ru': Language.RU,
        'ja': Language.JA,
        'ko': Language.KO,
        'zh-Hans': Language.ZH,
        'ar': Language.AR,
      };

      const detectedLanguage = languageMap[detection.language] || Language.UNKNOWN;

      return {
        detectedLanguage,
        confidence: detection.score || 0.5,
      };

    } catch (error) {
      this.logger.error('Azure language detection error:', error);
      return { detectedLanguage: Language.UNKNOWN, confidence: 0 };
    }
  }

  private async detectLanguageWithGoogle(text: string): Promise<{
    detectedLanguage: Language;
    confidence: number;
  }> {
    const apiKey = this.configService.get<string>('GOOGLE_TRANSLATE_API_KEY');

    if (!apiKey) {
      return { detectedLanguage: Language.UNKNOWN, confidence: 0 };
    }

    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2/detect`,
        {
          q: text,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const detection = response.data.data.detections[0];
      const languageMap: Record<string, Language> = {
        'en': Language.EN,
        'es': Language.ES,
        'fr': Language.FR,
        'de': Language.DE,
        'it': Language.IT,
        'pt': Language.PT,
        'ru': Language.RU,
        'ja': Language.JA,
        'ko': Language.KO,
        'zh': Language.ZH,
        'ar': Language.AR,
      };

      const detectedLanguage = languageMap[detection.language] || Language.UNKNOWN;

      return {
        detectedLanguage,
        confidence: detection.confidence || 0.5,
      };

    } catch (error) {
      this.logger.error('Google language detection error:', error);
      return { detectedLanguage: Language.UNKNOWN, confidence: 0 };
    }
  }

  private combineDetectionResults(
    results: Array<{ detectedLanguage: Language; confidence: number } | null>
  ): LanguageDetectionResult {
    if (results.length === 0) {
      return {
        detectedLanguage: Language.UNKNOWN,
        confidence: 0,
        alternatives: [],
        processingTime: 0,
      };
    }

    // Weight voting by confidence
    const votes: Record<Language, { total: number; confidence: number }> = {};
    
    for (const result of results) {
      if (result) {
        if (!votes[result.detectedLanguage]) {
          votes[result.detectedLanguage] = { total: 0, confidence: 0 };
        }
        votes[result.detectedLanguage].total += 1;
        votes[result.detectedLanguage].confidence += result.confidence;
      }
    }

    // Find language with highest weighted score
    let bestLanguage = Language.UNKNOWN;
    let bestScore = 0;
    let bestConfidence = 0;

    for (const [language, vote] of Object.entries(votes)) {
      const score = vote.total * vote.confidence;
      if (score > bestScore) {
        bestScore = score;
        bestLanguage = language as Language;
        bestConfidence = vote.confidence / vote.total;
      }
    }

    // Create alternatives
    const alternatives = Object.entries(votes)
      .filter(([lang, vote]) => lang !== bestLanguage)
      .map(([lang, vote]) => ({
        language: lang as Language,
        confidence: vote.confidence / vote.total,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return {
      detectedLanguage: bestLanguage,
      confidence: bestConfidence,
      alternatives,
      processingTime: 0, // Would be calculated by caller
    };
  }

  private async updateDocumentTranslation(
    documentId: string,
    translation: TranslationResult,
    options: TranslationOptions
  ): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) return;

    const translationData = document.translationData || {
      originalLanguage: translation.sourceLanguage,
      availableTranslations: [],
    };

    // Add or update translation
    const existingTranslation = translationData.availableTranslations.find(
      t => t.language === options.targetLanguage
    );

    if (existingTranslation) {
      existingTranslation.translatedText = translation.translatedText;
      existingTranslation.translatedAt = new Date();
      existingTranslation.translatedBy = translation.provider;
    } else {
      translationData.availableTranslations.push({
        language: options.targetLanguage,
        translatedText: translation.translatedText,
        translatedAt: new Date(),
        translatedBy: translation.provider,
      });
    }

    await this.documentRepository.update(documentId, {
      translationData,
      detectedLanguage: translation.sourceLanguage,
    });
  }

  private async updateDocumentWithMultipleTranslations(
    documentId: string,
    results: TranslationResult[]
  ): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) return;

    const translationData = {
      originalLanguage: results[0]?.sourceLanguage || Language.UNKNOWN,
      availableTranslations: results.map(result => ({
        language: result.targetLanguage,
        translatedText: result.translatedText,
        translatedAt: new Date(),
        translatedBy: result.provider,
      })),
    };

    await this.documentRepository.update(documentId, {
      translationData,
      detectedLanguage: results[0]?.sourceLanguage || Language.UNKNOWN,
    });
  }

  private mapLanguageToISO(language: Language): string {
    const mapping: Record<Language, string> = {
      [Language.EN]: 'en',
      [Language.ES]: 'es',
      [Language.FR]: 'fr',
      [Language.DE]: 'de',
      [Language.IT]: 'it',
      [Language.PT]: 'pt',
      [Language.RU]: 'ru',
      [Language.JA]: 'ja',
      [Language.KO]: 'ko',
      [Language.ZH]: 'zh',
      [Language.AR]: 'ar',
      [Language.UNKNOWN]: 'auto',
    };

    return mapping[language] || 'auto';
  }

  private mapLanguageToDeepL(language: Language): string {
    const mapping: Record<Language, string> = {
      [Language.EN]: 'EN',
      [Language.ES]: 'ES',
      [Language.FR]: 'FR',
      [Language.DE]: 'DE',
      [Language.IT]: 'IT',
      [Language.PT]: 'PT',
      [Language.RU]: 'RU',
      [Language.JA]: 'JA',
      [Language.KO]: 'KO', // DeepL supports Korean
      [Language.ZH]: 'ZH',
      [Language.AR]: 'AR', // DeepL supports Arabic
      [Language.UNKNOWN]: 'auto',
    };

    return mapping[language] || 'auto';
  }

  async getTranslationStatistics(): Promise<{
    totalTranslations: number;
    languagePairs: Record<string, number>;
    providerUsage: Record<string, number>;
    averageProcessingTime: number;
  }> {
    const documents = await this.documentRepository.find({
      where: {
        translationData: { $ne: null },
      },
      select: ['translationData'],
    });

    const totalTranslations = documents.length;
    const languagePairs: Record<string, number> = {};
    const providerUsage: Record<string, number> = {};
    let totalProcessingTime = 0;
    let processingTimeCount = 0;

    for (const doc of documents) {
      if (doc.translationData) {
        const sourceLang = doc.translationData.originalLanguage;
        const translations = doc.translationData.availableTranslations || [];

        for (const translation of translations) {
          const pair = `${sourceLang}-${translation.language}`;
          languagePairs[pair] = (languagePairs[pair] || 0) + 1;
          
          const provider = translation.translatedBy;
          providerUsage[provider] = (providerUsage[provider] || 0) + 1;
        }
      }
    }

    const averageProcessingTime = processingTimeCount > 0 ? totalProcessingTime / processingTimeCount : 0;

    return {
      totalTranslations,
      languagePairs,
      providerUsage,
      averageProcessingTime,
    };
  }
}
