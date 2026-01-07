/**
 * Dashboard Logic - Mobile App
 * Displays portfolio overview, tax summary, and optimization cards
 */

class DashboardApp {
    constructor() {
        // Initialize core modules
        this.fifoQueue = new FIFOQueue();
        this.taxCalculator = new TaxCalculator();
        this.storageManager = new StorageManager();
        this.whatIfScenarios = new WhatIfScenarios(this.fifoQueue, this.taxCalculator);

        // Load data
        this.loadData();

        // Initialize UI
        this.initializeUI();
        this.updateDashboard();

        console.log('✓ Dashboard initialized');
    }

    /**
     * Load data from localStorage
     */
    loadData() {
        try {
            const data = this.storageManager.loadData();
            if (data) {
                this.fifoQueue.transactions = data.transactions || [];
                this.fifoQueue.holdings = data.holdings || {};
                this.fifoQueue.realizedGains = data.realizedGains || [];

                // Load settings
                const settings = this.storageManager.loadSettings();
                if (settings && settings.filerStatus !== undefined) {
                    this.taxCalculator.setFilerStatus(settings.filerStatus);
                }
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }

    /**
     * Initialize UI event listeners
     */
    initializeUI() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        // Update prices button
        const updatePricesBtn = document.getElementById('updatePricesBtn');
        if (updatePricesBtn) {
            updatePricesBtn.addEventListener('click', () => this.showUpdatePricesDialog());
        }
    }

    /**
     * Update all dashboard displays
     */
    updateDashboard() {
        const holdings = this.fifoQueue.getHoldings();
        const hasData = Object.keys(holdings).length > 0 || this.fifoQueue.realizedGains.length > 0;

        if (!hasData) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.updatePortfolioValue(holdings);
        this.updatePnL(holdings);
        this.updateTaxSummary();
        this.updateOptimizationCards();
    }

    /**
     * Update portfolio value card
     */
    updatePortfolioValue(holdings) {
        let totalValue = 0;
        let totalCost = 0;

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            totalCost += holding.totalCostBasis;

            // Try to get current price from localStorage
            const currentPrice = this.getCurrentPrice(symbol);
            if (currentPrice) {
                totalValue += holding.totalQuantity * currentPrice;
            } else {
                // Use average cost if no current price
                totalValue += holding.totalCostBasis;
            }
        }

        const portfolioValueEl = document.getElementById('portfolioValue');
        const portfolioChangeEl = document.getElementById('portfolioChange');

        if (portfolioValueEl) {
            portfolioValueEl.textContent = this.formatAmount(totalValue);
        }

        if (portfolioChangeEl) {
            const change = totalValue - totalCost;
            const changePercent = totalCost > 0 ? ((change / totalCost) * 100) : 0;

            const changeValueEl = portfolioChangeEl.querySelector('.change-value');
            const changePercentEl = portfolioChangeEl.querySelector('.change-percent');

            if (changeValueEl) {
                changeValueEl.textContent = (change >= 0 ? '+' : '') + 'Rs. ' + this.formatAmount(Math.abs(change));
                changeValueEl.style.color = change >= 0 ? 'rgba(255, 255, 255, 0.9)' : '#FCA5A5';
            }

            if (changePercentEl) {
                changePercentEl.textContent = '(' + (change >= 0 ? '+' : '') + changePercent.toFixed(2) + '%)';
            }
        }
    }

    /**
     * Update P&L display
     */
    updatePnL(holdings) {
        let unrealizedPnL = 0;

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = this.getCurrentPrice(symbol);

            if (currentPrice) {
                const currentValue = holding.totalQuantity * currentPrice;
                unrealizedPnL += (currentValue - holding.totalCostBasis);
            }
        }

        // Calculate realized P&L for today (would need to track daily in real app)
        let realizedPnL = 0;
        const today = new Date().toDateString();

        for (const gain of this.fifoQueue.realizedGains) {
            const saleDate = new Date(gain.saleDate).toDateString();
            if (saleDate === today) {
                realizedPnL += gain.capitalGain;
            }
        }

        // Update UI
        const unrealizedEl = document.getElementById('unrealizedPnL');
        if (unrealizedEl) {
            unrealizedEl.textContent = (unrealizedPnL >= 0 ? '+' : '') + 'Rs. ' + this.formatAmount(Math.abs(unrealizedPnL));
            unrealizedEl.className = 'pnl-value ' + (unrealizedPnL >= 0 ? 'positive' : 'negative');
        }

