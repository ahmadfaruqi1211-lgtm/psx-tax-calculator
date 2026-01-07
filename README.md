# Pakistan Stock Tax Calculator - FIFO Capital Gains Tax Calculator

A standalone JavaScript application for calculating capital gains tax on Pakistan Stock Exchange securities using the FIFO (First-In-First-Out) method.

## Features

### Core Functionality
- **FIFO Engine**: Accurate lot-level tracking with First-In-First-Out logic
- **T+2 Settlement**: Automatic settlement date calculation (Trade date + 2 business days)
- **Pakistan CGT Rules**: Implements 15% flat rate for securities acquired after July 1, 2024
- **Filer/Non-Filer**: Toggle between filer and non-filer tax status
- **Real-time Calculations**: Instant tax liability and profit calculations

### Advanced Features
- **What-If Scenarios**: Analyze optimal sale timing for tax efficiency
- **Tax Loss Harvesting**: Identify opportunities to offset gains with losses
- **Portfolio Analysis**: Comprehensive tax efficiency analysis across all holdings
- **Break-Even Calculator**: Calculate price targets including tax impact
- **Holding Period Tracking**: Automatic calculation of holding periods

### Data Management
- **localStorage Persistence**: All data stored locally in browser
- **Import/Export**: JSON-based data portability
- **PDF Reports**: Professional tax reports with jsPDF
- **Auto-Save**: Automatic data persistence with debouncing
- **Backup System**: Create and restore timestamped backups

## Technical Architecture

### Frontend Stack
- **Pure HTML/CSS/JavaScript**: No frameworks, vanilla ES6+
- **Responsive Design**: Mobile-first CSS with media queries
- **Progressive Enhancement**: Works without external dependencies (except jsPDF)

### Mobile Deployment
- **Wrapper**: Capacitor (not Trusted Web Activity)
- **Platform**: Google Play Store (Android App Bundle)
- **Cost**: $25 one-time (Google Play registration)

### Storage
- **Primary**: localStorage (JSON-based)
- **Encryption**: XOR cipher (demo) - upgrade to AES-GCM for production
- **Capacity**: ~5MB per domain
- **Persistence**: Survives browser restarts

### Libraries
- **jsPDF**: Client-side PDF generation
- **No other dependencies**: Completely self-contained

## File Structure

```
psx-tax-calculator/
├── index.html              # Main application interface
├── test.html              # Test case verification
├── README.md              # This file
├── css/
│   └── styles.css         # Application styling
└── js/
    ├── fifo-engine.js     # Core FIFO calculation logic
    ├── tax-calculator.js  # CGT rate application
    ├── storage-manager.js # localStorage wrapper
    ├── what-if-scenarios.js # Tax optimization
    ├── pdf-generator.js   # PDF report generation
    └── app.js             # Main application controller
```

## Installation

### Option 1: Run Locally
1. Clone/download the repository
2. Open `index.html` in a modern browser
3. No build process required!

### Option 2: Deploy to Web Server
1. Upload all files to your web server
2. Serve via HTTPS for localStorage to work properly
3. No server-side processing needed

### Option 3: Build Android App
1. Install Capacitor CLI:
   ```bash
   npm install -g @capacitor/cli
   ```

2. Initialize Capacitor project:
   ```bash
   npx cap init
   ```

3. Add Android platform:
   ```bash
   npx cap add android
   ```

4. Build and deploy:
   ```bash
   npx cap sync
   npx cap open android
   ```

5. Build AAB (Android App Bundle) in Android Studio

6. Upload to Google Play Console

## Usage Guide

### Adding Transactions

#### Buy Transaction
1. Select "Buy" from transaction type
2. Enter symbol (e.g., OGDC, PPL, MARI)
3. Enter quantity and price
4. Select trade date
5. Click "Add Transaction"

**Settlement Date**: Automatically calculated as trade date + 2 business days

#### Sell Transaction
1. Select "Sell" from transaction type
2. Enter symbol (must have existing holdings)
3. Enter quantity and price
4. Select trade date
5. Click "Add Transaction"

**FIFO Logic**: Shares from oldest purchase lots are sold first

### Understanding FIFO

**Example:**
```
Buy 100 OGDC @ Rs. 100 on Jan 1, 2025
Buy 50 OGDC @ Rs. 120 on Feb 1, 2025
Sell 120 OGDC @ Rs. 150 on Mar 1, 2025
```

**FIFO Consumption:**
- Lot 1: 100 shares @ Rs. 100 (fully consumed)
- Lot 2: 20 shares @ Rs. 120 (partially consumed)
- Remaining: 30 shares @ Rs. 120

