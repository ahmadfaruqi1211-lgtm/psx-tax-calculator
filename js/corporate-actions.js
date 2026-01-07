/**
 * Corporate Actions Manager
 * Handles bonus shares and right issues for cost basis adjustment
 *
 * Features:
 * - Bonus share adjustments (proportional cost basis reduction)
 * - Right issue tracking (separate FIFO lot with RIGHT_ISSUE flag)
 * - Validation to prevent duplicate applications
 * - localStorage persistence
 * - Audit trail for all corporate actions
 */

class CorporateActionsManager {
    constructor(fifoQueue, storageManager) {
        this.fifoQueue = fifoQueue;
        this.storageManager = storageManager;

        // Store all corporate actions for audit trail
        this.corporateActions = [];

        // Load from storage if available
        this.loadFromStorage();
    }

    /**
     * Apply a corporate action to a symbol
     *
     * @param {string} symbol - Stock symbol (e.g., 'HBL')
     * @param {string} actionType - 'BONUS' or 'RIGHT'
     * @param {object} details - Action-specific details
     * @returns {object} Result of the corporate action application
     */
    applyCorporateAction(symbol, actionType, details) {
        symbol = symbol.toUpperCase();
        actionType = actionType.toUpperCase();

        // Validate inputs
        this._validateInputs(symbol, actionType, details);

        // Check if action already applied
        if (this._isActionAlreadyApplied(symbol, actionType, details.exDate)) {
            throw new Error(
                `Corporate action already applied: ${actionType} for ${symbol} on ${details.exDate}`
            );
        }

        // Check if user has holdings
        const holdings = this.fifoQueue.getHoldings();
        if (!holdings[symbol]) {
            throw new Error(
                `No holdings found for ${symbol}. You must own shares before applying corporate action.`
            );
        }

        let result;

        if (actionType === 'BONUS') {
            result = this._applyBonusShares(symbol, details);
        } else if (actionType === 'RIGHT') {
            result = this._applyRightIssue(symbol, details);
        } else {
            throw new Error(`Unsupported action type: ${actionType}`);
        }

        // Record the action
        const actionRecord = {
            id: this.corporateActions.length + 1,
            symbol: symbol,
            type: actionType,
            details: details,
            exDate: new Date(details.exDate),
            appliedDate: new Date(),
            applied: true,
            result: result
        };

        this.corporateActions.push(actionRecord);

        // Save to storage
        this.saveToStorage();

        console.log(`✓ Corporate action applied: ${actionType} for ${symbol}`);
        console.log(`  ${result.summary}`);

        return actionRecord;
    }

