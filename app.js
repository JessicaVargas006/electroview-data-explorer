// ============================================================================
// ElectroView - Client-Side Electronics Data Explorer
// Part 1: Core State, Utilities, Data Loading
// ============================================================================

const AppState = {
    rawRows: [], filteredRows: [], columns: [], columnTypes: {}, columnStats: {},
    filterSpec: {}, currentPage: 1, rowsPerPage: 25, currentChart: null,
    searchTerm: '', sortColumn: null, sortDirection: 'asc'
};

const SAMPLE_CSV = `ProductID,ProductName,Category,Brand,Price,Cost,Rating,Stock,UnitsSold,ReturnRate,LaunchDate
P001,iPhone 14 Pro,Phones,Apple,999,650,4.8,120,450,0.02,2022-09-16
P002,Galaxy S23 Ultra,Phones,Samsung,1199,780,4.7,85,380,0.03,2023-02-01
P003,Pixel 7 Pro,Phones,Google,899,580,4.6,95,220,0.025,2022-10-13
P004,MacBook Pro 16,Laptops,Apple,2499,1600,4.9,45,180,0.01,2021-10-26
P005,Dell XPS 15,Laptops,Dell,1899,1200,4.5,60,150,0.02,2022-05-12
P006,ThinkPad X1 Carbon,Laptops,Lenovo,1699,1100,4.6,70,190,0.015,2022-08-20
P007,AirPods Pro,Audio,Apple,249,120,4.7,200,850,0.04,2022-09-23
P008,Sony WH-1000XM5,Audio,Sony,399,220,4.8,110,320,0.02,2022-05-12
P009,Bose QC45,Audio,Bose,329,180,4.6,95,280,0.025,2021-09-23
P010,iPad Air,Tablets,Apple,599,380,4.7,140,420,0.02,2022-03-18
P011,Galaxy Tab S8,Tablets,Samsung,699,450,4.5,85,210,0.03,2022-02-25
P012,Magic Mouse,Accessories,Apple,79,35,4.3,250,520,0.05,2021-04-20
P013,Logitech MX Master 3,Accessories,Logitech,99,50,4.8,180,680,0.03,2020-06-11
P014,USB-C Hub,Accessories,Anker,45,18,4.4,320,920,0.06,2021-01-15
P015,Apple Watch Series 8,Wearables,Apple,399,240,4.7,130,380,0.02,2022-09-16
P016,Galaxy Watch 5,Wearables,Samsung,279,165,4.5,95,240,0.03,2022-08-26
P017,LG OLED TV 55,TVs,LG,1499,980,4.8,35,95,0.015,2022-03-10
P018,Samsung QLED 65,TVs,Samsung,1799,1150,4.7,28,72,0.02,2022-04-15
P019,Echo Dot,Smart Home,Amazon,49,22,4.5,400,1200,0.04,2020-10-22
P020,Google Nest Hub,Smart Home,Google,99,52,4.4,220,650,0.035,2021-05-04`;

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideIn 0.3s ease reverse'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}

function formatNumber(num, dec = 2) { return (num != null && !isNaN(num)) ? Number(num).toFixed(dec) : 'N/A'; }
function formatCurrency(num) { return (num != null && !isNaN(num)) ? '$' + Number(num).toFixed(2) : 'N/A'; }
function formatPercent(num) { return (num != null && !isNaN(num)) ? (Number(num) * 100).toFixed(1) + '%' : 'N/A'; }

function parseCSV(csvText) {
    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true, skipEmptyLines: true, transformHeader: h => h.trim(),
            complete: r => resolve(r.data), error: e => reject(e)
        });
    });
}

function inferTypes(rows) {
    const columns = Object.keys(rows[0] || {});
    const types = {}, stats = {};
    columns.forEach(col => {
        const values = rows.map(r => r[col]).filter(v => v != null && v !== '');
        const total = rows.length, nonEmpty = values.length;
        const missingPct = ((total - nonEmpty) / total) * 100;
        const unique = new Set(values).size;
        const examples = [...new Set(values)].slice(0, 3);
        
        let inferredType = 'text';
        const numericValues = values.filter(v => !isNaN(Number(v)) && isFinite(Number(v)));
        if (numericValues.length / nonEmpty > 0.8) inferredType = 'numeric';
        else if (values.some(v => dayjs(v).isValid() && v.match(/\d{4}/))) {
            if (values.filter(v => dayjs(v).isValid()).length / nonEmpty > 0.8) inferredType = 'date';
        } else if (unique <= Math.min(50, 0.2 * nonEmpty) && unique > 0) inferredType = 'categorical';
        
        types[col] = inferredType;
        stats[col] = { missing: missingPct, unique, examples };
    });
    return { types, stats };
}

