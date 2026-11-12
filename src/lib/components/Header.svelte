<script lang="ts">
	import { Sun, Moon, Coffee, Timer, Sparkles } from 'lucide-svelte';
	import { workStore } from '../storage.svelte';
	import { themeStore } from '../theme.svelte';
	import { formatThaiDate } from '../calculator';

	let {
		onStatusClick
	}: {
		onStatusClick?: () => void;
	} = $props();

	// Current Thai formatted date
	const todayDateString = $derived(
		formatThaiDate(new Date(), { showDayOfWeek: true, showYear: false })
	);

	function triggerHaptic(duration = 10) {
		if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// ignore
			}
		}
	}

	function handleToggleTheme() {
		triggerHaptic(12);
		themeStore.toggleTheme();
	}
</script>

<header
	class="sticky top-0 z-30 mx-auto w-full max-w-md border-b border-slate-200/80 bg-white/90 px-4 pt-[max(env(safe-area-inset-top,0px),10px)] pb-3 shadow-xs backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/90"
>
	<div class="flex items-center justify-between gap-2">
		<!-- Left: Logo & Brand -->
		<div class="flex items-center gap-2.5">
			<div
				class="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 shadow-md shadow-blue-500/20 ring-1 ring-white/20"
			>
				<span class="text-base font-black tracking-tight text-white select-none">HW</span>
				<!-- Mini ambient dot -->
				<span class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900"></span>
			</div>

			<div class="flex flex-col">
				<div class="flex items-center gap-1.5">
					<span class="text-base font-bold tracking-tight text-slate-900 dark:text-white">
						HourWorked
					</span>
					<span
						class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
					>
						THB
					</span>
				</div>
				<!-- Thai Date -->
				<span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
					{todayDateString}
				</span>
			</div>
		</div>

		<!-- Right: Status Pill & Theme Switcher -->
		<div class="flex items-center gap-2">
			<!-- Status Pill -->
			<button
				type="button"
				onclick={() => {
					triggerHaptic(8);
					onStatusClick?.();
				}}
				class="group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 active:scale-95 {workStore.isClockedIn
					? workStore.isOnBreak
						? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300/60 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60'
						: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60'
					: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'}"
				title="สถานะปัจจุบัน"
			>
				{#if workStore.isClockedIn}
					{#if workStore.isOnBreak}
						<Coffee size={13} class="animate-bounce text-amber-600 dark:text-amber-400" />
						<span>พักเบรก</span>
					{:else}
						<span class="relative flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
						</span>
						<span class="font-bold">ทำงานอยู่</span>
					{/if}
				{:else}
					<span class="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
					<span>พร้อมเข้างาน</span>
				{/if}
			</button>

			<!-- Theme Toggle Button -->
			<button
				type="button"
				onclick={handleToggleTheme}
				aria-label={themeStore.isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
				class="relative flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 transition-all duration-200 hover:bg-slate-100 active:scale-90 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				{#if themeStore.isDark}
					<Sun size={17} class="text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
				{:else}
					<Moon size={17} class="text-slate-700 transition-transform duration-300 -rotate-12 hover:rotate-0" />
				{/if}
			</button>
		</div>
	</div>
</header>