    /**
     * Apply bonus shares - adjust cost basis proportionally
     * @private
     */
    _applyBonusShares(symbol, details) {
        const { ratio, exDate } = details;

        // Parse ratio (can be "20%" or 0.20)
        const bonusRatio = typeof ratio === 'string' && ratio.endsWith('%') ?
            parseFloat(ratio) / 100 :
            parseFloat(ratio);

        if (isNaN(bonusRatio) || bonusRatio <= 0 || bonusRatio > 1) {
            throw new Error(`Invalid bonus ratio: ${ratio}. Must be between 0 and 100% (e.g., "20%" or 0.20)`);
        }

        // Get all lots for this symbol
        const lots = this.fifoQueue.holdings[symbol];
        if (!lots || lots.length === 0) {
            throw new Error(`No lots found for ${symbol}`);
        }

        const exDateObj = new Date(exDate);
        let totalOldShares = 0;
        let totalBonusShares = 0;
        let totalCostBasis = 0;

        // Calculate totals for lots purchased before ex-date
        for (const lot of lots) {
            // Only apply to shares purchased before ex-date
            if (lot.purchaseDate < exDateObj) {
                totalOldShares += lot.remainingQuantity;
                totalCostBasis += lot.remainingQuantity * lot.price;
            }
        }

        if (totalOldShares === 0) {
            throw new Error(
                `No shares purchased before ex-date (${exDate}) for ${symbol}`
            );
        }

        // Calculate bonus shares
        totalBonusShares = Math.floor(totalOldShares * bonusRatio);

        if (totalBonusShares === 0) {
            throw new Error(
                `Bonus ratio too small: ${totalOldShares} × ${bonusRatio} = ${totalBonusShares} shares`
            );
        }

        // New total shares and adjusted cost
        const totalNewShares = totalOldShares + totalBonusShares;
        const newAvgCost = totalCostBasis / totalNewShares;

        // Adjust all lots purchased before ex-date
        for (const lot of lots) {
            if (lot.purchaseDate < exDateObj) {
                const oldQuantity = lot.remainingQuantity;
                const bonusForThisLot = Math.floor(oldQuantity * bonusRatio);

                // Adjust quantity
                lot.remainingQuantity = oldQuantity + bonusForThisLot;

                // Adjust price (cost per share decreases)
                lot.price = (oldQuantity * lot.price) / lot.remainingQuantity;

                console.log(
                    `  Adjusted lot: ${oldQuantity} → ${lot.remainingQuantity} shares, ` +
                    `price adjusted to Rs. ${lot.price.toFixed(2)}`
                );
            }
        }

        return {
            type: 'BONUS',
            symbol: symbol,
            oldShares: totalOldShares,
            bonusShares: totalBonusShares,
            newTotalShares: totalNewShares,
            oldAvgCost: totalCostBasis / totalOldShares,
            newAvgCost: newAvgCost,
            costBasis: totalCostBasis,
            bonusRatio: bonusRatio,
            bonusPercentage: (bonusRatio * 100).toFixed(2) + '%',
            summary: `Bonus ${(bonusRatio * 100).toFixed(0)}%: ${totalOldShares} → ${totalNewShares} shares, avg cost Rs. ${(totalCostBasis / totalOldShares).toFixed(2)} → Rs. ${newAvgCost.toFixed(2)}`
        };
    }

    /**
     * Apply right issue - add as separate FIFO lot
     * @private
     */
    _applyRightIssue(symbol, details) {
        const { ratio, price, exDate, subscriptionDate } = details;

        // Parse ratio (e.g., "1:5" means 1 right share for every 5 held)
        let rightRatio;
        if (typeof ratio === 'string' && ratio.includes(':')) {
            const [right, held] = ratio.split(':').map(n => parseFloat(n.trim()));
            rightRatio = right / held;
        } else {
            rightRatio = parseFloat(ratio);
        }

        if (isNaN(rightRatio) || rightRatio <= 0) {
            throw new Error(`Invalid right ratio: ${ratio}. Use format "1:5" or decimal 0.2`);
        }

        const rightPrice = parseFloat(price);
        if (isNaN(rightPrice) || rightPrice <= 0) {
            throw new Error(`Invalid right issue price: ${price}`);
        }

        // Get all lots for this symbol
        const lots = this.fifoQueue.holdings[symbol];
        if (!lots || lots.length === 0) {
            throw new Error(`No lots found for ${symbol}`);
        }

        const exDateObj = new Date(exDate);
        let eligibleShares = 0;

        // Calculate eligible shares (purchased before ex-date)
        for (const lot of lots) {
            if (lot.purchaseDate < exDateObj) {
                eligibleShares += lot.remainingQuantity;
            }
        }

        if (eligibleShares === 0) {
            throw new Error(
                `No shares purchased before ex-date (${exDate}) for ${symbol}`
            );
        }

        // Calculate right shares entitled
        const rightSharesEntitled = Math.floor(eligibleShares * rightRatio);

        if (rightSharesEntitled === 0) {
            throw new Error(
                `Right ratio too small: ${eligibleShares} × ${rightRatio} = ${rightSharesEntitled} shares`
            );
        }

        // Use subscription date if provided, otherwise use ex-date + 30 days
        const purchaseDate = subscriptionDate ?
            new Date(subscriptionDate) :
            new Date(exDateObj.getTime() + (30 * 24 * 60 * 60 * 1000));

        // Add right shares as a new FIFO lot with special flag
        const newLot = {
            quantity: rightSharesEntitled,
            price: rightPrice,
            purchaseDate: purchaseDate,
            remainingQuantity: rightSharesEntitled,
            originalTransaction: {
                type: 'RIGHT_ISSUE',
                symbol: symbol,
                exDate: exDateObj,
                rightRatio: rightRatio,
                rightPrice: rightPrice,
                eligibleShares: eligibleShares
            }
        };

        lots.push(newLot);

        // Calculate new portfolio metrics
        const holdings = this.fifoQueue.getHoldings();
        const updatedHolding = holdings[symbol];

        console.log(
            `  Added right issue lot: ${rightSharesEntitled} shares @ Rs. ${rightPrice}`
        );

        return {
            type: 'RIGHT',
            symbol: symbol,
            eligibleShares: eligibleShares,
            rightSharesEntitled: rightSharesEntitled,
            rightPrice: rightPrice,
            rightRatio: rightRatio,
            ratioString: typeof ratio === 'string' ? ratio : `${rightRatio * 100}%`,
            totalCost: rightSharesEntitled * rightPrice,
            newTotalShares: updatedHolding.totalQuantity,
            newAvgCost: updatedHolding.averageCost,
            newTotalCostBasis: updatedHolding.totalCostBasis,
            purchaseDate: purchaseDate,
            summary: `Right ${typeof ratio === 'string' ? ratio : (rightRatio * 100).toFixed(0) + '%'}: Added ${rightSharesEntitled} shares @ Rs. ${rightPrice}, new avg cost Rs. ${updatedHolding.averageCost.toFixed(2)}`
        };
    }

