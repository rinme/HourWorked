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

<!-- Mobile app presentation shell -->
<div
	class="min-h-screen w-full bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-start transition-colors duration-200"
>
	<!-- Phone Frame (Edge-to-edge on mobile, sleek centered container on tablet/desktop) -->
	<div
		class="relative flex min-h-screen w-full max-w-md flex-col bg-slate-50 shadow-2xl dark:bg-slate-950 sm:my-3 sm:min-h-[844px] sm:overflow-hidden sm:rounded-[40px] sm:border sm:border-slate-300/80 sm:ring-8 sm:ring-slate-900/10 dark:sm:border-slate-800 dark:sm:ring-slate-900/80"
	>
		<!-- Main Content Slot -->
		<div class="relative flex min-h-screen flex-1 flex-col sm:min-h-0">
			{@render children()}
		</div>
	</div>
</div>
