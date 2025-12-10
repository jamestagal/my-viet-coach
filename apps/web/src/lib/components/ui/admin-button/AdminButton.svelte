<script lang="ts" module>
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from "svelte/elements";

	export type AdminButtonVariant = "default" | "action" | "danger" | "success" | "warning" | "outline" | "ghost";
	export type AdminButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

	export type AdminButtonProps = HTMLButtonAttributes & HTMLAnchorAttributes & {
		variant?: AdminButtonVariant;
		size?: AdminButtonSize;
		isLoading?: boolean;
		href?: string;
	};
</script>

<script lang="ts">
	let {
		class: className = "",
		variant = "default",
		size = "md",
		href = undefined,
		type = "button",
		isLoading = false,
		disabled,
		children,
		...restProps
	}: AdminButtonProps = $props();

	let isDisabled = $derived(disabled || isLoading);

	// Variant styles
	const variantStyles: Record<AdminButtonVariant, string> = {
		default: "bg-primary text-primary-foreground hover:bg-primary/90",
		action: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
		danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
		success: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
		warning: "bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm",
		outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
		ghost: "hover:bg-accent hover:text-accent-foreground",
	};

	// Size styles
	const sizeStyles: Record<AdminButtonSize, string> = {
		xs: "h-7 rounded px-2 text-xs",
		sm: "h-9 rounded-md px-3 text-sm",
		md: "h-10 rounded-lg px-6 text-sm",
		lg: "h-11 rounded-md px-8 text-base",
		icon: "h-10 w-10",
	};

	const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
</script>

{#if href}
	<a
		class="{baseStyles} {variantStyles[variant]} {sizeStyles[size]} {className}"
		{href}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		class="{baseStyles} {variantStyles[variant]} {sizeStyles[size]} {className} {isLoading ? 'relative' : ''}"
		{type}
		disabled={isDisabled}
		{...restProps}
	>
		{#if isLoading}
			<span class="absolute inset-0 flex items-center justify-center">
				<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</span>
			<span class="invisible">{@render children?.()}</span>
		{:else}
			{@render children?.()}
		{/if}
	</button>
{/if}