function addComputedColumns(rows) {
    const hasPrice = rows[0]?.hasOwnProperty('Price');
    const hasCost = rows[0]?.hasOwnProperty('Cost');
    const hasUnitsSold = rows[0]?.hasOwnProperty('UnitsSold');
    return rows.map(row => {
        const newRow = { ...row };
        if (hasPrice && hasCost) {
            const price = Number(row.Price), cost = Number(row.Cost);
            if (!isNaN(price) && !isNaN(cost) && price > 0) newRow.Margin = (price - cost) / price;
        }
        if (hasPrice && hasUnitsSold) {
            const price = Number(row.Price), units = Number(row.UnitsSold);
            if (!isNaN(price) && !isNaN(units)) newRow.Revenue = price * units;
        }
        return newRow;
    });
}

async function loadData(csvText) {
    try {
        const loadBtn = document.getElementById('load-data');
        loadBtn.querySelector('.btn-text').classList.add('hidden');
        loadBtn.querySelector('.loader-dots').classList.remove('hidden');
        loadBtn.disabled = true;
        
        let rows = await parseCSV(csvText);
        if (rows.length === 0) throw new Error('No data found');
        if (rows.length > 50000 && confirm(`Dataset has ${rows.length} rows. Sample to 50,000?`)) {
            rows = rows.sort(() => Math.random() - 0.5).slice(0, 50000);
        }
        
        rows = addComputedColumns(rows);
        const { types, stats } = inferTypes(rows);
        
        AppState.rawRows = rows;
        AppState.filteredRows = rows;
        AppState.columns = Object.keys(rows[0]);
        AppState.columnTypes = types;
        AppState.columnStats = stats;
        AppState.currentPage = 1;
        
        renderAll();
        document.getElementById('overview-section').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        
        loadBtn.querySelector('.btn-text').classList.remove('hidden');
        loadBtn.querySelector('.loader-dots').classList.add('hidden');
        loadBtn.disabled = false;
        showToast('✓ Data loaded successfully!');
    } catch (error) {
        showToast('✗ Error: ' + error.message, 'error');
        const loadBtn = document.getElementById('load-data');
        loadBtn.querySelector('.btn-text').classList.remove('hidden');
        loadBtn.querySelector('.loader-dots').classList.add('hidden');
        loadBtn.disabled = false;
    }
}

function renderAll() {
    renderOverview();
    renderDataDictionary();
    renderFilters();
    renderChart();
    renderTable();
}

function renderOverview() {
    const rows = AppState.rawRows, cols = AppState.columns;
    document.getElementById('chip-rows').textContent = rows.length.toLocaleString();
    document.getElementById('chip-columns').textContent = cols.length;
    const avgMissing = Object.values(AppState.columnStats).reduce((s, st) => s + st.missing, 0) / cols.length;
    document.getElementById('chip-missing').textContent = avgMissing.toFixed(1) + '%';
    const sizeKB = JSON.stringify(rows).length / 1024, sizeMB = sizeKB / 1024;
    document.getElementById('chip-size').textContent = sizeMB > 1 ? sizeMB.toFixed(2) + ' MB' : sizeKB.toFixed(2) + ' KB';
    
    const hasPrice = cols.includes('Price'), hasCost = cols.includes('Cost');
    const hasRating = cols.includes('Rating'), hasMargin = cols.includes('Margin');
    if (hasPrice || hasCost || hasRating || hasMargin) {
        document.getElementById('kpi-section').classList.remove('hidden');
        if (hasPrice) {
            const prices = rows.map(r => Number(r.Price)).filter(v => !isNaN(v));
            document.getElementById('kpi-price').textContent = formatCurrency(prices.reduce((a, b) => a + b, 0) / prices.length);
        }
        if (hasCost) {
            const costs = rows.map(r => Number(r.Cost)).filter(v => !isNaN(v));
            document.getElementById('kpi-cost').textContent = formatCurrency(costs.reduce((a, b) => a + b, 0) / costs.length);
        }
        if (hasMargin) {
            const margins = rows.map(r => Number(r.Margin)).filter(v => !isNaN(v));
            document.getElementById('kpi-margin').textContent = formatPercent(margins.reduce((a, b) => a + b, 0) / margins.length);
        }
        if (hasRating) {
            const ratings = rows.map(r => Number(r.Rating)).filter(v => !isNaN(v));
            document.getElementById('kpi-rating').textContent = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
        }
    }
}

