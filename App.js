// App.js
import { appConfig } from './app.config.js';
import DataContext from './services/DataContext.js';
import './components/NavComponent.js';
import './components/TableComponent.js';
import './components/FilterComponent.js';
import './components/EditorComponent.js';
import './components/InfoCardComponent.js';

class App {
    constructor() {
        this.config = appConfig;
        this.currentSourceId = this.config.defaultView;
        this.dataContext = new DataContext(this.config);
        this.isOnline = navigator.onLine;
        this.setupConnectivityHandlers();
    }

    async init() {
        try {
            // Initialize data context
            await this.dataContext.initialize();
            
            // Make app instance globally available for debugging
            window.app = this;
            
            // Initialize UI
            this.initializeUI();
            await this.loadView(this.config.defaultView);
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    setupConnectivityHandlers() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateConnectivityStatus();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectivityStatus();
        });
    }

    updateConnectivityStatus() {
        document.body.classList.toggle('offline', !this.isOnline);
        const statusEl = document.getElementById('connectivity-status');
        if (statusEl) {
            statusEl.textContent = this.isOnline ? 'Online' : 'Offline';
            statusEl.className = this.isOnline ? 'status-online' : 'status-offline';
        }
    }

    initializeUI() {
        // Set app title
        document.getElementById('app-title').textContent = this.config.app.name;
        
        // Initialize nav component
        const navComponent = document.querySelector('nav-component');
        if (navComponent) {
            navComponent.setAttribute('app-name', this.config.app.name);
        }
        
        // Initialize view controls
        this.initializeViewControls();
        
        // Update connectivity status
        this.updateConnectivityStatus();
    }

    initializeViewControls() {
        const container = document.getElementById('view-controls');
        if (!container) return;

        container.innerHTML = '';
        Object.entries(this.config.dataSources).forEach(([sourceId, config]) => {
            const button = document.createElement('button');
            button.textContent = config.displayName;
            button.dataset.sourceId = sourceId;
            button.classList.toggle('active', sourceId === this.currentSourceId);
            button.onclick = () => this.loadView(sourceId);
            container.appendChild(button);
        });
    }

    async loadView(sourceId) {
        this.currentSourceId = sourceId;
        this.updateViewButtons();

        // Update view title
        const sourceConfig = this.config.dataSources[sourceId];
        const viewTitle = sourceConfig.displayName;
        
        // Update mobile header title
        const titleElement = document.getElementById('app-title');
        if (titleElement) {
            titleElement.textContent = viewTitle;
        }

        // Update document title
        // document.title = `${viewTitle} - ${this.config.app.name}`;
        
        
        const data = await this.dataContext.getData(sourceId);
        
        ['data-filter', 'data-table', 'data-editor'].forEach(id => {
            const component = document.getElementById(id);
            if (component) {
                component.setAttribute('source-id', sourceId);
            }
        });

        const tableComponent = document.getElementById('data-table');
        if (tableComponent) {
            tableComponent.setAttribute('data', JSON.stringify(data));
        }
    }

    updateViewButtons() {
        const buttons = document.querySelectorAll('#view-controls button');
        buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.sourceId === this.currentSourceId);
        });
    }

    setupEventListeners() {
        // Listen for data changes
        this.dataContext.addListener((sourceId, action, data) => {
            if (sourceId === this.currentSourceId) {
                this.refreshView();
            }
        });

        // Filter changes
        document.addEventListener('filter-change', async e => {
            const { filters, searchTerm } = e.detail;
            const filteredData = await this.dataContext.searchAndFilter(
                this.currentSourceId, 
                { filters, searchTerm }
            );
            const tableComponent = document.getElementById('data-table');
            if (tableComponent) {
                tableComponent.setAttribute('data', JSON.stringify(filteredData));
            }
        });

        // New entry
        document.addEventListener('new-entry', async e => {
            const { entry } = e.detail;
            await this.dataContext.addRecord(this.currentSourceId, entry);
        });

        // Update entry
        document.addEventListener('update-entry', async e => {
            const { entry } = e.detail;
            await this.dataContext.updateRecord(this.currentSourceId, entry);
        });

        // Delete entry
        document.addEventListener('delete-entry', async e => {
            const { id } = e.detail;
            await this.dataContext.deleteRecord(this.currentSourceId, id);
        });

        // Export data
        document.addEventListener('export-data', async e => {
            const { format = 'csv' } = e.detail || {};
            const data = await this.dataContext.exportData(this.currentSourceId, format);
            const filename = `${this.currentSourceId}_export_${new Date().toISOString().split('T')[0]}.${format}`;
            this.downloadFile(data, filename, format === 'csv' ? 'text/csv' : 'application/json');
        });

        // Import data
        document.addEventListener('import-data', async e => {
            const { data, format } = e.detail;
            await this.dataContext.importData(this.currentSourceId, data, format);
        });
    }

    async refreshView() {
        const data = await this.dataContext.getData(this.currentSourceId);
        const tableComponent = document.getElementById('data-table');
        if (tableComponent) {
            tableComponent.setAttribute('data', JSON.stringify(data));
        }
    }

    showError(message) {
        // Implementation depends on your UI design
        console.error(message);
        alert(message); // Replace with better error handling
    }

    downloadFile(content, filename, type = 'text/plain') {
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

    toggleEditor() {
        const editor = document.getElementById('data-editor');
        if (editor) {
            const isVisible = editor.getAttribute('visible') === 'true';
            editor.setAttribute('visible', (!isVisible).toString());
        }
    }
}

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init().catch(console.error);
});

export default App;