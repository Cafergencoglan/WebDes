// ============================================
// GREENHOUSE CALCULATOR - MAIN JAVASCRIPT
// ============================================

// Material properties database
const materials = {
    steel: {
        name: 'Steel',
        yieldStrength: 250,    // MPa
        density: 7850,          // kg/m3
        costPerKg: 0.8,         // USD/kg
        elasticModulus: 200     // GPa
    },
    aluminum: {
        name: 'Aluminum',
        yieldStrength: 240,
        density: 2700,
        costPerKg: 1.5,
        elasticModulus: 70
    },
    wood: {
        name: 'Wood',
        yieldStrength: 10,
        density: 500,
        costPerKg: 0.5,
        elasticModulus: 10
    }
};

// Global results storage
let designResults = null;
let charts = {};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initializeCharts();
});

function setupEventListeners() {
    // Form submission
    const form = document.getElementById('designForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        performCalculation();
    });

    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Real-time validation
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', validateInput);
    });
}

function validateInput(event) {
    const input = event.target;
    const value = parseFloat(input.value);

    if (isNaN(value) || value <= 0) {
        input.style.borderColor = '#D32F2F';
    } else {
        input.style.borderColor = '#E0E0E0';
    }
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

function performCalculation() {
    // Get input values
    const length = parseFloat(document.getElementById('length').value);
    const width = parseFloat(document.getElementById('width').value);
    const liveLoad = parseFloat(document.getElementById('liveLoad').value);
    const snowLoad = parseFloat(document.getElementById('snowLoad').value);
    const windSpeed = parseFloat(document.getElementById('windSpeed').value);
    const materialType = document.getElementById('material').value;

    // Validate inputs
    if (!validateInputs(length, width, liveLoad, snowLoad, windSpeed)) {
        alert('Please enter valid positive values for all fields.');
        return;
    }

    // Get selected material
    const material = materials[materialType];

    // Perform calculations
    designResults = {
        input: {
            length, width, liveLoad, snowLoad, windSpeed,
            material: material.name
        },
        ...calculateLoads(length, width, liveLoad, snowLoad, windSpeed),
        ...designMaterials(length, width, liveLoad, snowLoad, windSpeed, material),
        ...calculateStresses(length, liveLoad, snowLoad, material),
        ...calculateDeflection(length, liveLoad, snowLoad, material),
        ...estimateCost(material)
    };

    // Display results
    displayResults();
    showResultsPanel();
    updateCharts();
}

// ============================================
// LOAD CALCULATIONS
// ============================================

function calculateLoads(length, width, liveLoad, snowLoad, windSpeed) {
    // Dead load estimation (15% of total design load)
    const totalDesignLoad = liveLoad + snowLoad;
    const deadLoad = totalDesignLoad * 0.15;

    // Convert to kN (1 kg = 0.00981 kN)
    const liveLoadKN = liveLoad * 0.00981;
    const snowLoadKN = snowLoad * 0.00981;
    const deadLoadKN = deadLoad * 0.00981;

    // Apply load factors (Eurocode)
    const totalVerticalLoad = (deadLoadKN * 1.2) + (liveLoadKN * 1.6) + (snowLoadKN * 1.2);

    // Wind load calculation (Eurocode 1)
    const windPressure = 0.5 * 1.225 * Math.pow(windSpeed, 2) / 1000; // kN/m2
    const exposureFactor = 1.3;  // Terrain category II
    const shapeCoefficient = 1.3; // For greenhouses
    const effectiveArea = length * width / 1000;
    const windLoad = windPressure * exposureFactor * shapeCoefficient * effectiveArea;

    // Combined load case (most critical)
    const combinedLoad = Math.max(totalVerticalLoad, windLoad * 1.5);

    return {
        loads: {
            deadLoad: parseFloat(deadLoad.toFixed(2)),
            totalVerticalLoad: parseFloat(totalVerticalLoad.toFixed(2)),
            windLoad: parseFloat(windLoad.toFixed(2)),
            combinedLoad: parseFloat(combinedLoad.toFixed(2))
        }
    };
}

// ============================================
// MATERIAL DIMENSION DESIGN
// ============================================

function designMaterials(length, width, liveLoad, snowLoad, windSpeed, material) {
    // Moment calculation: M = (w * L^2) / 8
    const distributedLoad = ((liveLoad + snowLoad) * 0.00981 * 1.6 + 
                            (liveLoad + snowLoad) * 0.15 * 0.00981 * 1.2) / length;
    const momentKNm = (distributedLoad * Math.pow(length, 2)) / 8;
    const momentNmm = momentKNm * 1e6;

    // Safety factor and allowable stress
    const safetyFactor = 2.0;
    const allowableStress = material.yieldStrength / safetyFactor;

    // Required section modulus
    const requiredZ = momentNmm / allowableStress;

    // Calculate beam dimensions (assuming h = 2*b for optimal design)
    let b = Math.pow((requiredZ * 6) / 2, 1/3);
    const beamWidth = Math.ceil(b / 10) * 10;  // Round to 10mm
    const beamHeight = Math.ceil(2 * b / 10) * 10;

    // Column diameter (circular section)
    const compressionStress = (liveLoad + snowLoad) * 0.00981 * 1.6 / (length / 10);
    const requiredArea = (compressionStress * 1000) / allowableStress;
    const columnDiameter = Math.ceil(Math.sqrt(4 * requiredArea / Math.PI) / 10) * 10;

    // Foundation depth (standard 0.8m below frost line)
    const foundationDepth = 800;

    return {
        dimensions: {
            beamWidth: Math.round(beamWidth),
            beamHeight: Math.round(beamHeight),
            columnDiameter: Math.round(columnDiameter),
            foundationDepth: Math.round(foundationDepth)
        },
        safety: {
            safetyFactor: parseFloat(safetyFactor.toFixed(2)),
            allowableStress: parseFloat(allowableStress.toFixed(1))
        }
    };
}

// ============================================
// STRESS ANALYSIS
// ============================================

function calculateStresses(length, liveLoad, snowLoad, material) {
    const distributedLoad = ((liveLoad + snowLoad) * 0.00981 * 1.6 + 
                            (liveLoad + snowLoad) * 0.15 * 0.00981 * 1.2) / length;
    const momentKNm = (distributedLoad * Math.pow(length, 2)) / 8;
    const momentNmm = momentKNm * 1e6;

    const safetyFactor = 2.0;
    const allowableStress = material.yieldStrength / safetyFactor;

    // For rectangular beam: I = (b * h^4) / 12
    const requiredZ = momentNmm / allowableStress;
    let b = Math.pow((requiredZ * 6) / 2, 1/3);
    const beamWidth = Math.ceil(b / 10) * 10;
    const beamHeight = Math.ceil(2 * b / 10) * 10;

    const Ix = (beamWidth * Math.pow(beamHeight, 3)) / 12;
    const y = beamHeight / 2;
    const maxStress = (momentNmm * y) / Ix;
    const stressRatio = maxStress / allowableStress;

    return {
        stress: {
            maxStress: parseFloat(maxStress.toFixed(1)),
            allowableStress: parseFloat(allowableStress.toFixed(1)),
            stressRatio: parseFloat(stressRatio.toFixed(2))
        }
    };
}

// ============================================
// FEM & DEFLECTION ANALYSIS
// ============================================

function calculateDeflection(length, liveLoad, snowLoad, material) {
    const distributedLoad = ((liveLoad + snowLoad) * 0.00981 * 1.6 + 
                            (liveLoad + snowLoad) * 0.15 * 0.00981 * 1.2) / length;

    // Get design dimensions
    const momentKNm = (distributedLoad * Math.pow(length, 2)) / 8;
    const momentNmm = momentKNm * 1e6;
    const safetyFactor = 2.0;
    const allowableStress = material.yieldStrength / safetyFactor;
    const requiredZ = momentNmm / allowableStress;

    let b = Math.pow((requiredZ * 6) / 2, 1/3);
    const beamWidth = Math.ceil(b / 10) * 10;
    const beamHeight = Math.ceil(2 * b / 10) * 10;

    // Maximum deflection for simply supported beam: δ = (5 * w * L^4) / (384 * E * I)
    const w = distributedLoad; // kN/m
    const E = material.elasticModulus * 1e9; // Pa
    const Ix = (beamWidth * Math.pow(beamHeight, 3)) / 12 / 1e12; // Convert to m^4

    const deflectionM = (5 * w * 1000 * Math.pow(length, 4)) / (384 * E * Ix);
    const maxDeflection = deflectionM * 1000; // Convert to mm
    const deflectionLimit = (length * 1000) / 250; // L/250

    // FEM stress estimate
    const maxStress = (momentNmm * (beamHeight / 2)) / ((beamWidth * Math.pow(beamHeight, 3)) / 12);
    const maxStressFEM = maxStress * 0.95;
    const minSafetyFactor = allowableStress / maxStressFEM;

    return {
        fem: {
            maxDeflection: parseFloat(maxDeflection.toFixed(2)),
            maxStress: parseFloat(maxStressFEM.toFixed(1)),
            minSafetyFactor: parseFloat(minSafetyFactor.toFixed(2)),
            deflectionLimit: parseFloat(deflectionLimit.toFixed(2))
        }
    };
}

// ============================================
// COST ESTIMATION
// ============================================

function estimateCost(material) {
    const results = designResults;
    
    // Material weight calculation
    const beamVolume = (results.dimensions.beamWidth * results.dimensions.beamHeight * 
                       results.input.length) / 1e9; // m3
    const columnVolume = (Math.PI * Math.pow(results.dimensions.columnDiameter, 2) * 
                         results.input.length / 4) / 1e9; // m3

    const totalVolume = beamVolume + columnVolume * 4; // 4 main columns
    const totalWeight = totalVolume * material.density;

    // Material cost
    const materialCost = totalWeight * material.costPerKg;

    // Labor cost
    const laborCost = results.input.length * 0.3 * 50;

    // Additional costs (foundation, fasteners, misc) - 20%
    const additionalCost = (materialCost + laborCost) * 0.2;
    const totalCost = materialCost + laborCost + additionalCost;

    return {
        cost: {
            materialCost: parseFloat(materialCost.toFixed(2)),
            laborCost: parseFloat(laborCost.toFixed(2)),
            additionalCost: parseFloat(additionalCost.toFixed(2)),
            totalCost: parseFloat(totalCost.toFixed(2))
        }
    };
}

// ============================================
// RESULT DISPLAY
// ============================================

function displayResults() {
    if (!designResults) return;

    // Load Analysis
    document.getElementById('deadLoad').textContent = designResults.loads.deadLoad.toFixed(1);
    document.getElementById('totalVerticalLoad').textContent = designResults.loads.totalVerticalLoad.toFixed(2);
    document.getElementById('windLoad').textContent = designResults.loads.windLoad.toFixed(2);
    document.getElementById('combinedLoad').textContent = designResults.loads.combinedLoad.toFixed(2);

    // Dimensions
    document.getElementById('beamWidth').textContent = designResults.dimensions.beamWidth;
    document.getElementById('beamHeight').textContent = designResults.dimensions.beamHeight;
    document.getElementById('columnDiameter').textContent = designResults.dimensions.columnDiameter;
    document.getElementById('foundationDepth').textContent = designResults.dimensions.foundationDepth;

    // Safety
    document.getElementById('safetyFactor').textContent = designResults.safety.safetyFactor.toFixed(2);
    document.getElementById('maxStress').textContent = designResults.stress.maxStress.toFixed(1);
    document.getElementById('allowableStress').textContent = designResults.stress.allowableStress.toFixed(1);
    document.getElementById('stressRatio').textContent = designResults.stress.stressRatio.toFixed(2);

    // FEM Results
    document.getElementById('maxDeflection').textContent = designResults.fem.maxDeflection.toFixed(2);
    document.getElementById('maxStressFEM').textContent = designResults.fem.maxStress.toFixed(1);
    document.getElementById('minSafetyFactor').textContent = designResults.fem.minSafetyFactor.toFixed(2);
    document.getElementById('deflectionLimit').textContent = designResults.fem.deflectionLimit.toFixed(2);

    // Cost
    document.getElementById('materialCost').textContent = '$' + designResults.cost.materialCost.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('laborCost').textContent = '$' + designResults.cost.laborCost.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('additionalCost').textContent = '$' + designResults.cost.additionalCost.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('totalCost').textContent = '$' + designResults.cost.totalCost.toLocaleString('en-US', {minimumFractionDigits: 2});

    // Status badge
    updateStatusBadge();

    // Compliance message
    updateComplianceMessage();
}

function updateStatusBadge() {
    const badge = document.getElementById('statusBadge');
    const stressRatio = designResults.stress.stressRatio;
    const deflection = designResults.fem.maxDeflection;
    const deflectionLimit = designResults.fem.deflectionLimit;

    let status = 'SAFE';
    let statusClass = 'safe';

    if (stressRatio > 0.9 || deflection > deflectionLimit) {
        status = '⚠️ REVIEW REQUIRED';
        statusClass = 'warning';
    }

    if (stressRatio > 1.0) {
        status = '❌ DESIGN FAILURE';
        statusClass = 'danger';
    }

    badge.textContent = status;
    badge.className = 'status-badge ' + statusClass;
}

function updateComplianceMessage() {
    const message = document.getElementById('complianceMessage');
    const stressRatio = designResults.stress.stressRatio;
    const deflection = designResults.fem.maxDeflection;
    const deflectionLimit = designResults.fem.deflectionLimit;
    const minSF = designResults.fem.minSafetyFactor;

    let text = '';
    let className = 'safe';

    if (stressRatio > 1.0) {
        text = '❌ DESIGN FAILURE: Stress ratio exceeds 1.0. Please increase beam dimensions or review material selection.';
        className = 'danger';
    } else if (deflection > deflectionLimit) {
        text = '⚠️ WARNING: Deflection exceeds L/250 limit. Consider increasing beam height or using higher-grade material.';
        className = 'warning';
    } else if (stressRatio > 0.85) {
        text = '⚠️ CAUTION: Design is near maximum stress capacity. Recommend review by structural engineer.';
        className = 'warning';
    } else {
        text = '✅ SAFE: Design meets Eurocode requirements with safety factor of ' + minSF.toFixed(2) + '.';
        className = 'safe';
    }

    message.textContent = text;
    message.className = 'compliance-message ' + className;
}

function showResultsPanel() {
    document.getElementById('resultsPanel').style.display = 'block';
    document.getElementById('exportPanel').style.display = 'block';
    document.querySelector('.tab-content.active').classList.remove('active');
    document.getElementById('loads').classList.add('active');
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-tab="loads"]').classList.add('active');
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update charts if needed
    if (tabName === 'visualize') {
        updateVisualizationCharts();
    }
}