    /**
     * Validate inputs
     * @private
     */
    _validateInputs(symbol, actionType, details) {
        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Symbol is required and must be a string');
        }

        if (!['BONUS', 'RIGHT'].includes(actionType)) {
            throw new Error('Action type must be "BONUS" or "RIGHT"');
        }

        if (!details || typeof details !== 'object') {
            throw new Error('Details object is required');
        }

        if (!details.exDate) {
            throw new Error('Ex-date is required in details');
        }

        // Validate date format
        const exDate = new Date(details.exDate);
        if (isNaN(exDate.getTime())) {
            throw new Error(`Invalid ex-date: ${details.exDate}`);
        }

        if (actionType === 'BONUS') {
            if (!details.ratio) {
                throw new Error('Bonus ratio is required (e.g., "20%" or 0.20)');
            }
        }

        if (actionType === 'RIGHT') {
            if (!details.ratio) {
                throw new Error('Right ratio is required (e.g., "1:5" or 0.2)');
            }
            if (!details.price) {
                throw new Error('Right issue price is required');
            }
        }
    }

    /**
     * Check if action already applied
     * @private
     */
    _isActionAlreadyApplied(symbol, actionType, exDate) {
        const exDateObj = new Date(exDate);

        return this.corporateActions.some(action =>
            action.symbol === symbol &&
            action.type === actionType &&
            action.exDate.getTime() === exDateObj.getTime() &&
            action.applied === true
        );
    }

    /**
     * Get all corporate actions for a symbol
     * @param {string} symbol - Stock symbol
     * @returns {Array} Array of corporate actions
     */
    getCorporateActions(symbol = null) {
        if (symbol) {
            return this.corporateActions.filter(
                action => action.symbol === symbol.toUpperCase()
            );
        }
        return this.corporateActions;
    }

    /**
     * Get corporate actions summary
     * @returns {object} Summary statistics
     */
    getSummary() {
        const summary = {
            totalActions: this.corporateActions.length,
            bonusActions: this.corporateActions.filter(a => a.type === 'BONUS').length,
            rightActions: this.corporateActions.filter(a => a.type === 'RIGHT').length,
            symbolsAffected: [...new Set(this.corporateActions.map(a => a.symbol))],
            actions: this.corporateActions
        };

        return summary;
    }

    /**
     * Reverse a corporate action (undo)
     * WARNING: This is complex and should be used carefully
     *
     * @param {number} actionId - ID of the action to reverse
     * @returns {object} Result of reversal
     */
    reverseCorporateAction(actionId) {
        const action = this.corporateActions.find(a => a.id === actionId);

        if (!action) {
            throw new Error(`Corporate action with ID ${actionId} not found`);
        }

        if (!action.applied) {
            throw new Error(`Corporate action ${actionId} is already reversed`);
        }

        // Check if there are any sales after this corporate action
        const realizedGains = this.fifoQueue.getRealizedGains();
        const salesAfterAction = realizedGains.filter(gain =>
            gain.symbol === action.symbol &&
            new Date(gain.saleDate) > action.appliedDate
        );

        if (salesAfterAction.length > 0) {
            throw new Error(
                `Cannot reverse: ${salesAfterAction.length} sales occurred after this action. ` +
                `Reversing would invalidate tax calculations.`
            );
        }

        if (action.type === 'BONUS') {
            this._reverseBonusShares(action);
        } else if (action.type === 'RIGHT') {
            this._reverseRightIssue(action);
        }

        action.applied = false;
        action.reversedDate = new Date();

        this.saveToStorage();

        console.log(`✓ Corporate action reversed: ${action.type} for ${action.symbol}`);

        return {
            success: true,
            actionId: actionId,
            message: `Reversed ${action.type} action for ${action.symbol}`
        };
    }

    /**
     * Reverse bonus shares
     * @private
     */
    _reverseBonusShares(action) {
        const symbol = action.symbol;
        const bonusRatio = action.result.bonusRatio;
        const exDate = new Date(action.details.exDate);

        const lots = this.fifoQueue.holdings[symbol];
        if (!lots) {
            throw new Error(`No lots found for ${symbol}`);
        }

        // Reverse the adjustment
        for (const lot of lots) {
            if (lot.purchaseDate < exDate) {
                const currentQuantity = lot.remainingQuantity;
                const originalQuantity = Math.floor(currentQuantity / (1 + bonusRatio));
                const bonusRemoved = currentQuantity - originalQuantity;

                // Restore original quantity
                lot.remainingQuantity = originalQuantity;

                // Restore original price
                lot.price = (currentQuantity * lot.price) / originalQuantity;

                console.log(
                    `  Reversed lot: ${currentQuantity} → ${originalQuantity} shares ` +
                    `(removed ${bonusRemoved} bonus shares)`
                );
            }
        }
    }

    /**
     * Reverse right issue
     * @private
     */
    _reverseRightIssue(action) {
        const symbol = action.symbol;
        const rightSharesEntitled = action.result.rightSharesEntitled;
        const purchaseDate = new Date(action.result.purchaseDate);

        const lots = this.fifoQueue.holdings[symbol];
        if (!lots) {
            throw new Error(`No lots found for ${symbol}`);
        }

        // Find and remove the right issue lot
        const rightLotIndex = lots.findIndex(lot =>
            lot.originalTransaction &&
            lot.originalTransaction.type === 'RIGHT_ISSUE' &&
            lot.purchaseDate.getTime() === purchaseDate.getTime() &&
            lot.quantity === rightSharesEntitled
        );

        if (rightLotIndex === -1) {
            throw new Error(`Right issue lot not found for reversal`);
        }

        // Check if any shares from this lot have been sold
        const rightLot = lots[rightLotIndex];
        if (rightLot.remainingQuantity !== rightLot.quantity) {
            throw new Error(
                `Cannot reverse: ${rightLot.quantity - rightLot.remainingQuantity} ` +
                `right shares have been sold`
            );
        }

        // Remove the lot
        lots.splice(rightLotIndex, 1);

        console.log(
            `  Removed right issue lot: ${rightSharesEntitled} shares @ Rs. ${action.result.rightPrice}`
        );
    }

    /**
     * Generate corporate actions report
     * @param {string} symbol - Optional symbol filter
     * @returns {string} Formatted report
     */
    generateReport(symbol = null) {
        const actions = symbol ?
            this.getCorporateActions(symbol) :
            this.corporateActions;

        if (actions.length === 0) {
            return 'No corporate actions recorded.';
        }

        const lines = [];
        lines.push('='.repeat(70));
        lines.push('CORPORATE ACTIONS REPORT');
        if (symbol) {
            lines.push(`Symbol: ${symbol}`);
        }
        lines.push('='.repeat(70));
        lines.push('');

        for (const action of actions) {
            lines.push(`${action.type}: ${action.symbol}`);
            lines.push(`  Ex-Date: ${action.exDate.toLocaleDateString('en-PK')}`);
            lines.push(`  Applied: ${action.appliedDate.toLocaleDateString('en-PK')}`);
            lines.push(`  Status: ${action.applied ? 'Active' : 'Reversed'}`);

            if (action.type === 'BONUS') {
                lines.push(`  Ratio: ${action.result.bonusPercentage}`);
                lines.push(`  Old Shares: ${action.result.oldShares}`);
                lines.push(`  Bonus Shares: ${action.result.bonusShares}`);
                lines.push(`  New Total: ${action.result.newTotalShares}`);
                lines.push(`  Old Avg Cost: Rs. ${action.result.oldAvgCost.toFixed(2)}`);
                lines.push(`  New Avg Cost: Rs. ${action.result.newAvgCost.toFixed(2)}`);
            } else if (action.type === 'RIGHT') {
                lines.push(`  Ratio: ${action.result.ratioString}`);
                lines.push(`  Eligible Shares: ${action.result.eligibleShares}`);
                lines.push(`  Right Shares: ${action.result.rightSharesEntitled}`);
                lines.push(`  Right Price: Rs. ${action.result.rightPrice.toFixed(2)}`);
                lines.push(`  Total Cost: Rs. ${action.result.totalCost.toFixed(2)}`);
                lines.push(`  New Avg Cost: Rs. ${action.result.newAvgCost.toFixed(2)}`);
            }

            lines.push('');
        }

        lines.push('='.repeat(70));

        return lines.join('\n');
    }

    /**
     * Save to localStorage
     */
    saveToStorage() {
        if (!this.storageManager) {
            console.warn('StorageManager not available');
            return;
        }

        const settings = this.storageManager.loadSettings() || {};
        settings.corporateActions = this.corporateActions;
        this.storageManager.saveSettings(settings);
    }

    /**
     * Load from localStorage
     */
    loadFromStorage() {
        if (!this.storageManager) {
            return;
        }

        const settings = this.storageManager.loadSettings();
        if (settings && settings.corporateActions) {
            // Restore dates from string format
            this.corporateActions = settings.corporateActions.map(action => ({
                ...action,
                exDate: new Date(action.exDate),
                appliedDate: new Date(action.appliedDate),
                reversedDate: action.reversedDate ? new Date(action.reversedDate) : undefined
            }));

            console.log(`✓ Loaded ${this.corporateActions.length} corporate actions from storage`);
        }
    }

    /**
     * Clear all corporate actions
     * WARNING: This will remove all corporate action history
     */
    clearAll() {
        if (!confirm(
            'Are you sure you want to clear all corporate actions? ' +
            'This will NOT reverse their effects on your portfolio. ' +
            'This only clears the history.'
        )) {
            return false;
        }

        this.corporateActions = [];
        this.saveToStorage();
        console.log('✓ All corporate actions cleared');
        return true;
    }

    /**
     * Export corporate actions to JSON
     * @returns {object} Corporate actions data
     */
    exportData() {
        return {
            corporateActions: this.corporateActions,
            exportDate: new Date(),
            version: '1.0'
        };
    }

    /**
     * Import corporate actions from JSON
     * @param {object} data - Corporate actions data
     */
    importData(data) {
        if (!data.corporateActions || !Array.isArray(data.corporateActions)) {
            throw new Error('Invalid corporate actions data');
        }

        // Restore dates
        this.corporateActions = data.corporateActions.map(action => ({
            ...action,
            exDate: new Date(action.exDate),
            appliedDate: new Date(action.appliedDate),
            reversedDate: action.reversedDate ? new Date(action.reversedDate) : undefined
        }));

        this.saveToStorage();
        console.log(`✓ Imported ${this.corporateActions.length} corporate actions`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorporateActionsManager;
}
