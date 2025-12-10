<script>
	import { Chart, registerables } from 'chart.js';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Props: chart data is required, options are optional
	let { data, options = {}, type = 'line' } = $props();

	let chartElement = $state();
	let chartInstance = null;

	onMount(() => {
		drawChart();
		return () => {
			if (chartInstance) {
				chartInstance.destroy();
			}
		};
	});

	$effect(() => {
		if (data && chartElement) {
			drawChart();
		}
	});

	function cssvar(name) {
		if(!browser) return '';
		return getComputedStyle(document.documentElement).getPropertyValue(name);
	}


	export function drawChart() {
		if (chartElement && data && browser) {
				// Register Chart.js components
				Chart.register(...registerables);

				// Destroy previous chart instance if it exists
				if (chartInstance) {
					chartInstance.destroy();
				}

				const primaryColor = cssvar('--primary');
				const secondaryColor = cssvar('--secondary');

				// Default options that were configured in the page component
				const defaultOptions = {
					responsive: true,
					maintainAspectRatio: false,
					pointBackgroundColor: cssvar('--main'),

					scales: {
						x: {
							grid: { display: false },
							border: { display: false },
							ticks: { font: { family: "'Inter', sans-serif" } }
						},
						y: {
							beginAtZero: false,
							grid: { display: true, color: primaryColor },
							border: { display: false },
							ticks: { font: { family: "'Inter', sans-serif" } }
						}
					},
					plugins: {
						legend: {
							position: 'bottom',
							align: 'start',
							labels: {
								font: { family: "'Inter', sans-serif" },
								usePointStyle: true,
								pointStyle: 'rectRounded',
								color: secondaryColor,
								boxWidth: 12,
								boxHeight: 12,
								padding: 20,
								align: 'start',
								
							}
						},
						tooltip: {
							bodyFont: { family: "'Inter', sans-serif" },
							bodyColor: primaryColor,
							titleFont: { family: "'Inter', sans-serif" },
							titleColor: primaryColor,
							color: primaryColor,
							backgroundColor: secondaryColor,
							displayColors: false
						}
					},
					// Default element styling (can be overridden by type-specific below)
					elements: {
						bar: {
							borderRadius: 6, // Apply rounded corners
							borderWidth: 0, // Remove bar border
							hoverBorderWidth: 0 // Explicitly remove hover border
						}
					}
				};

				// Merge default options with any options passed via props
				// Passed options will override defaults
				const finalOptions = {
					...defaultOptions,
					...options,
					scales: { ...defaultOptions.scales, ...(options.scales || {}) },
					plugins: { ...defaultOptions.plugins, ...(options.plugins || {}) },
					elements: { ...defaultOptions.elements, ...(options.elements || {}) }
				};

				const ctx = chartElement.getContext('2d');
				chartInstance = new Chart(ctx, {
					type: type, // Use the type prop
					data: $state.snapshot(data),
					options: finalOptions
				});

			}
	}
</script>

<div class="relative h-full w-full">
	<canvas bind:this={chartElement}></canvas>
</div> 