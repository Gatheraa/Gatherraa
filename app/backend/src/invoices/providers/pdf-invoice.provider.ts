import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  paymentDate?: Date;
  totalAmount: number;
  status: 'PAID' | 'PENDING' | 'FAILED';
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  booking: {
    id: string;
    startDate: Date;
    endDate: Date;
    seats: number;
    workspace: {
      name: string;
      planType: string;
    };
  };
}

@Injectable()
export class PdfInvoiceProvider {
  async generate(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50,
          },
        });

        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => {
          buffers.push(chunk);
        });

        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        doc.on('error', (error) => {
          reject(error);
        });

        // Header - Logo and Title
        this.addHeader(doc);

        // Invoice Metadata
        this.addInvoiceMetadata(doc, invoice);

        // Bill To Section
        this.addBillToSection(doc, invoice);

        // Service Details
        this.addServiceDetails(doc, invoice);

        // Amount Summary
        this.addAmountSummary(doc, invoice);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: typeof PDFDocument): void {
    // Logo placeholder (in a real implementation, you'd add an actual logo)
    doc.fillColor('#1f2937').fontSize(24).text('Gatherraa', 50, 50, { align: 'left' });
    
    // TAX INVOICE title
    doc.fillColor('#6b7280').fontSize(14).text('TAX INVOICE', 50, 80, { align: 'left' });
    
    // Horizontal line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 100).lineTo(545, 100).stroke();
  }

  private addInvoiceMetadata(doc: typeof PDFDocument, invoice: Invoice): void {
    const startY = 120;
    
    doc.fillColor('#374151').fontSize(12);
    
    // Left column - Invoice details
    doc.text('Invoice Number:', 50, startY);
    doc.text(`INV-${invoice.invoiceNumber}`, 150, startY);
    
    doc.text('Issue Date:', 50, startY + 20);
    doc.text(invoice.issueDate.toLocaleDateString('en-NG'), 150, startY + 20);
    
    if (invoice.paymentDate) {
      doc.text('Payment Date:', 50, startY + 40);
      doc.text(invoice.paymentDate.toLocaleDateString('en-NG'), 150, startY + 40);
    }
    
    // Right column - Status
    doc.text('Status:', 400, startY);
    
    const statusColor = invoice.status === 'PAID' ? '#059669' : 
                       invoice.status === 'PENDING' ? '#d97706' : '#dc2626';
    
    doc.fillColor(statusColor).text(invoice.status, 450, startY);
    doc.fillColor('#374151'); // Reset color
  }

  private addBillToSection(doc: typeof PDFDocument, invoice: Invoice): void {
    const startY = 200;
    
    doc.fillColor('#1f2937').fontSize(14).text('Bill To:', 50, startY);
    
    doc.fillColor('#6b7280').fontSize(12);
    doc.text(invoice.user.fullName, 50, startY + 25);
    doc.text(invoice.user.email, 50, startY + 45);
    
    // Horizontal line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, startY + 70).lineTo(545, startY + 70).stroke();
  }

  private addServiceDetails(doc: typeof PDFDocument, invoice: Invoice): void {
    const startY = 290;
    
    doc.fillColor('#1f2937').fontSize(14).text('Service Details:', 50, startY);
    
    doc.fillColor('#6b7280').fontSize(12);
    
    const details = [
      { label: 'Workspace Name:', value: invoice.booking.workspace.name },
      { label: 'Plan Type:', value: invoice.booking.workspace.planType },
      { label: 'Start Date:', value: invoice.booking.startDate.toLocaleDateString('en-NG') },
      { label: 'End Date:', value: invoice.booking.endDate.toLocaleDateString('en-NG') },
      { label: 'Number of Seats:', value: invoice.booking.seats.toString() },
    ];
    
    details.forEach((detail, index) => {
      const y = startY + 25 + (index * 20);
      doc.text(detail.label, 50, y);
      doc.text(detail.value, 150, y);
    });
    
    // Horizontal line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, startY + 125).lineTo(545, startY + 125).stroke();
  }

  private addAmountSummary(doc: typeof PDFDocument, invoice: Invoice): void {
    const startY = 435;
    
    doc.fillColor('#1f2937').fontSize(14).text('Amount Summary:', 50, startY);
    
    doc.fillColor('#6b7280').fontSize(12);
    
    // Subtotal (assuming no taxes for now)
    doc.text('Subtotal:', 400, startY + 25);
    doc.text(`₦${invoice.totalAmount.toFixed(2)}`, 480, startY + 25, { align: 'right' });
    
    // Total
    doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold');
    doc.text('Total:', 400, startY + 50);
    doc.text(`₦${invoice.totalAmount.toFixed(2)}`, 480, startY + 50, { align: 'right' });
    
    // Status
    doc.fillColor('#6b7280').fontSize(12).font('Helvetica');
    doc.text('Status:', 400, startY + 75);
    
    const statusColor = invoice.status === 'PAID' ? '#059669' : 
                       invoice.status === 'PENDING' ? '#d97706' : '#dc2626';
    
    doc.fillColor(statusColor).text(invoice.status, 450, startY + 75);
  }

  private addFooter(doc: typeof PDFDocument): void {
    const footerY = 650;
    
    // Horizontal line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, footerY).lineTo(545, footerY).stroke();
    
    // Thank you message
    doc.fillColor('#6b7280').fontSize(12).text('Thank you for your business!', 50, footerY + 20, { align: 'center' });
    
    // Company info
    doc.fontSize(10).text('Gatherraa - Workspace Management Platform', 50, footerY + 40, { align: 'center' });
    doc.text('support@gatherraa.com | www.gatherraa.com', 50, footerY + 55, { align: 'center' });
  }
}
