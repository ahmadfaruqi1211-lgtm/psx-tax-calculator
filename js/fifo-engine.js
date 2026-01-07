/**
 * FIFO Tax Calculator - Core Engine
 * Pakistan Stock Exchange Capital Gains Tax Calculator
 *
 * FIFO (First-In-First-Out) Logic:
 * - Shares purchased first are considered sold first
 * - Maintains separate queues for each stock symbol
 * - Tracks lot-level cost basis and purchase dates
 * - Settlement date: T+2 (Trade date + 2 business days)
 */

class FIFOQueue {
    constructor() {
        // Store holdings by symbol: { symbol: [lot1, lot2, ...] }
        // Each lot: { quantity, price, purchaseDate, settlementDate }
        this.holdings = {};

        // Store all transactions for audit trail
        this.transactions = [];

        // Store realized gains/losses
        this.realizedGains = [];
    }

    /**
     * Add a settlement date to a trade date (T+2 for Pakistan Stock Exchange)
     * @param {Date} tradeDate - The trade execution date
     * @returns {Date} Settlement date (trade date + 2 business days)
     */
    calculateSettlementDate(tradeDate) {
        const date = new Date(tradeDate);
        let daysAdded = 0;

        // Add 2 business days (skip weekends)
        while (daysAdded < 2) {
            date.setDate(date.getDate() + 1);
            const dayOfWeek = date.getDay();

            // Skip Saturday (6) and Sunday (0)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                daysAdded++;
            }
        }

