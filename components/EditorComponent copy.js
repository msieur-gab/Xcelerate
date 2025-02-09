import BaseComponent from './BaseComponent.js';

class EditorComponent extends BaseComponent {
    constructor() {
        super();
        this.isExpanded = false;
        this.sourceId = '';
        this.editingRecord = null;
        this.errors = new Map();
        this.template = document.createElement('template');
        this.setupTemplate();
    }

    setupTemplate() {
        this.template.innerHTML = `
            <style>
                :host {
                    display: block;
                    margin-top: 1rem;
                }

                .editor-wrapper {
                    background: white;
                    border-radius: 0.5rem;
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .editor-toggle {
                    width: 100%;
                    padding: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                    color: var(--text-color);
                    border-bottom: 1px solid transparent;
                }

                .editor-toggle:hover {
                    background: var(--light-color);
                }

                .editor-toggle-text {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .editor-toggle-icon {
                    transition: transform 0.3s ease;
                }

                .editor-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }

                .editor-wrapper.expanded .editor-content {
                    max-height: 2000px;
                }

                .editor-wrapper.expanded .editor-toggle {
                    border-bottom: 1px solid var(--border-color);
                }

                .editor-wrapper.expanded .editor-toggle-icon {
                    transform: rotate(180deg);
                }

                .form-grid {
                    display: grid;
                    gap: 1rem;
                    padding: 1rem;
                }

                @media (min-width: 640px) {
                    .form-grid {
                        grid-template-columns: repeat(2, 1fr);
                        padding: 1.5rem;
                    }
                }

                @media (min-width: 1024px) {
                    .form-grid {
                        grid-template-columns: repeat(3, 1fr);
                    }
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                label {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                }

                input, select, textarea {
                    padding: 0.5rem;
                    border: 1px solid var(--border-color);
                    border-radius: 0.25rem;
                    font-size: 0.875rem;
                    width: 100%;
                }

                input:focus, select:focus, textarea:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
                }

                .actions {
                    padding: 1rem;
                    background: var(--light-color);
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                }

                button {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    font-size: 0.875rem;
                }

                .save-button {
                    background: var(--primary-color);
                    color: white;
                }

                .cancel-button {
                    background: var(--light-color);
                    border: 1px solid var(--border-color);
                }

                .error-message {
                    color: var(--danger-color);
                    font-size: 0.75rem;
                    margin-top: 0.25rem;
                }
            </style>

            <div class="editor-wrapper">
                <button class="editor-toggle" type="button">
                    <span class="editor-toggle-text">
                        <span>Add New Entry</span>
                    </span>
                    <span class="editor-toggle-icon">▼</span>
                </button>

                <div class="editor-content">
                    <form id="editor-form">
                        <div class="form-grid"></div>
                        <div class="actions">
                            <button type="button" class="cancel-button">Cancel</button>
                            <button type="submit" class="save-button">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    static get observedAttributes() {
        return ['source-id', 'record-id'];
    }

    async connectedCallback() {
        this.shadowRoot.appendChild(this.template.content.cloneNode(true));
        this.setupEventListeners();
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'source-id':
                this.sourceId = newValue;
                await this.render();
                break;

            case 'record-id':
                if (newValue) {
                    const dataContext = await this.getDataContext();
                    this.editingRecord = await dataContext.getRecord(this.sourceId, newValue);
                    await this.render();
                    this.expand();
                } else {
                    this.editingRecord = null;
                }
                break;
        }
    }

    setupEventListeners() {
        const toggle = this.shadowRoot.querySelector('.editor-toggle');
        toggle?.addEventListener('click', () => this.toggleExpanded());

        const form = this.shadowRoot.querySelector('#editor-form');
        form?.addEventListener('submit', (e) => this.handleSubmit(e));

        const cancelButton = this.shadowRoot.querySelector('.cancel-button');
        cancelButton?.addEventListener('click', () => this.collapse());
    }

    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        const wrapper = this.shadowRoot.querySelector('.editor-wrapper');
        wrapper?.classList.toggle('expanded', this.isExpanded);
    }

    expand() {
        this.isExpanded = true;
        const wrapper = this.shadowRoot.querySelector('.editor-wrapper');
        wrapper?.classList.add('expanded');
    }

    collapse() {
        this.isExpanded = false;
        const wrapper = this.shadowRoot.querySelector('.editor-wrapper');
        wrapper?.classList.remove('expanded');
    }

    async createInputField(fieldName, currentValue = '') {
        const sourceConfig = await this.getSourceConfig(this.sourceId);
        const formatType = sourceConfig.columnFormatting[fieldName];
        const validation = sourceConfig.validation?.[fieldName] || {};
        const fieldErrors = this.errors.get(fieldName) || [];

        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = this.formatFieldLabel(fieldName);
        wrapper.appendChild(label);

        let input;

        if (formatType === 'select') {
            input = document.createElement('select');
            const dataContext = await this.getDataContext();
            const options = await dataContext.getFieldOptions(this.sourceId, fieldName);
            
            input.innerHTML = `
                <option value="">Select ${fieldName}</option>
                ${options.map(opt => `
                    <option value="${opt}" ${currentValue === opt ? 'selected' : ''}>
                        ${opt}
                    </option>
                `).join('')}
            `;
        } else {
            input = document.createElement('input');
            input.type = this.getInputType(formatType);
            input.value = currentValue;
        }

        input.name = fieldName;
        if (validation.required) input.required = true;
        if (validation.minLength) input.minLength = validation.minLength;
        
        wrapper.appendChild(input);

        if (fieldErrors.length > 0) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = fieldErrors.join(', ');
            wrapper.appendChild(errorDiv);
        }

        return wrapper;
    }

    getInputType(formatType) {
        switch (formatType) {
            case 'email': return 'email';
            case 'phone': return 'tel';
            case 'date': return 'date';
            case 'currency':
            case 'percentage':
            case 'number':
                return 'number';
            default:
                return 'text';
        }
    }

    formatFieldLabel(fieldName) {
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }

    async render() {
        if (!this.sourceId) return;

        const sourceConfig = await this.getSourceConfig(this.sourceId);
        if (!sourceConfig) return;

        const formGrid = this.shadowRoot.querySelector('.form-grid');
        if (!formGrid) return;

        // Clear existing fields
        formGrid.innerHTML = '';

        // Create form fields
        for (const fieldName of sourceConfig.visibleColumns) {
            const currentValue = this.editingRecord?.[fieldName] || '';
            const fieldElement = await this.createInputField(fieldName, currentValue);
            formGrid.appendChild(fieldElement);
        }

        // Update toggle button text
        const toggleText = this.shadowRoot.querySelector('.editor-toggle-text span');
        if (toggleText) {
            toggleText.textContent = this.editingRecord ? 'Edit Entry' : 'Add New Entry';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const record = Object.fromEntries(formData.entries());

        if (!this.editingRecord) {
            const sourceConfig = await this.getSourceConfig(this.sourceId);
            record[sourceConfig.primaryKey] = this.generateId(sourceConfig.primaryKey);
        }

        try {
            const isValid = await this.validateForm(formData);
            if (!isValid) {
                await this.render();
                return;
            }

            this.dispatchCustomEvent(
                this.editingRecord ? 'update-entry' : 'new-entry',
                { entry: record }
            );

            this.collapse();
            e.target.reset();
            this.editingRecord = null;
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    }

    async validateForm(formData) {
        const sourceConfig = await this.getSourceConfig(this.sourceId);
        const validation = sourceConfig.validation || {};
        this.errors.clear();
        let hasErrors = false;

        for (const [field, rules] of Object.entries(validation)) {
            const value = formData.get(field);
            const fieldErrors = await this.validateField(value, rules);
            
            if (fieldErrors.length > 0) {
                this.errors.set(field, fieldErrors);
                hasErrors = true;
            }
        }

        return !hasErrors;
    }
}

customElements.define('editor-component', EditorComponent);

export default EditorComponent;