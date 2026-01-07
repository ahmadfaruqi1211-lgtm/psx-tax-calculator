/**
 * Add Transaction Logic - Mobile App
 * Handles smart form for manual transaction entry
 */

class AddTransactionApp {
    constructor() {
        // Initialize core modules
        this.fifoQueue = new FIFOQueue();
        this.taxCalculator = new TaxCalculator();
        this.storageManager = new StorageManager();

        // Load data
        this.loadData();

        // Form state
        this.transactionType = 'BUY';

        // Initialize UI
        this.initializeForm();
        this.populateSymbolsList();
        this.setDefaultDate();

        console.log('✓ Add Transaction form initialized');
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
     * Initialize form event listeners
     */
    initializeForm() {
        // Transaction type toggle
        const buyBtn = document.getElementById('buyBtn');
        const sellBtn = document.getElementById('sellBtn');

        buyBtn.addEventListener('click', () => this.setTransactionType('BUY'));
        sellBtn.addEventListener('click', () => this.setTransactionType('SELL'));

        // Symbol input
        const symbolInput = document.getElementById('symbol');
        symbolInput.addEventListener('input', () => this.onSymbolChange());

        // Quantity and price inputs
        const quantityInput = document.getElementById('quantity');
        const priceInput = document.getElementById('price');
        const commissionInput = document.getElementById('commission');

        quantityInput.addEventListener('input', () => this.updateCalculations());
        priceInput.addEventListener('input', () => this.updateCalculations());
        commissionInput.addEventListener('input', () => this.updateCalculations());

        // Trade date input
        const tradeDateInput = document.getElementById('tradeDate');
        tradeDateInput.addEventListener('change', () => this.updateSettlementDate());

        // Form submission
        const form = document.getElementById('transactionForm');
        form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    /**
     * Set transaction type
     */
    setTransactionType(type) {
        this.transactionType = type;

        const buyBtn = document.getElementById('buyBtn');
        const sellBtn = document.getElementById('sellBtn');
        const transactionTypeInput = document.getElementById('transactionType');

        if (type === 'BUY') {
            buyBtn.classList.add('active');
            sellBtn.classList.remove('active');
        } else {
            sellBtn.classList.add('active');
            buyBtn.classList.remove('active');
        }

        transactionTypeInput.value = type;

        // Update form state
        this.onSymbolChange();
        this.updateCalculations();
    }

    /**
     * Populate symbols list from existing holdings
     */
    populateSymbolsList() {
        const datalist = document.getElementById('symbolsList');
        const holdings = this.fifoQueue.getHoldings();

        // Clear existing options
        datalist.innerHTML = '';

        // Add symbols from holdings
        const symbols = Object.keys(holdings);
        symbols.forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            datalist.appendChild(option);
        });
    }

    /**
     * Handle symbol input change
     */
    onSymbolChange() {
        const symbol = document.getElementById('symbol').value.trim().toUpperCase();
        const availableToSellDiv = document.getElementById('availableToSell');

        if (this.transactionType === 'SELL' && symbol) {
            const holdings = this.fifoQueue.getHoldings();
            const holding = holdings[symbol];

            if (holding && holding.totalQuantity > 0) {
                const availableQtySpan = document.getElementById('availableQty');
                availableQtySpan.textContent = `Available to sell: ${holding.totalQuantity} shares`;
                availableToSellDiv.style.display = 'block';
            } else {
                availableToSellDiv.style.display = 'none';
            }
        } else {
            availableToSellDiv.style.display = 'none';
        }

        this.updateCalculations();
    }