function renderDataDictionary() {
    const tbody = document.querySelector('#dictionary-table tbody');
    tbody.innerHTML = AppState.columns.map(col => {
        const type = AppState.columnTypes[col], stats = AppState.columnStats[col];
        return `<tr><td><strong>${col}</strong></td><td><span class="filter-type-badge">${type}</span></td>
                <td>${stats.missing.toFixed(1)}%</td><td>${stats.unique}</td><td>${stats.examples.join(', ')}</td></tr>`;
    }).join('');
}

// ============================================================================
// FILTERS
// ============================================================================

function renderFilters() {
    const container = document.getElementById('filters-container');
    container.innerHTML = '';
    
    AppState.columns.forEach(col => {
        const type = AppState.columnTypes[col];
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        filterGroup.innerHTML = `<div class="filter-label">${col} <span class="filter-type-badge">${type}</span></div>`;
        
        if (type === 'categorical') {
            const select = document.createElement('select');
            select.className = 'filter-select';
            select.multiple = true;
            select.size = 4;
            
            const values = [...new Set(AppState.rawRows.map(r => r[col]).filter(Boolean))];
            const counts = {};
            values.forEach(v => counts[v] = AppState.rawRows.filter(r => r[col] === v).length);
            
            Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50).forEach(([v, c]) => {
                select.innerHTML += `<option value="${v}">${v} (${c})</option>`;
            });
            
            select.addEventListener('change', () => {
                const selected = Array.from(select.selectedOptions).map(o => o.value);
                if (selected.length > 0) AppState.filterSpec[col] = { type: 'categorical', values: selected };
                else delete AppState.filterSpec[col];
                applyFilters();
            });
            filterGroup.appendChild(select);
            
        } else if (type === 'numeric') {
            const values = AppState.rawRows.map(r => Number(r[col])).filter(v => !isNaN(v));
            const min = Math.min(...values), max = Math.max(...values);
            const rangeDiv = document.createElement('div');
            rangeDiv.className = 'filter-range';
            rangeDiv.innerHTML = `
                <input type="number" class="filter-input" placeholder="Min: ${min.toFixed(2)}" step="any" data-col="${col}" data-bound="min">
                <input type="number" class="filter-input" placeholder="Max: ${max.toFixed(2)}" step="any" data-col="${col}" data-bound="max">
            `;
            
            rangeDiv.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', debounce(() => {
                    const minInput = rangeDiv.querySelector('[data-bound="min"]');
                    const maxInput = rangeDiv.querySelector('[data-bound="max"]');
                    const minVal = minInput.value ? Number(minInput.value) : min;
                    const maxVal = maxInput.value ? Number(maxInput.value) : max;
                    
                    if (minInput.value || maxInput.value) {
                        AppState.filterSpec[col] = { type: 'numeric', min: minVal, max: maxVal };
                    } else delete AppState.filterSpec[col];
                    applyFilters();
                }, 500));
            });
            filterGroup.appendChild(rangeDiv);
            
        } else if (type === 'date') {
            const rangeDiv = document.createElement('div');
            rangeDiv.className = 'filter-range';
            rangeDiv.innerHTML = `
                <input type="date" class="filter-input" data-col="${col}" data-bound="from">
                <input type="date" class="filter-input" data-col="${col}" data-bound="to">
            `;
            
            rangeDiv.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', () => {
                    const fromInput = rangeDiv.querySelector('[data-bound="from"]');
                    const toInput = rangeDiv.querySelector('[data-bound="to"]');
                    if (fromInput.value || toInput.value) {
                        AppState.filterSpec[col] = { 
                            type: 'date', 
                            from: fromInput.value || '1900-01-01', 
                            to: toInput.value || '2100-12-31' 
                        };
                    } else delete AppState.filterSpec[col];
                    applyFilters();
                });
            });
            filterGroup.appendChild(rangeDiv);
            
        } else if (type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'filter-input';
            input.placeholder = 'Contains...';
            input.addEventListener('input', debounce(() => {
                if (input.value) AppState.filterSpec[col] = { type: 'text', value: input.value };
                else delete AppState.filterSpec[col];
                applyFilters();
            }, 500));
            filterGroup.appendChild(input);
        }
        
        container.appendChild(filterGroup);
    });
}

