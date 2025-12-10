<script lang="ts">
	interface Props {
		class?: string;
		size?: number;
	}

	let { class: className = '', size = 28 }: Props = $props();
</script>

<img
	src="/speak-pho-real.svg"
	alt="Speak Phở Real logo"
	width={size}
	height={size}
	class={className}
/>
