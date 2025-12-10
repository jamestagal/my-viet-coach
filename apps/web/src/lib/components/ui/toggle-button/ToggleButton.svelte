<script>

    let randomId = `toggle-${Math.random().toString(36).substring(2, 15)}`;
    let { 
        checked = $bindable(),
        onchange = () => {},
        id = randomId,
        name = randomId,
        size = 'sm',
        title
     } = $props();

    const sizes = {
        xs: {
            background: 'w-[28px] h-[16px]',
            circle: 'w-[12px] h-[12px]'
        },
        sm: {
            background: 'w-[36px] h-[20px]',
            circle: 'w-[16px] h-[16px]'
        },
        md: {
            background: 'w-[44px] h-[24px]',
            circle: 'w-[20px] h-[20px]'
        }
    }

</script>

<div class="flex flex-row gap-2 items-center">
    <label for={id} class="scale-100 active:scale-95 transition-all duration-50 items-center cursor-pointer">
        <input 
            type="checkbox" 
        bind:checked
        id={id}
        name={name} 
        class="sr-only peer"
        onchange={() => onchange(checked)}
    >
    <div class="flex flex-row {checked ? 'bg-secondary' : 'bg-primary-3'} rounded-xl {sizes[size]?.background} items-center p-[2px]">
        <span class="flex shadow-md {sizes[size]?.circle} {checked ? 'bg-main' : 'bg-secondary'} rounded-full transition-all duration-200 {checked ? 'translate-x-full' : 'translate-x-0'}">
        </span>
    </div>
    </label> 
    {#if title}
        <p class="text-xs font-medium">{title}</p>
    {/if}
</div>


<!-- @component Toggle
### Usage
```svelte
<script>
    import Toggle from '$lib/components/ui/Toggle.svelte';
</script>
<Toggle name="toggle" title="Toggle" size="sm" />
```
-->