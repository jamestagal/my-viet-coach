<script>
    import { slide, fly, fade, scale } from 'svelte/transition';
    import { ChevronsUpDown } from 'lucide-svelte';

    let { 
        placeholder = 'Select an option', 
        options = [], 
        value = $bindable(), 
        name = '',
        onSelect = () => {}
    } = $props();

    let isOpen = $state(false);
    let dropdownRef = $state(null);
    let shouldOpenUp = $state(false);
    
    let selected = $derived(options.find(opt => opt.value === value) || {});

    function handleSelect(option, index) {
        value = option.value;
        onSelect({ option, index });
        isOpen = false;
    }

    function handleClickOutside(event) {
        if (dropdownRef && !dropdownRef.contains(event.target)) {
            isOpen = false;
        }
    }

    function checkSpace() {
        if (!dropdownRef) return;
        
        const rect = dropdownRef.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = options.length * 40; // Approximate height per option
        
        shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    }

    function toggleDropdown() {
        isOpen = !isOpen;
        if (isOpen) {
            checkSpace();
            document.addEventListener('click', handleClickOutside);
        } else {
            document.removeEventListener('click', handleClickOutside);
        }
    }
</script>

<div class="flex flex-col relative z-[9999]" bind:this={dropdownRef}>
    <input type="hidden" {name} value={value || ''} />
    <button
        type="button"
        class="flex items-center cursor-pointer w-full px-4 py-2 gap-2 font-medium text-secondary-2 bg-main border border-primary-3 focus:border-primary-4 rounded-xl hover:bg-primary-2"
        onclick={toggleDropdown}
    >
        <div class="flex flex-row w-full items-center justify-between gap-2">
            <span class="capitalize">{selected.name || selected.value || placeholder}</span>
            {#if selected.note}
                <span class="text-sm text-fade">{selected.note}</span>
            {/if}
        </div>
        <ChevronsUpDown size={16} class="flex-shrink-0" />
    </button>

    {#if isOpen}
        <div 
            in:fade={{ y: shouldOpenUp ? 10 : -10, duration: 30 }} 
            out:fade={{ duration: 100 }} 
            class="absolute z-[9999] w-full {shouldOpenUp ? 'bottom-full mb-2' : 'top-full mt-2'} border border-border bg-background rounded-xl shadow-lg"
        >
            <div class="py-1 overflow-auto rounded-xl max-h-60 ring-opacity-5 focus:outline-none">
                {#each options as option, index}
                    <button
                        type="button"
                        class="flex flex-row w-full cursor-pointer items-center justify-between px-4 py-2 text-left hover:bg-muted"
                        onclick={() => handleSelect(option, index)}
                    >
                        <span class="capitalize">{option.name || option.value}</span>
                        {#if option.note}
                        <span class="text-sm text-fade">{option.note}</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>