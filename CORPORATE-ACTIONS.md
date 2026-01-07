# Corporate Actions Module

## Overview

The Corporate Actions Manager handles bonus shares and right issues with automatic cost basis adjustments for accurate tax calculations. All actions are tracked in an audit trail and persisted in localStorage.

## Features

- **Bonus Shares**: Proportional cost basis reduction
- **Right Issues**: Separate FIFO lot tracking with RIGHT_ISSUE flag
- **Validation**: Prevents duplicate applications
- **Audit Trail**: Complete history of all corporate actions
- **Reversal Support**: Undo actions (with safety checks)
- **localStorage Persistence**: Automatic saving and loading

## Usage

### Basic Setup

```javascript
const fifoQueue = new FIFOQueue();
const storageManager = new StorageManager();
const corporateActions = new CorporateActionsManager(fifoQueue, storageManager);
```

### Apply Bonus Shares

```javascript
// User has 100 shares of HBL @ Rs. 100 = Rs. 10,000 cost basis
corporateActions.applyCorporateAction('HBL', 'BONUS', {
    ratio: '20%',  // or 0.20
    exDate: '2025-03-01'
});

// Result:
// - 120 shares (100 + 20 bonus)
// - New avg cost: Rs. 83.33 (10,000 / 120)
// - Cost basis unchanged: Rs. 10,000
```

### Apply Right Issue

```javascript
// User has 100 shares of PPL @ Rs. 100 = Rs. 10,000 cost basis
corporateActions.applyCorporateAction('PPL', 'RIGHT', {
    ratio: '1:5',  // 1 right share for every 5 held
    price: 80,
    exDate: '2025-03-01',
    subscriptionDate: '2025-03-15'  // Optional
});

// Result:
// - 120 shares (100 original + 20 rights)
// - New avg cost: Rs. 96.67 (11,600 / 120)
// - New cost basis: Rs. 11,600 (10,000 + 1,600)
```

## API Reference

### applyCorporateAction(symbol, actionType, details)

Apply a corporate action to a symbol.

**Parameters:**
- `symbol` (string): Stock symbol (e.g., 'HBL')
- `actionType` (string): 'BONUS' or 'RIGHT'
- `details` (object): Action-specific details

**Returns:** Corporate action record with results

**Details Object for BONUS:**
```javascript
{
    ratio: '20%',      // Can be "20%" or 0.20
    exDate: '2025-03-01'
}
```

**Details Object for RIGHT:**
```javascript
{
    ratio: '1:5',      // Can be "1:5" or 0.20
    price: 80,
    exDate: '2025-03-01',
    subscriptionDate: '2025-03-15'  // Optional, defaults to exDate + 30 days
}
```

**Example:**
```javascript
const result = corporateActions.applyCorporateAction('HBL', 'BONUS', {
    ratio: '20%',
    exDate: '2025-03-01'
});

console.log(result.result.summary);
// "Bonus 20%: 100 → 120 shares, avg cost Rs. 100.00 → Rs. 83.33"
```

### getCorporateActions(symbol)

Get all corporate actions, optionally filtered by symbol.

**Parameters:**
- `symbol` (string, optional): Filter by stock symbol

**Returns:** Array of corporate action records

**Example:**
```javascript
const allActions = corporateActions.getCorporateActions();
const hblActions = corporateActions.getCorporateActions('HBL');
```

### getSummary()

Get summary statistics for all corporate actions.

**Returns:** Summary object

**Example:**
```javascript
const summary = corporateActions.getSummary();
console.log(`Total actions: ${summary.totalActions}`);
console.log(`Bonus actions: ${summary.bonusActions}`);
console.log(`Right actions: ${summary.rightActions}`);
console.log(`Symbols: ${summary.symbolsAffected.join(', ')}`);
```

### reverseCorporateAction(actionId)

Reverse (undo) a previously applied corporate action.

**Parameters:**
- `actionId` (number): ID of the action to reverse

**Returns:** Reversal result

**Safety Checks:**
- Prevents reversal if shares have been sold after the action
- Verifies all shares are still available

