// components/DashboardComponent.js
import BaseComponent from './BaseComponent.js';
import { 
    BarChart, Bar, LineChart, Line, PieChart, Pie,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

class DashboardComponent extends BaseComponent {
    constructor() {
        super();
        this.metrics = new Map();
        this.charts = new Map();
    }

    async connectedCallback() {
        await this.loadDashboardData();
        this.render();
    }

    async loadDashboardData() {
        const dataContext = await this.getDataContext();
        const dashboardConfig = dataContext.config.dashboard;

        if (!dashboardConfig) return;

        // Load metrics data
        for (const metric of dashboardConfig.metrics) {
            const data = await this.calculateMetric(metric);
            this.metrics.set(metric.id, data);
        }

        // Load charts data
        for (const chart of dashboardConfig.charts) {
            const data = await this.prepareChartData(chart);
            this.charts.set(chart.id, data);
        }
    }

    async calculateMetric(metric) {
        const dataContext = await this.getDataContext();
        const data = await dataContext.getData(metric.sourceId);
        
        switch (metric.type) {
            case 'count':
                return {
                    label: metric.label,
                    value: data.length,
                    type: metric.type
                };
            
            case 'sum':
                return {
                    label: metric.label,
                    value: data.reduce((sum, item) => sum + (item[metric.field] || 0), 0),
                    type: metric.type,
                    field: metric.field
                };
            
            case 'average':
                const values = data.map(item => item[metric.field]).filter(v => v != null);
                return {
                    label: metric.label,
                    value: values.reduce((sum, val) => sum + val, 0) / values.length,
                    type: metric.type,
                    field: metric.field
                };

            case 'distribution':
                const distribution = data.reduce((acc, item) => {
                    const value = item[metric.field];
                    acc[value] = (acc[value] || 0) + 1;
                    return acc;
                }, {});
                return {
                    label: metric.label,
                    value: distribution,
                    type: metric.type,
                    field: metric.field
                };
        }
    }

    async prepareChartData(chart) {
        const dataContext = await this.getDataContext();
        let data = await dataContext.getData(chart.sourceId);

        switch (chart.type) {
            case 'bar':
            case 'line':
                return {
                    type: chart.type,
                    title: chart.title,
                    data: this.prepareTimeSeriesData(data, chart),
                    config: chart
                };

            case 'pie':
                return {
                    type: chart.type,
                    title: chart.title,
                    data: this.preparePieData(data, chart),
                    config: chart
                };

            case 'comparison':
                return {
                    type: chart.type,
                    title: chart.title,
                    data: this.prepareComparisonData(data, chart),
                    config: chart
                };
        }
    }

    prepareTimeSeriesData(data, chart) {
        // Group by time period if specified
        if (chart.timeField) {
            return data.reduce((acc, item) => {
                const time = new Date(item[chart.timeField]);
                const period = this.getTimePeriod(time, chart.timePeriod || 'month');
                
                const existingPeriod = acc.find(p => p.period === period);
                if (existingPeriod) {
                    existingPeriod.value += item[chart.valueField] || 0;
                } else {
                    acc.push({
                        period,
                        value: item[chart.valueField] || 0
                    });
                }
                return acc;
            }, []).sort((a, b) => new Date(a.period) - new Date(b.period));
        }

        return data;
    }

    preparePieData(data, chart) {
        return Object.entries(data.reduce((acc, item) => {
            const key = item[chart.categoryField];
            acc[key] = (acc[key] || 0) + (item[chart.valueField] || 1);
            return acc;
        }, {})).map(([name, value]) => ({ name, value }));
    }

    prepareComparisonData(data, chart) {
        return data.map(item => ({
            name: item[chart.labelField],
            value1: item[chart.field1],
            value2: item[chart.field2]
        }));
    }

    getTimePeriod(date, period) {
        switch (period) {
            case 'day':
                return date.toISOString().split('T')[0];
            case 'month':
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            case 'year':
                return date.getFullYear().toString();
            default:
                return date.toISOString().split('T')[0];
        }
    }

    renderMetric(metric) {
        const data = this.metrics.get(metric.id);
        if (!data) return '';

        let valueDisplay = data.value;
        if (typeof valueDisplay === 'number') {
            valueDisplay = data.type === 'currency' 
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(valueDisplay)
                : valueDisplay.toLocaleString();
        }

        return `
            <div class="metric-card">
                <div class="metric-label">${data.label}</div>
                <div class="metric-value">${valueDisplay}</div>
            </div>
        `;
    }

    renderChart(chartId) {
        const chartData = this.charts.get(chartId);
        if (!chartData) return '';

        return `
            <div class="chart-card">
                <h3 class="chart-title">${chartData.title}</h3>
                <div class="chart-container" id="chart-${chartId}"></div>
            </div>
        `;
    }

    setupCharts() {
        this.charts.forEach((chartData, chartId) => {
            const container = this.shadowRoot.querySelector(`#chart-${chartId}`);
            if (!container) return;

            const Chart = this.getChartComponent(chartData.type);
            if (!Chart) return;

            const chart = new Chart();
            chart.data = chartData.data;
            chart.config = chartData.config;
            container.appendChild(chart);
        });
    }

    getChartComponent(type) {
        switch (type) {
            case 'bar':
                return BarChart;
            case 'line':
                return LineChart;
            case 'pie':
                return PieChart;
            default:
                return null;
        }
    }

    render() {
        const dashboardConfig = window.app?.dataContext?.config?.dashboard;
        if (!dashboardConfig) {
            this.shadowRoot.innerHTML = `
                <div class="no-dashboard">No dashboard configuration found</div>
            `;
            return;
        }

        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            
            <div class="dashboard">
                <div class="metrics-grid">
                    ${dashboardConfig.metrics.map(metric => 
                        this.renderMetric(metric)
                    ).join('')}
                </div>

                <div class="charts-grid">
                    ${dashboardConfig.charts.map(chart => 
                        this.renderChart(chart.id)
                    ).join('')}
                </div>
            </div>
        `;

        this.setupCharts();
    }

    get styles() {
        return `
            ${this.addBaseStyles()}

            .dashboard {
                padding: var(--space-4);
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: var(--space-4);
                margin-bottom: var(--space-4);
            }

            .metric-card {
                background: white;
                padding: var(--space-4);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-sm);
            }

            .metric-label {
                font-size: 0.875rem;
                color: var(--text-muted);
                margin-bottom: var(--space-2);
            }

            .metric-value {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--text-color);
            }

            .charts-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: var(--space-4);
            }

            .chart-card {
                background: white;
                padding: var(--space-4);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-sm);
            }

            .chart-title {
                margin: 0 0 var(--space-4);
                font-size: 1rem;
                color: var(--text-color);
            }

            .chart-container {
                height: 300px;
            }

            @media (max-width: 768px) {
                .dashboard {
                    padding: var(--space-2);
                }

                .charts-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }
}

customElements.define('dashboard-component', DashboardComponent);

export default DashboardComponent;