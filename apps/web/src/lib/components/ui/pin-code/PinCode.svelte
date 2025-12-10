<script lang="ts">
	interface Props {
		onInput?: (value: string) => void;
		onComplete: (value: string) => void;
		isLoading?: boolean;
	}

	let { onInput, onComplete, isLoading = false }: Props = $props();
	let pinCode = $state(['', '', '', '', '', '']);

	function checkCompletion() {
		onInput?.(pinCode.join(''));
		if (pinCode.every((digit) => digit.length === 1)) {
			onComplete(pinCode.join(''));
		}
	}

	function handleInput(index: number, event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value.replace(/\D/g, '').slice(-1);
		pinCode[index] = value;

		checkCompletion();

		if (value && index < 5) {
			document.getElementById(`pin-${index + 1}`)?.focus();
		}
	}

	function handleKeydown(index: number, event: KeyboardEvent) {
		if (event.key === 'Backspace' && !pinCode[index] && index > 0) {
			event.preventDefault();
			pinCode[index - 1] = '';
			document.getElementById(`pin-${index - 1}`)?.focus();
			checkCompletion();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const pastedData = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
		pinCode = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
		document.getElementById(`pin-${Math.min(pastedData.length, 5)}`)?.focus();
		checkCompletion();
	}

	export function reset() {
		pinCode = ['', '', '', '', '', ''];
		checkCompletion();
		document.getElementById('pin-0')?.focus();
	}
</script>

<div class="grid grid-cols-6 gap-2 w-full max-w-xs">
	{#each pinCode as _, i}
		<input
			type="text"
			inputmode="numeric"
			id="pin-{i}"
			bind:value={pinCode[i]}
			oninput={(e) => handleInput(i, e)}
			onkeydown={(e) => handleKeydown(i, e)}
			onpaste={handlePaste}
			maxlength="1"
			disabled={isLoading}
			autocomplete="off"
			class="w-full aspect-square text-center text-xl border rounded-lg
             focus:outline-none focus:ring-2 focus:ring-primary
             disabled:opacity-50 disabled:cursor-not-allowed
             bg-background"
		/>
	{/each}
</div>
