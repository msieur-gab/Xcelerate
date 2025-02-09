// components/EditorComponent.js
import BaseComponent from './BaseComponent.js';

class EditorComponent extends BaseComponent {
    constructor() {
        super();
        this.isVisible = false;
        this.sourceId = '';
        this.editingRecord = null;
        this.errors = new Map();
    }

    static get observedAttributes() {
        return ['source-id', 'visible', 'record-id'];
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'source-id':
                this.sourceId = newValue;
                await this.render();
                break;

            case 'visible':
                this.toggle(newValue === 'true');
                break;

            case 'record-id':
                if (newValue) {
                    const dataContext = await this.getDataContext();
                    this.editingRecord = await dataContext.getRecord(this.sourceId, newValue);
                    await this.render();
                } else {
                    this.editingRecord = null;
                }
                break;
        }
    }

    toggle(force) {
        this.isVisible = typeof force === 'boolean' ? force : !this.isVisible;
        this.setAttribute('visible', this.isVisible);
    
        const container = this.shadowRoot.querySelector('.editor-container');
        const overlay = this.shadowRoot.querySelector('.overlay');
        
        if (container && overlay) {
            if (this.isVisible) {
                container.classList.add('visible');
                overlay.classList.add('visible');
                document.body.style.overflow = 'hidden';
            } else {
                container.classList.remove('visible');
                overlay.classList.remove('visible');
                
                overlay.addEventListener('transitionend', () => {
                    if (!this.isVisible) {
                        document.body.style.overflow = '';
                    }
                }, { once: true });
            }
        }
    }

    async createInputField(fieldName) {
        const sourceConfig = await this.getSourceConfig(this.sourceId);
        if (!sourceConfig) return '';

        const formatType = sourceConfig.columnFormatting[fieldName];
        const validation = sourceConfig.validation?.[fieldName] || {};
        const currentValue = this.editingRecord?.[fieldName] || '';
        const fieldErrors = this.errors.get(fieldName) || [];

        if (formatType === 'boolean') {
            return `
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" 
                            name="${fieldName}" 
                            ${currentValue ? 'checked' : ''}
                        >
                        ${fieldName}
                    </label>
                    ${this.renderErrors(fieldErrors)}
                </div>
            `;
        }

        if (formatType === 'select') {
            const dataContext = await this.getDataContext();
            const options = await dataContext.getFieldOptions(this.sourceId, fieldName);
            return `
                <div class="form-group">
                    <label>${fieldName}</label>
                    <select name="${fieldName}" ${validation.required ? 'required' : ''}>
                        <option value="">Select ${fieldName}</option>
                        ${options.map(opt => `
                            <option value="${opt}" ${currentValue === opt ? 'selected' : ''}>
                                ${opt}
                            </option>
                        `).join('')}
                    </select>
                    ${this.renderErrors(fieldErrors)}
                </div>
            `;
        }

        let inputType = 'text';
        let inputAttrs = '';

        switch (formatType) {
            case 'email':
                inputType = 'email';
                break;
            case 'phone':
                inputType = 'tel';
                inputAttrs = 'pattern="[0-9-+]+"';
                break;
            case 'date':
                inputType = 'date';
                break;
            case 'currency':
            case 'percentage':
            case 'number':
                inputType = 'number';
                inputAttrs = 'step="any"';
                if (validation.min !== undefined) {
                    inputAttrs += ` min="${validation.min}"`;
                }
                break;
        }

        return `
            <div class="form-group">
                <label>${fieldName}</label>
                <input 
                    type="${inputType}"
                    name="${fieldName}"
                    value="${currentValue}"
                    ${inputAttrs}
                    ${validation.required ? 'required' : ''}
                    ${validation.minLength ? `minlength="${validation.minLength}"` : ''}
                >
                ${this.renderErrors(fieldErrors)}
            </div>
        `;
    }

    renderErrors(errors) {
        if (!errors || errors.length === 0) return '';
        return `
            <div class="field-errors">
                ${errors.map(error => `<div class="error">${error}</div>`).join('')}
            </div>
        `;
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

   async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const record = Object.fromEntries(formData.entries());

        // Add ID for new records
        if (!this.editingRecord) {
            const sourceConfig = await this.getSourceConfig(this.sourceId);
            record[sourceConfig.primaryKey] = this.generateId(sourceConfig.primaryKey);
        }

        // Validate form
        const isValid = await this.validateForm(formData);
        if (!isValid) {
            await this.render();
            return;
        }

        // Dispatch event
        this.dispatchCustomEvent(this.editingRecord ? 'update-entry' : 'new-entry', {
            sourceId: this.sourceId,
            entry: record
        });
         
        this.toggle(false);
        e.target.reset();
        this.editingRecord = null;
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
    
        const dataContext = await this.getDataContext();
        const data = await dataContext.getData(this.sourceId);
    
        if (data.length === 0) {
            this.shadowRoot.innerHTML = `
                <style>${this.styles}</style>
                <div class="error">No data available</div>
            `;
            return;
        }
    
        const fields = Object.keys(data[0]);
        const formFields = await Promise.all(
            fields.map(field => this.createInputField(field))
        );
    
        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            <div class="overlay ${this.isVisible ? 'visible' : ''}">
                <div class="editor-container ${this.isVisible ? 'visible' : ''}">
                    <div class="editor-header">
                        <h2>${this.editingRecord ? 'Edit' : 'Add New'} ${sourceConfig.displayName}</h2>
                        <button class="close-button" onclick="this.getRootNode().host.toggle(false)">&times;</button>
                    </div>
                    
                    <form onsubmit="this.getRootNode().host.handleSubmit(event)">
                        <div class="form-grid">
                            ${formFields.join('')}
                        </div>
                        
                        <div class="actions">
                            <button type="button" class="cancel-button" 
                                onclick="this.getRootNode().host.toggle(false)">
                                Cancel
                            </button>
                            <button type="submit" class="save-button">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    get styles() {
        return `
            ${this.addBaseStyles()}

            .overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                opacity: 0;
                visibility: hidden;
                transition: 0.3s;
                z-index: 1000;
            }

            .overlay.visible {
                opacity: 1;
                visibility: visible;
            }

            .editor-container {
                position: fixed;
                inset: 2rem;
                background: white;
                border-radius: 1rem;
                padding: 2rem;
                transform: scale(0.95);
                opacity: 0;
                visibility: hidden;
                transition: 0.3s;
                z-index: 1001;
                overflow-y: auto;
            }

            .editor-container.visible {
                transform: scale(1);
                opacity: 1;
                visibility: visible;
            }

            .editor-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
            }

            h2 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: #333;
            }

            .close-button {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0.5rem;
                color: #666;
            }

            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .form-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            label {
                font-size: 0.9rem;
                color: #666;
            }

            input:not([type="checkbox"]),
            select {
                padding: 0.75rem;
                border: 1px solid #ddd;
                border-radius: 0.5rem;
                font-size: 0.9rem;
                width: 100%;
            }

            input:not([type="checkbox"]):focus,
            select:focus {
                outline: none;
                border-color: #1976d2;
                box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
            }

            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                cursor: pointer;
            }

            input[type="checkbox"] {
                width: 1.25rem;
                height: 1.25rem;
            }

            .actions {
                display: flex;
                justify-content: flex-end;
                gap: 1rem;
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 1px solid #eee;
            }

            button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.9rem;
                min-width: 100px;
            }

            .save-button {
                background: #1976d2;
                color: white;
            }

            .save-button:hover {
                background: #1565c0;
            }

            .cancel-button {
                background: #f8f9fa;
                border: 1px solid #ddd;
            }

            .cancel-button:hover {
                background: #e9ecef;
            }

            .field-errors {
                margin-top: 0.25rem;
            }

            .error {
                color: #dc3545;
                font-size: 0.8rem;
            }

            @media (max-width: 768px) {
                .editor-container {
                    inset: 0;
                    border-radius: 0;
                    padding: 1rem;
                }

                .form-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }

                .actions {
                    position: sticky;
                    bottom: 0;
                    background: white;
                    padding: 1rem 0;
                    margin: 0;
                    margin-top: 1rem;
                }

                button {
                    flex: 1;
                }
            }
        `;
    }
}

customElements.define('editor-component', EditorComponent);

export default EditorComponent;