        return date;
    }

    /**
     * Add a transaction (buy or sell)
     * @param {string} type - 'BUY' or 'SELL'
     * @param {string} symbol - Stock symbol (e.g., 'OGDC')
     * @param {number} quantity - Number of shares
     * @param {number} price - Price per share in PKR
     * @param {Date|string} date - Trade date
     * @returns {object} Transaction record with calculated fields
     */
    addTransaction(type, symbol, quantity, price, date) {
        const tradeDate = new Date(date);
        const settlementDate = this.calculateSettlementDate(tradeDate);

        const transaction = {
            id: this.transactions.length + 1,
            type: type.toUpperCase(),
            symbol: symbol.toUpperCase(),
            quantity: parseFloat(quantity),
            price: parseFloat(price),
            tradeDate: tradeDate,
            settlementDate: settlementDate,
            totalValue: parseFloat(quantity) * parseFloat(price),
            timestamp: new Date()
        };

        if (type.toUpperCase() === 'BUY') {
            this._processBuy(transaction);
        } else if (type.toUpperCase() === 'SELL') {
            return this._processSell(transaction);
        }

        this.transactions.push(transaction);
        return transaction;
    }

    /**
     * Process a BUY transaction - Add to FIFO queue
     * @private
     */
    _processBuy(transaction) {
        const { symbol, quantity, price, settlementDate } = transaction;

        // Initialize holdings array for this symbol if it doesn't exist
        if (!this.holdings[symbol]) {
            this.holdings[symbol] = [];
        }

        // Add new lot to the END of the queue (FIFO)
        const lot = {
            quantity: quantity,
            price: price,
            purchaseDate: settlementDate, // Use settlement date for holding period
            remainingQuantity: quantity,
            originalTransaction: transaction
        };

        this.holdings[symbol].push(lot);

        console.log(`✓ Added ${quantity} shares of ${symbol} @ Rs. ${price} to FIFO queue`);
    }

    /**
     * Process a SELL transaction - Remove from FIFO queue
     * @private
     * @returns {object} Sale result with cost basis and capital gains
     */
    _processSell(transaction) {
        const { symbol, quantity, price, settlementDate } = transaction;

        // Check if we have any holdings for this symbol
        if (!this.holdings[symbol] || this.holdings[symbol].length === 0) {
            throw new Error(`Cannot sell ${symbol}: No holdings found`);
        }

        // Calculate total available shares
        const totalAvailable = this.holdings[symbol].reduce(
            (sum, lot) => sum + lot.remainingQuantity,
            0
        );

        if (totalAvailable < quantity) {
            throw new Error(
                `Cannot sell ${quantity} shares of ${symbol}: Only ${totalAvailable} available`
            );
        }

        // FIFO Logic: Consume lots from the BEGINNING of the queue
        let remainingToSell = quantity;
        const lotsUsed = [];
        let totalCostBasis = 0;

        // Process lots in FIFO order (oldest first)
        for (let i = 0; i < this.holdings[symbol].length && remainingToSell > 0; i++) {
            const lot = this.holdings[symbol][i];

            // How many shares can we take from this lot?
            const sharesToTake = Math.min(lot.remainingQuantity, remainingToSell);

            if (sharesToTake > 0) {
                // Calculate cost basis for these shares
                const costBasis = sharesToTake * lot.price;
                totalCostBasis += costBasis;

                // Calculate holding period
                const holdingPeriod = this.getHoldingPeriod(
                    lot.purchaseDate,
                    settlementDate
                );

                // Record this lot usage
                lotsUsed.push({
                    purchaseDate: lot.purchaseDate,
                    quantity: sharesToTake,
                    costPerShare: lot.price,
                    costBasis: costBasis,
                    holdingPeriod: holdingPeriod
                });

                // Update remaining quantity in the lot
                lot.remainingQuantity -= sharesToTake;
                remainingToSell -= sharesToTake;

                console.log(
                    `  → Using ${sharesToTake} shares from lot purchased on ${lot.purchaseDate.toLocaleDateString()} @ Rs. ${lot.price}`
                );
            }
        }

        // Remove fully consumed lots from the queue
        this.holdings[symbol] = this.holdings[symbol].filter(
            lot => lot.remainingQuantity > 0
        );

        // Calculate capital gain/loss
        const saleProceeds = quantity * price;
        const capitalGain = saleProceeds - totalCostBasis;

        const saleResult = {
            symbol: symbol,
            quantitySold: quantity,
            sellPrice: price,
            saleProceeds: saleProceeds,
            totalCostBasis: totalCostBasis,
            capitalGain: capitalGain,
            lotsUsed: lotsUsed,
            saleDate: settlementDate
        };

        this.realizedGains.push(saleResult);

        console.log(`✓ Sold ${quantity} shares of ${symbol} @ Rs. ${price}`);
        console.log(`  Cost Basis: Rs. ${totalCostBasis.toFixed(2)}`);
        console.log(`  Sale Proceeds: Rs. ${saleProceeds.toFixed(2)}`);
        console.log(`  Capital Gain: Rs. ${capitalGain.toFixed(2)}`);

        return saleResult;
    }

    /**
     * Calculate sale without actually executing it (for what-if scenarios)
     * @param {string} symbol - Stock symbol
     * @param {number} quantity - Number of shares to sell
     * @param {number} sellPrice - Hypothetical sell price
     * @param {Date|string} sellDate - Hypothetical sell date
     * @returns {object} Projected sale result
     */
    calculateSale(symbol, quantity, sellPrice, sellDate) {
        symbol = symbol.toUpperCase();
        const settlementDate = this.calculateSettlementDate(new Date(sellDate));

        if (!this.holdings[symbol] || this.holdings[symbol].length === 0) {
            throw new Error(`No holdings found for ${symbol}`);
        }

        const totalAvailable = this.holdings[symbol].reduce(
            (sum, lot) => sum + lot.remainingQuantity,
            0
        );

        if (totalAvailable < quantity) {
            throw new Error(
                `Insufficient shares: ${quantity} requested, ${totalAvailable} available`
            );
        }

        let remainingToSell = quantity;
        const lotsUsed = [];
        let totalCostBasis = 0;

        // Simulate FIFO consumption
        for (let i = 0; i < this.holdings[symbol].length && remainingToSell > 0; i++) {
            const lot = this.holdings[symbol][i];
            const sharesToTake = Math.min(lot.remainingQuantity, remainingToSell);

            if (sharesToTake > 0) {
                const costBasis = sharesToTake * lot.price;
                totalCostBasis += costBasis;

                const holdingPeriod = this.getHoldingPeriod(
                    lot.purchaseDate,
                    settlementDate
                );

                lotsUsed.push({
                    purchaseDate: lot.purchaseDate,
                    quantity: sharesToTake,
                    costPerShare: lot.price,
                    costBasis: costBasis,
                    holdingPeriod: holdingPeriod
                });

                remainingToSell -= sharesToTake;
            }
        }

        const saleProceeds = quantity * sellPrice;
        const capitalGain = saleProceeds - totalCostBasis;

        return {
            symbol: symbol,
            quantitySold: quantity,
            sellPrice: sellPrice,
            saleProceeds: saleProceeds,
            totalCostBasis: totalCostBasis,
            capitalGain: capitalGain,
            lotsUsed: lotsUsed,
            saleDate: settlementDate,
            isSimulation: true
        };
    }

    /**
     * Get cost basis for a potential sale (used for tax planning)
     * @param {string} symbol - Stock symbol
     * @param {number} quantity - Number of shares
     * @returns {object} Cost basis breakdown
     */
    getCostBasisForSale(symbol, quantity) {
        symbol = symbol.toUpperCase();

        if (!this.holdings[symbol]) {
            return { totalCost: 0, avgCost: 0, lots: [] };
        }

        let remainingToSell = quantity;
        let totalCost = 0;
        const lots = [];

        for (let i = 0; i < this.holdings[symbol].length && remainingToSell > 0; i++) {
            const lot = this.holdings[symbol][i];
            const sharesToTake = Math.min(lot.remainingQuantity, remainingToSell);

            if (sharesToTake > 0) {
                const cost = sharesToTake * lot.price;
                totalCost += cost;

                lots.push({
                    quantity: sharesToTake,
                    costPerShare: lot.price,
                    totalCost: cost,
                    purchaseDate: lot.purchaseDate
                });

                remainingToSell -= sharesToTake;
            }
        }

        return {
            totalCost: totalCost,
            avgCost: quantity > 0 ? totalCost / quantity : 0,
            lots: lots
        };
    }

    /**
     * Calculate holding period between two dates
     * @param {Date} purchaseDate - Purchase settlement date
     * @param {Date} sellDate - Sale settlement date
     * @returns {object} Holding period with days, months, years
     */
    getHoldingPeriod(purchaseDate, sellDate) {
        const purchase = new Date(purchaseDate);
        const sell = new Date(sellDate);

        // Calculate difference in milliseconds
        const diffMs = sell - purchase;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Calculate years and months
        let years = sell.getFullYear() - purchase.getFullYear();
        let months = sell.getMonth() - purchase.getMonth();

        if (months < 0) {
            years--;
            months += 12;
        }

        return {
            days: diffDays,
            months: months + (years * 12),
            years: years,
            isLongTerm: diffDays >= 365, // 1+ year holding
            formatted: `${years}y ${months}m (${diffDays} days)`
        };
    }

    /**
     * Get current holdings summary
     * @returns {object} Holdings organized by symbol
     */
    getHoldings() {
        const summary = {};

        for (const symbol in this.holdings) {
            const lots = this.holdings[symbol];
            const totalQuantity = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);

            if (totalQuantity > 0) {
                const totalValue = lots.reduce(
                    (sum, lot) => sum + (lot.remainingQuantity * lot.price),
                    0
                );

                summary[symbol] = {
                    totalQuantity: totalQuantity,
                    averageCost: totalValue / totalQuantity,
                    totalCostBasis: totalValue,
                    lots: lots.map(lot => ({
                        quantity: lot.remainingQuantity,
                        price: lot.price,
                        purchaseDate: lot.purchaseDate,
                        value: lot.remainingQuantity * lot.price
                    }))
                };
            }
        }

        return summary;
    }

    /**
     * Get all realized gains/losses
     * @returns {Array} Array of realized gain/loss records
     */
    getRealizedGains() {
        return this.realizedGains;
    }

    /**
     * Get all transactions
     * @returns {Array} Array of all transactions
     */
    getTransactions() {
        return this.transactions;
    }

    /**
     * Reset all data (for testing or new tax year)
     */
    reset() {
        this.holdings = {};
        this.transactions = [];
        this.realizedGains = [];
        console.log('✓ FIFO queue reset');
    }

    /**
     * Export data for storage
     * @returns {object} Serializable data object
     */
    exportData() {
        return {
            holdings: this.holdings,
            transactions: this.transactions,
            realizedGains: this.realizedGains,
            exportDate: new Date()
        };
    }

    /**
     * Import data from storage
     * @param {object} data - Previously exported data
     */
    importData(data) {
        if (data.holdings) {
            // Restore dates from string format
            this.holdings = {};
            for (const symbol in data.holdings) {
                this.holdings[symbol] = data.holdings[symbol].map(lot => ({
                    ...lot,
                    purchaseDate: new Date(lot.purchaseDate)
                }));
            }
        }

        if (data.transactions) {
            this.transactions = data.transactions.map(t => ({
                ...t,
                tradeDate: new Date(t.tradeDate),
                settlementDate: new Date(t.settlementDate),
                timestamp: new Date(t.timestamp)
            }));
        }

        if (data.realizedGains) {
            this.realizedGains = data.realizedGains.map(g => ({
                ...g,
                saleDate: new Date(g.saleDate),
                lotsUsed: g.lotsUsed.map(lot => ({
                    ...lot,
                    purchaseDate: new Date(lot.purchaseDate)
                }))
            }));
        }

        console.log('✓ Data imported successfully');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIFOQueue;
}