    /**
     * Update cost calculations and tax preview
     */
    updateCalculations() {
        const quantity = parseFloat(document.getElementById('quantity').value) || 0;
        const price = parseFloat(document.getElementById('price').value) || 0;
        const commission = parseFloat(document.getElementById('commission').value) || 0;

        // Calculate costs
        const subtotal = quantity * price;
        const totalCost = subtotal + commission;

        // Update cost summary
        document.getElementById('subtotal').textContent = 'Rs. ' + this.formatAmount(subtotal);
        document.getElementById('commissionDisplay').textContent = 'Rs. ' + this.formatAmount(commission);
        document.getElementById('totalCost').textContent = 'Rs. ' + this.formatAmount(totalCost);

        // Update tax preview for SELL
        if (this.transactionType === 'SELL') {
            this.updateTaxPreview(quantity, price, commission);
        } else {
            document.getElementById('taxPreview').style.display = 'none';
        }
    }

    /**
     * Update tax preview for SELL transactions
     */
    updateTaxPreview(quantity, price, commission) {
        const symbol = document.getElementById('symbol').value.trim().toUpperCase();
        const taxPreviewDiv = document.getElementById('taxPreview');

        if (!symbol || quantity <= 0 || price <= 0) {
            taxPreviewDiv.style.display = 'none';
            return;
        }

        const holdings = this.fifoQueue.getHoldings();
        const holding = holdings[symbol];

        if (!holding || holding.totalQuantity === 0) {
            taxPreviewDiv.style.display = 'none';
            return;
        }

        // Create a temporary FIFO queue for simulation
        const tempQueue = new FIFOQueue();
        tempQueue.transactions = [...this.fifoQueue.transactions];
        tempQueue.holdings = JSON.parse(JSON.stringify(this.fifoQueue.holdings));
        tempQueue.realizedGains = [...this.fifoQueue.realizedGains];

        // Simulate the sale
        const tradeDate = document.getElementById('tradeDate').value || new Date().toISOString().split('T')[0];
        const settlementDate = this.calculateSettlementDate(new Date(tradeDate));

        try {
            const saleResult = tempQueue.sell(symbol, quantity, price, tradeDate, settlementDate.toISOString().split('T')[0], commission);

            if (saleResult && saleResult.realizedGains && saleResult.realizedGains.length > 0) {
                // Calculate total capital gain
                let totalCapitalGain = 0;
                let totalTax = 0;

                saleResult.realizedGains.forEach(gain => {
                    totalCapitalGain += gain.capitalGain;
                    const taxCalc = this.taxCalculator.calculateTaxForSale(gain);
                    totalTax += taxCalc.totalTax;
                });

                const saleProceeds = (quantity * price) - commission;
                const netProceeds = saleProceeds - totalTax;
                const taxRate = this.taxCalculator.isFiler ? 15.0 : 15.0; // Both are 15% for now

                // Update preview
                document.getElementById('previewGain').textContent =
                    (totalCapitalGain >= 0 ? '+' : '') + 'Rs. ' + this.formatAmount(totalCapitalGain);
                document.getElementById('previewGain').style.color =
                    totalCapitalGain >= 0 ? 'var(--success)' : 'var(--danger)';

                document.getElementById('previewRate').textContent = taxRate.toFixed(1) + '%';
                document.getElementById('previewTax').textContent = 'Rs. ' + this.formatAmount(totalTax);
                document.getElementById('previewNet').textContent = 'Rs. ' + this.formatAmount(netProceeds);

                taxPreviewDiv.style.display = 'block';
            } else {
                taxPreviewDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Tax preview error:', error);
            taxPreviewDiv.style.display = 'none';
        }
    }

    /**
     * Set default date to today
     */
    setDefaultDate() {
        const tradeDateInput = document.getElementById('tradeDate');
        const today = new Date().toISOString().split('T')[0];
        tradeDateInput.value = today;
        this.updateSettlementDate();
    }

    /**
     * Update settlement date (T+2)
     */
    updateSettlementDate() {
        const tradeDateInput = document.getElementById('tradeDate');
        const settlementDateSpan = document.getElementById('settlementDateText');

        if (!tradeDateInput.value) {
            settlementDateSpan.textContent = '--';
            return;
        }

        const tradeDate = new Date(tradeDateInput.value);
        const settlementDate = this.calculateSettlementDate(tradeDate);

        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        settlementDateSpan.textContent = settlementDate.toLocaleDateString('en-US', options);
    }

    /**
     * Calculate settlement date (T+2 business days)
     */
    calculateSettlementDate(tradeDate) {
        const date = new Date(tradeDate);
        let businessDays = 0;

        while (businessDays < 2) {
            date.setDate(date.getDate() + 1);
            const dayOfWeek = date.getDay();
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                businessDays++;
            }
        }

        return date;
    }