**Tax Calculation:**
- Cost Basis: (100 × 100) + (20 × 120) = Rs. 12,400
- Sale Proceeds: 120 × 150 = Rs. 18,000
- Capital Gain: 18,000 - 12,400 = Rs. 5,600
- Tax (15%): 5,600 × 0.15 = Rs. 840
- Net Profit: 5,600 - 840 = Rs. 4,760

### Tax Rates

#### New Regime (After July 1, 2024)
| Taxpayer Status | Tax Rate |
|----------------|----------|
| Filer          | 15%      |
| Non-Filer      | 15%      |

**Note**: Flat 15% rate applies regardless of holding period for securities acquired after July 1, 2024.

#### Legacy Regime (Before July 1, 2024)
| Holding Period | Filer | Non-Filer |
|---------------|-------|-----------|
| < 1 year      | 15%   | 15%       |
| 1-2 years     | 12.5% | 15%       |
| 2-3 years     | 10%   | 15%       |
| 3-4 years     | 7.5%  | 15%       |
| 4+ years      | 0%    | 15%       |

### What-If Analysis

**Purpose**: Analyze optimal timing for sales to minimize tax liability

**How to Use:**
1. Enter stock symbol
2. Enter quantity to sell
3. Enter hypothetical sell price
4. Select potential sell date
5. Click "Calculate"

**Results:**
- Current scenario (sell today)
- Future scenarios (30, 90, 180, 365 days)
- Tax savings comparison
- Optimal timing recommendation

### Reports & Exports

#### PDF Tax Report
- Comprehensive tax summary
- Transaction-by-transaction breakdown
- Lot-level cost basis details
- Professional formatting for tax filing

#### JSON Export
- Full transaction history
- All holdings with lot details
- Realized gains and tax calculations
- Portable across devices

#### Holdings Report
- Current portfolio snapshot
- Cost basis and unrealized gains
- Lot-level breakdown
- Market value (if prices provided)

## API Reference

### FIFOQueue Class

```javascript
const queue = new FIFOQueue();

// Add transaction
queue.addTransaction(type, symbol, quantity, price, date);
// type: 'BUY' or 'SELL'
// symbol: string (e.g., 'OGDC')
// quantity: number
// price: number (PKR)
// date: Date or string

// Get holdings
const holdings = queue.getHoldings();
// Returns: { symbol: { totalQuantity, averageCost, lots: [...] } }

// Calculate hypothetical sale
const result = queue.calculateSale(symbol, quantity, price, date);
// Returns: { capitalGain, totalCostBasis, lotsUsed: [...] }

// Get realized gains
const gains = queue.getRealizedGains();
// Returns: Array of realized gain/loss records
```

### TaxCalculator Class

```javascript
const calculator = new TaxCalculator();

// Set filer status
calculator.setFilerStatus(true); // true = filer, false = non-filer

// Calculate tax for a sale
const taxCalc = calculator.calculateTaxForSale(saleResult);
// Returns: { totalTax, netProfit, effectiveTaxRate, taxByLot: [...] }

// Get tax rate
const rate = calculator.getTaxRate(purchaseDate, holdingDays);
// Returns: number (e.g., 0.15 for 15%)

// Aggregate tax across multiple sales
const aggregate = calculator.calculateAggregateTax(salesResults);
// Returns: { totalGains, totalLosses, netGain, totalTax, ... }
```

### StorageManager Class

```javascript
const storage = new StorageManager();

// Save data
storage.saveData(data, encrypt = false);

// Load data
const data = storage.loadData(encrypted = false);

// Export to file
storage.exportToFile(data, filename);

// Import from file
const data = await storage.importFromFile(file);

// Create backup
storage.createBackup(data);

// Restore backup
const data = storage.restoreBackup(backupKey);
```

### WhatIfScenarios Class

```javascript
const scenarios = new WhatIfScenarios(fifoQueue, taxCalculator);

// Analyze optimal timing
const timing = scenarios.analyzeOptimalTiming(symbol, quantity, price);
// Returns: { scenarios: [...], optimal: {...}, recommendation: "..." }

// Identify tax loss harvesting
const opportunities = scenarios.identifyTaxLossHarvesting(currentPrices);
// Returns: Array of loss harvesting opportunities

// Compare filer vs non-filer
const comparison = scenarios.compareFilerStatus(saleResult);
// Returns: { filer: {...}, nonFiler: {...}, taxDifference: ... }

// Portfolio analysis
const analysis = scenarios.analyzePortfolioTaxEfficiency(currentPrices);
// Returns: Comprehensive portfolio tax analysis
```

## Test Case Verification

Open [test.html](test.html) to run the built-in test case:

