/**
 * Pakistan Capital Gains Tax (CGT) Calculator
 * For Pakistan Stock Exchange securities
 *
 * Tax Rules (as of July 1, 2024):
 * - Flat 15% CGT on securities acquired after July 1, 2024
 * - Different rates apply based on filer/non-filer status
 * - Holding period affects tax treatment in some cases
 */

class TaxCalculator {
    constructor() {
        // Cut-off date for new tax regime (July 1, 2024)
        this.newRegimeCutoff = new Date('2024-07-01');

        // Tax rates for securities acquired AFTER July 1, 2024
        this.taxRates = {
            filer: {
                default: 0.15  // 15% flat rate
            },
            nonFiler: {
                default: 0.15  // 15% flat rate (same for non-filers on securities)
            }
        };

        // Historical rates (for securities acquired BEFORE July 1, 2024)
        // These may vary based on holding period
        this.legacyRates = {
            filer: {
                lessThan1Year: 0.15,      // Short-term: 15%
                oneToTwoYears: 0.125,     // 12.5%
                twoToThreeYears: 0.10,    // 10%
                threeToFourYears: 0.075,  // 7.5%
                fourPlusYears: 0.00       // Exempt after 4 years
            },
            nonFiler: {
                lessThan1Year: 0.15,
                oneToTwoYears: 0.15,
                twoToThreeYears: 0.15,
                threeToFourYears: 0.15,
                fourPlusYears: 0.15       // Non-filers don't get exemption
            }
        };

        // User's filer status (default: filer)
        this.isFiler = true;
    }

    /**
     * Set filer/non-filer status
     * @param {boolean} isFiler - True if taxpayer is a filer
     */
    setFilerStatus(isFiler) {
        this.isFiler = isFiler;
        console.log(`✓ Filer status set to: ${isFiler ? 'Filer' : 'Non-Filer'}`);
    }

    /**
     * Get tax rate based on purchase date and holding period
     * @param {Date} purchaseDate - Purchase settlement date
     * @param {number} holdingDays - Number of days held
     * @returns {number} Tax rate (decimal, e.g., 0.15 for 15%)
     */
    getTaxRate(purchaseDate, holdingDays) {
        const purchase = new Date(purchaseDate);

        // Check if acquired after new regime cutoff (July 1, 2024)
        if (purchase >= this.newRegimeCutoff) {
            // Flat 15% for all securities acquired after July 1, 2024
            return this.isFiler ?
                this.taxRates.filer.default :
                this.taxRates.nonFiler.default;
        }

        // Legacy rules for securities acquired before July 1, 2024
        const rates = this.isFiler ? this.legacyRates.filer : this.legacyRates.nonFiler;

        // Determine rate based on holding period
        if (holdingDays < 365) {
            return rates.lessThan1Year;
        } else if (holdingDays < 730) {  // 365 * 2
            return rates.oneToTwoYears;
        } else if (holdingDays < 1095) {  // 365 * 3
            return rates.twoToThreeYears;
        } else if (holdingDays < 1460) {  // 365 * 4
            return rates.threeToFourYears;
        } else {
            return rates.fourPlusYears;
        }
    }

    /**
     * Calculate tax for a single sale
     * @param {object} saleResult - Result from FIFOQueue.calculateSale()
     * @returns {object} Tax calculation details
     */
    calculateTaxForSale(saleResult) {
        const taxByLot = [];
        let totalTax = 0;

        // Calculate tax for each lot used in the sale
        for (const lot of saleResult.lotsUsed) {
            const taxRate = this.getTaxRate(
                lot.purchaseDate,
                lot.holdingPeriod.days
            );

            // Calculate gain for this specific lot
            const lotGain = (saleResult.sellPrice - lot.costPerShare) * lot.quantity;

            // Tax only applies to gains (not losses)
            const taxableGain = Math.max(0, lotGain);
            const lotTax = taxableGain * taxRate;

            totalTax += lotTax;

            taxByLot.push({
                purchaseDate: lot.purchaseDate,
                quantity: lot.quantity,
                costPerShare: lot.costPerShare,
                sellPrice: saleResult.sellPrice,
                gain: lotGain,
                taxableGain: taxableGain,
                taxRate: taxRate,
                taxRatePercentage: (taxRate * 100).toFixed(2) + '%',
                tax: lotTax,
                holdingPeriod: lot.holdingPeriod
            });
        }

        return {
            symbol: saleResult.symbol,
            quantitySold: saleResult.quantitySold,
            saleProceeds: saleResult.saleProceeds,
            totalCostBasis: saleResult.totalCostBasis,
            capitalGain: saleResult.capitalGain,
            taxableGain: Math.max(0, saleResult.capitalGain),
            totalTax: totalTax,
            netProfit: saleResult.capitalGain - totalTax,
            effectiveTaxRate: saleResult.capitalGain > 0 ?
                (totalTax / saleResult.capitalGain) : 0,
            taxByLot: taxByLot,
            saleDate: saleResult.saleDate,
            isFiler: this.isFiler
        };
    }