// ============================================
// CHART INITIALIZATION
// ============================================

function initializeCharts() {
    // Load Chart
    const loadCtx = document.getElementById('loadChart');
    if (loadCtx) {
        charts.load = new Chart(loadCtx, {
            type: 'bar',
            data: {
                labels: ['Dead Load', 'Live Load', 'Snow Load', 'Wind Load'],
                datasets: [{
                    label: 'Load (kN)',
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.7)',
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(255, 152, 0, 0.7)',
                        'rgba(244, 67, 54, 0.7)'
                    ],
                    borderColor: [
                        'rgba(46, 125, 50, 1)',
                        'rgba(21, 101, 192, 1)',
                        'rgba(230, 124, 115, 1)',
                        'rgba(211, 47, 47, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { font: { size: 12 } }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Load (kN)' }
                    }
                }
            }
        });
    }

    // Stress Chart
    const stressCtx = document.getElementById('stressChart');
    if (stressCtx) {
        charts.stress = new Chart(stressCtx, {
            type: 'doughnut',
            data: {
                labels: ['Used Capacity', 'Available Capacity'],
                datasets: [{
                    data: [50, 50],
                    backgroundColor: [
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(189, 189, 189, 0.3)'
                    ],
                    borderColor: [
                        'rgba(21, 101, 192, 1)',
                        'rgba(117, 117, 117, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 12 }, padding: 20 }
                    }
                }
            }
        });
    }

    // Deflection Chart
    const deflectionCtx = document.getElementById('deflectionChart');
    if (deflectionCtx) {
        charts.deflection = new Chart(deflectionCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: 11}, (_, i) => (i * 10) + '%'),
                datasets: [{
                    label: 'Deflection (mm)',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    borderColor: 'rgba(255, 152, 0, 1)',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: 'rgba(255, 152, 0, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { font: { size: 12 } }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Cost Chart
    const costCtx = document.getElementById('costChart');
    if (costCtx) {
        charts.cost = new Chart(costCtx, {
            type: 'pie',
            data: {
                labels: ['Material', 'Labor', 'Additional'],
                datasets: [{
                    data: [33, 33, 34],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.7)',
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(255, 152, 0, 0.7)'
                    ],
                    borderColor: [
                        'rgba(46, 125, 50, 1)',
                        'rgba(21, 101, 192, 1)',
                        'rgba(230, 124, 115, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 12 }, padding: 20 }
                    }
                }
            }
        });
    }
}

// ============================================
// CHART UPDATES
// ============================================

function updateCharts() {
    if (!designResults) return;

    // Update Load Chart
    if (charts.load) {
        const deadLoad = designResults.loads.deadLoad * 0.00981 * 1.2;
        const liveLoad = designResults.input.liveLoad * 0.00981 * 1.6;
        const snowLoad = designResults.input.snowLoad * 0.00981 * 1.2;
        const windLoad = designResults.loads.windLoad;

        charts.load.data.datasets[0].data = [deadLoad, liveLoad, snowLoad, windLoad];
        charts.load.update();
    }

    // Update Stress Chart
    if (charts.stress) {
        const stressRatio = Math.min(designResults.stress.stressRatio * 100, 100);
        charts.stress.data.datasets[0].data = [stressRatio, 100 - stressRatio];
        charts.stress.update();
    }

    // Update Deflection Chart
    if (charts.deflection) {
        const maxDeflection = designResults.fem.maxDeflection;
        const deflectionLimit = designResults.fem.deflectionLimit;
        const deflectionData = Array.from({length: 11}, (_, i) => {
            return (maxDeflection / deflectionLimit) * (i * 10);
        });
        charts.deflection.data.datasets[0].data = deflectionData;
        charts.deflection.update();
    }

    // Update Cost Chart
    if (charts.cost) {
        const total = designResults.cost.totalCost;
        const materialPercent = (designResults.cost.materialCost / total) * 100;
        const laborPercent = (designResults.cost.laborCost / total) * 100;
        const additionalPercent = (designResults.cost.additionalCost / total) * 100;

        charts.cost.data.datasets[0].data = [materialPercent, laborPercent, additionalPercent];
        charts.cost.update();
    }
}

function updateVisualizationCharts() {
    if (!designResults) return;

    // Load Distribution
    const loadDistTrace = {
        x: Array.from({length: 11}, (_, i) => (i * 10)),
        y: Array.from({length: 11}, (_, i) => {
            return designResults.loads.totalVerticalLoad * Math.cos((i * 10) * Math.PI / 180);
        }),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Load Distribution'
    };

    const loadDistLayout = {
        title: 'Load Distribution Along Structure Length',
        xaxis: { title: 'Position (%)' },
        yaxis: { title: 'Load (kN)' },
        responsive: true
    };

    Plotly.newPlot('loadDistribution', [loadDistTrace], loadDistLayout, {responsive: true});

    // Stress Distribution
    const stressDistTrace = {
        x: Array.from({length: 11}, (_, i) => (i * 10)),
        y: Array.from({length: 11}, (_, i) => {
            return designResults.stress.maxStress * Math.sin((i * 10) * Math.PI / 180);
        }),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Stress Distribution',
        fill: 'tozeroy'
    };

    const stressDistLayout = {
        title: 'Stress Distribution Along Structure Height',
        xaxis: { title: 'Position (%)' },
        yaxis: { title: 'Stress (MPa)' },
        responsive: true
    };

    Plotly.newPlot('stressDistribution', [stressDistTrace], stressDistLayout, {responsive: true});
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportJSON() {
    if (!designResults) {
        alert('Please calculate design first.');
        return;
    }

    const dataStr = JSON.stringify(designResults, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'greenhouse-design-' + new Date().getTime() + '.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function exportPDF() {
    alert('PDF export requires additional library. Using print function instead...');
    window.print();
}

function printDesign() {
    window.print();
}

// ============================================
// VALIDATION HELPER
// ============================================

function validateInputs(length, width, liveLoad, snowLoad, windSpeed) {
    return !isNaN(length) && length > 0 &&
           !isNaN(width) && width > 0 &&
           !isNaN(liveLoad) && liveLoad > 0 &&
           !isNaN(snowLoad) && snowLoad >= 0 &&
           !isNaN(windSpeed) && windSpeed >= 0;
}