        const realizedEl = document.getElementById('realizedPnL');
        if (realizedEl) {
            realizedEl.textContent = (realizedPnL >= 0 ? '+' : '') + 'Rs. ' + this.formatAmount(Math.abs(realizedPnL));
            realizedEl.className = 'pnl-value ' + (realizedPnL >= 0 ? 'positive' : 'negative');
        }
    }

    /**
     * Update tax summary card
     */
    updateTaxSummary() {
        let totalGains = 0;
        let totalLosses = 0;
        let totalTax = 0;

        // Get fiscal year dates (July 1 - June 30)
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        let fiscalYearStart, fiscalYearEnd;
        if (currentMonth >= 7) {
            fiscalYearStart = new Date(currentYear, 6, 1);
            fiscalYearEnd = new Date(currentYear + 1, 5, 30);
        } else {
            fiscalYearStart = new Date(currentYear - 1, 6, 1);
            fiscalYearEnd = new Date(currentYear, 5, 30);
        }

        const daysRemaining = Math.ceil((fiscalYearEnd - today) / (1000 * 60 * 60 * 24));

        // Calculate realized gains/losses for current fiscal year
        for (const gain of this.fifoQueue.realizedGains) {
            const saleDate = new Date(gain.saleDate);

            if (saleDate >= fiscalYearStart && saleDate <= fiscalYearEnd) {
                if (gain.capitalGain > 0) {
                    totalGains += gain.capitalGain;
                } else {
                    totalLosses += Math.abs(gain.capitalGain);
                }

                const taxCalc = this.taxCalculator.calculateTaxForSale(gain);
                totalTax += taxCalc.totalTax;
            }
        }

        const netGains = totalGains - totalLosses;
        const effectiveRate = netGains > 0 ? ((totalTax / netGains) * 100) : 15.0;
        const netAfterTax = netGains - totalTax;

        // Update UI
        document.getElementById('netGains').textContent = 'Rs. ' + this.formatAmount(netGains);
        document.getElementById('taxLiability').textContent = 'Rs. ' + this.formatAmount(totalTax);
        document.getElementById('effectiveRate').textContent = effectiveRate.toFixed(1) + '%';
        document.getElementById('netAfterTax').textContent = 'Rs. ' + this.formatAmount(netAfterTax);

        // Update fiscal year remaining days
        const fiscalYearEl = document.querySelector('.fiscal-year');
        if (fiscalYearEl) {
            fiscalYearEl.textContent = `${daysRemaining} days remaining`;
        }
    }

    /**
     * Update optimization cards
     */
    updateOptimizationCards() {
        // Get current prices for calculations
        const currentPrices = this.getAllCurrentPrices();

        // Holding Period Opportunities
        const holdingPeriodOpps = this.whatIfScenarios.scanHoldingPeriodOpportunities(currentPrices);
        const holdingPeriodSavings = holdingPeriodOpps.reduce((sum, opp) => sum + opp.savings, 0);

        document.getElementById('holdingPeriodSavings').textContent = 'Rs. ' + this.formatAmount(holdingPeriodSavings);
        document.getElementById('holdingPeriodText').textContent =
            holdingPeriodOpps.length > 0
                ? `${holdingPeriodOpps.length} opportunity${holdingPeriodOpps.length > 1 ? 'ies' : 'y'}`
                : 'No opportunities';

        // Loss Harvesting
        const lossHarvestSuggestions = this.whatIfScenarios.suggestLossHarvesting(currentPrices);
        const lossHarvestSavings = lossHarvestSuggestions.reduce((sum, sug) => sum + sug.taxSavings, 0);

        document.getElementById('lossHarvestSavings').textContent = 'Rs. ' + this.formatAmount(lossHarvestSavings);
        document.getElementById('lossHarvestText').textContent =
            lossHarvestSuggestions.length > 0
                ? `${lossHarvestSuggestions.length} suggestion${lossHarvestSuggestions.length > 1 ? 's' : ''}`
                : 'No losses to harvest';

        // Filer Status Comparison
        const filerComparison = this.whatIfScenarios.compareFilingStatusPortfolio(currentPrices);
        const filerSavings = filerComparison.savings > 0 ? filerComparison.savings : 0;

        document.getElementById('filerStatusSavings').textContent = 'Rs. ' + this.formatAmount(filerSavings);
        document.getElementById('filerStatusText').textContent =
            'Current: ' + (this.taxCalculator.isFiler ? 'Filer' : 'Non-Filer');
    }

    /**
     * Get current price for a symbol
     */
    getCurrentPrice(symbol) {
        try {
            const pricesData = localStorage.getItem('currentPrices');
            if (pricesData) {
                const prices = JSON.parse(pricesData);
                return prices[symbol] || null;
            }
        } catch (error) {
            console.error('Error getting current price:', error);
        }
        return null;
    }

    /**
     * Get all current prices
     */
    getAllCurrentPrices() {
        try {
            const pricesData = localStorage.getItem('currentPrices');
            if (pricesData) {
                return JSON.parse(pricesData);
            }
        } catch (error) {
            console.error('Error getting current prices:', error);
        }
        return {};
    }

    /**
     * Show update prices dialog
     */
    showUpdatePricesDialog() {
        // In a real app, this would show a modal to update prices
        // For now, redirect to a separate page
        alert('Update prices feature will be available in the next update. Use the Settings page to manually enter current prices.');
    }

    /**
     * Refresh dashboard
     */
    refresh() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<div class="loading"></div>';
        }

        setTimeout(() => {
            this.loadData();
            this.updateDashboard();

            if (refreshBtn) {
                refreshBtn.innerHTML = `
                    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                    </svg>
                `;
            }
        }, 500);
    }

    /**
     * Show empty state
     */
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'flex';
        }

        // Hide other cards
        const cards = document.querySelectorAll('.card, .action-card, .section-header, .optimization-cards');
        cards.forEach(card => {
            card.style.display = 'none';
        });
    }

    /**
     * Hide empty state
     */
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Show other cards
        const cards = document.querySelectorAll('.card, .action-card, .section-header, .optimization-cards');
        cards.forEach(card => {
            card.style.display = '';
        });
    }

    /**
     * Format amount for display
     */
    formatAmount(amount) {
        return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Initialize app when DOM is ready
let dashboardApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        dashboardApp = new DashboardApp();
    });
} else {
    dashboardApp = new DashboardApp();
}

// Make app globally accessible
window.dashboardApp = dashboardApp;