    /**
     * Calculate aggregate tax for multiple sales
     * @param {Array} salesResults - Array of sale results from FIFOQueue
     * @returns {object} Aggregate tax summary
     */
    calculateAggregateTax(salesResults) {
        let totalGains = 0;
        let totalLosses = 0;
        let totalTax = 0;
        const salesWithTax = [];

        for (const sale of salesResults) {
            const taxCalc = this.calculateTaxForSale(sale);
            salesWithTax.push(taxCalc);

            if (taxCalc.capitalGain > 0) {
                totalGains += taxCalc.capitalGain;
            } else {
                totalLosses += Math.abs(taxCalc.capitalGain);
            }

            totalTax += taxCalc.totalTax;
        }

        const netGain = totalGains - totalLosses;

        return {
            totalGains: totalGains,
            totalLosses: totalLosses,
            netGain: netGain,
            totalTax: totalTax,
            netProfitAfterTax: netGain - totalTax,
            effectiveTaxRate: netGain > 0 ? (totalTax / netGain) : 0,
            salesCount: salesResults.length,
            salesWithTax: salesWithTax,
            isFiler: this.isFiler,
            calculationDate: new Date()
        };
    }

    /**
     * Calculate potential tax savings by delaying sale
     * @param {object} saleResult - Result from FIFOQueue.calculateSale()
     * @param {number} daysToDelay - Number of days to delay the sale
     * @returns {object} Tax savings analysis
     */
    analyzeDelayBenefit(saleResult, daysToDelay) {
        const currentTaxCalc = this.calculateTaxForSale(saleResult);

        // Simulate delayed sale
        const delayedDate = new Date(saleResult.saleDate);
        delayedDate.setDate(delayedDate.getDate() + daysToDelay);

        const delayedResult = { ...saleResult, saleDate: delayedDate };

        // Recalculate lots with increased holding period
        delayedResult.lotsUsed = saleResult.lotsUsed.map(lot => {
            const newHoldingDays = lot.holdingPeriod.days + daysToDelay;
            const newHoldingPeriod = {
                ...lot.holdingPeriod,
                days: newHoldingDays,
                isLongTerm: newHoldingDays >= 365
            };

            return {
                ...lot,
                holdingPeriod: newHoldingPeriod
            };
        });

        const delayedTaxCalc = this.calculateTaxForSale(delayedResult);

        const taxSavings = currentTaxCalc.totalTax - delayedTaxCalc.totalTax;

        return {
            currentTax: currentTaxCalc.totalTax,
            delayedTax: delayedTaxCalc.totalTax,
            taxSavings: taxSavings,
            savingsPercentage: currentTaxCalc.totalTax > 0 ?
                (taxSavings / currentTaxCalc.totalTax * 100) : 0,
            daysToDelay: daysToDelay,
            delayedSaleDate: delayedDate,
            recommendation: taxSavings > 0 ?
                `Consider delaying sale by ${daysToDelay} days to save Rs. ${taxSavings.toFixed(2)} in taxes` :
                'No tax benefit from delaying this sale'
        };
    }

