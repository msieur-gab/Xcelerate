// components/InfoCardComponent.js
import BaseComponent from './BaseComponent.js';

class InfoCardComponent extends BaseComponent {
    constructor() {
        super();
        this.isVisible = false;
        this.data = null;
        this.sourceId = '';
        this.resolvedReferences = new Map();
    }

    show(data, sourceId) {
        this.data = data;
        this.sourceId = sourceId;
        
        // First render the content
        this.resolveReferences().then(() => {
            this.render();
            
            // Then trigger the animation after a small delay
            requestAnimationFrame(() => {
                const container = this.shadowRoot.querySelector('.card-container');
                const overlay = this.shadowRoot.querySelector('.overlay');
                if (container && overlay) {
                    this.isVisible = true;
                    container.classList.add('visible');
                    overlay.classList.add('visible');
                    document.body.style.overflow = 'hidden';
                }
            });
        });
    }

    hide() {
        const container = this.shadowRoot.querySelector('.card-container');
        const overlay = this.shadowRoot.querySelector('.overlay');
        
        if (container && overlay) {
            container.classList.remove('visible');
            overlay.classList.remove('visible');
            
            // Wait for the animation to complete before cleaning up
            container.addEventListener('transitionend', () => {
                this.isVisible = false;
                this.data = null;
                this.sourceId = '';
                this.resolvedReferences.clear();
                this.render();
                document.body.style.overflow = '';
            }, { once: true });
        }
    }

    async resolveReferences() {
        if (!this.data || !this.sourceId) return;

        const dataContext = await this.getDataContext();
        const relationships = dataContext.config.relationships[this.sourceId];
        
        if (!relationships?.references) return;

        for (const [field, targetSource] of Object.entries(relationships.references)) {
            if (this.data[field]) {
                const resolvedValue = await dataContext.resolveReference(
                    this.sourceId,
                    this.data[field],
                    field
                );
                this.resolvedReferences.set(field, resolvedValue);
            }
        }
    }

    async formatField(key, value) {
        if (value === null || value === undefined) return '-';
        
        const sourceConfig = await this.getSourceConfig(this.sourceId);
        const formatType = sourceConfig.columnFormatting[key];
        
        // Check if this is a reference field
        if (this.resolvedReferences.has(key)) {
            return `
                <span class="reference-value">
                    ${this.resolvedReferences.get(key)}
                    <span class="reference-id">(${value})</span>
                </span>
            `;
        }
        
        return this.formatValue(value, formatType);
    }

    setupEventListeners() {
        this.shadowRoot.addEventListener('click', (e) => {
            if (e.target.classList.contains('overlay') || 
                e.target.classList.contains('close-button')) {
                this.hide();
            }
        });

        // Handle keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    async render() {
        if (!this.data) {
            this.shadowRoot.innerHTML = `<style>${this.styles}</style>`;
            return;
        }

        const sourceConfig = await this.getSourceConfig(this.sourceId);
        const displayName = sourceConfig?.displayField ? 
            this.data[sourceConfig.displayField] : 'Details';

        const fields = await Promise.all(
            Object.entries(this.data)
                .filter(([key]) => !key.toLowerCase().includes('id'))
                .map(async ([key, value]) => {
                    const formattedValue = await this.formatField(key, value);
                    return `
                        <div class="info-item">
                            <span class="info-label">${key}</span>
                            <span class="info-value">${formattedValue}</span>
                        </div>
                    `;
                })
        );

        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            <div class="overlay ${this.isVisible ? 'visible' : ''}">
                <div class="card-container ${this.isVisible ? 'visible' : ''}">
                    <div class="card-header">
                        <h2>${displayName}</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="info-grid">${fields.join('')}</div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    get styles() {
        return `
            ${this.addBaseStyles()}

            :host {
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1001;
                pointer-events: none;
            }

            .overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.3);
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }
            
            .overlay.visible {
                opacity: 1;
                pointer-events: auto;
            }
            
            .card-container {
                background: white;
                border-radius: 16px 16px 0 0;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
                padding: 20px;
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                max-width: 800px;
                margin: 0 auto;
                max-height: 85vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .card-container.visible {
                transform: translateY(0);
            }
            
            .card-header {
                position: sticky;
                top: 0;
                background: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: -20px -20px 20px -20px;
                padding: 1rem;
                border-bottom: 1px solid #eee;
                z-index: 1;
            }
            
            .card-header h2 {
                font-size: 1.2rem;
                font-weight: bold;
                color: #333;
                margin: 0;
            }
            
            .close-button {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 8px;
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s ease;
            }

            .close-button:hover {
                background-color: rgba(0, 0, 0, 0.05);
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 20px;
                padding-top: 1rem;
            }
            
            .info-item {
                display: flex;
                flex-direction: column;
            }
            
            .info-label {
                font-size: 0.85rem;
                color: #666;
                margin-bottom: 4px;
            }
            
            .info-value {
                font-size: 1rem;
                color: #333;
                word-break: break-word;
            }

            @media (min-width: 801px) {
                .card-container {
                    max-width: 800px;
                    margin: 0 auto;
                    border-radius: 16px;
                    bottom: 50%;
                    transform: translateY(150%);
                }

                .card-container.visible {
                    transform: translateY(50%);
                }
            }

            @media (max-width: 800px) {
                .info-grid {
                    grid-template-columns: 1fr;
                }

                .card-container {
                    max-height: 90vh;
                }
            }
        `;
    }
}

customElements.define('info-card-component', InfoCardComponent);

export default InfoCardComponent;