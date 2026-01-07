/**
 * PDF Report Generator
 * Professional tax report generator using jsPDF
 *
 * Note: This module requires jsPDF to be loaded externally
 * Include in HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 */

class PDFGenerator {
    constructor() {
        this.pageWidth = 210; // A4 width in mm
        this.pageHeight = 297; // A4 height in mm
        this.margin = 20;
        this.lineHeight = 7;
        this.currentY = this.margin;
        this.primaryColor = [12, 75, 51]; // Pakistan green RGB
    }

    /**
     * Check if jsPDF is available
     */
    isAvailable() {
        return typeof window !== 'undefined' && typeof window.jspdf !== 'undefined';
    }

    /**
     * Initialize new PDF document
     */
    _initDocument() {
        if (!this.isAvailable()) {
            throw new Error('jsPDF library not loaded. Please include jsPDF in your HTML.');
        }

        const { jsPDF } = window.jspdf;
        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        this.currentY = this.margin;
        this.pageNumber = 1;
    }

    /**
     * Add new page with header
     */
    _addPage() {
        this.doc.addPage();
        this.currentY = this.margin;
        this.pageNumber++;
    }

    /**
     * Check if need new page
     */
    _checkPageBreak(requiredSpace = 20) {
        if (this.currentY + requiredSpace > this.pageHeight - this.margin - 15) {
            this._addPage();
            return true;
        }
        return false;
    }

    /**
     * Add text with styling
     */
    _addText(text, fontSize = 10, fontStyle = 'normal', align = 'left', color = null) {
        this._checkPageBreak();

        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', fontStyle);

        if (color) {
            this.doc.setTextColor(color[0], color[1], color[2]);
        } else {
            this.doc.setTextColor(0, 0, 0);
        }

        const maxWidth = this.pageWidth - (2 * this.margin);
        const lines = this.doc.splitTextToSize(text, maxWidth);

        for (const line of lines) {
            this._checkPageBreak();

            const x = align === 'center' ? this.pageWidth / 2 :
                      align === 'right' ? this.pageWidth - this.margin :
                      this.margin;

            this.doc.text(line, x, this.currentY, { align: align });
            this.currentY += this.lineHeight;
        }
    }

    /**
     * Add horizontal line
     */
    _addLine(color = null) {
        if (color) {
            this.doc.setDrawColor(color[0], color[1], color[2]);
        } else {
            this.doc.setDrawColor(200, 200, 200);
        }
        this.doc.setLineWidth(0.3);
        this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
        this.currentY += 5;
    }

    /**
     * Add spacing
     */
    _addSpace(mm = 5) {
        this.currentY += mm;
    }

    /**
     * Format currency with Pakistani rupee notation
     */
    _formatCurrency(amount) {
        const formatted = Math.abs(amount).toFixed(2);
        const [integer, decimal] = formatted.split('.');

        // Pakistani number format: 1,50,000 (lakhs system)
        let result = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        return `Rs. ${amount < 0 ? '-' : ''}${result}.${decimal}`;
    }

