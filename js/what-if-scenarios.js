/**
 * What-If Scenarios - Tax Optimization Analyzer
 * Provides insights and suggestions for tax-efficient trading
 *
 * Features:
 * - Tax loss harvesting opportunities
 * - Optimal sale timing analysis
 * - Lot selection optimization
 * - Filer vs non-filer comparison
 * - Holding period optimization
 */

class WhatIfScenarios {
    constructor(fifoQueue, taxCalculator) {
        this.fifoQueue = fifoQueue;
        this.taxCalculator = taxCalculator;
    }

    /**
     * Analyze optimal sale timing for tax efficiency
     * @param {string} symbol - Stock symbol
     * @param {number} quantity - Shares to sell
     * @param {number} currentPrice - Current market price
     * @returns {object} Timing recommendations
     */
    analyzeOptimalTiming(symbol, quantity, currentPrice) {
        const holdings = this.fifoQueue.holdings[symbol.toUpperCase()];

        if (!holdings || holdings.length === 0) {
            throw new Error(`No holdings found for ${symbol}`);
        }

        const today = new Date();
        const scenarios = [];

        // Scenario 1: Sell today
        const sellToday = this.fifoQueue.calculateSale(symbol, quantity, currentPrice, today);
        const taxToday = this.taxCalculator.calculateTaxForSale(sellToday);
        scenarios.push({
            scenario: 'Sell Today',
            date: today,
            daysFromNow: 0,
            tax: taxToday.totalTax,
            netProfit: taxToday.netProfit,
            effectiveTaxRate: taxToday.effectiveTaxRate
        });

        // Scenario 2-5: Sell after various delays
        const delays = [30, 90, 180, 365]; // 1 month, 3 months, 6 months, 1 year

        for (const days of delays) {
            const futureDate = new Date(today);
            futureDate.setDate(futureDate.getDate() + days);

            try {
                const sellFuture = this.fifoQueue.calculateSale(symbol, quantity, currentPrice, futureDate);
                const taxFuture = this.taxCalculator.calculateTaxForSale(sellFuture);

                scenarios.push({
                    scenario: `Sell in ${days} days`,
                    date: futureDate,
                    daysFromNow: days,
                    tax: taxFuture.totalTax,
                    netProfit: taxFuture.netProfit,
                    effectiveTaxRate: taxFuture.effectiveTaxRate,
                    taxSavings: taxToday.totalTax - taxFuture.totalTax
                });
            } catch (e) {
                console.warn(`Cannot calculate scenario for ${days} days:`, e.message);
            }
        }

        // Find optimal scenario (lowest tax)
        const optimal = scenarios.reduce((best, current) =>
            current.tax < best.tax ? current : best
        );

        return {
            symbol: symbol,
            quantity: quantity,
            currentPrice: currentPrice,
            scenarios: scenarios,
            optimal: optimal,
            recommendation: this._generateTimingRecommendation(scenarios, optimal)
        };
    }

    /**
     * Generate recommendation text for optimal timing
     * @private
     */
    _generateTimingRecommendation(scenarios, optimal) {
        const sellToday = scenarios[0];
        const savingsPotential = sellToday.tax - optimal.tax;

        if (savingsPotential <= 0) {
            return 'Sell now - no tax benefit from waiting';
        }

        const savingsPercent = (savingsPotential / sellToday.tax * 100).toFixed(1);

        return `Wait ${optimal.daysFromNow} days to save Rs. ${savingsPotential.toFixed(2)} (${savingsPercent}% reduction)`;
    }

    /**
     * Identify tax loss harvesting opportunities
     * @param {number} currentPrices - Object with symbol: price pairs
     * @returns {Array} Array of loss harvesting opportunities
     */
    identifyTaxLossHarvesting(currentPrices) {
        const opportunities = [];
        const holdings = this.fifoQueue.getHoldings();

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (!currentPrice) {
                continue;
            }

            const currentValue = holding.totalQuantity * currentPrice;
            const unrealizedGainLoss = currentValue - holding.totalCostBasis;

            // Look for losses (negative unrealized gain)
            if (unrealizedGainLoss < 0) {
                const sellSimulation = this.fifoQueue.calculateSale(
                    symbol,
                    holding.totalQuantity,
                    currentPrice,
                    new Date()
                );

                opportunities.push({
                    symbol: symbol,
                    quantity: holding.totalQuantity,
                    costBasis: holding.totalCostBasis,
                    currentValue: currentValue,
                    unrealizedLoss: Math.abs(unrealizedGainLoss),
                    lossPercentage: (unrealizedGainLoss / holding.totalCostBasis * 100).toFixed(2),
                    currentPrice: currentPrice,
                    averageCost: holding.averageCost,
                    recommendation: `Sell to realize loss of Rs. ${Math.abs(unrealizedGainLoss).toFixed(2)} for tax offset`
                });
            }
        }

