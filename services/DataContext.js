// services/DataContext.js
import StorageService from './StorageService.js';

class DataContext {
    constructor(config) {
        this.config = config;
        this.storage = new StorageService(config);
        this.listeners = new Set();
        this.cache = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize storage service
            await this.storage.initialize();
            
            // Load initial data into cache
            for (const sourceId of Object.keys(this.config.dataSources)) {
                const data = await this.storage.getAllRecords(sourceId);
                this.cache.set(sourceId, data);
            }
            
            this.initialized = true;
            console.log('DataContext initialized successfully');
        } catch (error) {
            console.error('DataContext initialization error:', error);
            throw error;
        }
    }

    getSourceConfig(sourceId) {
        return this.config.dataSources[sourceId];
    }

    async getData(sourceId) {
        if (!this.initialized) {
            throw new Error('DataContext not initialized');
        }

        // Try cache first
        if (this.cache.has(sourceId)) {
            return this.cache.get(sourceId);
        }

        // Fallback to storage
        const data = await this.storage.getAllRecords(sourceId);
        this.cache.set(sourceId, data);
        return data;
    }

    async getRecord(sourceId, id) {
        if (!this.initialized) {
            throw new Error('DataContext not initialized');
        }

        // Try cache first
        const cachedData = this.cache.get(sourceId);
        if (cachedData) {
            const record = cachedData.find(r => 
                r[this.getSourceConfig(sourceId).primaryKey] === id
            );
            if (record) return record;
        }

        // Fallback to storage
        return await this.storage.getRecord(sourceId, id);
    }

    async addRecord(sourceId, record) {
        if (!this.initialized) {
            throw new Error('DataContext not initialized');
        }

        // Validate record
        this.validateRecord(sourceId, record);

        const result = await this.storage.addRecord(sourceId, record);
        
        // Update cache
        const cachedData = this.cache.get(sourceId) || [];
        cachedData.push(result);
        this.cache.set(sourceId, cachedData);
        
        this.notifyListeners(sourceId, 'add', result);
        return result;
    }

    async updateRecord(sourceId, record) {
        if (!this.initialized) {
            throw new Error('DataContext not initialized');
        }

        // Validate record
        this.validateRecord(sourceId, record);

        const result = await this.storage.updateRecord(sourceId, record);
        
        // Update cache
        const cachedData = this.cache.get(sourceId) || [];
        const index = cachedData.findIndex(r => 
            r[this.getSourceConfig(sourceId).primaryKey] === record[this.getSourceConfig(sourceId).primaryKey]
        );
        if (index !== -1) {
            cachedData[index] = result;
            this.cache.set(sourceId, cachedData);
        }
        
        this.notifyListeners(sourceId, 'update', result);
        return result;
    }

    async deleteRecord(sourceId, id) {
        if (!this.initialized) {
            throw new Error('DataContext not initialized');
        }

        await this.storage.deleteRecord(sourceId, id);
        
        // Update cache
        const cachedData = this.cache.get(sourceId) || [];
        const filteredData = cachedData.filter(r => 
            r[this.getSourceConfig(sourceId).primaryKey] !== id
        );
        this.cache.set(sourceId, filteredData);
        
        this.notifyListeners(sourceId, 'delete', id);
    }

    validateRecord(sourceId, record) {
        const sourceConfig = this.getSourceConfig(sourceId);
        const validation = sourceConfig.validation;
        
        if (!validation) return;

        const errors = [];
        
        for (const [field, rules] of Object.entries(validation)) {
            const value = record[field];

            if (rules.required && !value) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value) {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }

                if (rules.type === 'email' && !this.isValidEmail(value)) {
                    errors.push(`${field} must be a valid email address`);
                }

                if (rules.type === 'number' && typeof value !== 'number') {
                    errors.push(`${field} must be a number`);
                }

                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${field} must be at least ${rules.min}`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join('\n')}`);
        }
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners(sourceId, action, data) {
        this.listeners.forEach(callback => {
            try {
                callback(sourceId, action, data);
            } catch (error) {
                console.error('Error in listener callback:', error);
            }
        });
    }

    async getFieldOptions(sourceId, fieldName) {
        const data = await this.getData(sourceId);
        
        // Get unique values from the field
        const uniqueValues = new Set();
        
        data.forEach(record => {
            const value = record[fieldName];
            if (value) {
                // Handle comma-separated values
                if (typeof value === 'string' && value.includes(',')) {
                    value.split(',').forEach(v => uniqueValues.add(v.trim()));
                } else {
                    uniqueValues.add(value);
                }
            }
        });
        
        // Convert Set to Array and sort
        return Array.from(uniqueValues).sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string') {
                return a.localeCompare(b);
            }
            return a - b;
        });
    }

    // Helper method to get field type
    getFieldType(sourceId, fieldName) {
        const sourceConfig = this.getSourceConfig(sourceId);
        return sourceConfig?.columnFormatting?.[fieldName] || 'text';
    }

    // Helper method to get field validation rules
    getFieldValidation(sourceId, fieldName) {
        const sourceConfig = this.getSourceConfig(sourceId);
        return sourceConfig?.validation?.[fieldName] || {};
    }

    async searchAndFilter(sourceId, { searchTerm, filters }) {
        let data = await this.getData(sourceId);
        const sourceConfig = this.getSourceConfig(sourceId);

        // Apply search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            data = data.filter(record => 
                sourceConfig.searchableFields.some(field => {
                    const value = record[field];
                    return value && String(value).toLowerCase().includes(term);
                })
            );
        }

        // Apply filters
        if (filters && Object.keys(filters).length > 0) {
            data = data.filter(record => 
                Object.entries(filters).every(([key, value]) => {
                    const recordValue = record[key];
                    if (typeof recordValue === 'string' && recordValue.includes(',')) {
                        return recordValue.split(',')[0] === value;
                    }
                    return recordValue === value;
                })
            );
        }

        return data;
    }

    async exportData(sourceId, format = 'json') {
        return await this.storage.exportData(sourceId, format);
    }

    async importData(sourceId, data, format = 'json') {
        // Clear cache for this source
        this.cache.delete(sourceId);
        
        if (format === 'csv') {
            await this.storage.importCSV(sourceId, data);
        } else {
            await this.storage.importData(sourceId, data);
        }
        
        // Update cache with new data
        const newData = await this.storage.getAllRecords(sourceId);
        this.cache.set(sourceId, newData);
        
        this.notifyListeners(sourceId, 'import', newData);
    }

    // Helper method to resolve references
    async resolveReference(sourceId, referenceId, referenceField) {
        const relationships = this.config.relationships[sourceId];
        if (!relationships?.references) return referenceId;

        const targetSource = relationships.references[referenceField];
        if (!targetSource) return referenceId;

        const record = await this.getRecord(targetSource, referenceId);
        if (!record) return referenceId;

        const displayField = this.config.dataSources[targetSource].displayField;
        return record[displayField] || referenceId;
    }
}

export default DataContext;