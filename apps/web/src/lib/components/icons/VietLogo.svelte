<script lang="ts">
	interface Props {
		class?: string;
		size?: number;
	}

	let { class: className = '', size = 28 }: Props = $props();
</script>

<img
	src="/noi-hay.svg"
	alt="Nói Hay logo"
	width={size}
	height={size}
	class={className}
/>