    /**
     * Generate tax summary report
     * @param {object} aggregateTax - Result from calculateAggregateTax()
     * @returns {string} Formatted text report
     */
    generateReport(aggregateTax) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('PAKISTAN STOCK EXCHANGE - CAPITAL GAINS TAX REPORT');
        lines.push('='.repeat(60));
        lines.push('');
        lines.push(`Taxpayer Status: ${aggregateTax.isFiler ? 'Filer' : 'Non-Filer'}`);
        lines.push(`Report Date: ${aggregateTax.calculationDate.toLocaleDateString()}`);
        lines.push('');
        lines.push('-'.repeat(60));
        lines.push('SUMMARY');
        lines.push('-'.repeat(60));
        lines.push(`Total Realized Gains:     Rs. ${aggregateTax.totalGains.toFixed(2)}`);
        lines.push(`Total Realized Losses:    Rs. ${aggregateTax.totalLosses.toFixed(2)}`);
        lines.push(`Net Capital Gain:         Rs. ${aggregateTax.netGain.toFixed(2)}`);
        lines.push(`Total Tax Liability:      Rs. ${aggregateTax.totalTax.toFixed(2)}`);
        lines.push(`Net Profit After Tax:     Rs. ${aggregateTax.netProfitAfterTax.toFixed(2)}`);
        lines.push(`Effective Tax Rate:       ${(aggregateTax.effectiveTaxRate * 100).toFixed(2)}%`);
        lines.push('');

        lines.push('-'.repeat(60));
        lines.push('TRANSACTION DETAILS');
        lines.push('-'.repeat(60));

        for (let i = 0; i < aggregateTax.salesWithTax.length; i++) {
            const sale = aggregateTax.salesWithTax[i];
            lines.push('');
            lines.push(`Sale #${i + 1}: ${sale.symbol}`);
            lines.push(`  Quantity Sold:          ${sale.quantitySold}`);
            lines.push(`  Sale Proceeds:          Rs. ${sale.saleProceeds.toFixed(2)}`);
            lines.push(`  Cost Basis:             Rs. ${sale.totalCostBasis.toFixed(2)}`);
            lines.push(`  Capital Gain:           Rs. ${sale.capitalGain.toFixed(2)}`);
            lines.push(`  Tax Liability:          Rs. ${sale.totalTax.toFixed(2)}`);
            lines.push(`  Net Profit:             Rs. ${sale.netProfit.toFixed(2)}`);

            if (sale.taxByLot.length > 1) {
                lines.push(`  Lots Used:              ${sale.taxByLot.length}`);
                for (let j = 0; j < sale.taxByLot.length; j++) {
                    const lot = sale.taxByLot[j];
                    lines.push(`    Lot ${j + 1}: ${lot.quantity} shares @ Rs. ${lot.costPerShare} (${lot.taxRatePercentage} tax)`);
                }
            }
        }

        lines.push('');
        lines.push('='.repeat(60));

        return lines.join('\n');
    }

    /**
     * Get tax rate explanation for a specific scenario
     * @param {Date} purchaseDate - Purchase date
     * @param {number} holdingDays - Holding period in days
     * @returns {string} Explanation of tax rate
     */
    getTaxRateExplanation(purchaseDate, holdingDays) {
        const purchase = new Date(purchaseDate);
        const rate = this.getTaxRate(purchaseDate, holdingDays);
        const ratePercent = (rate * 100).toFixed(2);

        if (purchase >= this.newRegimeCutoff) {
            return `${ratePercent}% - Flat rate for securities acquired after July 1, 2024`;
        }

        const status = this.isFiler ? 'Filer' : 'Non-Filer';
        const years = Math.floor(holdingDays / 365);

        if (holdingDays < 365) {
            return `${ratePercent}% - Short-term holding (less than 1 year) [${status}]`;
        } else if (holdingDays < 730) {
            return `${ratePercent}% - Held for ${years}-2 years [${status}]`;
        } else if (holdingDays < 1095) {
            return `${ratePercent}% - Held for ${years}-3 years [${status}]`;
        } else if (holdingDays < 1460) {
            return `${ratePercent}% - Held for ${years}-4 years [${status}]`;
        } else {
            return this.isFiler ?
                `${ratePercent}% - Exempt after 4 years [${status}]` :
                `${ratePercent}% - No exemption for non-filers [${status}]`;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaxCalculator;
}
