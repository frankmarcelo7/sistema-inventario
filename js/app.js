document.addEventListener('DOMContentLoaded', function() {
    // Tooltip initialization
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    // Chart.js global defaults
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#A3AED1';
        
        // Custom tooltips
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(43, 54, 116, 0.9)';
        Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
        Chart.defaults.plugins.tooltip.bodyColor = '#FFFFFF';
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.displayColors = false;
    }

    // Example Mock Data for Charts
    const initCharts = () => {
        // Sales / Outflow Chart
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx) {
            new Chart(salesCtx, {
                type: 'line',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
                    datasets: [{
                        label: 'Salidas de Inventario',
                        data: [65, 59, 80, 81, 56, 95, 110, 130],
                        borderColor: '#4318FF',
                        backgroundColor: 'rgba(67, 24, 255, 0.1)',
                        borderWidth: 3,
                        tension: 0.4, // Smooth curve
                        fill: true,
                        pointBackgroundColor: '#FFFFFF',
                        pointBorderColor: '#4318FF',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                borderDash: [5, 5],
                                color: '#E2E8F0',
                                drawBorder: false
                            },
                            ticks: { padding: 10 }
                        },
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { padding: 10 }
                        }
                    }
                }
            });
        }

        // Category Distribution Chart
        const catCtx = document.getElementById('categoryChart');
        if (catCtx) {
            new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Electrónica', 'Mobiliario', 'Oficina', 'Herramientas'],
                    datasets: [{
                        data: [45, 25, 20, 10],
                        backgroundColor: [
                            '#4318FF', // Primary
                            '#6AD2FF', // Light blue
                            '#05CD99', // Green
                            '#FFCE20'  // Yellow
                        ],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    family: "'Inter', sans-serif",
                                    size: 13
                                }
                            }
                        }
                    }
                }
            });
        }

        // Stock Levels Chart (Bar)
        const stockCtx = document.getElementById('stockChart');
        if (stockCtx) {
            new Chart(stockCtx, {
                type: 'bar',
                data: {
                    labels: ['Portátiles', 'Monitores', 'Teclados', 'Sillas', 'Escritorios'],
                    datasets: [{
                        label: 'Stock Actual',
                        data: [120, 85, 200, 40, 15],
                        backgroundColor: '#4318FF',
                        borderRadius: 6,
                        barThickness: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                borderDash: [5, 5],
                                color: '#E2E8F0',
                                drawBorder: false
                            }
                        },
                        x: {
                            grid: { display: false, drawBorder: false }
                        }
                    }
                }
            });
        }
    };

    initCharts();
});