function applyFilters() {
    let filtered = [...AppState.rawRows];
    
    Object.entries(AppState.filterSpec).forEach(([col, spec]) => {
        if (spec.type === 'categorical') {
            filtered = filtered.filter(row => spec.values.includes(row[col]));
        } else if (spec.type === 'numeric') {
            filtered = filtered.filter(row => {
                const val = Number(row[col]);
                return !isNaN(val) && val >= spec.min && val <= spec.max;
            });
        } else if (spec.type === 'date') {
            filtered = filtered.filter(row => {
                const date = dayjs(row[col]);
                return date.isValid() && date.isAfter(dayjs(spec.from).subtract(1, 'day')) && date.isBefore(dayjs(spec.to).add(1, 'day'));
            });
        } else if (spec.type === 'text') {
            filtered = filtered.filter(row => String(row[col] || '').toLowerCase().includes(spec.value.toLowerCase()));
        }
    });
    
    AppState.filteredRows = filtered;
    AppState.currentPage = 1;
    renderChart();
    renderTable();
}

// ============================================================================
// CHARTS
// ============================================================================

function renderChart() {
    const chartType = document.getElementById('chart-type').value;
    if (AppState.currentChart) { AppState.currentChart.destroy(); AppState.currentChart = null; }
    
    document.getElementById('main-chart').classList.remove('hidden');
    document.getElementById('heatmap-canvas').classList.add('hidden');
    document.getElementById('chart-empty-state').classList.add('hidden');
    
    if (chartType === 'histogram') renderHistogram();
    else if (chartType === 'bar') renderBarChart();
    else if (chartType === 'scatter') renderScatterPlot();
    else if (chartType === 'box') renderBoxPlot();
    else if (chartType === 'heatmap') renderHeatmap();
    
    updateChartControls(chartType);
}

