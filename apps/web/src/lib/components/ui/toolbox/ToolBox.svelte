<script>
    import { onMount } from 'svelte';
    import { fade, scale, fly, slide } from 'svelte/transition';

    let {
        closeOnClick = false,
        openOnHover = false,
        position = 'top',
        children,
        trigger
    } = $props();

    let toolboxOpen = $state(false);
    let triggerEl = $state();
    let toolboxEl = $state();
    let toolboxStyle = $state('');
    let positioningTimeout;

    function toggleToolbox(event) {
        toolboxOpen = !toolboxOpen;

        if (positioningTimeout) {
            clearTimeout(positioningTimeout);
        }

        // Get coordinates from click event
        const x = event.clientX;
        const y = event.clientY;
        
        if (toolboxOpen) {
            // Set initial position off-screen to prevent flicker
            toolboxStyle = 'position: fixed; visibility: hidden;';
            setTimeout(() => {
                const triggerRect = triggerEl.getBoundingClientRect();
                const toolboxRect = toolboxEl.getBoundingClientRect();
                const xAxis = triggerRect.left + (triggerRect.width);
                const yAxis = triggerRect.bottom + 8;
                positionToolbox(xAxis, yAxis);
            }, 0);
        }
    }

    function close() {
        toolboxOpen = false;
    }

    function positionToolbox(clickX, clickY) {
        if (!toolboxEl || !triggerEl) return;

        const toolboxRect = toolboxEl.getBoundingClientRect();
        const triggerRect = triggerEl.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const padding = 10;
        const spacing = 8;

        let left, top;

        // Set initial position based on preference
        switch (position) {
            case 'right':
                left = triggerRect.right + spacing;
                // Vertically center align with trigger
                top = triggerRect.top + (triggerRect.height - toolboxRect.height) / 2;
                break;
            case 'left':
                left = triggerRect.left - toolboxRect.width - spacing;
                // Vertically center align with trigger
                top = triggerRect.top + (triggerRect.height - toolboxRect.height) / 2;
                break;
            case 'top':
                // Horizontally center align with trigger
                left = triggerRect.left + (triggerRect.width - toolboxRect.width) / 2;
                top = triggerRect.top - toolboxRect.height - spacing;
                break;
            case 'bottom':
                // Horizontally center align with trigger
                left = triggerRect.left + (triggerRect.width - toolboxRect.width) / 2;
                top = triggerRect.bottom + spacing;
                break;
        }

        // Fallback positions if the preferred position doesn't fit
        if (left + toolboxRect.width > viewportWidth - padding) {
            // If going off right edge
            if (position === 'top' || position === 'bottom') {
                // For top/bottom positioning, try to keep it centered but within bounds
                left = viewportWidth - toolboxRect.width - padding;
            } else {
                // For left/right positioning, switch sides
                left = triggerRect.left - toolboxRect.width - spacing;
            }
        }
        if (left < padding) {
            // If going off left edge
            if (position === 'top' || position === 'bottom') {
                // For top/bottom positioning, align with left edge
                left = padding;
            } else {
                // For left/right positioning, switch sides
                left = triggerRect.right + spacing;
            }
        }
        if (top + toolboxRect.height > viewportHeight - padding) {
            // If going off bottom edge
            if (position === 'left' || position === 'right') {
                // For left/right positioning, try to keep it centered but within bounds
                top = viewportHeight - toolboxRect.height - padding;
            } else {
                // For top/bottom positioning, switch sides
                top = triggerRect.top - toolboxRect.height - spacing;
            }
        }
        if (top < padding) {
            // If going off top edge
            if (position === 'left' || position === 'right') {
                // For left/right positioning, align with top edge
                top = padding;
            } else {
                // For top/bottom positioning, switch sides
                top = triggerRect.bottom + spacing;
            }
        }

        // Final viewport bounds check
        left = Math.max(padding, Math.min(left, viewportWidth - toolboxRect.width - padding));
        top = Math.max(padding, Math.min(top, viewportHeight - toolboxRect.height - padding));

        const relativeLeft = left - triggerRect.left;
        const relativeTop = top - triggerRect.top;

        // Position relative to the viewport using fixed positioning
        toolboxStyle = `position: fixed; left: ${left}px; top: ${top}px;`;
    }

    function handleClick(event) {
        if (closeOnClick && toolboxEl.contains(event.target) && toolboxOpen) {
            close();
        }
    }

    onMount(() => {
        const handleClickOutside = (event) => {
            if (toolboxOpen && triggerEl && toolboxEl && !triggerEl.contains(event.target) && !toolboxEl.contains(event.target)) {
                toolboxOpen = false;
            }
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            if (positioningTimeout) {
                clearTimeout(positioningTimeout);
            }
        };
    });
</script>


    <span class="inline-flex flex-shrink-1 items-center justify-center" bind:this={triggerEl}>
        <button type="button" class="button inline-flex flex-shrink-1 w-fit" onclick={toggleToolbox}>
            {@render trigger?.()}
        </button>
    </span>

{#if toolboxOpen}
    <button type="button"
        bind:this={toolboxEl}
        style={toolboxStyle}
        class="z-50 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] md:max-w-md overflow-auto bg-main border border-primary-2 rounded-xl shadow-lg"
        onclick={handleClick}
        in:fly={{ y: -5, duration: 200 }}
        out:fade={{duration: 100}}>

        {@render children?.({ close })}

    </button>
{/if}