**Example:**
```javascript
try {
    corporateActions.reverseCorporateAction(1);
    console.log('Action reversed successfully');
} catch (error) {
    console.error('Cannot reverse:', error.message);
}
```

### generateReport(symbol)

Generate a formatted text report of corporate actions.

**Parameters:**
- `symbol` (string, optional): Filter by symbol

**Returns:** Formatted text report

**Example:**
```javascript
const report = corporateActions.generateReport('HBL');
console.log(report);
```

### Storage Methods

```javascript
// Save to localStorage
corporateActions.saveToStorage();

// Load from localStorage
corporateActions.loadFromStorage();

// Export to JSON
const data = corporateActions.exportData();

// Import from JSON
corporateActions.importData(data);

// Clear all (with confirmation)
corporateActions.clearAll();
```

## How It Works

### Bonus Shares Logic

1. **Identify Eligible Lots**: Only lots purchased before ex-date are eligible
2. **Calculate Bonus**: `bonusShares = floor(eligibleShares × bonusRatio)`
3. **Adjust Quantities**: Add bonus shares to each lot proportionally
4. **Adjust Prices**: Reduce cost per share to maintain same total cost basis

**Example:**
```
Before: Lot 1: 100 shares @ Rs. 100 = Rs. 10,000
Bonus: 20% (20 shares)
After:  Lot 1: 120 shares @ Rs. 83.33 = Rs. 10,000
```

### Right Issue Logic

1. **Identify Eligible Lots**: Only lots purchased before ex-date are eligible
2. **Calculate Entitlement**: `rightShares = floor(eligibleShares × rightRatio)`
3. **Create New Lot**: Add as separate FIFO lot with RIGHT_ISSUE flag
4. **Update Averages**: Recalculate portfolio-wide average cost

**Example:**
```
Before: Lot 1: 100 shares @ Rs. 100 = Rs. 10,000
Right:  1:5 @ Rs. 80 (20 shares)
After:  Lot 1: 100 shares @ Rs. 100 = Rs. 10,000
        Lot 2: 20 shares @ Rs. 80 = Rs. 1,600  [RIGHT_ISSUE]
        Total: 120 shares, avg Rs. 96.67 = Rs. 11,600
```

### FIFO Implications

Right issue shares form a **separate FIFO lot**, meaning:
- They have their own purchase date (subscription date)
- They maintain their own cost basis (right price)
- They are sold separately in FIFO order based on their purchase date

**Example Sale After Right Issue:**
```javascript
// Portfolio: Lot 1 (100 @ Rs. 100, date: Jan 1)
//           Lot 2 (20 @ Rs. 80, date: Mar 15)

// Sell 110 shares:
// - First 100 from Lot 1 @ Rs. 100
// - Next 10 from Lot 2 @ Rs. 80
// Cost basis = (100 × 100) + (10 × 80) = Rs. 10,800
```

## Validation & Error Handling

### Automatic Validations

1. **Symbol Exists**: Must have holdings before applying action
2. **No Duplicates**: Can't apply same action twice (same symbol, type, ex-date)
3. **Valid Ratios**: Bonus must be 0-100%, right ratio must be positive
4. **Valid Dates**: Ex-date must be valid date format
5. **Eligible Shares**: Must have shares purchased before ex-date
6. **Minimum Shares**: Calculated shares must be at least 1

### Error Examples

```javascript
// Error: No holdings
corporateActions.applyCorporateAction('XYZ', 'BONUS', {...});
// Error: No holdings found for XYZ

// Error: Duplicate action
corporateActions.applyCorporateAction('HBL', 'BONUS', {ratio: '20%', exDate: '2025-03-01'});
corporateActions.applyCorporateAction('HBL', 'BONUS', {ratio: '20%', exDate: '2025-03-01'});
// Error: Corporate action already applied

// Error: Invalid ratio
corporateActions.applyCorporateAction('HBL', 'BONUS', {ratio: '150%', exDate: '2025-03-01'});
// Error: Invalid bonus ratio: 150%. Must be between 0 and 100%

// Error: No eligible shares
corporateActions.applyCorporateAction('HBL', 'BONUS', {
    ratio: '20%',
    exDate: '2024-01-01'  // Before any purchases
});
// Error: No shares purchased before ex-date
```