function updateChartControls(chartType) {
    const optionsDiv = document.getElementById('chart-options');
    const numericCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'numeric');
    const categoricalCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'categorical');
    
    if (chartType === 'histogram' && numericCols.length > 0) {
        optionsDiv.innerHTML = `
            <div class="chart-option-group">
                <label class="chart-option-label">Column</label>
                <select id="hist-column" class="select">${numericCols.map(c => `<option value="${c}" ${c === 'Price' ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="chart-option-group">
                <label class="chart-option-label">Bins</label>
                <input type="number" id="hist-bins" class="input" value="30" min="10" max="50" style="width:80px;">
            </div>
        `;
        optionsDiv.querySelector('#hist-column').addEventListener('change', renderChart);
        optionsDiv.querySelector('#hist-bins').addEventListener('change', renderChart);
    } else if (chartType === 'bar' && categoricalCols.length > 0) {
        optionsDiv.innerHTML = `
            <div class="chart-option-group">
                <label class="chart-option-label">Column</label>
                <select id="bar-column" class="select">${categoricalCols.map(c => `<option value="${c}" ${c === 'Category' ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="chart-option-group">
                <label class="chart-option-label">Top K</label>
                <input type="number" id="bar-topk" class="input" value="10" min="5" max="50" style="width:80px;">
            </div>
        `;
        optionsDiv.querySelector('#bar-column').addEventListener('change', renderChart);
        optionsDiv.querySelector('#bar-topk').addEventListener('change', renderChart);
    } else if (chartType === 'scatter' && numericCols.length >= 2) {
        optionsDiv.innerHTML = `
            <div class="chart-option-group">
                <label class="chart-option-label">X</label>
                <select id="scatter-x" class="select">${numericCols.map(c => `<option value="${c}" ${c === 'Price' ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="chart-option-group">
                <label class="chart-option-label">Y</label>
                <select id="scatter-y" class="select">${numericCols.map(c => `<option value="${c}" ${c === 'UnitsSold' ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="chart-option-group">
                <label class="chart-option-label">Color</label>
                <select id="scatter-color" class="select"><option value="">None</option>${categoricalCols.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
            </div>
        `;
        optionsDiv.querySelectorAll('select').forEach(sel => sel.addEventListener('change', renderChart));
    } else if (chartType === 'box' && numericCols.length > 0) {
        optionsDiv.innerHTML = `
            <div class="chart-option-group">
                <label class="chart-option-label">Numeric</label>
                <select id="box-numeric" class="select">${numericCols.map(c => `<option value="${c}" ${c === 'Price' ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="chart-option-group">
                <label class="chart-option-label">Group By</label>
                <select id="box-category" class="select"><option value="">None</option>${categoricalCols.map(c => `<option value="${c}" ${c === 'Category' ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
        `;
        optionsDiv.querySelectorAll('select').forEach(sel => sel.addEventListener('change', renderChart));
    } else {
        optionsDiv.innerHTML = '';
    }
}

function renderHistogram() {
    const numericCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'numeric');
    if (numericCols.length === 0) {
        document.getElementById('chart-empty-state').classList.remove('hidden');
        return;
    }
    
    const col = document.getElementById('hist-column')?.value || numericCols.includes('Price') ? 'Price' : numericCols[0];
    const bins = parseInt(document.getElementById('hist-bins')?.value || 30);
    
    const values = AppState.filteredRows.map(r => Number(r[col])).filter(v => !isNaN(v));
    const min = Math.min(...values), max = Math.max(...values);
    const binSize = (max - min) / bins;
    
    const histogram = Array(bins).fill(0);
    values.forEach(v => {
        const binIndex = Math.min(Math.floor((v - min) / binSize), bins - 1);
        histogram[binIndex]++;
    });
    
    const labels = Array(bins).fill(0).map((_, i) => (min + i * binSize).toFixed(2));
    
    const ctx = document.getElementById('main-chart').getContext('2d');
    AppState.currentChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: col, data: histogram, backgroundColor: 'rgba(99, 102, 241, 0.7)' }] },
        options: { responsive: true, plugins: { title: { display: true, text: `Histogram of ${col}` } } }
    });
}

function renderBarChart() {
    const categoricalCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'categorical');
    if (categoricalCols.length === 0) {
        document.getElementById('chart-empty-state').classList.remove('hidden');
        return;
    }
    
    const col = document.getElementById('bar-column')?.value || categoricalCols.includes('Category') ? 'Category' : categoricalCols[0];
    const topK = parseInt(document.getElementById('bar-topk')?.value || 10);
    
    const counts = {};
    AppState.filteredRows.forEach(r => counts[r[col]] = (counts[r[col]] || 0) + 1);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topK);
    
    const ctx = document.getElementById('main-chart').getContext('2d');
    AppState.currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(s => s[0]),
            datasets: [{ label: 'Count', data: sorted.map(s => s[1]), backgroundColor: 'rgba(99, 102, 241, 0.7)' }]
        },
        options: { responsive: true, plugins: { title: { display: true, text: `Top ${topK} ${col}` } } }
    });
}

function renderScatterPlot() {
    const numericCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'numeric');
    if (numericCols.length < 2) {
        document.getElementById('chart-empty-state').classList.remove('hidden');
        return;
    }
    
    const xCol = document.getElementById('scatter-x')?.value || 'Price';
    const yCol = document.getElementById('scatter-y')?.value || 'UnitsSold';
    const colorCol = document.getElementById('scatter-color')?.value || '';
    
    let datasets = [];
    if (colorCol) {
        const groups = {};
        AppState.filteredRows.forEach(r => {
            const group = r[colorCol] || 'Unknown';
            if (!groups[group]) groups[group] = [];
            groups[group].push({ x: Number(r[xCol]), y: Number(r[yCol]) });
        });
        
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        Object.entries(groups).forEach(([group, data], i) => {
            datasets.push({
                label: group,
                data: data.filter(d => !isNaN(d.x) && !isNaN(d.y)),
                backgroundColor: colors[i % colors.length]
            });
        });
    } else {
        const data = AppState.filteredRows.map(r => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
            .filter(d => !isNaN(d.x) && !isNaN(d.y));
        datasets.push({ label: `${yCol} vs ${xCol}`, data, backgroundColor: 'rgba(99, 102, 241, 0.7)' });
    }
    
    const ctx = document.getElementById('main-chart').getContext('2d');
    AppState.currentChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: `${yCol} vs ${xCol}` } },
            scales: { x: { title: { display: true, text: xCol } }, y: { title: { display: true, text: yCol } } }
        }
    });
}

