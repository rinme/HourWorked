<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { themeStore } from '#lib/theme.svelte';

	let { children }: LayoutProps = $props();

	onMount(() => {
		themeStore.initTheme();
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/icon.svg" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

<!-- Mobile app presentation shell: Clean warm light (#fafafa / #ffffff) and deep editorial dark (#09090b / #121215) -->
<div
	class="min-h-[100dvh] w-full bg-[#f4f4f5] dark:bg-[#050507] text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-start transition-colors duration-200"
>
	<!-- Phone Frame (Edge-to-edge on mobile, sleek centered container on tablet/desktop) -->
	<div
		class="relative flex min-h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#09090b] sm:my-3 sm:min-h-[844px] sm:overflow-hidden sm:rounded-[36px] sm:border sm:border-zinc-200/80 sm:ring-8 sm:ring-zinc-900/5 dark:sm:border-zinc-800/80 dark:sm:ring-zinc-950/80"
	>
		<!-- Main Content Slot -->
		<div class="relative flex min-h-[100dvh] flex-1 flex-col sm:min-h-0">
			{@render children()}
		</div>
	</div>
</div>
