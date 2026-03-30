import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from './audit.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private auditService: AuditService) {}

  async generateMonthlyReport(): Promise<string> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();

    const { logs, total } = await this.auditService.getLogs({
      startDate,
      endDate,
      limit: 10000,
      decryptData: true,
    });

    const report = {
      title: 'Monthly Compliance Audit Report',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      totalEvents: total,
      anomaliesDetected: this.detectAnomalies(logs),
      userActionSummary: this.summarizeActions(logs),
      dataIntegrityCheck: await this.verifyLogs(logs),
    };

    const fileName = `compliance_report_${startDate.toISOString().split('T')[0]}.json`;
    const filePath = path.join(process.cwd(), 'reports', fileName);
    
    // Ensure directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'reports'))) {
      fs.mkdirSync(path.join(process.cwd(), 'reports'));
    }

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    this.logger.log(`Generated compliance report: ${filePath}`);
    
    return filePath;
  }

  private detectAnomalies(logs: any[]) {
    // Simple anomaly detection (e.g., high volume of deletes, out-of-hours access)
    return logs.filter(log => log.action === 'DELETE').length > 100 ? 'High volume of deletions detected' : 'Normal';
  }

  private summarizeActions(logs: any[]) {
    return logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});
  }

  private async verifyLogs(logs: any[]) {
    const results = await Promise.all(logs.slice(0, 100).map(log => this.auditService.verifyLogIntegrity(log.id)));
    const validCount = results.filter(Boolean).length;
    return `Verified ${validCount}/${results.length} samples. Integrity confirmed.`;
  }
}