        // Sort by loss amount (largest first)
        opportunities.sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);

        return opportunities;
    }

    /**
     * Compare filer vs non-filer tax impact
     * @param {object} saleResult - Sale result from FIFO queue
     * @returns {object} Comparison analysis
     */
    compareFilerStatus(saleResult) {
        const originalStatus = this.taxCalculator.isFiler;

        // Calculate as filer
        this.taxCalculator.setFilerStatus(true);
        const filerTax = this.taxCalculator.calculateTaxForSale(saleResult);

        // Calculate as non-filer
        this.taxCalculator.setFilerStatus(false);
        const nonFilerTax = this.taxCalculator.calculateTaxForSale(saleResult);

        // Restore original status
        this.taxCalculator.setFilerStatus(originalStatus);

        const taxDifference = nonFilerTax.totalTax - filerTax.totalTax;

        return {
            symbol: saleResult.symbol,
            capitalGain: saleResult.capitalGain,
            filer: {
                tax: filerTax.totalTax,
                netProfit: filerTax.netProfit,
                effectiveRate: filerTax.effectiveTaxRate
            },
            nonFiler: {
                tax: nonFilerTax.totalTax,
                netProfit: nonFilerTax.netProfit,
                effectiveRate: nonFilerTax.effectiveTaxRate
            },
            taxDifference: taxDifference,
            savingsByBeingFiler: taxDifference,
            recommendation: taxDifference > 0 ?
                `Being a filer saves Rs. ${taxDifference.toFixed(2)} on this transaction` :
                'No tax difference between filer and non-filer for this transaction'
        };
    }

    /**
     * Analyze portfolio-wide tax efficiency
     * @param {object} currentPrices - Object with symbol: price pairs
     * @returns {object} Portfolio tax analysis
     */
    analyzePortfolioTaxEfficiency(currentPrices) {
        const holdings = this.fifoQueue.getHoldings();
        const stockAnalysis = [];
        let totalUnrealizedGains = 0;
        let totalUnrealizedLosses = 0;
        let totalTaxLiability = 0;

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (!currentPrice) {
                console.warn(`No price provided for ${symbol}`);
                continue;
            }

            const currentValue = holding.totalQuantity * currentPrice;
            const unrealizedGainLoss = currentValue - holding.totalCostBasis;

            // Simulate sale to calculate tax
            try {
                const saleSimulation = this.fifoQueue.calculateSale(
                    symbol,
                    holding.totalQuantity,
                    currentPrice,
                    new Date()
                );

                const taxCalc = this.taxCalculator.calculateTaxForSale(saleSimulation);

                if (unrealizedGainLoss > 0) {
                    totalUnrealizedGains += unrealizedGainLoss;
                    totalTaxLiability += taxCalc.totalTax;
                } else {
                    totalUnrealizedLosses += Math.abs(unrealizedGainLoss);
                }

                stockAnalysis.push({
                    symbol: symbol,
                    quantity: holding.totalQuantity,
                    costBasis: holding.totalCostBasis,
                    currentValue: currentValue,
                    unrealizedGainLoss: unrealizedGainLoss,
                    potentialTax: taxCalc.totalTax,
                    netProfitAfterTax: taxCalc.netProfit,
                    effectiveTaxRate: taxCalc.effectiveTaxRate,
                    recommendation: this._generateStockRecommendation(unrealizedGainLoss, taxCalc)
                });
            } catch (e) {
                console.warn(`Cannot analyze ${symbol}:`, e.message);
            }
        }

        const netUnrealizedGain = totalUnrealizedGains - totalUnrealizedLosses;

        return {
            totalUnrealizedGains: totalUnrealizedGains,
            totalUnrealizedLosses: totalUnrealizedLosses,
            netUnrealizedGain: netUnrealizedGain,
            potentialTaxLiability: totalTaxLiability,
            netPortfolioValue: netUnrealizedGain - totalTaxLiability,
            stockAnalysis: stockAnalysis,
            summary: this._generatePortfolioSummary(stockAnalysis, totalTaxLiability)
        };
    }

    /**
     * Generate stock-specific recommendation
     * @private
     */
    _generateStockRecommendation(unrealizedGainLoss, taxCalc) {
        if (unrealizedGainLoss < 0) {
            return `Consider tax loss harvesting - realize loss of Rs. ${Math.abs(unrealizedGainLoss).toFixed(2)}`;
        }

        if (taxCalc.effectiveTaxRate > 0.12) {
            return `High tax rate (${(taxCalc.effectiveTaxRate * 100).toFixed(1)}%) - consider holding longer`;
        }

        return 'Position is tax-efficient';
    }

    /**
     * Generate portfolio summary
     * @private
     */
    _generatePortfolioSummary(stockAnalysis, totalTaxLiability) {
        const losers = stockAnalysis.filter(s => s.unrealizedGainLoss < 0);
        const winners = stockAnalysis.filter(s => s.unrealizedGainLoss > 0);

        const suggestions = [];

        if (losers.length > 0) {
            const totalLosses = losers.reduce((sum, s) => sum + Math.abs(s.unrealizedGainLoss), 0);
            suggestions.push(`${losers.length} positions with losses (Rs. ${totalLosses.toFixed(2)}) - consider tax loss harvesting`);
        }

        if (totalTaxLiability > 0) {
            suggestions.push(`Potential tax liability: Rs. ${totalTaxLiability.toFixed(2)} if all positions are liquidated`);
        }

        if (winners.length > 0 && losers.length > 0) {
            suggestions.push('Consider offsetting gains with losses to minimize tax');
        }

        return suggestions;
    }

    /**
     * Calculate break-even price for a position
     * @param {string} symbol - Stock symbol
     * @param {boolean} includeTax - Include tax in break-even calculation
     * @returns {object} Break-even analysis
     */
    calculateBreakEven(symbol, includeTax = true) {
        const holdings = this.fifoQueue.getHoldings();
        const holding = holdings[symbol.toUpperCase()];

        if (!holding) {
            throw new Error(`No holdings found for ${symbol}`);
        }

        // Break-even without tax
        const breakEvenNoTax = holding.averageCost;

        let breakEvenWithTax = breakEvenNoTax;

        if (includeTax) {
            // Estimate tax rate (use first lot's rate as approximation)
            const firstLot = this.fifoQueue.holdings[symbol.toUpperCase()][0];
            const estimatedHoldingDays = Math.floor((new Date() - firstLot.purchaseDate) / (1000 * 60 * 60 * 24));
            const taxRate = this.taxCalculator.getTaxRate(firstLot.purchaseDate, estimatedHoldingDays);

            // Break-even price must cover cost + tax on gain
            // sellPrice * quantity - costBasis - tax = 0
            // sellPrice * quantity - costBasis - (sellPrice - avgCost) * quantity * taxRate = 0
            // sellPrice = (costBasis + avgCost * quantity * taxRate) / (quantity * (1 - taxRate))
            breakEvenWithTax = holding.averageCost / (1 - taxRate);
        }

        return {
            symbol: symbol,
            quantity: holding.totalQuantity,
            averageCost: holding.averageCost,
            totalCostBasis: holding.totalCostBasis,
            breakEvenNoTax: breakEvenNoTax,
            breakEvenWithTax: breakEvenWithTax,
            taxImpact: breakEvenWithTax - breakEvenNoTax,
            taxImpactPercent: ((breakEvenWithTax - breakEvenNoTax) / breakEvenNoTax * 100).toFixed(2)
        };
    }

    /**
     * Generate tax-efficient rebalancing suggestions
     * @param {object} targetAllocation - Desired allocation { symbol: percentage }
     * @param {object} currentPrices - Current prices { symbol: price }
     * @returns {object} Rebalancing plan with tax considerations
     */
    generateRebalancingPlan(targetAllocation, currentPrices) {
        const holdings = this.fifoQueue.getHoldings();
        const currentAllocation = {};
        let totalValue = 0;

        // Calculate current allocation
        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (currentPrice) {
                const value = holding.totalQuantity * currentPrice;
                totalValue += value;
                currentAllocation[symbol] = value;
            }
        }

        // Calculate rebalancing trades
        const trades = [];

        for (const symbol in targetAllocation) {
            const targetValue = totalValue * (targetAllocation[symbol] / 100);
            const currentValue = currentAllocation[symbol] || 0;
            const difference = targetValue - currentValue;

            if (Math.abs(difference) > 100) { // Only suggest if difference > Rs. 100
                const currentPrice = currentPrices[symbol];
                const quantity = Math.abs(Math.floor(difference / currentPrice));

                if (difference > 0) {
                    trades.push({
                        action: 'BUY',
                        symbol: symbol,
                        quantity: quantity,
                        estimatedValue: difference,
                        taxImpact: 0
                    });
                } else {
                    // Calculate tax impact for sell
                    try {
                        const saleSimulation = this.fifoQueue.calculateSale(symbol, quantity, currentPrice, new Date());
                        const taxCalc = this.taxCalculator.calculateTaxForSale(saleSimulation);

                        trades.push({
                            action: 'SELL',
                            symbol: symbol,
                            quantity: quantity,
                            estimatedValue: Math.abs(difference),
                            taxImpact: taxCalc.totalTax,
                            netProfit: taxCalc.netProfit
                        });
                    } catch (e) {
                        console.warn(`Cannot simulate sale for ${symbol}:`, e.message);
                    }
                }
            }
        }

        const totalTaxImpact = trades.reduce((sum, trade) => sum + (trade.taxImpact || 0), 0);

        return {
            currentAllocation: currentAllocation,
            targetAllocation: targetAllocation,
            totalValue: totalValue,
            trades: trades,
            totalTaxImpact: totalTaxImpact,
            recommendation: totalTaxImpact > totalValue * 0.05 ?
                'High tax impact - consider gradual rebalancing' :
                'Rebalancing is tax-efficient'
        };
    }

    /**
     * Generate comprehensive tax report with optimization suggestions
     * @param {object} currentPrices - Current prices { symbol: price }
     * @returns {object} Comprehensive report
     */
    generateOptimizationReport(currentPrices) {
        const portfolio = this.analyzePortfolioTaxEfficiency(currentPrices);
        const lossHarvesting = this.identifyTaxLossHarvesting(currentPrices);

        const report = {
            generatedAt: new Date(),
            portfolio: portfolio,
            lossHarvestingOpportunities: lossHarvesting,
            topRecommendations: [],
            estimatedTaxSavings: 0
        };

        // Generate top recommendations
        if (lossHarvesting.length > 0) {
            const totalLosses = lossHarvesting.reduce((sum, opp) => sum + opp.unrealizedLoss, 0);
            report.topRecommendations.push({
                priority: 1,
                category: 'Tax Loss Harvesting',
                description: `Realize Rs. ${totalLosses.toFixed(2)} in losses to offset gains`,
                estimatedSavings: totalLosses * 0.15 // Assuming 15% tax rate
            });
            report.estimatedTaxSavings += totalLosses * 0.15;
        }

        // Check for high-tax positions
        const highTaxPositions = portfolio.stockAnalysis.filter(s => s.effectiveTaxRate > 0.12);
        if (highTaxPositions.length > 0) {
            report.topRecommendations.push({
                priority: 2,
                category: 'Holding Period Optimization',
                description: `${highTaxPositions.length} positions with high tax rates - consider holding longer`,
                positions: highTaxPositions.map(p => p.symbol)
            });
        }

        return report;
    }

    /**
     * FEATURE 1: Holding Period Optimizer
     * Scan all holdings for stocks approaching the 1-year mark
     * Calculate tax savings if user waits
     *
     * @param {object} currentPrices - Object with symbol: price pairs
     * @returns {Array} Array of holding period optimization suggestions
     */
    scanHoldingPeriodOpportunities(currentPrices) {
        const opportunities = [];
        const holdings = this.fifoQueue.getHoldings();
        const today = new Date();

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (!currentPrice) {
                continue;
            }

            // Check each lot in the holding
            const lots = this.fifoQueue.holdings[symbol];

            for (const lot of lots) {
                if (lot.remainingQuantity <= 0) continue;

                const purchaseDate = lot.purchaseDate;
                const daysSincePurchase = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));

                // Check if acquired before July 1, 2024 (legacy rules apply)
                const isLegacyRegime = purchaseDate < new Date('2024-07-01');

                if (!isLegacyRegime) {
                    // New regime: flat 15%, no benefit from waiting
                    continue;
                }

                // Legacy regime: check if approaching milestone dates
                const milestones = [
                    { days: 365, name: '1 year', targetRate: 0.125 },
                    { days: 730, name: '2 years', targetRate: 0.10 },
                    { days: 1095, name: '3 years', targetRate: 0.075 },
                    { days: 1460, name: '4 years', targetRate: 0.00 }
                ];

                for (const milestone of milestones) {
                    const daysUntilMilestone = milestone.days - daysSincePurchase;

                    // Check if within 90 days of milestone
                    if (daysUntilMilestone > 0 && daysUntilMilestone <= 90) {
                        // Calculate current tax
                        const currentTaxRate = this.taxCalculator.getTaxRate(purchaseDate, daysSincePurchase);
                        const gainPerShare = currentPrice - lot.price;
                        const currentGain = gainPerShare * lot.remainingQuantity;
                        const currentTax = Math.max(0, currentGain * currentTaxRate);

                        // Calculate future tax
                        const futureTaxRate = milestone.targetRate;
                        const futureTax = Math.max(0, currentGain * futureTaxRate);

                        const taxSavings = currentTax - futureTax;

                        if (taxSavings > 100) { // Only recommend if savings > Rs. 100
                            const milestoneDate = new Date(purchaseDate);
                            milestoneDate.setDate(milestoneDate.getDate() + milestone.days);

                            opportunities.push({
                                type: 'HOLDING_PERIOD',
                                stock: symbol,
                                quantity: lot.remainingQuantity,
                                recommendation: `Wait ${daysUntilMilestone} days to reach ${milestone.name} holding period`,
                                currentTax: currentTax,
                                optimizedTax: futureTax,
                                savings: taxSavings,
                                daysToWait: daysUntilMilestone,
                                milestoneDate: milestoneDate,
                                purchaseDate: purchaseDate,
                                currentTaxRate: (currentTaxRate * 100).toFixed(1) + '%',
                                targetTaxRate: (futureTaxRate * 100).toFixed(1) + '%',
                                explanation: `On ${milestoneDate.toLocaleDateString('en-PK', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}, your holding period will exceed ${milestone.name}. Tax rate will drop from ${(currentTaxRate * 100).toFixed(1)}% to ${(futureTaxRate * 100).toFixed(1)}%, saving you Rs. ${taxSavings.toFixed(2)}.`
                            });
                        }
                    }
                }
            }
        }

        // Sort by savings (highest first)
        opportunities.sort((a, b) => b.savings - a.savings);

        return opportunities;
    }

    /**
     * FEATURE 2: Loss Harvesting Suggester with Offset Calculation
     * Identify stocks at a loss and calculate tax offset against realized gains
     *
     * @param {object} currentPrices - Object with symbol: price pairs
     * @param {number} realizedGains - Total realized gains year-to-date
     * @returns {Array} Array of loss harvesting suggestions with offset calculations
     */
    suggestLossHarvesting(currentPrices, realizedGains = 0) {
        const suggestions = [];
        const holdings = this.fifoQueue.getHoldings();

        // Get realized gains if not provided
        if (realizedGains === 0) {
            const realizedGainsList = this.fifoQueue.getRealizedGains();
            for (const gain of realizedGainsList) {
                if (gain.capitalGain > 0) {
                    realizedGains += gain.capitalGain;
                }
            }
        }

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (!currentPrice) {
                continue;
            }

            const currentValue = holding.totalQuantity * currentPrice;
            const unrealizedLoss = holding.totalCostBasis - currentValue;

            // Only consider positions with losses
            if (unrealizedLoss <= 0) {
                continue;
            }

            // Calculate tax savings from offsetting realized gains
            const taxRate = 0.15; // Current flat rate
            const offsetableAmount = Math.min(unrealizedLoss, realizedGains);
            const taxSavings = offsetableAmount * taxRate;

            // Only suggest if savings > Rs. 100
            if (taxSavings > 100) {
                suggestions.push({
                    type: 'LOSS_HARVEST',
                    stock: symbol,
                    quantity: holding.totalQuantity,
                    avgCost: holding.averageCost,
                    currentPrice: currentPrice,
                    recommendation: `Sell ${holding.totalQuantity} shares at Rs. ${currentPrice.toFixed(2)}`,
                    unrealizedLoss: unrealizedLoss,
                    lossPercentage: ((unrealizedLoss / holding.totalCostBasis) * 100).toFixed(2),
                    realizedGainsToOffset: offsetableAmount,
                    taxSavings: taxSavings,
                    netBenefit: taxSavings,
                    explanation: `Selling ${holding.totalQuantity} ${symbol} at Rs. ${currentPrice.toFixed(2)} realizes a loss of Rs. ${unrealizedLoss.toFixed(2)}. This offsets Rs. ${offsetableAmount.toFixed(2)} of your realized gains, saving you Rs. ${taxSavings.toFixed(2)} in taxes (15% rate).`,
                    detailedBreakdown: {
                        costBasis: holding.totalCostBasis,
                        currentValue: currentValue,
                        realizedLoss: unrealizedLoss,
                        yourRealizedGains: realizedGains,
                        offsetAmount: offsetableAmount,
                        taxRate: (taxRate * 100) + '%',
                        taxSavings: taxSavings
                    }
                });
            }
        }

        // Sort by tax savings (highest first)
        suggestions.sort((a, b) => b.taxSavings - a.taxSavings);

        return suggestions;
    }

    /**
     * FEATURE 3: Filer vs Non-Filer Portfolio-Wide Comparison
     * Show side-by-side tax liability for entire portfolio
     *
     * @param {object} currentPrices - Object with symbol: price pairs
     * @returns {object} Comprehensive filer vs non-filer comparison
     */
    compareFilingStatusPortfolio(currentPrices) {
        const holdings = this.fifoQueue.getHoldings();
        const realizedGains = this.fifoQueue.getRealizedGains();

        const originalStatus = this.taxCalculator.isFiler;

        // Calculate as FILER
        this.taxCalculator.setFilerStatus(true);

        let filerRealizedTax = 0;
        let filerUnrealizedTax = 0;
        const filerDetails = [];

        // Process realized gains
        for (const gain of realizedGains) {
            const taxCalc = this.taxCalculator.calculateTaxForSale(gain);
            filerRealizedTax += taxCalc.totalTax;
        }

        // Process unrealized positions
        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (currentPrice) {
                try {
                    const saleSimulation = this.fifoQueue.calculateSale(
                        symbol,
                        holding.totalQuantity,
                        currentPrice,
                        new Date()
                    );
                    const taxCalc = this.taxCalculator.calculateTaxForSale(saleSimulation);
                    filerUnrealizedTax += taxCalc.totalTax;

                    filerDetails.push({
                        symbol: symbol,
                        unrealizedGain: saleSimulation.capitalGain,
                        tax: taxCalc.totalTax
                    });
                } catch (e) {
                    console.warn(`Cannot simulate ${symbol}:`, e.message);
                }
            }
        }

        // Calculate as NON-FILER
        this.taxCalculator.setFilerStatus(false);

        let nonFilerRealizedTax = 0;
        let nonFilerUnrealizedTax = 0;
        const nonFilerDetails = [];

        // Process realized gains
        for (const gain of realizedGains) {
            const taxCalc = this.taxCalculator.calculateTaxForSale(gain);
            nonFilerRealizedTax += taxCalc.totalTax;
        }

        // Process unrealized positions
        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (currentPrice) {
                try {
                    const saleSimulation = this.fifoQueue.calculateSale(
                        symbol,
                        holding.totalQuantity,
                        currentPrice,
                        new Date()
                    );
                    const taxCalc = this.taxCalculator.calculateTaxForSale(saleSimulation);
                    nonFilerUnrealizedTax += taxCalc.totalTax;

                    nonFilerDetails.push({
                        symbol: symbol,
                        unrealizedGain: saleSimulation.capitalGain,
                        tax: taxCalc.totalTax
                    });
                } catch (e) {
                    // Already warned above
                }
            }
        }

        // Restore original status
        this.taxCalculator.setFilerStatus(originalStatus);

        const filerTotal = filerRealizedTax + filerUnrealizedTax;
        const nonFilerTotal = nonFilerRealizedTax + nonFilerUnrealizedTax;
        const difference = nonFilerTotal - filerTotal;

        return {
            type: 'FILER_COMPARISON',
            filer: {
                realizedTax: filerRealizedTax,
                unrealizedTax: filerUnrealizedTax,
                totalTax: filerTotal,
                details: filerDetails
            },
            nonFiler: {
                realizedTax: nonFilerRealizedTax,
                unrealizedTax: nonFilerUnrealizedTax,
                totalTax: nonFilerTotal,
                details: nonFilerDetails
            },
            difference: difference,
            savings: difference,
            savingsPercentage: nonFilerTotal > 0 ? ((difference / nonFilerTotal) * 100).toFixed(2) : 0,
            recommendation: difference > 0 ?
                `As a non-filer, you're paying Rs. ${difference.toFixed(2)} extra (${((difference / nonFilerTotal) * 100).toFixed(1)}% more). Consider becoming a filer to save on taxes.` :
                'Currently, there is no tax difference between filer and non-filer status for your portfolio under the new tax regime (15% flat rate).',
            explanation: difference > 0 ?
                `Under Pakistan's tax laws, being a filer can save you money, especially for securities acquired before July 1, 2024. Your current portfolio would save Rs. ${difference.toFixed(2)} by filing taxes.` :
                'The new tax regime (post July 1, 2024) applies a flat 15% rate regardless of filer status. However, becoming a filer may still provide benefits for other income sources and transactions.',
            currentStatus: originalStatus ? 'Filer' : 'Non-Filer'
        };
    }

    /**
     * FEATURE 4: Year-End Tax Projector (Pakistan Fiscal Year: July 1 - June 30)
     * Sum all realized gains year-to-date and project total tax liability
     * Suggest actions before fiscal year end
     *
     * @param {object} currentPrices - Object with symbol: price pairs (optional)
     * @returns {object} Year-end tax projection and recommendations
     */
    projectYearEndTax(currentPrices = {}) {
        // Pakistan fiscal year: July 1 to June 30
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-12

        // Determine current fiscal year
        let fiscalYearStart, fiscalYearEnd;

        if (currentMonth >= 7) {
            // July-December: FY is current year to next year
            fiscalYearStart = new Date(currentYear, 6, 1); // July 1
            fiscalYearEnd = new Date(currentYear + 1, 5, 30); // June 30 next year
        } else {
            // January-June: FY is last year to current year
            fiscalYearStart = new Date(currentYear - 1, 6, 1); // July 1 last year
            fiscalYearEnd = new Date(currentYear, 5, 30); // June 30 this year
        }

        const daysUntilFYEnd = Math.ceil((fiscalYearEnd - today) / (1000 * 60 * 60 * 24));
        const daysIntoFY = Math.ceil((today - fiscalYearStart) / (1000 * 60 * 60 * 24));
        const totalDaysInFY = Math.ceil((fiscalYearEnd - fiscalYearStart) / (1000 * 60 * 60 * 24));

        // Get all realized gains in current fiscal year
        const realizedGains = this.fifoQueue.getRealizedGains();

        let totalRealizedGains = 0;
        let totalRealizedLosses = 0;
        let realizedTax = 0;
        const transactionsThisYear = [];

        for (const gain of realizedGains) {
            const saleDate = new Date(gain.saleDate);

            // Check if sale is in current fiscal year
            if (saleDate >= fiscalYearStart && saleDate <= fiscalYearEnd) {
                const taxCalc = this.taxCalculator.calculateTaxForSale(gain);

                if (gain.capitalGain > 0) {
                    totalRealizedGains += gain.capitalGain;
                } else {
                    totalRealizedLosses += Math.abs(gain.capitalGain);
                }

                realizedTax += taxCalc.totalTax;

                transactionsThisYear.push({
                    symbol: gain.symbol,
                    date: saleDate,
                    gain: gain.capitalGain,
                    tax: taxCalc.totalTax
                });
            }
        }

        const netRealizedGain = totalRealizedGains - totalRealizedLosses;

        // Calculate unrealized positions
        const holdings = this.fifoQueue.getHoldings();
        let unrealizedGains = 0;
        let unrealizedLosses = 0;
        let potentialTax = 0;
        const unrealizedDetails = [];

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = currentPrices[symbol];

            if (currentPrice) {
                const currentValue = holding.totalQuantity * currentPrice;
                const unrealizedGainLoss = currentValue - holding.totalCostBasis;

                try {
                    const saleSimulation = this.fifoQueue.calculateSale(
                        symbol,
                        holding.totalQuantity,
                        currentPrice,
                        new Date()
                    );
                    const taxCalc = this.taxCalculator.calculateTaxForSale(saleSimulation);

                    if (unrealizedGainLoss > 0) {
                        unrealizedGains += unrealizedGainLoss;
                        potentialTax += taxCalc.totalTax;
                    } else {
                        unrealizedLosses += Math.abs(unrealizedGainLoss);
                    }

                    unrealizedDetails.push({
                        symbol: symbol,
                        unrealizedGainLoss: unrealizedGainLoss,
                        potentialTax: taxCalc.totalTax
                    });
                } catch (e) {
                    console.warn(`Cannot simulate ${symbol}:`, e.message);
                }
            }
        }

        // Generate recommendations
        const recommendations = [];

        // Recommendation 1: Loss harvesting before year end
        if (unrealizedLosses > 0 && totalRealizedGains > 0) {
            const offsetableAmount = Math.min(unrealizedLosses, totalRealizedGains);
            const taxSavings = offsetableAmount * 0.15;

            recommendations.push({
                priority: 1,
                type: 'LOSS_HARVEST_YEAR_END',
                action: 'Harvest losses before June 30',
                potentialSavings: taxSavings,
                description: `You have Rs. ${unrealizedLosses.toFixed(2)} in unrealized losses. Selling these positions before June 30 can offset Rs. ${offsetableAmount.toFixed(2)} of your realized gains, saving Rs. ${taxSavings.toFixed(2)} in taxes.`,
                deadline: fiscalYearEnd
            });
        }

        // Recommendation 2: Defer gains to next fiscal year
        if (unrealizedGains > 0 && daysUntilFYEnd < 30) {
            recommendations.push({
                priority: 2,
                type: 'DEFER_GAINS',
                action: 'Consider deferring gains to next fiscal year',
                description: `You have Rs. ${unrealizedGains.toFixed(2)} in unrealized gains. If you can wait ${daysUntilFYEnd} days until the new fiscal year (after June 30), you can defer tax payment by one year.`,
                daysToWait: daysUntilFYEnd,
                deadline: fiscalYearEnd
            });
        }

        // Recommendation 3: Holding period optimization
        if (daysUntilFYEnd > 90) {
            const holdingPeriodOpps = this.scanHoldingPeriodOpportunities(currentPrices);
            if (holdingPeriodOpps.length > 0) {
                const totalSavings = holdingPeriodOpps.reduce((sum, opp) => sum + opp.savings, 0);
                recommendations.push({
                    priority: 3,
                    type: 'HOLDING_PERIOD',
                    action: 'Optimize holding periods',
                    potentialSavings: totalSavings,
                    description: `${holdingPeriodOpps.length} positions are approaching tax milestone dates. Waiting could save Rs. ${totalSavings.toFixed(2)}.`,
                    opportunities: holdingPeriodOpps.slice(0, 3) // Top 3
                });
            }
        }

        return {
            type: 'YEAR_END_PROJECTION',
            fiscalYear: {
                start: fiscalYearStart,
                end: fiscalYearEnd,
                current: today,
                daysRemaining: daysUntilFYEnd,
                daysCompleted: daysIntoFY,
                progressPercentage: ((daysIntoFY / totalDaysInFY) * 100).toFixed(1)
            },
            realized: {
                gains: totalRealizedGains,
                losses: totalRealizedLosses,
                netGain: netRealizedGain,
                tax: realizedTax,
                transactions: transactionsThisYear
            },
            unrealized: {
                gains: unrealizedGains,
                losses: unrealizedLosses,
                potentialTax: potentialTax,
                details: unrealizedDetails
            },
            projection: {
                totalTaxLiability: realizedTax,
                potentialAdditionalTax: potentialTax,
                maxTaxLiability: realizedTax + potentialTax,
                netPosition: netRealizedGain + unrealizedGains - unrealizedLosses
            },
            recommendations: recommendations,
            summary: `Year-to-date (FY ${fiscalYearStart.getFullYear()}-${fiscalYearEnd.getFullYear()}): You've realized Rs. ${netRealizedGain.toFixed(2)} in net gains with Rs. ${realizedTax.toFixed(2)} in tax liability. With ${daysUntilFYEnd} days until fiscal year end, you have time to optimize your tax position.`,
            urgencyLevel: daysUntilFYEnd < 30 ? 'HIGH' : daysUntilFYEnd < 90 ? 'MEDIUM' : 'LOW'
        };
    }

    /**
     * MASTER FUNCTION: Generate Complete Optimization Report
     * Combines all four features into a single comprehensive report
     *
     * @param {object} input - Input data matching the specified format
     * @returns {object} Complete optimization report
     */
    generateCompleteOptimizationReport(input) {
        // Parse input format
        const { holdings, realizedGains = 0, isFiler = true } = input;

        // Build currentPrices object from holdings
        const currentPrices = {};
        for (const holding of holdings || []) {
            if (holding.symbol && holding.currentPrice) {
                currentPrices[holding.symbol] = holding.currentPrice;
            }
        }

        // Set filer status
        this.taxCalculator.setFilerStatus(isFiler);

        // Generate all optimization reports
        const holdingPeriodOpps = this.scanHoldingPeriodOpportunities(currentPrices);
        const lossHarvestingSuggestions = this.suggestLossHarvesting(currentPrices, realizedGains);
        const filerComparison = this.compareFilingStatusPortfolio(currentPrices);
        const yearEndProjection = this.projectYearEndTax(currentPrices);

        // Combine all optimizations
        const allOptimizations = [
            ...holdingPeriodOpps,
            ...lossHarvestingSuggestions
        ];

        // Add filer comparison as optimization if applicable
        if (filerComparison.savings > 0) {
            allOptimizations.push({
                type: 'FILER_STATUS',
                recommendation: 'Become a filer',
                savings: filerComparison.savings,
                explanation: filerComparison.recommendation
            });
        }

        // Sort by savings
        allOptimizations.sort((a, b) => (b.savings || 0) - (a.savings || 0));

        return {
            generatedAt: new Date(),
            timezone: 'PKT (Pakistan Standard Time)',
            isFiler: isFiler,
            optimizations: allOptimizations,
            holdingPeriodOptimizations: holdingPeriodOpps,
            lossHarvestingOpportunities: lossHarvestingSuggestions,
            filerComparison: filerComparison,
            yearEndProjection: yearEndProjection,
            totalPotentialSavings: allOptimizations.reduce((sum, opt) => sum + (opt.savings || opt.taxSavings || 0), 0),
            topRecommendation: allOptimizations[0] || null,
            urgentActions: yearEndProjection.recommendations.filter(r => r.priority === 1)
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhatIfScenarios;
}
