// components/TableComponent.js
import BaseComponent from './BaseComponent.js';

class TableComponent extends BaseComponent {
    constructor() {
        super();
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.data = [];
        this.sourceId = '';
        this.loading = false;
    }

    static get observedAttributes() {
        return ['source-id', 'data', 'loading'];
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'source-id':
                this.sourceId = newValue;
                await this.render();
                break;

            case 'data':
                try {
                    this.data = JSON.parse(newValue || '[]');
                    await this.render();
                } catch (error) {
                    console.error('Error parsing table data:', error);
                    this.data = [];
                }
                break;

            case 'loading':
                this.loading = newValue === 'true';
                this.updateLoadingState();
                break;
        }
    }

    updateLoadingState() {
        const table = this.shadowRoot.querySelector('.table-container');
        if (table) {
            table.classList.toggle('loading', this.loading);
        }
    }

    connectedCallback() {
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        this.shadowRoot.addEventListener('click', e => {
            const header = e.target.closest('th');
            if (header) {
                this.sortBy(header.dataset.column);
            }
        });

        this.shadowRoot.addEventListener('click', async e => {
            const link = e.target.closest('.reference-link');
            if (link) {
                e.preventDefault();
                const referenceId = link.dataset.id;
                const sourceId = link.dataset.source;
                
                const dataContext = await this.getDataContext();
                const referenceData = await dataContext.getRecord(sourceId, referenceId);
                
                if (referenceData) {
                    const infoCard = document.querySelector('info-card-component');
                    infoCard?.show(referenceData, sourceId);
                }
            }
        });

        // Row selection
        this.shadowRoot.addEventListener('click', e => {
            const row = e.target.closest('tr[data-id]');
            if (row) {
                const isSelected = row.classList.toggle('selected');
                this.dispatchCustomEvent('row-select', {
                    id: row.dataset.id,
                    selected: isSelected
                });
            }
        });
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.data.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }

            if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        this.render();
    }

    async formatCell(value, column) {
        if (!value) return '';
        
        const sourceConfig = await this.getSourceConfig(this.sourceId);
        const dataContext = await this.getDataContext();
        const relationships = dataContext.config.relationships[this.sourceId];
        
        // Handle references first
        if (relationships?.references?.[column]) {
            const targetSourceId = relationships.references[column];
            const targetConfig = await this.getSourceConfig(targetSourceId);
            const displayValue = await dataContext.resolveReference(this.sourceId, value, column);
            
            return `<a href="#" class="reference-link" data-id="${value}" data-source="${targetSourceId}">${displayValue}</a>`;
        }

        // Handle special formats based on column formatting type
        const formatType = sourceConfig.columnFormatting[column];
        switch(formatType) {
            case 'email':
                return `<a href="mailto:${value}" class="email-link">${value}</a>`;
                
            case 'phone':
                // Format phone number for display
                const formattedPhone = this.formatPhoneNumber(value);
                // Create tel: link with the original unformatted number
                return `<a href="tel:${value.replace(/\D/g, '')}" class="phone-link">${formattedPhone}</a>`;
                
            case 'url':
                return `<a href="${value}" target="_blank" class="url-link">${value}</a>`;
                
            case 'percentage':
                return `${value}%`;
                
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0
                }).format(value);
                
            case 'date':
                return new Date(value).toLocaleDateString();
                
            case 'boolean':
                return value ? 'Yes' : 'No';
                
            case 'select':
                return value.split(',')[0];
                
            case 'tags':
                return value.split(',').map(tag => 
                    `<span class="tag">${tag.trim()}</span>`
                ).join('');
                
            default:
                // Try to auto-detect email and phone patterns if not explicitly formatted
                if (this.isEmailPattern(value)) {
                    return `<a href="mailto:${value}" class="email-link">${value}</a>`;
                }
                if (this.isPhonePattern(value)) {
                    const formattedPhone = this.formatPhoneNumber(value);
                    return `<a href="tel:${value.replace(/\D/g, '')}" class="phone-link">${formattedPhone}</a>`;
                }
                return value;
        }
    }

    formatPhoneNumber(phone) {
        // Remove all non-digits
        const cleaned = phone.replace(/\D/g, '');
        
        // Format based on length
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 11) {
            return `+${cleaned.slice(0,1)} (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
        }
        
        // Return original if can't format
        return phone;
    }

    isEmailPattern(value) {
        return typeof value === 'string' && 
               /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    isPhonePattern(value) {
        return typeof value === 'string' && 
               /^[\d\s+()-]{10,}$/.test(value) &&
               value.replace(/\D/g, '').length >= 10;
    }
    async render() {
        if (!this.sourceId) {
            this.shadowRoot.innerHTML = `
                <style>${this.styles}</style>
                <div class="error">No data source configured</div>
            `;
            return;
        }

        const sourceConfig = await this.getSourceConfig(this.sourceId);
        if (!sourceConfig) return;

        const columns = sourceConfig.visibleColumns;
        const rows = await Promise.all(this.data.map(async row => {
            const cells = await Promise.all(columns.map(async column => {
                const formattedValue = await this.formatCell(row[column], column);
                return `
                    <td class="cell-${sourceConfig.columnFormatting[column] || 'text'}">
                        ${formattedValue}
                    </td>
                `;
            }));
            
            return `
                <tr data-id="${row[sourceConfig.primaryKey]}">
                    ${cells.join('')}
                </tr>
            `;
        }));

        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            <div class="table-container ${this.loading ? 'loading' : ''}">
                <table>
                    <thead>
                        <tr>
                            ${columns.map(column => `
                                <th data-column="${column}" 
                                    class="${this.sortColumn === column ? 'sorted-' + this.sortDirection : ''}">
                                    ${column}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    get styles() {
        return `
            ${this.addBaseStyles()}

            .table-container {
                overflow-x: auto;
                margin: 1rem 0;
                background: white;
                border-radius: 0.5rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                transition: opacity 0.3s ease;
            }

            .table-container.loading {
                opacity: 0.5;
                pointer-events: none;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.9rem;
            }

            th, td {
                padding: 0.75rem 1rem;
                text-align: left;
                border-bottom: 1px solid #eee;
            }

            th {
                background: #f8f9fa;
                font-weight: 600;
                color: #333;
                white-space: nowrap;
                cursor: pointer;
                user-select: none;
                position: relative;
            }

            th:hover {
                background: #e9ecef;
            }

            th::after {
                content: '⇅';
                margin-left: 0.5rem;
                opacity: 0.3;
            }

            th.sorted-asc::after {
                content: '↑';
                opacity: 1;
            }

            th.sorted-desc::after {
                content: '↓';
                opacity: 1;
            }

            tr:hover {
                background: #f8f9fa;
            }

            tr.selected {
                background: #e8f4fe;
            }

            .cell-currency {
                text-align: right;
            }

            .cell-percentage {
                text-align: right;
            }

            .cell-number {
                text-align: right;
            }

            .reference-link {
                color: #0066cc;
                text-decoration: none;
                cursor: pointer;
            }

            .reference-link:hover {
                text-decoration: underline;
                color: #004499;
            }

            .error {
                padding: 1rem;
                color: #721c24;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 0.5rem;
                margin: 1rem 0;
            }

            .email-link,
            .phone-link,
            .url-link {
                color: var(--primary-color);
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
            }

            .email-link:hover,
            .phone-link:hover,
            .url-link:hover {
                text-decoration: underline;
                color: var(--primary-hover);
            }

            .tag {
                display: inline-block;
                padding: 0.125rem 0.5rem;
                background: #e2e2e2;
                border-radius: 1rem;
                font-size: 0.875em;
                margin: 0.125rem;
            }

            /* Add icons using pseudo-elements */
            .email-link::before {
                content: '📧';
                font-size: 0.875em;
            }

            .phone-link::before {
                content: '📞';
                font-size: 0.875em;
            }

            .url-link::before {
                content: '🔗';
                font-size: 0.875em;
            }

            @media (max-width: 768px) {
                th, td {
                    padding: 0.5rem;
                }

                table {
                    font-size: 0.8rem;
                }
                    .tag{
                    display:block;}

                .table-container {
                    margin: 0.5rem 0;
                    border-radius: 0.25rem;
                }
            }
        `;
    }
}

customElements.define('table-component', TableComponent);

export default TableComponent;