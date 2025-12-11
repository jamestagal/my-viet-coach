<script>
    import { goto } from '$app/navigation';
    import { PartyPopper } from 'lucide-svelte';
    


</script>


      <div class="card card-ring flex flex-col gap-6 p-6 max-w-xl bg-white rounded-lg">
        <div class="flex flex-col items-center mb-6 gap-2">
            <PartyPopper size={100} class="mx-auto mb-6" />
            <h3 class="text-xl font-semibold mb-2">Thank you! Everything went well.</h3>
            <p>Your payment has been processed successfully.</p>
            <p>Your billing information will be updated shortly.</p>
        </div>
        

        <button 
            class="button center action p-2"
            onclick={() => goto('/settings/billing')}
        >
            Back to Billing
        </button>
    </div>
