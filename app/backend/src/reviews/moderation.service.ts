import { Injectable } from '@nestjs/common';
import { ReviewStatus } from './entities/review.entity';

@Injectable()
export class ModerationService {
  private readonly spamKeywords = [
    'buy now',
    'click here',
    'limited time',
    'act now',
    'free money',
    'make money fast',
    'work from home',
    'get rich quick',
    'guaranteed',
    'no risk',
  ];

  private readonly inappropriateKeywords = [
    'hate',
    'violence',
    'abuse',
    'harassment',
    'discrimination',
    'offensive',
    'explicit',
    'inappropriate',
  ];

  /**
   * Check content for moderation issues
   * Returns moderation score (0-100, higher = more problematic)
   */
  checkContent(content: string, title?: string | null): { score: number; flags: string[] } {
    const text = `${title || ''} ${content}`.toLowerCase();
    const flags: string[] = [];
    let score = 0;

    // Check for spam keywords
    const spamMatches = this.spamKeywords.filter((keyword) => text.includes(keyword));
    if (spamMatches.length > 0) {
      flags.push('spam');
      score += spamMatches.length * 15;
    }

    // Check for inappropriate keywords
    const inappropriateMatches = this.inappropriateKeywords.filter((keyword) => text.includes(keyword));
    if (inappropriateMatches.length > 0) {
      flags.push('inappropriate');
      score += inappropriateMatches.length * 25;
    }

    // Check for excessive capitalization (potential spam)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 20) {
      flags.push('excessive_caps');
      score += 20;
    }

    // Check for excessive links
    const linkMatches = text.match(/https?:\/\//g);
    if (linkMatches && linkMatches.length > 2) {
      flags.push('excessive_links');
      score += linkMatches.length * 10;
    }

    // Check for very short content (potential spam)
    if (content.trim().length < 10) {
      flags.push('too_short');
      score += 15;
    }

    // Check for repetitive characters
    if (/(.)\1{4,}/.test(text)) {
      flags.push('repetitive');
      score += 10;
    }

    return { score: Math.min(score, 100), flags };
  }

  /**
   * Get moderation score (0-100)
   */
  getModerationScore(content: string, title?: string | null): number {
    return this.checkContent(content, title).score;
  }

  /**
   * Determine if review can be auto-approved
   */
  shouldAutoApprove(content: string, title?: string | null): boolean {
    const { score, flags } = this.checkContent(content, title);
    
    // Auto-approve if score is below threshold and no critical flags
    const criticalFlags = ['inappropriate', 'spam'];
    const hasCriticalFlags = flags.some((flag) => criticalFlags.includes(flag));
    
    return score < 30 && !hasCriticalFlags;
  }

  /**
   * Determine initial review status based on content
   */
  getInitialStatus(content: string, title?: string | null): ReviewStatus {
    if (this.shouldAutoApprove(content, title)) {
      return ReviewStatus.APPROVED;
    }

    const { score } = this.checkContent(content, title);
    if (score >= 70) {
      return ReviewStatus.FLAGGED;
    }

    return ReviewStatus.PENDING;
  }
}