    /**
     * Format date
     */
    _formatDate(date) {
        return new Date(date).toLocaleDateString('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Get fiscal year string
     */
    _getFiscalYear() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        if (currentMonth >= 7) {
            return `FY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
        } else {
            return `FY ${currentYear - 1}-${currentYear.toString().slice(-2)}`;
        }
    }

    /**
     * Add table
     */
    _addTable(headers, rows, columnWidths) {
        this._checkPageBreak(30);

        const startY = this.currentY;
        const startX = this.margin;
        const rowHeight = 8;

        // Header row
        this.doc.setFillColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');

        this.doc.rect(startX, startY, this.pageWidth - 2 * this.margin, rowHeight, 'F');

        let x = startX + 2;
        for (let i = 0; i < headers.length; i++) {
            this.doc.text(headers[i], x, startY + 6);
            x += columnWidths[i];
        }

        this.currentY = startY + rowHeight;

        // Data rows
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8);

        for (let i = 0; i < rows.length; i++) {
            this._checkPageBreak(rowHeight + 5);

            // Alternating row colors
            if (i % 2 === 0) {
                this.doc.setFillColor(245, 245, 245);
                this.doc.rect(startX, this.currentY, this.pageWidth - 2 * this.margin, rowHeight, 'F');
            }

            x = startX + 2;
            for (let j = 0; j < rows[i].length; j++) {
                const text = String(rows[i][j]);
                const maxWidth = columnWidths[j] - 4;
                const lines = this.doc.splitTextToSize(text, maxWidth);
                this.doc.text(lines[0], x, this.currentY + 6);
                x += columnWidths[j];
            }

            this.currentY += rowHeight;
        }

        this._addSpace(5);
    }

    /**
     * Add page footer with page numbers
     */
    _addFooters(totalPages) {
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(128, 128, 128);

            // Page number
            this.doc.text(
                `Page ${i} of ${totalPages}`,
                this.pageWidth / 2,
                this.pageHeight - 10,
                { align: 'center' }
            );

            // Generator credit
            this.doc.setFont('helvetica', 'italic');
            this.doc.text(
                'Generated with Pakistan Stock Tax Calculator',
                this.pageWidth / 2,
                this.pageHeight - 5,
                { align: 'center' }
            );
        }
    }

    /**
     * Generate comprehensive capital gains tax report
     */
    generateTaxReport(fifoQueue, taxCalculator, transactions, filename = null) {
        this._initDocument();

        const fiscalYear = this._getFiscalYear();
        const generatedDate = new Date();

        // Auto-generate filename if not provided
        if (!filename) {
            const year = fiscalYear.replace('FY ', '').replace('-', '-20');
            filename = `PSX_Tax_Report_${year}.pdf`;
        }

        // ===== COVER PAGE =====
        this._addSpace(80);

        // Logo/App name
        this.doc.setFontSize(24);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
        this.doc.text('Pakistan Stock Tax Calculator', this.pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += 15;

        // Report title
        this.doc.setFontSize(20);
        this.doc.setTextColor(0, 0, 0);
        this.doc.text('Capital Gains Tax Report', this.pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += 20;

        // Fiscal year
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'normal');
        const fyStart = fiscalYear.includes('24-25') ? 'July 1, 2024 - June 30, 2025' :
                        `Fiscal Year: ${fiscalYear}`;
        this.doc.text(fyStart, this.pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += 15;

        // Generated date
        this.doc.setFontSize(10);
        this.doc.text(
            `Generated: ${this._formatDate(generatedDate)} at ${generatedDate.toLocaleTimeString('en-US')}`,
            this.pageWidth / 2,
            this.currentY,
            { align: 'center' }
        );
        this.currentY += 10;

        // Taxpayer status
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        const statusColor = taxCalculator.isFiler ? [16, 185, 129] : [239, 68, 68];
        this.doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        this.doc.text(
            `Taxpayer Status: ${taxCalculator.isFiler ? 'Filer' : 'Non-Filer'}`,
            this.pageWidth / 2,
            this.currentY,
            { align: 'center' }
        );

        // ===== EXECUTIVE SUMMARY =====
        this._addPage();
        this._addText('EXECUTIVE SUMMARY', 16, 'bold', 'left', this.primaryColor);
        this._addSpace(3);
        this._addLine(this.primaryColor);
        this._addSpace(5);

        // Calculate aggregates
        const realizedGains = fifoQueue.realizedGains || [];
        let totalProceeds = 0;
        let totalCostBasis = 0;
        let totalGains = 0;
        let totalLosses = 0;
        let totalTax = 0;

        for (const gain of realizedGains) {
            totalProceeds += gain.saleProceeds;
            totalCostBasis += gain.totalCostBasis;
            if (gain.capitalGain > 0) {
                totalGains += gain.capitalGain;
            } else {
                totalLosses += Math.abs(gain.capitalGain);
            }
            const taxCalc = taxCalculator.calculateTaxForSale(gain);
            totalTax += taxCalc.totalTax;
        }

        const netGains = totalGains - totalLosses;
        const netAfterTax = netGains - totalTax;

        // Summary boxes
        this.doc.setFillColor(245, 247, 250);
        this.doc.roundedRect(this.margin, this.currentY, (this.pageWidth - 2 * this.margin) / 2 - 5, 25, 3, 3, 'F');
        this.doc.roundedRect(this.pageWidth / 2 + 2.5, this.currentY, (this.pageWidth - 2 * this.margin) / 2 - 5, 25, 3, 3, 'F');

        this.doc.setFontSize(9);
        this.doc.setTextColor(100, 100, 100);
        this.doc.text('Total Proceeds from Sales', this.margin + 5, this.currentY + 8);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(0, 0, 0);
        this.doc.text(this._formatCurrency(totalProceeds), this.margin + 5, this.currentY + 18);

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);
        this.doc.text('Total Cost Basis', this.pageWidth / 2 + 7.5, this.currentY + 8);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(0, 0, 0);
        this.doc.text(this._formatCurrency(totalCostBasis), this.pageWidth / 2 + 7.5, this.currentY + 18);

        this.currentY += 30;

        this.doc.setFillColor(245, 247, 250);
        this.doc.roundedRect(this.margin, this.currentY, (this.pageWidth - 2 * this.margin) / 2 - 5, 25, 3, 3, 'F');
        this.doc.roundedRect(this.pageWidth / 2 + 2.5, this.currentY, (this.pageWidth - 2 * this.margin) / 2 - 5, 25, 3, 3, 'F');

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);
        this.doc.text('Net Capital Gains', this.margin + 5, this.currentY + 8);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        const gainsColor = netGains >= 0 ? [16, 185, 129] : [239, 68, 68];
        this.doc.setTextColor(gainsColor[0], gainsColor[1], gainsColor[2]);
        this.doc.text(this._formatCurrency(netGains), this.margin + 5, this.currentY + 18);

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);
        this.doc.text('Total Tax Liability', this.pageWidth / 2 + 7.5, this.currentY + 8);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(239, 68, 68);
        this.doc.text(this._formatCurrency(totalTax), this.pageWidth / 2 + 7.5, this.currentY + 18);

        this.currentY += 30;
        this._addSpace(5);

        // ===== TRANSACTION DETAILS TABLE =====
        this._addText('TRANSACTION DETAILS', 14, 'bold', 'left', this.primaryColor);
        this._addSpace(3);
        this._addLine(this.primaryColor);
        this._addSpace(5);

        if (transactions && transactions.length > 0) {
            const headers = ['Date', 'Stock', 'Type', 'Qty', 'Price', 'Amount'];
            const columnWidths = [25, 25, 18, 18, 25, 30];
            const rows = [];

            for (const txn of transactions) {
                rows.push([
                    this._formatDate(txn.tradeDate),
                    txn.symbol,
                    txn.type,
                    txn.quantity,
                    this._formatCurrency(txn.price),
                    this._formatCurrency(txn.quantity * txn.price + (txn.commission || 0))
                ]);
            }

            this._addTable(headers, rows, columnWidths);
        } else {
            this._addText('No transactions recorded.', 10, 'italic');
            this._addSpace(10);
        }

        // ===== FIFO BREAKDOWN FOR EACH SALE =====
        if (realizedGains.length > 0) {
            this._addText('FIFO SALE BREAKDOWN', 14, 'bold', 'left', this.primaryColor);
            this._addSpace(3);
            this._addLine(this.primaryColor);
            this._addSpace(5);

            for (let i = 0; i < realizedGains.length; i++) {
                const sale = realizedGains[i];
                this._checkPageBreak(40);

                // Sale header
                this._addText(
                    `Sale #${i + 1}: ${sale.quantitySold} shares of ${sale.symbol} on ${this._formatDate(sale.saleDate)}`,
                    11,
                    'bold'
                );
                this._addSpace(2);

                // Lot breakdown
                if (sale.lots && sale.lots.length > 0) {
                    for (let j = 0; j < sale.lots.length; j++) {
                        const lot = sale.lots[j];
                        const purchaseDate = new Date(lot.purchaseDate);
                        const saleDate = new Date(sale.saleDate);
                        const holdingDays = Math.floor((saleDate - purchaseDate) / (1000 * 60 * 60 * 24));

                        this._addText(
                            `  Lot ${j + 1}: ${lot.quantity} shares purchased ${this._formatDate(lot.purchaseDate)} @ ${this._formatCurrency(lot.pricePerShare)} (${holdingDays} days holding)`,
                            9
                        );
                    }
                }

                this._addSpace(2);

                // Summary for this sale
                this.doc.setFillColor(250, 250, 250);
                this.doc.roundedRect(this.margin + 5, this.currentY, this.pageWidth - 2 * this.margin - 10, 30, 2, 2, 'F');

                const taxCalc = taxCalculator.calculateTaxForSale(sale);

                this.doc.setFontSize(9);
                this.doc.setTextColor(0, 0, 0);
                this.doc.text(`Total Cost Basis: ${this._formatCurrency(sale.totalCostBasis)}`, this.margin + 10, this.currentY + 8);
                this.doc.text(`Proceeds: ${this._formatCurrency(sale.saleProceeds)}`, this.margin + 10, this.currentY + 14);
                this.doc.text(`Capital Gain: ${this._formatCurrency(sale.capitalGain)}`, this.margin + 10, this.currentY + 20);
                this.doc.text(`Tax Rate: 15%`, this.margin + 10, this.currentY + 26);

                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(239, 68, 68);
                this.doc.text(`Tax: ${this._formatCurrency(taxCalc.totalTax)}`, this.pageWidth / 2 + 10, this.currentY + 26);

                this.currentY += 35;
                this._addSpace(5);
            }
        }