## Storage Format

Data is stored in localStorage under settings:

```javascript
{
  "corporateActions": [
    {
      "id": 1,
      "symbol": "HBL",
      "type": "BONUS",
      "details": {
        "ratio": "20%",
        "exDate": "2025-03-01"
      },
      "exDate": "2025-03-01T00:00:00.000Z",
      "appliedDate": "2026-01-06T12:00:00.000Z",
      "applied": true,
      "result": {
        "type": "BONUS",
        "symbol": "HBL",
        "oldShares": 100,
        "bonusShares": 20,
        "newTotalShares": 120,
        "oldAvgCost": 100,
        "newAvgCost": 83.33,
        "costBasis": 10000,
        "bonusRatio": 0.2,
        "bonusPercentage": "20%",
        "summary": "Bonus 20%: 100 → 120 shares, avg cost Rs. 100.00 → Rs. 83.33"
      }
    },
    {
      "id": 2,
      "symbol": "PPL",
      "type": "RIGHT",
      "details": {
        "ratio": "1:5",
        "price": 80,
        "exDate": "2025-03-01"
      },
      "exDate": "2025-03-01T00:00:00.000Z",
      "appliedDate": "2026-01-06T12:00:00.000Z",
      "applied": true,
      "result": {
        "type": "RIGHT",
        "symbol": "PPL",
        "eligibleShares": 100,
        "rightSharesEntitled": 20,
        "rightPrice": 80,
        "rightRatio": 0.2,
        "ratioString": "1:5",
        "totalCost": 1600,
        "newTotalShares": 120,
        "newAvgCost": 96.67,
        "newTotalCostBasis": 11600,
        "summary": "Right 1:5: Added 20 shares @ Rs. 80, new avg cost Rs. 96.67"
      }
    }
  ]
}
```

## Real-World Examples

### Example 1: HBL 20% Bonus (March 2025)

```javascript
// Initial position
fifoQueue.addTransaction('BUY', 'HBL', 500, 150, '2024-06-15');

// HBL announces 20% bonus with ex-date March 1, 2025
corporateActions.applyCorporateAction('HBL', 'BONUS', {
    ratio: '20%',
    exDate: '2025-03-01'
});

// Result:
// - Shares: 500 → 600
// - Avg Cost: Rs. 150 → Rs. 125
// - Total Cost: Rs. 75,000 (unchanged)
```

### Example 2: PPL 1:4 Right Issue @ Rs. 60

```javascript
// Initial position
fifoQueue.addTransaction('BUY', 'PPL', 400, 80, '2024-08-10');

// PPL announces 1:4 right issue @ Rs. 60
corporateActions.applyCorporateAction('PPL', 'RIGHT', {
    ratio: '1:4',  // 1 right share for every 4 held
    price: 60,
    exDate: '2025-04-01',
    subscriptionDate: '2025-04-20'
});

// Result:
// - Original: 400 shares @ Rs. 80 = Rs. 32,000
// - Rights: 100 shares @ Rs. 60 = Rs. 6,000
// - New Total: 500 shares @ Rs. 76 = Rs. 38,000
```

### Example 3: Multiple Actions on OGDC

```javascript
// Purchase in 2023
fifoQueue.addTransaction('BUY', 'OGDC', 1000, 100, '2023-01-15');

// 15% bonus in 2024
corporateActions.applyCorporateAction('OGDC', 'BONUS', {
    ratio: '15%',
    exDate: '2024-02-01'
});
// Now: 1,150 shares @ Rs. 86.96

// 1:10 right issue in 2025
corporateActions.applyCorporateAction('OGDC', 'RIGHT', {
    ratio: '1:10',
    price: 75,
    exDate: '2025-03-01'
});
// Now: 1,265 shares (1,150 + 115) @ Rs. 86.11
```

## Tax Implications

### Bonus Shares