    /**
     * Validate form
     */
    validateForm() {
        const symbol = document.getElementById('symbol').value.trim().toUpperCase();
        const quantity = parseFloat(document.getElementById('quantity').value);
        const price = parseFloat(document.getElementById('price').value);
        const tradeDate = document.getElementById('tradeDate').value;

        // Basic validation
        if (!symbol) {
            this.showError('Please enter a stock symbol');
            return false;
        }

        if (!quantity || quantity <= 0) {
            this.showError('Please enter a valid quantity');
            return false;
        }

        if (!price || price <= 0) {
            this.showError('Please enter a valid price');
            return false;
        }

        if (!tradeDate) {
            this.showError('Please select a trade date');
            return false;
        }

        // Validate SELL quantity
        if (this.transactionType === 'SELL') {
            const holdings = this.fifoQueue.getHoldings();
            const holding = holdings[symbol];

            if (!holding || holding.totalQuantity === 0) {
                this.showError(`You don't own any ${symbol} shares`);
                return false;
            }

            if (quantity > holding.totalQuantity) {
                this.showError(`Cannot sell ${quantity} shares. You only have ${holding.totalQuantity} shares available.`);
                return false;
            }
        }

        return true;
    }

    /**
     * Handle form submission
     */
    handleSubmit(event) {
        event.preventDefault();

        // Validate form
        if (!this.validateForm()) {
            return;
        }

        // Get form values
        const symbol = document.getElementById('symbol').value.trim().toUpperCase();
        const quantity = parseFloat(document.getElementById('quantity').value);
        const price = parseFloat(document.getElementById('price').value);
        const tradeDate = document.getElementById('tradeDate').value;
        const commission = parseFloat(document.getElementById('commission').value) || 0;
        const notes = document.getElementById('notes').value.trim();

        // Calculate settlement date
        const settlementDate = this.calculateSettlementDate(new Date(tradeDate));
        const settlementDateStr = settlementDate.toISOString().split('T')[0];

        try {
            // Add transaction
            if (this.transactionType === 'BUY') {
                this.fifoQueue.buy(symbol, quantity, price, tradeDate, settlementDateStr, commission, notes);
            } else {
                this.fifoQueue.sell(symbol, quantity, price, tradeDate, settlementDateStr, commission, notes);
            }

            // Save to localStorage
            this.storageManager.saveData({
                transactions: this.fifoQueue.transactions,
                holdings: this.fifoQueue.holdings,
                realizedGains: this.fifoQueue.realizedGains
            });

            // Show success message
            this.showSuccess(`${this.transactionType === 'BUY' ? 'Purchase' : 'Sale'} recorded successfully!`);

            // Redirect to portfolio after a short delay
            setTimeout(() => {
                window.location.href = 'portfolio.html';
            }, 1500);

        } catch (error) {
            console.error('Transaction error:', error);
            this.showError(error.message || 'Failed to record transaction');
        }
    }

    /**
     * Show success toast
     */
    showSuccess(message) {
        const toast = document.getElementById('successToast');
        const toastMessage = document.getElementById('toastMessage');

        toastMessage.textContent = message;
        toast.style.display = 'flex';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    /**
     * Show error message
     */
    showError(message) {
        alert(message);
    }

    /**
     * Format amount for display
     */
    formatAmount(amount) {
        return Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Initialize app when DOM is ready
let addTransactionApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        addTransactionApp = new AddTransactionApp();
    });
} else {
    addTransactionApp = new AddTransactionApp();
}

// Make app globally accessible
window.addTransactionApp = addTransactionApp;
