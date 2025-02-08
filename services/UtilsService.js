// services/UtilsService.js
class UtilsService {
    static formatValue(value, formatType) {
        if (value === null || value === undefined) return '';

        switch (formatType) {
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0
                }).format(value);

            case 'percentage':
                return `${value}%`;

            case 'date':
                return new Date(value).toLocaleDateString();

            case 'boolean':
                return value ? 'Yes' : 'No';

            case 'select':
                return value.split(',')[0];

            case 'tags':
                return value.split(',').join(', ');

            case 'email':
                return value;

            case 'phone':
                return value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');

            default:
                return value;
        }
    }

    static generateId(prefix = '') {
        return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static compareValues(a, b, order = 'asc') {
        if (a === b) return 0;

        // Handle null/undefined values
        if (a === null || a === undefined) return order === 'asc' ? -1 : 1;
        if (b === null || b === undefined) return order === 'asc' ? 1 : -1;

        // Convert to same type for comparison
        if (typeof a === 'string') {
            a = a.toLowerCase();
            b = String(b).toLowerCase();
        } else if (typeof a === 'number') {
            b = Number(b);
        }

        // Compare values
        if (a < b) return order === 'asc' ? -1 : 1;
        if (a > b) return order === 'asc' ? 1 : -1;
        return 0;
    }

    static getUniqueValues(array, key) {
        const values = new Set();
        array.forEach(item => {
            const value = item[key];
            if (typeof value === 'string' && value.includes(',')) {
                value.split(',').forEach(v => values.add(v.trim()));
            } else if (value !== null && value !== undefined) {
                values.add(value);
            }
        });
        return Array.from(values);
    }

    static async downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static getCurrentTimestamp() {
        return new Date().toISOString();
    }

    static generateFilename(baseName, extension) {
        const timestamp = new Date().toISOString().split('T')[0];
        return `${baseName}_${timestamp}.${extension}`;
    }

    static async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
}

export default UtilsService;