**Test Scenario:**
```
Buy 100 OGDC @ Rs. 100 on Jan 1, 2025
Buy 50 OGDC @ Rs. 120 on Feb 1, 2025
Sell 120 OGDC @ Rs. 150 on Mar 1, 2025
```

**Expected Results:**
- ✓ Cost Basis: Rs. 12,400
- ✓ Sale Proceeds: Rs. 18,000
- ✓ Capital Gain: Rs. 5,600
- ✓ Tax Liability: Rs. 840
- ✓ Net Profit After Tax: Rs. 4,760

## Security Considerations

### Current Implementation
- XOR cipher for basic obfuscation
- localStorage (client-side only)
- No server transmission

### Production Recommendations
1. **Upgrade Encryption**: Implement Web Crypto API with AES-GCM
   ```javascript
   // Example upgrade path
   async function encrypt(data, key) {
       const encoded = new TextEncoder().encode(data);
       const iv = crypto.getRandomValues(new Uint8Array(12));
       const encrypted = await crypto.subtle.encrypt(
           { name: "AES-GCM", iv },
           key,
           encoded
       );
       return { encrypted, iv };
   }
   ```

2. **Input Sanitization**: Already implemented, but review for edge cases

3. **CSP Headers**: Add Content Security Policy if deploying to web
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com;">
   ```

4. **HTTPS Only**: Serve over HTTPS in production

## Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome  | 60+            | Full support |
| Firefox | 55+            | Full support |
| Safari  | 11+            | Full support |
| Edge    | 79+            | Full support |

**Required Features:**
- ES6 (arrow functions, classes, template literals)
- localStorage
- Fetch API (for future enhancements)
- Web Crypto API (for production encryption)

## Limitations

1. **Client-Side Only**: No cloud sync across devices
2. **Browser Storage**: Limited to ~5MB
3. **Manual Prices**: No real-time market data integration
4. **Pakistan Only**: Tax rules specific to Pakistan
5. **No Audit Trail**: No immutable transaction log

## Future Enhancements

### Phase 1 (MVP Extensions)
- [ ] Real-time stock price integration via API
- [ ] Multi-currency support (USD, GBP)
- [ ] Dividend tracking
- [ ] Broker fee deduction

### Phase 2 (Advanced)
- [ ] Cloud sync with Firebase/Supabase
- [ ] Multiple portfolio support
- [ ] Tax year comparison
- [ ] Automatic tax form generation (Pakistan FBR forms)

### Phase 3 (Premium)
- [ ] AI-powered tax optimization
- [ ] Integration with brokerage APIs
- [ ] Collaborative portfolio management
- [ ] Professional tax advisor matching

## Contributing

This is a standalone project, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Implement changes with detailed comments
4. Test thoroughly with [test.html](test.html)
5. Submit pull request with description

**Code Style:**
- ES6+ features
- Detailed JSDoc comments
- No external dependencies (except jsPDF)
- Mobile-first responsive design

## License

MIT License - Free to use, modify, and distribute.

## Disclaimer

**This tool is for informational purposes only.**

- Not a substitute for professional tax advice
- Tax laws are subject to change
- Always consult a qualified tax professional before filing
- The developers assume no liability for tax miscalculations

## Support

For issues, questions, or feature requests:
1. Check [test.html](test.html) for verification
2. Review console logs for errors
3. Open an issue with detailed description

## Deployment Guide

### Backend: NONE (100% Client-Side)

### Cost Breakdown
| Item | Cost | Frequency |
|------|------|-----------|
| Google Play Registration | $25 | One-time |
| Web Hosting (optional) | $0-10/month | Monthly |
| Domain (optional) | $10-15/year | Yearly |

**Total for Android App**: $25 one-time

### Play Store Submission
1. Create developer account ($25)
2. Generate signed AAB in Android Studio
3. Create store listing:
   - App name: "Pakistan Stock Tax Calculator"
   - Category: Finance
   - Content rating: Everyone
   - Privacy policy required (even though no data collected)
4. Upload AAB
5. Submit for review (1-7 days)

## Version History

**v1.0.0** (2025-01-06)
- Initial release
- Core FIFO engine
- Pakistan CGT rules implementation
- T+2 settlement calculation
- What-if scenarios
- PDF export
- localStorage persistence

---

**Built with ❤️ for Pakistan's investor community**

**Frontend**: Pure HTML/CSS/JavaScript (Vanilla JS)
**Mobile Wrapper**: Capacitor (not Trusted Web Activity)
**Storage**: localStorage (JSON-based, encrypted)
**PDF Export**: jsPDF library
**Deployment**: Google Play Store (Android App Bundle)
**Backend**: NONE (100% client-side)
**Cost**: $25 one-time (Google Play registration)
