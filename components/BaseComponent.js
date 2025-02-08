// components/BaseComponent.js
export class BaseComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async getDataContext() {
        // Wait for DataContext to be available
        let attempts = 0;
        while (!window.app?.dataContext && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        return window.app?.dataContext;
    }

    async getSourceConfig(sourceId) {
        const dataContext = await this.getDataContext();
        return dataContext?.getSourceConfig(sourceId);
    }

    dispatchCustomEvent(name, detail = {}) {
        const event = new CustomEvent(name, {
            detail,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    formatValue(value, formatType) {
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

            default:
                return value;
        }
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    generateId(prefix = '') {
        return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async validateField(value, rules) {
        const errors = [];

        if (!rules) return errors;

        if (rules.required && !value) {
            errors.push('This field is required');
        }

        if (value) {
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`Must be at least ${rules.minLength} characters`);
            }

            if (rules.type === 'email' && !this.isValidEmail(value)) {
                errors.push('Must be a valid email address');
            }

            if (rules.type === 'number') {
                const num = Number(value);
                if (isNaN(num)) {
                    errors.push('Must be a number');
                } else if (rules.min !== undefined && num < rules.min) {
                    errors.push(`Must be at least ${rules.min}`);
                }
            }
        }

        return errors;
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    addBaseStyles() {
        return `
            :host {
                display: block;
                font-family: system-ui, -apple-system, sans-serif;
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            .hidden {
                display: none !important;
            }

            .error {
                color: #dc3545;
                font-size: 0.875rem;
                margin-top: 0.25rem;
            }

            .loading {
                opacity: 0.5;
                pointer-events: none;
            }

            @media (max-width: 768px) {
                :host {
                    font-size: 14px;
                }
            }
        `;
    }
}

export default BaseComponent;