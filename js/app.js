/**
 * Main Application Logic
 * Ties together all modules and handles UI interactions
 */

class PakistanStockTaxApp {
    constructor() {
        // Initialize core modules
        this.fifoQueue = new FIFOQueue();
        this.taxCalculator = new TaxCalculator();
        this.storageManager = new StorageManager();
        this.whatIfScenarios = new WhatIfScenarios(this.fifoQueue, this.taxCalculator);
        this.pdfGenerator = new PDFGenerator();
        this.corporateActions = new CorporateActionsManager(this.fifoQueue, this.storageManager);

        // Initialize UI
        this.initializeEventListeners();
        this.setTodayDate();
        this.loadData();
        this.updateAllDisplays();

        console.log('✓ Pakistan Stock Tax Calculator initialized');
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Transaction form
        const form = document.getElementById('transactionForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddTransaction();
            });
        }

        // Filer status toggle
        const filerToggle = document.getElementById('filerStatus');
        if (filerToggle) {
            filerToggle.addEventListener('change', (e) => {
                this.handleFilerStatusChange(e.target.checked);
            });
        }
    }

    /**
     * Set today's date as default
     */
    setTodayDate() {
        const tradeDateInput = document.getElementById('tradeDate');
        const whatifDateInput = document.getElementById('whatifDate');
        const today = new Date().toISOString().split('T')[0];

        if (tradeDateInput) tradeDateInput.value = today;
        if (whatifDateInput) whatifDateInput.value = today;
    }

    /**
     * Handle adding a transaction
     */
    handleAddTransaction() {
        try {
            const type = document.getElementById('transactionType').value;
            const symbol = document.getElementById('symbol').value.toUpperCase();
            const quantity = parseFloat(document.getElementById('quantity').value);
            const price = parseFloat(document.getElementById('price').value);
            const tradeDate = document.getElementById('tradeDate').value;

            // Validate inputs
            if (!symbol || quantity <= 0 || price <= 0 || !tradeDate) {
                this.showMessage('Please fill all fields correctly', 'error');
                return;
            }

            // Add transaction
            const result = this.fifoQueue.addTransaction(type, symbol, quantity, price, tradeDate);

            // Show success message
            if (type === 'BUY') {
                this.showMessage(
                    `Added BUY: ${quantity} shares of ${symbol} @ Rs. ${price}`,
                    'success'
                );
            } else {
                this.showMessage(
                    `Added SELL: ${quantity} shares of ${symbol} @ Rs. ${price}. Capital Gain: Rs. ${result.capitalGain.toFixed(2)}`,
                    'success'
                );
            }

            // Reset form
            document.getElementById('transactionForm').reset();
            this.setTodayDate();

            // Update displays
            this.updateAllDisplays();

            // Auto-save
            this.storageManager.autoSave(this.fifoQueue.exportData());

        } catch (error) {
            this.showMessage(`Error: ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Handle filer status change
     */
    handleFilerStatusChange(isFiler) {
        this.taxCalculator.setFilerStatus(isFiler);

        const statusText = document.getElementById('filerStatusText');
        if (statusText) {
            statusText.textContent = isFiler ?
                'Current: Filer (15% flat rate)' :
                'Current: Non-Filer (15% flat rate)';
        }

        // Update displays with new tax calculations
        this.updateAllDisplays();

        this.showMessage(
            `Filer status updated to: ${isFiler ? 'Filer' : 'Non-Filer'}`,
            'info'
        );
    }

    /**
     * Update all displays
     */
    updateAllDisplays() {
        this.updateHoldingsDisplay();
        this.updateRealizedGainsDisplay();
        this.updateTaxSummary();
        this.updateStorageInfo();
    }

    /**
     * Update holdings display
     */
    updateHoldingsDisplay() {
        const container = document.getElementById('holdingsDisplay');
        if (!container) return;

        const holdings = this.fifoQueue.getHoldings();

        if (Object.keys(holdings).length === 0) {
            container.innerHTML = '<p class="empty-state">No holdings yet. Add buy transactions to get started.</p>';
            return;
        }

        let html = '';

        for (const symbol in holdings) {
            const holding = holdings[symbol];

            html += `
                <div class="holding-item">
                    <div class="holding-header">
                        <span class="symbol">${symbol}</span>
                        <span>${holding.totalQuantity} shares</span>
                    </div>
                    <div class="holding-details">
                        <div class="detail-row">
                            <span class="detail-label">Average Cost:</span>
                            <span class="detail-value">${this.formatCurrency(holding.averageCost)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Cost Basis:</span>
                            <span class="detail-value">${this.formatCurrency(holding.totalCostBasis)}</span>
                        </div>
                    </div>
                    ${this.renderLotBreakdown(holding.lots)}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Render lot breakdown
     */
    renderLotBreakdown(lots) {
        if (!lots || lots.length === 0) return '';

        let html = '<div class="lot-breakdown"><strong>Lots:</strong><div style="margin-top: 8px;">';

        for (let i = 0; i < lots.length; i++) {
            const lot = lots[i];
            html += `
                <div class="lot-item">
                    <span>${lot.quantity} shares @ ${this.formatCurrency(lot.price)}</span>
                    <span>${this.formatDate(lot.purchaseDate)}</span>
                </div>
            `;
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Update realized gains display
     */
    updateRealizedGainsDisplay() {
        const container = document.getElementById('realizedGainsDisplay');
        if (!container) return;

        const realizedGains = this.fifoQueue.getRealizedGains();

        if (realizedGains.length === 0) {
            container.innerHTML = '<p class="empty-state">No sales recorded yet.</p>';
            return;
        }

        let html = '';

        for (const sale of realizedGains) {
            const taxCalc = this.taxCalculator.calculateTaxForSale(sale);

            html += `
                <div class="gain-item">
                    <div class="gain-header">
                        <span class="symbol">${sale.symbol}</span>
                        <span>${this.formatDate(sale.saleDate)}</span>
                    </div>
                    <div class="gain-details">
                        <div class="detail-row">
                            <span class="detail-label">Quantity:</span>
                            <span class="detail-value">${sale.quantitySold} shares</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Sale Price:</span>
                            <span class="detail-value">${this.formatCurrency(sale.sellPrice)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Sale Proceeds:</span>
                            <span class="detail-value">${this.formatCurrency(sale.saleProceeds)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Cost Basis:</span>
                            <span class="detail-value">${this.formatCurrency(sale.totalCostBasis)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Capital Gain:</span>
                            <span class="detail-value ${sale.capitalGain >= 0 ? 'positive' : 'negative'}">
                                ${this.formatCurrency(sale.capitalGain)}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Tax:</span>
                            <span class="detail-value">${this.formatCurrency(taxCalc.totalTax)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Net Profit:</span>
                            <span class="detail-value ${taxCalc.netProfit >= 0 ? 'positive' : 'negative'}">
                                ${this.formatCurrency(taxCalc.netProfit)}
                            </span>
                        </div>
                    </div>
                    ${this.renderTaxByLot(taxCalc.taxByLot)}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Render tax by lot breakdown
     */
    renderTaxByLot(taxByLot) {
        if (!taxByLot || taxByLot.length === 0) return '';

        let html = '<div class="lot-breakdown"><strong>Tax by Lot:</strong><div style="margin-top: 8px;">';

        for (let i = 0; i < taxByLot.length; i++) {
            const lot = taxByLot[i];
            html += `
                <div class="lot-item">
                    <span>${lot.quantity} shares @ ${this.formatCurrency(lot.costPerShare)}</span>
                    <span>${lot.taxRatePercentage} → ${this.formatCurrency(lot.tax)}</span>
                </div>
            `;
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Update tax summary
     */
    updateTaxSummary() {
        const realizedGains = this.fifoQueue.getRealizedGains();

        if (realizedGains.length === 0) {
            document.getElementById('totalGains').textContent = 'Rs. 0.00';
            document.getElementById('totalLosses').textContent = 'Rs. 0.00';
            document.getElementById('netGain').textContent = 'Rs. 0.00';
            document.getElementById('taxLiability').textContent = 'Rs. 0.00';
            document.getElementById('netProfit').textContent = 'Rs. 0.00';
            return;
        }

        const aggregateTax = this.taxCalculator.calculateAggregateTax(realizedGains);

        document.getElementById('totalGains').textContent = this.formatCurrency(aggregateTax.totalGains);
        document.getElementById('totalLosses').textContent = this.formatCurrency(aggregateTax.totalLosses);
        document.getElementById('netGain').textContent = this.formatCurrency(aggregateTax.netGain);
        document.getElementById('taxLiability').textContent = this.formatCurrency(aggregateTax.totalTax);
        document.getElementById('netProfit').textContent = this.formatCurrency(aggregateTax.netProfitAfterTax);
    }

    /**
     * Update storage info
     */
    updateStorageInfo() {
        const container = document.getElementById('storageInfo');
        if (!container) return;

        const info = this.storageManager.getStorageInfo();

        if (!info.available) {
            container.innerHTML = '<p>localStorage not available</p>';
            return;
        }

        container.innerHTML = `
            <div>Storage Used: ${info.appSizeKB} KB of ~5 MB available</div>
        `;
    }

    /**
     * Refresh holdings
     */
    refreshHoldings() {
        this.updateHoldingsDisplay();
        this.showMessage('Holdings refreshed', 'info');
    }

    /**
     * Run what-if analysis
     */
    runWhatIfAnalysis() {
        try {
            const symbol = document.getElementById('whatifSymbol').value.toUpperCase();
            const quantity = parseFloat(document.getElementById('whatifQuantity').value);
            const price = parseFloat(document.getElementById('whatifPrice').value);
            const date = document.getElementById('whatifDate').value;

            if (!symbol || quantity <= 0 || price <= 0 || !date) {
                this.showMessage('Please fill all what-if fields', 'error');
                return;
            }

            // Run analysis
            const timing = this.whatIfScenarios.analyzeOptimalTiming(symbol, quantity, price);

            // Display results
            const container = document.getElementById('whatifResults');
            let html = '<h4 style="margin-bottom: 15px;">Scenarios:</h4>';

            for (const scenario of timing.scenarios) {
                const isOptimal = scenario === timing.optimal;
                html += `
                    <div class="scenario-item ${isOptimal ? 'optimal' : ''}">
                        <div>
                            <div class="scenario-label">${scenario.scenario}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">
                                ${this.formatDate(scenario.date)}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div>Tax: ${this.formatCurrency(scenario.tax)}</div>
                            <div style="font-size: 0.9rem; color: #64748b;">
                                Net: ${this.formatCurrency(scenario.netProfit)}
                            </div>
                            ${scenario.taxSavings ? `<div style="font-size: 0.85rem; color: #10b981;">
                                Save: ${this.formatCurrency(scenario.taxSavings)}
                            </div>` : ''}
                        </div>
                    </div>
                `;
            }

            html += `
                <div style="margin-top: 15px; padding: 15px; background: #d1fae5; border-radius: 8px;">
                    <strong>Recommendation:</strong> ${timing.recommendation}
                </div>
            `;

            container.innerHTML = html;

        } catch (error) {
            this.showMessage(`Error: ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Save data to storage
     */
    saveData() {
        const data = this.fifoQueue.exportData();
        const success = this.storageManager.saveData(data);

        if (success) {
            this.showMessage('Data saved successfully', 'success');
            this.updateStorageInfo();
        } else {
            this.showMessage('Failed to save data', 'error');
        }
    }

    /**
     * Load data from storage
     */
    loadData() {
        const data = this.storageManager.loadData();

        if (data) {
            this.fifoQueue.importData(data);
            this.updateAllDisplays();
            this.showMessage('Data loaded successfully', 'success');
        }
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            return;
        }

        this.fifoQueue.reset();
        this.storageManager.clearAllData();
        this.updateAllDisplays();
        this.showMessage('All data cleared', 'info');
    }

    /**
     * Export to PDF
     */
    exportToPDF() {
        try {
            const realizedGains = this.fifoQueue.getRealizedGains();

            if (realizedGains.length === 0) {
                this.showMessage('No sales to export', 'error');
                return;
            }

            const aggregateTax = this.taxCalculator.calculateAggregateTax(realizedGains);
            this.pdfGenerator.generateTaxReport(aggregateTax);

            this.showMessage('PDF exported successfully', 'success');
        } catch (error) {
            this.showMessage(`Failed to export PDF: ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Export to JSON
     */
    exportToJSON() {
        const data = this.fifoQueue.exportData();
        this.storageManager.exportToFile(data, `psx-tax-data-${new Date().toISOString().split('T')[0]}.json`);
        this.showMessage('JSON exported successfully', 'success');
    }

    /**
     * Import from file
     */
    async importFromFile(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;

            const data = await this.storageManager.importFromFile(file);
            this.fifoQueue.importData(data);
            this.updateAllDisplays();

            this.showMessage('Data imported successfully', 'success');

            // Reset file input
            event.target.value = '';
        } catch (error) {
            this.showMessage(`Failed to import: ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Handle corporate action application
     */
    handleCorporateAction(symbol, type, details) {
        try {
            const result = this.corporateActions.applyCorporateAction(symbol, type, details);

            this.showMessage(
                `Corporate action applied: ${result.result.summary}`,
                'success'
            );

            this.updateAllDisplays();
            this.updateCorporateActionsDisplay();

            return result;
        } catch (error) {
            this.showMessage(`Error: ${error.message}`, 'error');
            console.error(error);
            return null;
        }
    }

    /**
     * Apply bonus shares
     */
    applyBonusShares(symbol, ratio, exDate) {
        return this.handleCorporateAction(symbol, 'BONUS', { ratio, exDate });
    }

    /**
     * Apply right issue
     */
    applyRightIssue(symbol, ratio, price, exDate, subscriptionDate) {
        const details = { ratio, price, exDate };
        if (subscriptionDate) {
            details.subscriptionDate = subscriptionDate;
        }
        return this.handleCorporateAction(symbol, 'RIGHT', details);
    }

    /**
     * Update corporate actions display
     */
    updateCorporateActionsDisplay() {
        const container = document.getElementById('corporateActionsHistory');
        if (!container) return;

        const actions = this.corporateActions.getCorporateActions();

        if (actions.length === 0) {
            container.innerHTML = '<p class="empty-state">No corporate actions recorded yet.</p>';
            return;
        }

        let html = '<div style="margin-top: 20px;"><h4>Corporate Actions History</h4>';

        for (const action of actions) {
            const statusClass = action.applied ? 'success' : 'error';
            const statusText = action.applied ? 'Applied' : 'Reversed';

            html += `
                <div class="test-section ${statusClass}" style="margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong>${action.type}: ${action.symbol}</strong><br>
                            <span style="font-size: 0.9rem; color: #64748b;">
                                Ex-Date: ${this.formatDate(action.exDate)} |
                                Applied: ${this.formatDate(action.appliedDate)} |
                                Status: ${statusText}
                            </span><br>
                            <span style="font-size: 0.9rem; margin-top: 5px; display: block;">
                                ${action.result.summary}
                            </span>
                        </div>
                        ${action.applied ? `
                            <button class="btn btn-secondary" onclick="app.reverseCorporateAction(${action.id})"
                                    style="font-size: 0.8rem; padding: 5px 10px;">
                                Undo
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Reverse corporate action
     */
    reverseCorporateAction(actionId) {
        try {
            const result = this.corporateActions.reverseCorporateAction(actionId);

            this.showMessage(result.message, 'success');
            this.updateAllDisplays();
            this.updateCorporateActionsDisplay();
        } catch (error) {
            this.showMessage(`Error: ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Get corporate actions summary
     */
    getCorporateActionsSummary() {
        return this.corporateActions.getSummary();
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return `Rs. ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    /**
     * Format date
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Show message toast
     */
    showMessage(message, type = 'info') {
        const toast = document.getElementById('messageToast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `message-toast ${type} show`;

        // Auto-hide after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
}

// Initialize app when DOM is ready
let app;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new PakistanStockTaxApp();
    });
} else {
    app = new PakistanStockTaxApp();
}

// Make app globally accessible for inline event handlers
window.app = app;
