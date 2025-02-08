// services/StorageService.js
class StorageService {
    constructor(config) {
        this.config = config;
        this.stores = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Check if localforage is available globally
            if (!window.localforage) {
                throw new Error('LocalForage is not loaded');
            }

            // Initialize stores for each data source
            for (const [sourceId, sourceConfig] of Object.entries(this.config.dataSources)) {
                const store = localforage.createInstance({
                    name: this.config.storage.name,
                    storeName: sourceId,
                    description: `Storage for ${sourceConfig.displayName}`
                });

                this.stores.set(sourceId, store);

                // Check if store is empty and needs initialization
                const keys = await store.keys();
                if (keys.length === 0) {
                    // Load initial data from source file
                    const module = await import(sourceConfig.file);
                    const initialData = module[sourceConfig.exportName];
                    await this.importData(sourceId, initialData);
                }
            }

            this.initialized = true;
            console.log('Storage Service initialized');
        } catch (error) {
            console.error('Failed to initialize storage:', error);
            throw error;
        }
    }

    async importData(sourceId, data) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);

        const sourceConfig = this.config.dataSources[sourceId];
        const primaryKey = sourceConfig.primaryKey;

        // Store each record with its primary key
        await Promise.all(data.map(async record => {
            if (!record[primaryKey]) {
                console.warn('Record missing primary key:', record);
                return;
            }
            await store.setItem(record[primaryKey], record);
        }));
    }

    async getAllRecords(sourceId) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);

        const records = [];
        await store.iterate(value => {
            records.push(value);
        });

        return records;
    }

    async getRecord(sourceId, id) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);
        return await store.getItem(id);
    }

    async addRecord(sourceId, record) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);

        const sourceConfig = this.config.dataSources[sourceId];
        const primaryKey = sourceConfig.primaryKey;

        if (!record[primaryKey]) {
            throw new Error(`Record missing primary key: ${primaryKey}`);
        }

        await store.setItem(record[primaryKey], record);
        return record;
    }

    async updateRecord(sourceId, record) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);

        const sourceConfig = this.config.dataSources[sourceId];
        const primaryKey = sourceConfig.primaryKey;

        if (!record[primaryKey]) {
            throw new Error(`Record missing primary key: ${primaryKey}`);
        }

        const existingRecord = await store.getItem(record[primaryKey]);
        if (!existingRecord) {
            throw new Error(`Record not found with key: ${record[primaryKey]}`);
        }

        const updatedRecord = { ...existingRecord, ...record };
        await store.setItem(record[primaryKey], updatedRecord);
        return updatedRecord;
    }

    async deleteRecord(sourceId, id) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);
        await store.removeItem(id);
    }

    async clearSource(sourceId) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);
        await store.clear();
    }

    async clearAll() {
        await Promise.all(
            Array.from(this.stores.values()).map(store => store.clear())
        );
    }

    async exportData(sourceId, format = 'json') {
        const records = await this.getAllRecords(sourceId);
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(records, null, 2);
                
            case 'csv': {
                if (records.length === 0) return '';
                
                const headers = Object.keys(records[0]);
                const csvRows = [headers.join(',')];
                
                records.forEach(record => {
                    const values = headers.map(header => {
                        const value = record[header];
                        return typeof value === 'string' && value.includes(',') 
                            ? `"${value}"` 
                            : value;
                    });
                    csvRows.push(values.join(','));
                });
                
                return csvRows.join('\n');
            }
                
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    async importCSV(sourceId, csvContent) {
        const store = this.stores.get(sourceId);
        if (!store) throw new Error(`Store not found for source: ${sourceId}`);

        // First clear existing data
        await store.clear();

        // Load papaparse from CDN if needed
        if (!window.Papa) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        return new Promise((resolve, reject) => {
            Papa.parse(csvContent, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        await this.importData(sourceId, results.data);
                        resolve(results.data);
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (error) => reject(error)
            });
        });
    }
}

export default StorageService;