- **No immediate tax**: Bonus shares are not taxable income
- **Lower cost basis**: Reduces per-share cost, affects future capital gains
- **Same total cost**: Total cost basis remains unchanged
- **Example**: If you sell after bonus, each share has lower cost basis, so higher capital gain per share

### Right Issues

- **New investment**: Right shares are purchased at right price
- **Separate lot**: Forms new FIFO lot for tax tracking
- **Tax on sale**: Capital gains calculated based on right price as cost basis
- **Example**: Right shares bought at Rs. 80 and sold at Rs. 120 = Rs. 40 gain per share

## Testing

Run [test-corporate-actions.html](test-corporate-actions.html) to see:

1. **Bonus Shares Test**: 20% bonus on HBL
2. **Right Issue Test**: 1:5 @ Rs. 80 on PPL
3. **Multiple Actions Test**: Sequential bonus and right issue
4. **Validation Tests**: Error handling for various scenarios

All tests include:
- Before/After comparisons
- Calculation verification
- FIFO lot breakdown
- Detailed explanations

## Integration with Main App

### Add to app.js

```javascript
class PakistanStockTaxApp {
    constructor() {
        // ... existing code ...
        this.corporateActions = new CorporateActionsManager(
            this.fifoQueue,
            this.storageManager
        );
    }

    // Add corporate action from UI
    handleCorporateAction() {
        const symbol = document.getElementById('caSymbol').value;
        const type = document.getElementById('caType').value;
        const ratio = document.getElementById('caRatio').value;
        const price = document.getElementById('caPrice').value;
        const exDate = document.getElementById('caExDate').value;

        try {
            const details = { ratio, exDate };
            if (type === 'RIGHT') {
                details.price = parseFloat(price);
            }

            const result = this.corporateActions.applyCorporateAction(
                symbol,
                type,
                details
            );

            this.showMessage(result.result.summary, 'success');
            this.updateAllDisplays();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }
}
```

### Add UI Section

```html
<section class="card">
    <h3>Corporate Actions</h3>
    <form id="corporateActionForm">
        <div class="form-row">
            <select id="caType">
                <option value="BONUS">Bonus Shares</option>
                <option value="RIGHT">Right Issue</option>
            </select>
            <input type="text" id="caSymbol" placeholder="Symbol">
            <input type="text" id="caRatio" placeholder="Ratio (e.g., 20% or 1:5)">
            <input type="number" id="caPrice" placeholder="Right Price" step="0.01">
            <input type="date" id="caExDate">
        </div>
        <button type="submit" class="btn btn-primary">Apply Corporate Action</button>
    </form>

    <div id="corporateActionsHistory"></div>
</section>
```

## Limitations

1. **Manual Entry**: User must manually enter corporate actions (no API integration)
2. **No Fractions**: Fractional shares are floored to whole numbers
3. **No Automatic Dates**: Subscription dates must be manually specified
4. **Reversal Restrictions**: Cannot reverse if shares have been sold
5. **No Stock Splits**: Currently only supports bonus shares and rights (stock splits can be added)

## Future Enhancements

1. **Stock Splits**: Add support for forward/reverse splits
2. **Dividends**: Track dividend reinvestment
3. **Spin-offs**: Handle corporate spin-offs
4. **Mergers**: Track merger conversions
5. **API Integration**: Automatic detection from stock exchange announcements
6. **Notifications**: Alert users when ex-dates approach
7. **Bulk Import**: Import multiple actions from CSV

## Troubleshooting

### Problem: Bonus shares not calculated correctly

**Solution**: Verify:
- Ex-date is correct
- Shares were purchased before ex-date
- Ratio is valid (0-100% for bonus)

### Problem: Right shares not added to portfolio

**Solution**: Check:
- Right price is specified
- Ratio is valid format ("1:5" or 0.20)
- Holdings exist before ex-date

### Problem: Cannot reverse action

**Solution**: Ensure:
- No shares sold after the action was applied
- All right shares are still in portfolio
- Action ID is correct

---

**Version**: 1.0.0
**Last Updated**: January 2026
**Compatibility**: Works with Pakistan Stock Tax Calculator v1.0.0+