        // ===== TAX CALCULATION SUMMARY =====
        this._checkPageBreak(80);
        this._addText('TAX CALCULATION SUMMARY', 14, 'bold', 'left', this.primaryColor);
        this._addSpace(3);
        this._addLine(this.primaryColor);
        this._addSpace(5);

        this._addText(`Gains by Holding Period:`, 11, 'bold');
        this._addSpace(2);
        this._addText(`  All holdings taxed at flat rate of 15% (Post July 1, 2024)`, 9);
        this._addSpace(5);

        this._addText(`Total Realized Gains: ${this._formatCurrency(totalGains)}`, 10);
        this._addText(`Total Realized Losses: ${this._formatCurrency(totalLosses)}`, 10);
        this._addText(`Net Gains: ${this._formatCurrency(netGains)}`, 11, 'bold');
        this._addSpace(3);
        this._addText(`Tax Rate: 15.0%`, 10);
        this._addText(`Total Tax Due: ${this._formatCurrency(totalTax)}`, 12, 'bold', 'left', [239, 68, 68]);
        this._addSpace(5);

        // ===== DISCLAIMER =====
        this._checkPageBreak(40);
        this._addText('DISCLAIMER', 12, 'bold');
        this._addSpace(3);
        this._addLine();
        this._addSpace(3);

