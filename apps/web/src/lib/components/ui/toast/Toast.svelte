<script module>

    let toasts = $state([]);
    let toastId = 0;
    
    // Default values
    const maxToasts = 3;
    const toastDuration = 4000;
    const isClosable = true;
    
    // Toast types
    const TOAST_TYPES = {
      SUCCESS: 'success',
      ERROR: 'error',
      INFO: 'info',
      WARNING: 'warning'
    };
    
    // Create toast object with methods
    export const toast = {
      async show(data) {
        const id = toastId++;
        const type = data.type || TOAST_TYPES.INFO;
        const duration = data.duration || toastDuration;
        const closable = data.closable || isClosable;
        const controller = this.timer(() => this.remove(id), duration);
    
        const newToast = {
          id,
          closable,
          type,
          duration,
          controller, // holds pause/resume
          ...data
        };
    
        // Remove oldest toast
        if (toasts.length >= maxToasts) {
          const removedToast = toasts.pop();
          removedToast?.controller?.pause();
        }
    
        toasts = [newToast, ...toasts];
        return id;
      },
    
      timer(callback, duration) {
        let start = Date.now();
        let remaining = duration;
        let timerId;
    
        const pause = () => {
          clearTimeout(timerId);
          remaining -= Date.now() - start;
        };
    
        const resume = () => {
          start = Date.now();
          timerId = setTimeout(callback, remaining);
        };
    
    
        resume();
        
        return { pause, resume };
      },
    
      success(data) {
        if (typeof data === 'string') {
          return this.show({ type: TOAST_TYPES.SUCCESS, message: data });
        }
        return this.show({ type: TOAST_TYPES.SUCCESS, ...data });
      },
      error(data) {
        if (typeof data === 'string') {
          return this.show({ type: TOAST_TYPES.ERROR, message: data });
        }
        return this.show({ type: TOAST_TYPES.ERROR, ...data });
      },
      info(data) {
        if (typeof data === 'string') {
          return this.show({ type: TOAST_TYPES.INFO, message: data });
        }
        return this.show({ type: TOAST_TYPES.INFO, ...data });
      },
      warning(data) {
        if (typeof data === 'string') {
          return this.show({ type: TOAST_TYPES.WARNING, message: data });
        }
        return this.show({ type: TOAST_TYPES.WARNING, ...data });
      },
    
      remove(id) {
        toasts = toasts.filter(t => {
          const match = t.id === id;
          if (match) t.controller?.pause();
          return !match;
        });
      }
    };
    
    </script>
    
    
    <script>
        import { flip } from 'svelte/animate';
        import { fly } from 'svelte/transition';
    
        let { position = 'top-mid' } = $props();
    
        const positionClass = {
            'top-mid': { class: 'top-2 left-1/2 -translate-x-1/2', direction: 'top' },
            'top-right': { class: 'top-2 right-0', direction: 'top' },
            'top-left': { class: 'top-2 left-0', direction: 'top' },
            'bottom-mid': { class: 'bottom-2 left-1/2 -translate-x-1/2', direction: 'bottom' },
            'bottom-right': { class: 'bottom-2 right-0', direction: 'bottom' },
            'bottom-left': { class: 'bottom-2 left-0', direction: 'bottom' }
        }
    
        const styles = {
            success: 'bg-success/90 text-main',
            error: 'bg-danger/90 text-main',
            info: 'bg-primary/90 text-secondary border border-primary-3',
            warning: 'bg-warning/90 text-main'
        };
    
        const direction = positionClass[position].direction;
        
    </script>
    
    
    <div 
    tabindex="0"
    role="button" 
    class="fixed z-50 {positionClass[position]?.class} flex -space-y-12 hover:space-y-4 items-center group"
    class:flex-col={direction === 'top'}
    class:space-y-reverse={direction === 'bottom'}
    class:flex-col-reverse={direction === 'bottom'}
        onmouseenter={() => {
            toasts.forEach(toast => {
                toast.controller.pause();
            });
        }}
        onmouseleave={() => {
            toasts.forEach(toast => {
                toast.controller.resume();
            });
        }}>
                <!-- If transition duration  -->
                {#each toasts as singleToast, i (singleToast.id)}
                <!-- When increasing duration of transition:fly, it seems that then animate:flip is causing jitter -->
                    <div
                    animate:flip
                    transition:fly={{ y: direction === 'top' ? -100 : 100, duration: 100 }}
                    class="flex items-center w-fit p-3 min-h-16 min-w-xs group-hover:!scale-100 transition-all duration-300 text-sm backdrop-blur-sm rounded-xl {styles[singleToast.type]}"
                    style="z-index: {100 + singleToast.id}; scale: {1 - (i/10)}; box-shadow: 0 {direction === 'top' ? '4px' : '-4px'} 14px rgba(0, 0, 0, 0.2);"
                >
                
    
                    <div class="flex flex-col items-start w-full gap-1">
                        {#if singleToast.title}
                            <p class="text-xs uppercase font-bold">{singleToast.type}</p>
                        {/if}
                        {#if singleToast.message}
                            <p>{singleToast.message}</p>
                        {/if}
                    </div>
                        {#if singleToast.closable}
                        <button
                            type="button"
                            class="p-1 ml-1 rounded-full bg-secondary text-main flex-shrink-0 w-5 h-5 flex items-center justify-center"
                            onclick={() => { toast.remove(singleToast.id); }}
                            aria-label="Close toast"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18"></path>
                            <path d="m6 6 12 12"></path>
                        </svg>
                    </button>
                    {/if}
                </div>
            {/each}
        </div>
    
    <!-- Fix space-y-reverse for original Tailwind class -->
    <style>
        .space-y-reverse {
            & > * {
                --tw-space-y-reverse: 1;
            }
        }
    </style>
    
    <!-- @component Toast
    ### Usage
    ```svelte
    <script>
        import Toast, { toast } from '$lib/components/ui/Toast.svelte';
    </script>
    <Toast />
    <button type="button" onclick={() => toast.error({ title: 'Error', message: 'Hello, world!', duration: 10000, closable: true })}>Show error</button>
    <button type="button" onclick={() => toast.info({ title: 'Info', closable: true })}>Show info</button>
    <button type="button" onclick={() => toast.success('Simple success toast')}>Show success</button>
    <button type="button" onclick={() => toast.warning('Simple warning toast')}>Show warning</button>
    ```
    -->