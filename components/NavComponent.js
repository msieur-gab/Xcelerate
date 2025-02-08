// components/NavComponent.js
import BaseComponent from './BaseComponent.js';

class NavComponent extends BaseComponent {
    constructor() {
        super();
        this.isOpen = false;
        this.appName = '';
    }

    static get observedAttributes() {
        return ['app-name'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'app-name' && oldValue !== newValue) {
            this.appName = newValue;
            this.render();
        }
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    toggleNav() {
        this.isOpen = !this.isOpen;
        document.body.classList.toggle('nav-open', this.isOpen);
        this.updateNavState();
    }

    updateNavState() {
        const nav = this.shadowRoot.querySelector('.nav-sidebar');
        const overlay = this.shadowRoot.querySelector('.nav-overlay');
        const hamburgerBtn = this.shadowRoot.querySelector('.hamburger-btn');

        if (nav && overlay && hamburgerBtn) {
            nav.classList.toggle('open', this.isOpen);
            overlay.classList.toggle('visible', this.isOpen);
            hamburgerBtn.classList.toggle('active', this.isOpen);
        }
    }

    async handleViewChange(sourceId) {
        // Get the app instance
        const app = window.app;
        if (app) {
            await app.loadView(sourceId);
            
            // Update active state in nav
            const navItems = this.shadowRoot.querySelectorAll('.nav-item[data-source-id]');
            navItems.forEach(item => {
                item.classList.toggle('active', item.dataset.sourceId === sourceId);
            });

            // Close nav on mobile
            if (window.innerWidth < 1024) {
                this.toggleNav();
            }
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const hamburgerBtn = this.shadowRoot.querySelector('.hamburger-btn');
        hamburgerBtn?.addEventListener('click', () => this.toggleNav());

        // Overlay click to close on mobile
        const overlay = this.shadowRoot.querySelector('.nav-overlay');
        overlay?.addEventListener('click', () => this.toggleNav());

        // ESC key to close on mobile
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.toggleNav();
            }
        });

        // Handle navigation items
        // const navItems = this.shadowRoot.querySelectorAll('.nav-item[data-source-id]');
        // navItems.forEach(item => {
        //     item.addEventListener('click', () => {
        //         const sourceId = item.dataset.sourceId;
        //         this.dispatchCustomEvent('nav-item-selected', { sourceId });
        //         if (window.innerWidth < 1024) {
        //             this.toggleNav();
        //         }
        //     });
        // });

         // Handle navigation items
         const navItems = this.shadowRoot.querySelectorAll('.nav-item[data-source-id]');
         navItems.forEach(item => {
             item.addEventListener('click', () => {
                 const sourceId = item.dataset.sourceId;
                 this.handleViewChange(sourceId);
             });
         });

