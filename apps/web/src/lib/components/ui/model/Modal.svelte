<script>
    import { scale } from 'svelte/transition';
    import X from '@icons/x.svelte';
  

    let {
      isOpen = $bindable(false),
      title = '',
      maxWidth = 'max-w-2xl',
      height = 'h-auto',
      position = 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      showCloseButton = true,
      closeOnOverlayClick = false,
      showOverlay = true,
      children
    } = $props();
    
  
    let modalElement = $state();
  
    function closeModal(event) {
      isOpen = false;
    }
  
    function handleKeydown(event) {
      if (isOpen && event.key === 'Escape') {
        closeModal();
      }
    }
  </script>
  
  <svelte:window onkeydown={handleKeydown} />
  
  {#if isOpen}
    <div class={`fixed inset-0 ${showOverlay ? 'bg-black/40 backdrop-blur-md' : ''} flex z-50`}>

      {#if closeOnOverlayClick && showOverlay}
        <button
          class="absolute inset-0 w-full h-full cursor-default"
          onclick={closeModal}
          aria-label="Close modal"
        ></button>
      {/if}

      <div
        bind:this={modalElement}
        in:scale={{duration: 200, start: 0.90}}
        class={`absolute min-w-xs w-fit ${maxWidth} ${height} ${position} max-h-[calc(100svh-1rem)] bg-main border border-primary-2 rounded-xl shadow-lg overflow-hidden overflow-y-auto focus:outline-none`}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
      
      {#if title || showCloseButton}
        <div class="flex justify-between items-center pt-3">
          {#if title}
            <h2 class="font-semibold ml-5">{title}</h2>
          {/if}
          {#if showCloseButton}

          <button
            class="button p-2 mr-3"
            onclick={closeModal}
            aria-label="Close modal">
            <X size={20} /> 
            </button>
          {/if}
        </div>
      {/if}
      
    

        {@render children?.()}

      </div>
    </div>
  {/if}