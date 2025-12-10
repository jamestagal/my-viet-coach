<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { Menu } from 'lucide-svelte';

    let {
         children,
         isSideNavOpen = $bindable(false),
         isSwipeable = true
        } = $props();
    
    let isDesktop = $state(false);
    let hasInteracted = $state(false); // Track if user has toggled manually
    
    // Swipe functionality
    let touchStartX = $state(0);
    let touchStartY = $state(0);
    let isSwipeDetected = $state(false);

    onMount(() => {
       checkDevice();
    });

    function checkDevice() {
        isDesktop = window.innerWidth > 768;
        // Only sync state if user hasn't manually interacted
        if (!hasInteracted) {
            isSideNavOpen = isDesktop;
        }
    }

    function handleTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwipeDetected = false;
    }

    function handleTouchMove(e) {
        if (!touchStartX || !touchStartY || !isSwipeable) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        
        const diffX = Math.abs(currentX - touchStartX);
        const diffY = Math.abs(currentY - touchStartY);
        
        // Only consider horizontal swipes (more horizontal than vertical movement)
        if (diffX > diffY && diffX > 20) {
            isSwipeDetected = true;
        }
    }

    function handleTouchEnd(e) {
        if (!touchStartX || !isSwipeDetected) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const swipeDistance = touchEndX - touchStartX;
        const minSwipeDistance = 50;
        
        // Right swipe (open navigation) - only if navigation is closed
        if (swipeDistance > minSwipeDistance && !isSideNavOpen) {
            toggle();
        }
        // Left swipe (close navigation) - only if navigation is open  
        else if (swipeDistance < -minSwipeDistance && isSideNavOpen) {
            toggle();
        }
        
        // Reset values
        touchStartX = 0;
        touchStartY = 0;
        isSwipeDetected = false;
    }

    export function toggle() {
        hasInteracted = true; // Mark that user has manually toggled
        isSideNavOpen = !isSideNavOpen;
    }

</script>

<svelte:document 
    ontouchstart={handleTouchStart} 
    ontouchmove={handleTouchMove} 
    ontouchend={handleTouchEnd} 
/>

<div class="flex flex-col h-full min-w-60 overflow-x-hidden overflow-y-auto 
    ease-in-out transition-all duration-300 
    {hasInteracted ? (isSideNavOpen ? 'ml-0' : '-ml-60') : '-ml-60 md:ml-0'}">
    {@render children()}
</div>