        // Handle action items
        const actionItems = this.shadowRoot.querySelectorAll('.action-item');
        actionItems.forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleAction(action);
                if (window.innerWidth < 1024) {
                    this.toggleNav();
                }
            });
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) {
                this.isOpen = false;
                document.body.classList.remove('nav-open');
                this.updateNavState();
            }
        });
    }

    handleAction(action) {
        switch(action) {
            case 'add-entry':
                this.dispatchCustomEvent('toggle-editor');
                break;
            case 'export-data':
                this.dispatchCustomEvent('export-data');
                break;
            case 'import-data':
                this.triggerFileUpload();
                break;
            case 'generate-report':
                this.dispatchCustomEvent('generate-report');
                break;
        }
    }

    triggerFileUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json';
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const content = await this.readFile(file);
                const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
                
                this.dispatchCustomEvent('import-data', {
                    data: content,
                    format
                });
            } catch (error) {
                console.error('Error reading file:', error);
            }
        });
        input.click();
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    async getNavItems() {
        const dataContext = await this.getDataContext();
        if (!dataContext) return [];

        return Object.entries(dataContext.config.dataSources).map(([sourceId, config]) => ({
            sourceId,
            label: config.displayName,
            icon: this.getIconForSource(sourceId)
        }));
    }

    getIconForSource(sourceId) {
        const iconMap = {
            users: '👥',
            acquisitions: '💼',
            relations: '🔗',
            tasks: '📋',
            projects: '📁',
            reports: '📊'
        };
        return iconMap[sourceId] || '📄';
    }

    async render() {
        const navItems = await this.getNavItems();

        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            
            <button class="hamburger-btn" aria-label="Toggle Navigation">
                <span></span>
                <span></span>
                <span></span>
            </button>

            <div class="nav-overlay"></div>

            <nav class="nav-sidebar">
                <div class="nav-header">
                    <h2>${this.appName}</h2>
                </div>

                <div class="nav-content">
                    <div class="nav-section">
                        <h3 class="nav-section-title">Views</h3>
                        <ul class="nav-list">
                            ${navItems.map(item => `
                                <li class="nav-item" data-source-id="${item.sourceId}">
                                    <span class="nav-icon">${item.icon}</span>
                                    <span class="nav-label">${item.label}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>

                    <div class="nav-section">
                        <h3 class="nav-section-title">Actions</h3>
                        <ul class="nav-list">
                            <li class="nav-item action-item" data-action="add-entry">
                                <span class="nav-icon">➕</span>
                                <span class="nav-label">Add New Entry</span>
                            </li>
                            <li class="nav-item action-item" data-action="import-data">
                                <span class="nav-icon">📥</span>
                                <span class="nav-label">Import Data</span>
                            </li>
                            <li class="nav-item action-item" data-action="export-data">
                                <span class="nav-icon">📤</span>
                                <span class="nav-label">Export Data</span>
                            </li>
                            <li class="nav-item action-item" data-action="generate-report">
                                <span class="nav-icon">📊</span>
                                <span class="nav-label">Generate Report</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="nav-footer">
                    <div class="status-indicator">
                        <span id="connectivity-status"></span>
                    </div>
                    <p>© ${new Date().getFullYear()} ${this.appName}</p>
                </div>
            </nav>
        `;

        this.setupEventListeners();
    }

    get styles() {
        return `
            ${this.addBaseStyles()}

            :host {
                display: block;
                height: 100%;
            }

            .hamburger-btn {
                position: fixed;
                top: 1rem;
                left: 1rem;
                z-index: 60;
                width: 30px;
                height: 22px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                background: none;
                border: none;
                cursor: pointer;
                padding: 0;
            }

            .hamburger-btn span {
                display: block;
                width: 100%;
                height: 3px;
                background-color: var(--primary-color, #007bff);
                transition: transform 0.3s ease;
                border-radius: 3px;
            }

            .hamburger-btn.active span:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }

            .hamburger-btn.active span:nth-child(2) {
                opacity: 0;
            }

            .hamburger-btn.active span:nth-child(3) {
                transform: rotate(-45deg) translate(5px, -5px);
            }

            .nav-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
                z-index: 50;
            }

            .nav-overlay.visible {
                opacity: 1;
                visibility: visible;
            }

            .nav-sidebar {
                position: fixed;
                top: 0;
                left: 0;
                width: 280px;
                height: 100%;
                background: white;
                display: flex;
                flex-direction: column;
                box-shadow: 2px 0 8px rgba(0,0,0,0.1);
                z-index: 55;
                transition: transform 0.3s ease;
            }

            .nav-header {
                padding: 1.5rem;
                border-bottom: 1px solid var(--border-color, #eee);
                background: var(--light-color, #f8f9fa);
            }

            .nav-header h2 {
                margin: 0;
                font-size: 1.25rem;
                color: var(--primary-color, #007bff);
            }

            .nav-content {
                flex: 1;
                overflow-y: auto;
                padding: 1rem 0;
            }

            .nav-section {
                margin-bottom: 1.5rem;
            }

            .nav-section-title {
                padding: 0 1.5rem;
                font-size: 0.875rem;
                color: var(--text-muted, #6c757d);
                margin-bottom: 0.5rem;
                text-transform: uppercase;
                font-weight: 600;
            }

            .nav-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .nav-item {
                display: flex;
                align-items: center;
                padding: 0.75rem 1.5rem;
                cursor: pointer;
                transition: background 0.2s ease;
                user-select: none;
            }

            .nav-item:hover {
                background: var(--light-color, #f8f9fa);
            }

            .nav-icon {
                margin-right: 1rem;
                font-size: 1.25rem;
                width: 1.5rem;
                text-align: center;
            }

            .nav-label {
                font-size: 0.95rem;
                color: var(--dark-color, #343a40);
            }

            .nav-footer {
                padding: 1rem 1.5rem;
                border-top: 1px solid var(--border-color, #eee);
                background: var(--light-color, #f8f9fa);
                font-size: 0.875rem;
                color: var(--text-muted, #6c757d);
            }

            .status-indicator {
                margin-bottom: 0.5rem;
            }

            /* Mobile styles */
            @media (max-width: 1023px) {
                .nav-sidebar {
                    transform: translateX(-100%);
                }

                .nav-sidebar.open {
                    transform: translateX(0);
                }
            }

            /* Desktop styles */
            @media (min-width: 1024px) {
                .hamburger-btn,
                .nav-overlay {
                    display: none;
                }

                .nav-sidebar {
                    transform: none;
                }
            }
        `;
    }
}

customElements.define('nav-component', NavComponent);

export default NavComponent;