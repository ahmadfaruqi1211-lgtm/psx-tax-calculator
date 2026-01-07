/**
 * Storage Manager - localStorage wrapper with encryption support
 * Handles data persistence for the Pakistan Stock Tax Calculator
 *
 * Features:
 * - JSON-based storage
 * - Optional encryption (basic XOR cipher for demo, upgrade to AES for production)
 * - Auto-save functionality
 * - Data versioning
 * - Import/Export capabilities
 */

class StorageManager {
    constructor(encryptionKey = 'PSX-TAX-CALC-2025') {
        this.storageKey = 'psx_tax_calculator_data';
        this.settingsKey = 'psx_tax_calculator_settings';
        this.encryptionKey = encryptionKey;
        this.autoSaveEnabled = true;
        this.dataVersion = '1.0';

        // Check if localStorage is available
        this.isAvailable = this._checkLocalStorageAvailability();

        if (!this.isAvailable) {
            console.warn('⚠ localStorage not available - data will not persist');
        }
    }

    /**
     * Check if localStorage is available
     * @private
     * @returns {boolean}
     */
    _checkLocalStorageAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Simple XOR encryption (for demo purposes)
     * For production, use Web Crypto API with AES-GCM
     * @private
     * @param {string} data - Data to encrypt
     * @returns {string} Encrypted data
     */
    _encrypt(data) {
        const key = this.encryptionKey;
        let encrypted = '';

        for (let i = 0; i < data.length; i++) {
            const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            encrypted += String.fromCharCode(charCode);
        }

        // Base64 encode to handle special characters
        return btoa(encrypted);
    }

    /**
     * Simple XOR decryption
     * @private
     * @param {string} encryptedData - Encrypted data
     * @returns {string} Decrypted data
     */
    _decrypt(encryptedData) {
        try {
            // Base64 decode
            const data = atob(encryptedData);
            const key = this.encryptionKey;
            let decrypted = '';

            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                decrypted += String.fromCharCode(charCode);
            }

            return decrypted;
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }

