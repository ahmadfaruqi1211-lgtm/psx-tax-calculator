/**
 * Portfolio Logic - Mobile App
 * Displays current holdings with detailed view
 */

class PortfolioApp {
    constructor() {
        // Initialize core modules
        this.fifoQueue = new FIFOQueue();
        this.taxCalculator = new TaxCalculator();
        this.storageManager = new StorageManager();

        // Load data
        this.loadData();

        // Sort state
        this.sortBy = 'value'; // 'value', 'symbol', 'pnl'

        // Initialize UI
        this.initializeUI();
        this.updatePortfolio();

        console.log('✓ Portfolio initialized');
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
        // Sort button
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.toggleSort());
        }

        // Update prices button
        const updatePricesBtn = document.getElementById('updatePricesBtn');
        if (updatePricesBtn) {
            updatePricesBtn.addEventListener('click', () => this.showUpdatePricesModal());
        }

        // Filter button (future feature)
        const filterBtn = document.getElementById('filterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                alert('Filter feature coming soon!');
            });
        }
    }

    /**
     * Update portfolio display
     */
    updatePortfolio() {
        const holdings = this.fifoQueue.getHoldings();
        const hasHoldings = Object.keys(holdings).length > 0;

        if (!hasHoldings) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        this.updateSummary(holdings);
        this.displayHoldings(holdings);
    }

    /**
     * Update summary cards
     */
    updateSummary(holdings) {
        let totalValue = 0;
        let totalCost = 0;

        for (const symbol in holdings) {
            const holding = holdings[symbol];
            totalCost += holding.totalCostBasis;

            const currentPrice = this.getCurrentPrice(symbol);
            if (currentPrice) {
                totalValue += holding.totalQuantity * currentPrice;
            } else {
                totalValue += holding.totalCostBasis;
            }
        }

        const unrealizedPnL = totalValue - totalCost;
        const unrealizedPnLPercent = totalCost > 0 ? ((unrealizedPnL / totalCost) * 100) : 0;

        // Update portfolio value card
        document.getElementById('portfolioValue').textContent = 'Rs. ' + this.formatAmount(totalValue);
        document.getElementById('investedAmount').textContent = 'Rs. ' + this.formatAmount(totalCost);

        const unrealizedEl = document.getElementById('unrealizedPnLMain');
        const arrow = unrealizedPnL >= 0 ? '▲' : '▼';
        unrealizedEl.textContent = (unrealizedPnL >= 0 ? '+' : '') + unrealizedPnLPercent.toFixed(2) + '% ' + arrow;
        unrealizedEl.style.color = unrealizedPnL >= 0 ? 'var(--success)' : 'var(--danger)';

        // Update price update info
        this.updatePriceUpdateInfo();
    }

    /**
     * Display holdings list
     */
    displayHoldings(holdings) {
        const holdingsList = document.getElementById('holdingsList');
        holdingsList.innerHTML = '';

        // Convert to array for sorting
        const holdingsArray = [];
        for (const symbol in holdings) {
            const holding = holdings[symbol];
            const currentPrice = this.getCurrentPrice(symbol);
            const currentValue = currentPrice ? holding.totalQuantity * currentPrice : holding.totalCostBasis;
            const pnl = currentValue - holding.totalCostBasis;
            const pnlPercent = holding.totalCostBasis > 0 ? ((pnl / holding.totalCostBasis) * 100) : 0;

            holdingsArray.push({
                symbol,
                holding,
                currentPrice,
                currentValue,
                pnl,
                pnlPercent
            });
        }

        // Sort holdings
        this.sortHoldings(holdingsArray);

        // Display holdings
        holdingsArray.forEach(item => {
            const holdingCard = this.createHoldingCard(item);
            holdingsList.appendChild(holdingCard);
        });
    }

    /**
     * Sort holdings
     */
    sortHoldings(holdingsArray) {
        if (this.sortBy === 'value') {
            holdingsArray.sort((a, b) => b.currentValue - a.currentValue);
        } else if (this.sortBy === 'symbol') {
            holdingsArray.sort((a, b) => a.symbol.localeCompare(b.symbol));
        } else if (this.sortBy === 'pnl') {
            holdingsArray.sort((a, b) => b.pnl - a.pnl);
        }
    }

    /**
     * Toggle sort mode
     */
    toggleSort() {
        const sortBtn = document.getElementById('sortBtn');

        if (this.sortBy === 'value') {
            this.sortBy = 'symbol';
            sortBtn.textContent = 'Sort by Symbol';
        } else if (this.sortBy === 'symbol') {
            this.sortBy = 'pnl';
            sortBtn.textContent = 'Sort by P&L';
        } else {
            this.sortBy = 'value';
            sortBtn.textContent = 'Sort by Value';
        }

        this.updatePortfolio();
    }

    /**
     * Create holding card element
     */
    createHoldingCard(item) {
        const card = document.createElement('div');
        card.className = 'holding-card-enhanced';

        const avgCost = item.holding.totalCostBasis / item.holding.totalQuantity;
        const arrow = item.pnl >= 0 ? '▲' : '▼';

        // Calculate holding period for oldest lot
        let holdingDays = 0;
        if (item.holding.lots && item.holding.lots.length > 0) {
            const oldestLot = item.holding.lots[0];
            const purchaseDate = new Date(oldestLot.purchaseDate);
            const today = new Date();
            holdingDays = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
        }

        card.innerHTML = `
            <div class="holding-card-header">
                <div class="holding-symbol-main">${item.symbol}</div>
                <button class="edit-price-btn" onclick="event.stopPropagation(); window.portfolioApp.editPrice('${item.symbol}', ${item.currentPrice || avgCost})">
                    Edit
                </button>
            </div>
            <div class="holding-info-row">
                <span class="holding-info-text">${item.holding.totalQuantity} shares @ Rs. ${this.formatAmount(avgCost)} avg</span>
            </div>
            <div class="holding-info-row">
                <span class="holding-info-label">Current:</span>
                <span class="holding-info-value" id="currentPrice_${item.symbol}">Rs. ${this.formatAmount(item.currentPrice || avgCost)}</span>
            </div>
            <div class="holding-info-row">
                <span class="holding-info-label">Value:</span>
                <span class="holding-info-value">Rs. ${this.formatAmount(item.currentValue)}</span>
            </div>
            <div class="holding-pnl-row">
                <span class="holding-pnl-label">P&L:</span>
                <span class="holding-pnl ${item.pnl >= 0 ? 'positive' : 'negative'}">
                    ${item.pnl >= 0 ? '+' : ''}Rs. ${this.formatAmount(Math.abs(item.pnl))} (${item.pnl >= 0 ? '+' : ''}${item.pnlPercent.toFixed(2)}%) ${arrow}
                </span>
            </div>
            <div class="holding-info-row">
                <span class="holding-info-text">Holding: ${holdingDays} days</span>
            </div>
            <div class="holding-actions">
                <button class="btn btn-secondary btn-small" onclick="window.portfolioApp.sellHolding('${item.symbol}')">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14"/>
                    </svg>
                    Sell
                </button>
                <button class="btn btn-secondary btn-small" onclick="window.portfolioApp.whatIfHolding('${item.symbol}')">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    What If?
                </button>
            </div>
        `;

        return card;
    }

    /**
     * Show holding detail modal
     */
    showHoldingDetail(symbol) {
        const holdings = this.fifoQueue.getHoldings();
        const holding = holdings[symbol];

        if (!holding) return;

        const currentPrice = this.getCurrentPrice(symbol);
        const currentValue = currentPrice ? holding.totalQuantity * currentPrice : holding.totalCostBasis;
        const pnl = currentValue - holding.totalCostBasis;
        const avgCost = holding.totalCostBasis / holding.totalQuantity;

        // Update modal content
        document.getElementById('modalSymbol').textContent = symbol;
        document.getElementById('modalQuantity').textContent = holding.totalQuantity;
        document.getElementById('modalAvgCost').textContent = 'Rs. ' + this.formatAmount(avgCost);
        document.getElementById('modalCurrentPrice').textContent = currentPrice
            ? 'Rs. ' + this.formatAmount(currentPrice)
            : 'Not set';
        document.getElementById('modalTotalCost').textContent = 'Rs. ' + this.formatAmount(holding.totalCostBasis);
        document.getElementById('modalCurrentValue').textContent = 'Rs. ' + this.formatAmount(currentValue);

        const modalPnL = document.getElementById('modalPnL');
        modalPnL.textContent = (pnl >= 0 ? '+' : '') + 'Rs. ' + this.formatAmount(Math.abs(pnl));
        modalPnL.style.color = pnl >= 0 ? 'var(--success)' : 'var(--danger)';

        // Display lots
        this.displayLots(symbol, holding);

        // Show modal
        document.getElementById('holdingModal').style.display = 'flex';
    }

    /**
     * Display purchase lots
     */
    displayLots(symbol, holding) {
        const modalLots = document.getElementById('modalLots');
        modalLots.innerHTML = '';

        if (!holding.lots || holding.lots.length === 0) {
            modalLots.innerHTML = '<div class="empty-text">No lots available</div>';
            return;
        }

        holding.lots.forEach((lot, index) => {
            const lotDiv = document.createElement('div');
            lotDiv.className = 'lot-item';

            const purchaseDate = new Date(lot.purchaseDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            lotDiv.innerHTML = `
                <div class="lot-header">
                    <span class="lot-label">Lot ${index + 1}</span>
                    <span class="lot-date">${purchaseDate}</span>
                </div>
                <div class="lot-details">
                    <span class="lot-detail">Qty: ${lot.quantity}</span>
                    <span class="lot-detail">Price: Rs. ${this.formatAmount(lot.pricePerShare)}</span>
                    <span class="lot-detail">Cost: Rs. ${this.formatAmount(lot.costBasis)}</span>
                </div>
            `;

            modalLots.appendChild(lotDiv);
        });
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('holdingModal').style.display = 'none';
    }

    /**
     * Show empty state
     */
    showEmptyState() {
        document.getElementById('emptyState').style.display = 'flex';
        document.getElementById('holdingsList').style.display = 'none';
        document.querySelector('.section-header').style.display = 'none';
        document.querySelector('.card-primary').style.display = 'none';
    }

    /**
     * Hide empty state
     */
    hideEmptyState() {
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('holdingsList').style.display = 'block';
        document.querySelector('.section-header').style.display = 'flex';
        document.querySelector('.card-primary').style.display = 'block';
    }

    /**
     * Edit price for a symbol
     */
    editPrice(symbol, currentPrice) {
        const newPrice = prompt(`Enter new price for ${symbol}:`, currentPrice.toFixed(2));

        if (newPrice === null || newPrice.trim() === '') {
            return; // User cancelled
        }

        const price = parseFloat(newPrice);
        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid price');
            return;
        }

        // Update price in localStorage
        this.setCurrentPrice(symbol, price);

        // Refresh display
        this.updatePortfolio();
    }

    /**
     * Set current price for a symbol
     */
    setCurrentPrice(symbol, price) {
        try {
            let prices = {};
            const pricesData = localStorage.getItem('currentPrices');
            if (pricesData) {
                prices = JSON.parse(pricesData);
            }

            prices[symbol] = {
                price: price,
                updatedAt: new Date().toISOString()
            };

            localStorage.setItem('currentPrices', JSON.stringify(prices));
        } catch (error) {
            console.error('Error setting current price:', error);
        }
    }

    /**
     * Get current price for a symbol (returns price value only)
     */
    getCurrentPrice(symbol) {
        try {
            const pricesData = localStorage.getItem('currentPrices');
            if (pricesData) {
                const prices = JSON.parse(pricesData);
                return prices[symbol] ? prices[symbol].price : null;
            }
        } catch (error) {
            console.error('Error getting current price:', error);
        }
        return null;
    }

    /**
     * Show update prices modal
     */
    showUpdatePricesModal() {
        const holdings = this.fifoQueue.getHoldings();
        const symbols = Object.keys(holdings);

        if (symbols.length === 0) {
            alert('No holdings to update prices for');
            return;
        }

        let message = 'Enter current prices for your holdings:\n\n';
        let anyUpdated = false;

        for (const symbol of symbols) {
            const currentPrice = this.getCurrentPrice(symbol) || holdings[symbol].totalCostBasis / holdings[symbol].totalQuantity;
            const newPrice = prompt(`${message}${symbol}:`, currentPrice.toFixed(2));

            if (newPrice !== null && newPrice.trim() !== '') {
                const price = parseFloat(newPrice);
                if (!isNaN(price) && price > 0) {
                    this.setCurrentPrice(symbol, price);
                    anyUpdated = true;
                }
            }

            message = ''; // Clear message after first prompt
        }

        if (anyUpdated) {
            this.updatePortfolio();
        }
    }

    /**
     * Update price update info
     */
    updatePriceUpdateInfo() {
        const priceUpdateText = document.getElementById('priceUpdateText');
        if (!priceUpdateText) return;

        try {
            const pricesData = localStorage.getItem('currentPrices');
            if (!pricesData) {
                priceUpdateText.textContent = 'Prices not set';
                return;
            }

            const prices = JSON.parse(pricesData);
            const symbols = Object.keys(prices);

            if (symbols.length === 0) {
                priceUpdateText.textContent = 'Prices not set';
                return;
            }

            // Find most recent update
            let mostRecent = null;
            for (const symbol in prices) {
                const updatedAt = new Date(prices[symbol].updatedAt);
                if (!mostRecent || updatedAt > mostRecent) {
                    mostRecent = updatedAt;
                }
            }

            if (mostRecent) {
                const now = new Date();
                const diffMs = now - mostRecent;
                const diffMins = Math.floor(diffMs / (1000 * 60));
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                let timeAgo;
                if (diffMins < 1) {
                    timeAgo = 'just now';
                } else if (diffMins < 60) {
                    timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                } else if (diffHours < 24) {
                    timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                } else {
                    timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                }

                priceUpdateText.textContent = `Prices updated ${timeAgo}`;
            } else {
                priceUpdateText.textContent = 'Prices not set';
            }
        } catch (error) {
            console.error('Error updating price info:', error);
            priceUpdateText.textContent = 'Prices not set';
        }
    }

    /**
     * Navigate to sell transaction
     */
    sellHolding(symbol) {
        sessionStorage.setItem('sellSymbol', symbol);
        window.location.href = 'add-transaction.html';
    }

    /**
     * Navigate to what-if with pre-filled symbol
     */
    whatIfHolding(symbol) {
        sessionStorage.setItem('whatIfSymbol', symbol);
        window.location.href = 'what-if.html';
    }

    /**
     * Format amount for display
     */
    formatAmount(amount) {
        return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Initialize app when DOM is ready
let portfolioApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        portfolioApp = new PortfolioApp();
    });
} else {
    portfolioApp = new PortfolioApp();
}

// Make app globally accessible
window.portfolioApp = portfolioApp;