function renderBoxPlot() {
    const numericCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'numeric');
    if (numericCols.length === 0) {
        document.getElementById('chart-empty-state').classList.remove('hidden');
        return;
    }
    
    const numCol = document.getElementById('box-numeric')?.value || 'Price';
    const catCol = document.getElementById('box-category')?.value || '';
    
    if (catCol) {
        const groups = {};
        AppState.filteredRows.forEach(r => {
            const group = r[catCol] || 'Unknown';
            if (!groups[group]) groups[group] = [];
            const val = Number(r[numCol]);
            if (!isNaN(val)) groups[group].push(val);
        });
        
        const labels = Object.keys(groups).slice(0, 20);
        const data = labels.map(label => {
            const sorted = groups[label].sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const median = sorted[Math.floor(sorted.length * 0.5)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            return { min: sorted[0], q1, median, q3, max: sorted[sorted.length - 1] };
        });
        
        const ctx = document.getElementById('main-chart').getContext('2d');
        AppState.currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: numCol, data: data.map(d => d.median), backgroundColor: 'rgba(99, 102, 241, 0.7)' }]
            },
            options: { responsive: true, plugins: { title: { display: true, text: `${numCol} by ${catCol}` } } }
        });
    } else {
        const values = AppState.filteredRows.map(r => Number(r[numCol])).filter(v => !isNaN(v)).sort((a, b) => a - b);
        const q1 = values[Math.floor(values.length * 0.25)];
        const median = values[Math.floor(values.length * 0.5)];
        const q3 = values[Math.floor(values.length * 0.75)];
        
        const ctx = document.getElementById('main-chart').getContext('2d');
        AppState.currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Min', 'Q1', 'Median', 'Q3', 'Max'],
                datasets: [{ label: numCol, data: [values[0], q1, median, q3, values[values.length - 1]], backgroundColor: 'rgba(99, 102, 241, 0.7)' }]
            },
            options: { responsive: true, plugins: { title: { display: true, text: `Distribution of ${numCol}` } } }
        });
    }
}

