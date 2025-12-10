<script>
    import { onMount } from 'svelte';
    import Moon from '@icons/moon.svelte';
    import Sun from '@icons/sun.svelte'
    import Palette from '@icons/palette.svelte'
    import LoaderCircle from '@icons/loader-circle.svelte'
    import { getContext } from 'svelte';
  
    let mounted = $state(false);
    let theme = getContext('theme');
  
    onMount(() => {
      mounted = true;
    });

    function toggleTheme() {
      theme.set(theme.current === 'dark' ? 'light' : 'dark');
    }

  </script>
  
  

  <div class="flex items-center justify-center w-[40px] h-[26px]">
    {#if mounted}
  <button type="button" name="theme-switch" onclick={toggleTheme} 
    class="scale-100 active:scale-90 transition-all duration-100 p-0 m-0 relative w-full h-full
     rounded-full bg-primary-3 focus:outline-none cursor-pointer">
  
    
    <div class="absolute w-[20px] h-[20px] transition-transform duration-200 ease-in-out transform {theme.current === 'dark' ? 'translate-x-[16px]' : 'translate-x-[4px]'} top-[3px] bg-main rounded-full shadow-md flex items-center justify-center overflow-hidden">
         {#if theme.current !== 'light' && theme.current !== 'dark'}
         <Palette size={14} class="absolute text-secondary-3 transition-opacity duration-200 opacity-100" />
         {/if}
        <Sun size={14} class="absolute text-primary-accent transition-opacity duration-200 {theme.current === 'light' ? 'opacity-100' : 'opacity-0'}" />
        <Moon size={14} class="absolute text-primary-accent transition-opacity duration-200 {theme.current === 'dark' ? 'opacity-100' : 'opacity-0'}" />
    </div>
  </button>
  {:else}
    <LoaderCircle size={18} strokeWidth={3} class="text-primary-accent transition-opacity duration-200 animate-spin" />
  {/if}
</div>