    /**
     * Save data to localStorage
     * @param {object} data - Data object to save
     * @param {boolean} encrypt - Whether to encrypt the data
     * @returns {boolean} Success status
     */
    saveData(data, encrypt = false) {
        if (!this.isAvailable) {
            console.warn('⚠ Cannot save: localStorage not available');
            return false;
        }

        try {
            // Add metadata
            const dataWithMeta = {
                version: this.dataVersion,
                timestamp: new Date().toISOString(),
                encrypted: encrypt,
                data: data
            };

            let jsonString = JSON.stringify(dataWithMeta);

            // Encrypt if requested
            if (encrypt) {
                jsonString = this._encrypt(jsonString);
            }

            localStorage.setItem(this.storageKey, jsonString);
            console.log('✓ Data saved to localStorage');
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);

            // Check if quota exceeded
            if (e.name === 'QuotaExceededError') {
                console.error('⚠ localStorage quota exceeded');
            }

            return false;
        }
    }

    /**
     * Load data from localStorage
     * @param {boolean} encrypted - Whether the data is encrypted
     * @returns {object|null} Loaded data or null if not found
     */
    loadData(encrypted = false) {
        if (!this.isAvailable) {
            return null;
        }

        try {
            let jsonString = localStorage.getItem(this.storageKey);

            if (!jsonString) {
                console.log('ℹ No saved data found');
                return null;
            }

            // Decrypt if needed
            if (encrypted) {
                jsonString = this._decrypt(jsonString);
                if (!jsonString) {
                    console.error('Failed to decrypt data');
                    return null;
                }
            }

            const dataWithMeta = JSON.parse(jsonString);

            // Version check
            if (dataWithMeta.version !== this.dataVersion) {
                console.warn(`⚠ Data version mismatch: ${dataWithMeta.version} vs ${this.dataVersion}`);
                // You could add migration logic here
            }

            console.log('✓ Data loaded from localStorage');
            return dataWithMeta.data;
        } catch (e) {
            console.error('Failed to load data:', e);
            return null;
        }
    }

    /**
     * Save user settings
     * @param {object} settings - Settings object
     * @returns {boolean} Success status
     */
    saveSettings(settings) {
        if (!this.isAvailable) {
            return false;
        }

        try {
            const settingsWithMeta = {
                version: this.dataVersion,
                timestamp: new Date().toISOString(),
                settings: settings
            };

            localStorage.setItem(this.settingsKey, JSON.stringify(settingsWithMeta));
            console.log('✓ Settings saved');
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            return false;
        }
    }

    /**
     * Load user settings
     * @returns {object|null} Settings object or null
     */
    loadSettings() {
        if (!this.isAvailable) {
            return null;
        }

        try {
            const jsonString = localStorage.getItem(this.settingsKey);

            if (!jsonString) {
                return null;
            }

            const settingsWithMeta = JSON.parse(jsonString);
            console.log('✓ Settings loaded');
            return settingsWithMeta.settings;
        } catch (e) {
            console.error('Failed to load settings:', e);
            return null;
        }
    }

    /**
     * Export data as JSON file
     * @param {object} data - Data to export
     * @param {string} filename - Filename for download
     */
    exportToFile(data, filename = 'psx-tax-data.json') {
        const exportData = {
            version: this.dataVersion,
            exportDate: new Date().toISOString(),
            application: 'Pakistan Stock Tax Calculator',
            data: data
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create temporary download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        console.log(`✓ Data exported to ${filename}`);
    }

    /**
     * Import data from JSON file
     * @param {File} file - File object from file input
     * @returns {Promise<object>} Promise resolving to imported data
     */
    importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Validate structure
                    if (!importedData.version || !importedData.data) {
                        reject(new Error('Invalid file format'));
                        return;
                    }

                    // Version check
                    if (importedData.version !== this.dataVersion) {
                        console.warn(`⚠ Importing data from version ${importedData.version}`);
                    }

                    console.log('✓ Data imported from file');
                    resolve(importedData.data);
                } catch (e) {
                    reject(new Error('Failed to parse JSON file'));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Clear all stored data
     * @returns {boolean} Success status
     */
    clearAllData() {
        if (!this.isAvailable) {
            return false;
        }

        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.settingsKey);
            console.log('✓ All data cleared');
            return true;
        } catch (e) {
            console.error('Failed to clear data:', e);
            return false;
        }
    }

    /**
     * Get storage usage information
     * @returns {object} Storage stats
     */
    getStorageInfo() {
        if (!this.isAvailable) {
            return { available: false };
        }

        try {
            // Calculate approximate size
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }

            // Get app-specific data size
            const appData = localStorage.getItem(this.storageKey);
            const settingsData = localStorage.getItem(this.settingsKey);
            const appSize = (appData ? appData.length : 0) + (settingsData ? settingsData.length : 0);

            return {
                available: true,
                totalSize: totalSize,
                totalSizeKB: (totalSize / 1024).toFixed(2),
                appSize: appSize,
                appSizeKB: (appSize / 1024).toFixed(2),
                estimatedQuota: 5120, // Most browsers: ~5MB
                usagePercent: ((totalSize / (5120 * 1024)) * 100).toFixed(2)
            };
        } catch (e) {
            console.error('Failed to get storage info:', e);
            return { available: true, error: true };
        }
    }

    /**
     * Auto-save with debouncing
     * @param {object} data - Data to save
     * @param {number} delay - Debounce delay in ms
     */
    autoSave(data, delay = 1000) {
        if (!this.autoSaveEnabled) {
            return;
        }

        // Clear existing timeout
        if (this._autoSaveTimeout) {
            clearTimeout(this._autoSaveTimeout);
        }

        // Set new timeout
        this._autoSaveTimeout = setTimeout(() => {
            this.saveData(data);
        }, delay);
    }

    /**
     * Enable/disable auto-save
     * @param {boolean} enabled
     */
    setAutoSave(enabled) {
        this.autoSaveEnabled = enabled;
        console.log(`✓ Auto-save ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Create a backup with timestamp
     * @param {object} data - Data to backup
     * @returns {boolean} Success status
     */
    createBackup(data) {
        if (!this.isAvailable) {
            return false;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupKey = `${this.storageKey}_backup_${timestamp}`;

            const backupData = {
                version: this.dataVersion,
                timestamp: new Date().toISOString(),
                data: data
            };

            localStorage.setItem(backupKey, JSON.stringify(backupData));
            console.log(`✓ Backup created: ${backupKey}`);
            return true;
        } catch (e) {
            console.error('Failed to create backup:', e);
            return false;
        }
    }

    /**
     * List all available backups
     * @returns {Array} Array of backup keys with timestamps
     */
    listBackups() {
        if (!this.isAvailable) {
            return [];
        }

        const backups = [];
        const prefix = `${this.storageKey}_backup_`;

        for (let key in localStorage) {
            if (key.startsWith(prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        key: key,
                        timestamp: data.timestamp,
                        version: data.version
                    });
                } catch (e) {
                    console.warn(`Skipping invalid backup: ${key}`);
                }
            }
        }

        // Sort by timestamp (newest first)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return backups;
    }

    /**
     * Restore from a backup
     * @param {string} backupKey - Backup key to restore from
     * @returns {object|null} Restored data or null
     */
    restoreBackup(backupKey) {
        if (!this.isAvailable) {
            return null;
        }

        try {
            const jsonString = localStorage.getItem(backupKey);

            if (!jsonString) {
                console.error('Backup not found');
                return null;
            }

            const backupData = JSON.parse(jsonString);

            // Save as current data
            this.saveData(backupData.data);

            console.log(`✓ Restored from backup: ${backupKey}`);
            return backupData.data;
        } catch (e) {
            console.error('Failed to restore backup:', e);
            return null;
        }
    }

    /**
     * Delete old backups (keep only last N)
     * @param {number} keepCount - Number of backups to keep
     */
    cleanupOldBackups(keepCount = 5) {
        const backups = this.listBackups();

        if (backups.length <= keepCount) {
            return;
        }

        // Delete oldest backups
        const toDelete = backups.slice(keepCount);

        for (const backup of toDelete) {
            localStorage.removeItem(backup.key);
            console.log(`✓ Deleted old backup: ${backup.key}`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