function renderHeatmap() {
    const numericCols = AppState.columns.filter(c => AppState.columnTypes[c] === 'numeric');
    if (numericCols.length < 2) {
        document.getElementById('chart-empty-state').classList.remove('hidden');
        return;
    }
    
    document.getElementById('main-chart').classList.add('hidden');
    const heatmapDiv = document.getElementById('heatmap-canvas');
    heatmapDiv.classList.remove('hidden');
    
    const corr = {};
    numericCols.forEach(col1 => {
        corr[col1] = {};
        numericCols.forEach(col2 => {
            const vals1 = AppState.filteredRows.map(r => Number(r[col1])).filter(v => !isNaN(v));
            const vals2 = AppState.filteredRows.map(r => Number(r[col2])).filter(v => !isNaN(v));
            
            if (vals1.length !== vals2.length) { corr[col1][col2] = 0; return; }
            
            const mean1 = vals1.reduce((a, b) => a + b, 0) / vals1.length;
            const mean2 = vals2.reduce((a, b) => a + b, 0) / vals2.length;
            
            let num = 0, den1 = 0, den2 = 0;
            for (let i = 0; i < vals1.length; i++) {
                num += (vals1[i] - mean1) * (vals2[i] - mean2);
                den1 += (vals1[i] - mean1) ** 2;
                den2 += (vals2[i] - mean2) ** 2;
            }
            
            corr[col1][col2] = den1 && den2 ? num / Math.sqrt(den1 * den2) : 0;
        });
    });
    
    let html = '<table class="table" style="font-size:0.8rem;"><thead><tr><th></th>';
    numericCols.forEach(col => html += `<th>${col}</th>`);
    html += '</tr></thead><tbody>';
    
    numericCols.forEach(col1 => {
        html += `<tr><td><strong>${col1}</strong></td>`;
        numericCols.forEach(col2 => {
            const val = corr[col1][col2];
            const color = val > 0 ? `rgba(99, 102, 241, ${Math.abs(val)})` : `rgba(239, 68, 68, ${Math.abs(val)})`;
            html += `<td style="background:${color};color:#fff;">${val.toFixed(2)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    
    heatmapDiv.innerHTML = html;
}

// ============================================================================
// DATA TABLE
// ============================================================================

function renderTable() {
    const rows = AppState.filteredRows;
    const searchTerm = AppState.searchTerm.toLowerCase();
    
    let displayRows = searchTerm ? rows.filter(r => 
        Object.values(r).some(v => String(v).toLowerCase().includes(searchTerm))
    ) : rows;
    
    if (AppState.sortColumn) {
        displayRows.sort((a, b) => {
            const valA = a[AppState.sortColumn];
            const valB = b[AppState.sortColumn];
            const numA = Number(valA), numB = Number(valB);
            
            let cmp = 0;
            if (!isNaN(numA) && !isNaN(numB)) cmp = numA - numB;
            else cmp = String(valA).localeCompare(String(valB));
            
            return AppState.sortDirection === 'asc' ? cmp : -cmp;
        });
    }
    
    const totalPages = Math.ceil(displayRows.length / AppState.rowsPerPage);
    const start = (AppState.currentPage - 1) * AppState.rowsPerPage;
    const end = start + AppState.rowsPerPage;
    const pageRows = displayRows.slice(start, end);
    
    document.getElementById('table-count').textContent = `Showing ${displayRows.length.toLocaleString()} rows`;
    document.getElementById('page-info').textContent = `Page ${AppState.currentPage} of ${totalPages}`;
    document.getElementById('prev-page').disabled = AppState.currentPage === 1;
    document.getElementById('next-page').disabled = AppState.currentPage === totalPages;
    
    const thead = document.getElementById('table-head');
    thead.innerHTML = '<tr>' + AppState.columns.map(col => 
        `<th data-col="${col}">${col} ${AppState.sortColumn === col ? (AppState.sortDirection === 'asc' ? '▲' : '▼') : ''}</th>`
    ).join('') + '</tr>';
    
    thead.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (AppState.sortColumn === col) {
                AppState.sortDirection = AppState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                AppState.sortColumn = col;
                AppState.sortDirection = 'asc';
            }
            renderTable();
        });
    });
    
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = pageRows.map(row => 
        '<tr>' + AppState.columns.map(col => `<td>${row[col] ?? ''}</td>`).join('') + '</tr>'
    ).join('');
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

document.getElementById('theme-toggle').addEventListener('click', () => {
    const body = document.body;
    const icon = document.querySelector('.theme-icon');
    if (body.classList.contains('theme-dark')) {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        icon.textContent = '☀️';
    } else {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        icon.textContent = '🌙';
    }
});

document.getElementById('reset-app').addEventListener('click', () => {
    if (confirm('Reset the entire app?')) {
        location.reload();
    }
});

document.getElementById('csv-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('csv-paste').value = e.target.result;
        reader.readAsText(file);
    }
});

document.getElementById('use-pasted').addEventListener('click', () => {
    const csvText = document.getElementById('csv-paste').value;
    if (csvText.trim()) loadData(csvText);
    else showToast('Please paste CSV data first', 'warning');
});

document.getElementById('load-sample').addEventListener('click', () => {
    document.getElementById('csv-paste').value = SAMPLE_CSV;
    loadData(SAMPLE_CSV);
});

document.getElementById('load-data').addEventListener('click', () => {
    const csvText = document.getElementById('csv-paste').value;
    if (csvText.trim()) loadData(csvText);
    else showToast('Please upload or paste CSV data', 'warning');
});

document.getElementById('reset-filters').addEventListener('click', () => {
    AppState.filterSpec = {};
    AppState.filteredRows = AppState.rawRows;
    AppState.currentPage = 1;
    renderFilters();
    renderChart();
    renderTable();
});

document.getElementById('chart-type').addEventListener('change', renderChart);

document.getElementById('download-chart').addEventListener('click', () => {
    if (AppState.currentChart) {
        const url = AppState.currentChart.toBase64Image();
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chart.png';
        a.click();
        showToast('Chart downloaded!');
    } else {
        showToast('No chart to download', 'warning');
    }
});

document.getElementById('download-csv').addEventListener('click', () => {
    const csv = Papa.unparse(AppState.filteredRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_data.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded!');
});

document.getElementById('table-search').addEventListener('input', debounce((e) => {
    AppState.searchTerm = e.target.value;
    AppState.currentPage = 1;
    renderTable();
}, 500));

document.getElementById('prev-page').addEventListener('click', () => {
    if (AppState.currentPage > 1) {
        AppState.currentPage--;
        renderTable();
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(AppState.filteredRows.length / AppState.rowsPerPage);
    if (AppState.currentPage < totalPages) {
        AppState.currentPage++;
        renderTable();
    }
});

// Auto-load sample data on startup
window.addEventListener('DOMContentLoaded', () => {
    console.log('ElectroView initialized. Load data to begin.');
});
