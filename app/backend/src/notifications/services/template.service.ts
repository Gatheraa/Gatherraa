import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { CreateNotificationTemplateDto, UpdateNotificationTemplateDto } from '../dto';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
  ) {}

  /**
   * Create notification template
   */
  async createTemplate(dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    try {
      const template = this.templateRepository.create({
        ...dto,
        enabled: dto.enabled !== false,
      });

      await this.templateRepository.save(template);
      this.logger.log(`Template created with ID: ${template.id}`);
      return template;
    } catch (error) {
      this.logger.error(`Failed to create template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update notification template
   */
  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    try {
      await this.templateRepository.update(id, dto);
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new Error('Template not found');
      }

      this.logger.log(`Template ${id} updated`);
      return template;
    } catch (error) {
      this.logger.error(`Failed to update template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get template by code
   */
  async getTemplateByCode(code: string): Promise<NotificationTemplate> {
    try {
      const template = await this.templateRepository.findOne({
        where: { code, enabled: true },
      });

      if (!template) {
        throw new Error(`Template with code ${code} not found`);
      }

      return template;
    } catch (error) {
      this.logger.error(`Failed to get template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<NotificationTemplate> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    } catch (error) {
      this.logger.error(`Failed to get template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<NotificationTemplate[]> {
    try {
      return await this.templateRepository.find({ where: { enabled: true } });
    } catch (error) {
      this.logger.error(`Failed to get templates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string): Promise<NotificationTemplate[]> {
    try {
      return await this.templateRepository.find({
        where: { category, enabled: true },
      });
    } catch (error) {
      this.logger.error(`Failed to get templates by category: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      await this.templateRepository.delete(id);
      this.logger.log(`Template ${id} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Render template with variables
   */
  renderTemplate(template: NotificationTemplate, variables: Record<string, any>): { subject: string; html: string; title: string; message: string } {
    try {
      const rendered = {
        subject: this.replaceVariables(template.emailSubject, variables),
        html: this.replaceVariables(template.emailTemplate, variables),
        title: this.replaceVariables(template.pushTitle, variables),
        message: this.replaceVariables(template.pushMessage, variables),
      };

      return rendered;
    } catch (error) {
      this.logger.error(`Failed to render template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(text: string, variables: Record<string, any>): string {
    let result = text;

    for (const [key, value] of Object.entries(variables)) {
      if (value !== null && value !== undefined) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value));
      }
    }

    return result;
  }
}