        this._addText(
            'This report is for informational purposes only. Consult a tax professional for official tax filing. ' +
            'This app uses FIFO (First-In-First-Out) methodology as prescribed by NCCPL/FBR regulations. ' +
            'Tax laws are subject to change. The calculator assumes a flat 15% CGT rate applicable to securities acquired ' +
            'after July 1, 2024. Please verify current tax rates and regulations with FBR before filing.',
            9,
            'normal'
        );

        // Add footers to all pages
        const totalPages = this.doc.internal.getNumberOfPages();
        this._addFooters(totalPages);

        // Save PDF
        this.doc.save(filename);
        console.log(`✓ PDF Tax Report generated: ${filename}`);

        return filename;
    }

    /**
     * Generate holdings report (legacy method - kept for compatibility)
     */
    generateHoldingsReport(holdings, currentPrices = {}, filename = 'PSX_Holdings_Report.pdf') {
        this._initDocument();

        // Header
        this._addSpace(40);
        this._addText('Pakistan Stock Tax Calculator', 18, 'bold', 'center', this.primaryColor);
        this._addText('Portfolio Holdings Report', 14, 'bold', 'center');
        this._addSpace(10);
        this._addText(`Generated: ${this._formatDate(new Date())}`, 10, 'normal', 'center');

        this._addPage();

        // Holdings details
        this._addText('CURRENT HOLDINGS', 14, 'bold', 'left', this.primaryColor);
        this._addLine(this.primaryColor);
        this._addSpace(5);

        let totalCost = 0;
        let totalValue = 0;

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol] || 0;
            const value = holding.totalQuantity * currentPrice;
            const pnl = value - holding.totalCostBasis;

            totalCost += holding.totalCostBasis;
            totalValue += value;

            this._checkPageBreak(30);

            this._addText(`${symbol}`, 11, 'bold');
            this._addText(`  Quantity: ${holding.totalQuantity} shares`, 9);
            this._addText(`  Average Cost: ${this._formatCurrency(holding.averageCost)}`, 9);
            this._addText(`  Total Cost: ${this._formatCurrency(holding.totalCostBasis)}`, 9);
            if (currentPrice > 0) {
                this._addText(`  Current Price: ${this._formatCurrency(currentPrice)}`, 9);
                this._addText(`  Current Value: ${this._formatCurrency(value)}`, 9);
                const pnlColor = pnl >= 0 ? [16, 185, 129] : [239, 68, 68];
                this._addText(`  Unrealized P&L: ${this._formatCurrency(pnl)}`, 9, 'bold', 'left', pnlColor);
            }
            this._addSpace(5);
        }

        // Summary
        this._addLine();
        this._addText('PORTFOLIO SUMMARY', 12, 'bold');
        this._addText(`Total Cost Basis: ${this._formatCurrency(totalCost)}`, 10);
        this._addText(`Total Current Value: ${this._formatCurrency(totalValue)}`, 10);
        this._addText(`Total Unrealized P&L: ${this._formatCurrency(totalValue - totalCost)}`, 11, 'bold');

        const totalPages = this.doc.internal.getNumberOfPages();
        this._addFooters(totalPages);

        this.doc.save(filename);
        console.log(`✓ PDF Holdings Report generated: ${filename}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFGenerator;
}
