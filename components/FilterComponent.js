// components/FilterComponent.js
import BaseComponent from './BaseComponent.js';

class FilterComponent extends BaseComponent {
    constructor() {
        super();
        this.filters = {};
        this.searchTerm = '';
        this.sourceId = '';
        this.isBottomSheetVisible = false;
        this.filterOptions = new Map();
    }

    static get observedAttributes() {
        return ['source-id'];
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'source-id' && oldValue !== newValue) {
            this.sourceId = newValue;
            this.filters = {};
            this.searchTerm = '';
            await this.loadFilterOptions();
            await this.render();
        }
    }

    async loadFilterOptions() {
        if (!this.sourceId) return;

        const dataContext = await this.getDataContext();
        const sourceConfig = await this.getSourceConfig(this.sourceId);
        const data = await dataContext.getData(this.sourceId);

        // Get unique values for each filterable field
        sourceConfig.filterableFields.forEach(field => {
            const values = new Set();
            data.forEach(item => {
                if (item[field]) {
                    if (typeof item[field] === 'string' && item[field].includes(',')) {
                        item[field].split(',').forEach(val => values.add(val.trim()));
                    } else {
                        values.add(item[field]);
                    }
                }
            });
            this.filterOptions.set(field, Array.from(values).sort());
        });
    }

    toggleBottomSheet() {
        this.isBottomSheetVisible = !this.isBottomSheetVisible;
        const sheet = this.shadowRoot.querySelector('.bottom-sheet');
        const overlay = this.shadowRoot.querySelector('.overlay');
        
        if (sheet && overlay) {
            sheet.classList.toggle('visible', this.isBottomSheetVisible);
            overlay.classList.toggle('visible', this.isBottomSheetVisible);
            document.body.style.overflow = this.isBottomSheetVisible ? 'hidden' : '';
        }
    }

    handleSearch(value) {
        this.searchTerm = value;
        this.notifyFilterChange();
    }

    applyFilters() {
        const filters = {};
        const selects = this.shadowRoot.querySelectorAll('.filter-group select');
        
        selects.forEach(select => {
            if (select.value !== 'all') {
                filters[select.dataset.field] = select.value;
            }
        });

        this.filters = filters;
        this.notifyFilterChange();
        this.toggleBottomSheet();
    }

    resetFilters() {
        this.filters = {};
        const selects = this.shadowRoot.querySelectorAll('.filter-group select');
        selects.forEach(select => select.value = 'all');
        this.notifyFilterChange();
        this.render();
    }

    notifyFilterChange() {
        this.dispatchCustomEvent('filter-change', {
            filters: this.filters,
            searchTerm: this.searchTerm
        });
    }

    setupEventListeners() {
        this.shadowRoot.addEventListener('click', e => {
            if (e.target.classList.contains('overlay')) {
                this.toggleBottomSheet();
            }
        });

        // Debounced search input handler
        const searchInput = this.shadowRoot.querySelector('.search-input');
        if (searchInput) {
            const debouncedSearch = this.debounce(value => this.handleSearch(value), 300);
            searchInput.addEventListener('input', e => debouncedSearch(e.target.value));
        }
    }

    async renderFilterGroups() {
        if (!this.sourceId) return '';

        const sourceConfig = await this.getSourceConfig(this.sourceId);
        if (!sourceConfig) return '';

        return sourceConfig.filterableFields.map(field => {
            const options = this.filterOptions.get(field) || [];
            return `
                <div class="filter-group">
                    <label>${field}</label>
                    <select data-field="${field}">
                        <option value="all">All</option>
                        ${options.map(option => `
                            <option value="${option}" ${this.filters[field] === option ? 'selected' : ''}>
                                ${option}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }).join('');
    }

    async render() {
        const activeFiltersCount = Object.keys(this.filters).length;
        const filterGroups = await this.renderFilterGroups();

        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            
            <div class="filter-container">
                <div class="search-container">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input 
                        type="search" 
                        class="search-input" 
                        placeholder="Search..." 
                        value="${this.searchTerm}"
                    >
                </div>
                
                <button class="filter-button" onclick="this.getRootNode().host.toggleBottomSheet()">
                    Filters
                    ${activeFiltersCount > 0 ? `
                        <span class="filter-badge">${activeFiltersCount}</span>
                    ` : ''}
                </button>
            </div>

            <div class="overlay">
                <div class="bottom-sheet">
                    <div class="sheet-header">
                        <div class="sheet-title">Filters</div>
                        <button class="close-button" onclick="this.getRootNode().host.toggleBottomSheet()">&times;</button>
                    </div>
                    
                    <div class="filters-grid">
                        ${filterGroups}
                    </div>
                    
                    <div class="actions">
                        <button class="reset-button" onclick="this.getRootNode().host.resetFilters()">
                            Reset
                        </button>
                        <button class="apply-button" onclick="this.getRootNode().host.applyFilters()">
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    get styles() {
        return `
            ${this.addBaseStyles()}

            .filter-container {
                display: flex;
                gap: 1rem;
                align-items: center;
                margin-bottom: 1rem;
            }

            .search-container {
                flex: 1;
                position: relative;
            }

            .search-input {
                width: 100%;
                padding: 0.75rem 1rem 0.75rem 2.5rem;
                border: 1px solid #ddd;
                border-radius: 0.5rem;
                font-size: 0.9rem;
            }

            .search-icon {
                position: absolute;
                left: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                width: 1rem;
                height: 1rem;
                color: #666;
            }

            .filter-button {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.9rem;
                min-width: 100px;
                justify-content: center;
            }

            .filter-badge {
                background: #e3f2fd;
                color: #1976d2;
                padding: 0.125rem 0.375rem;
                border-radius: 1rem;
                font-size: 0.75rem;
                min-width: 1.25rem;
                text-align: center;
            }

            .overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                opacity: 0;
                visibility: hidden;
                transition: 0.3s;
                z-index: 100;
            }

            .overlay.visible {
                opacity: 1;
                visibility: visible;
            }

            .bottom-sheet {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: white;
                padding: 1.5rem;
                border-radius: 1rem 1rem 0 0;
                transform: translateY(100%);
                transition: 0.3s;
                z-index: 101;
                max-height: 85vh;
                overflow-y: auto;
            }

            .bottom-sheet.visible {
                transform: translateY(0);
            }

            .sheet-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
            }

            .sheet-title {
                font-size: 1.25rem;
                font-weight: 600;
            }

            .close-button {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0.5rem;
                color: #666;
            }

            .filters-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 1.5rem;
            }

            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .filter-group label {
                font-size: 0.875rem;
                color: #666;
            }

            .filter-group select {
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 0.25rem;
                font-size: 0.9rem;
            }

            .actions {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid #eee;
            }

            .actions button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
                font-size: 0.9rem;
                min-width: 100px;
            }

            .apply-button {
                background: #1976d2;
                color: white;
            }

            .reset-button {
                background: #f8f9fa;
                border: 1px solid #ddd;
            }

            @media (max-width: 768px) {
                .filters-grid {
                    grid-template-columns: 1fr;
                }

                .bottom-sheet {
                    max-height: 80vh;
                }

                .actions {
                    position: sticky;
                    bottom: 0;
                    background: white;
                    padding: 1rem 0;
                    margin: 0;
                    margin-top: 1rem;
                }

                .filter-container {
                    flex-direction: column;
                }

                .filter-button {
                    width: 100%;
                }
            }
        `;
    }
}

customElements.define('filter-component', FilterComponent);

export default FilterComponent;