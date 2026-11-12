<script lang="ts">
	import { Sun, Moon, Coffee, Timer, Sparkles, Cloud, CloudOff, RefreshCw, UserCheck } from 'lucide-svelte';
	import { workStore } from '../storage.svelte';
	import { themeStore } from '../theme.svelte';
	import { formatThaiDate } from '../calculator';
	import AuthModal from './AuthModal.svelte';

	let {
		onStatusClick
	}: {
		onStatusClick?: () => void;
	} = $props();

	let showAuthModal = $state(false);

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

	function handleOpenAuth() {
		triggerHaptic(10);
		showAuthModal = true;
	}
</script>

<header
	class="sticky top-0 z-30 mx-auto w-full max-w-md border-b border-zinc-200/80 bg-white/90 px-4 pt-[max(env(safe-area-inset-top,0px),10px)] pb-3 shadow-xs backdrop-blur-xl transition-colors duration-200 dark:border-white/10 dark:bg-[#09090b]/90"
>
	<div class="flex items-center justify-between gap-2">
		<!-- Left: Logo & Brand -->
		<div class="flex items-center gap-2.5">
			<div
				class="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 shadow-md shadow-blue-500/20 ring-1 ring-white/20"
			>
				<span class="text-base font-black tracking-tight text-white select-none">HW</span>
				<!-- Ambient sync dot -->
				<span
					class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#09090b] {workStore.user
						? 'bg-emerald-400'
						: 'bg-zinc-400'}"
				></span>
			</div>

			<div class="flex flex-col">
				<div class="flex items-center gap-1.5">
					<span class="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
						HourWorked
					</span>
					<span
						class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40"
					>
						THB
					</span>
				</div>
				<!-- Thai Date -->
				<span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
					{todayDateString}
				</span>
			</div>
		</div>

		<!-- Right: Cloud Sync Badge & Status Pill & Theme Switcher -->
		<div class="flex items-center gap-1.5 sm:gap-2">
			<!-- Cloud Sync Status Badge -->
			<button
				type="button"
				onclick={handleOpenAuth}
				class="group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 border {workStore.user
					? workStore.syncStatus === 'syncing'
						? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
						: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
					: 'border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40 ring-1 ring-blue-500/10'}"
				title={workStore.user ? `บัญชีคลาวด์: ${workStore.user.username} (คลิกเพื่อจัดการ / ซิงค์)` : 'คลิกเพื่อเข้าสู่ระบบ & บันทึกลง Cloud'}
			>
				{#if workStore.syncStatus === 'syncing'}
					<RefreshCw size={12} class="animate-spin text-blue-600 dark:text-blue-400" />
					<span class="tabular-nums font-mono">กำลังซิงค์...</span>
				{:else if workStore.user}
					<Cloud size={12} class="text-emerald-600 dark:text-emerald-400" />
					<span class="max-w-[80px] truncate">{workStore.user.username}</span>
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
				{:else}
					<Cloud size={12} class="text-blue-600 dark:text-blue-400" />
					<span>ซิงค์คลาวด์</span>
				{/if}
			</button>

			<!-- Status Pill -->
			<button
				type="button"
				onclick={() => {
					triggerHaptic(8);
					onStatusClick?.();
				}}
				class="group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 border {workStore.isClockedIn
					? workStore.isOnBreak
						? 'border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300'
						: 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300'
					: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-zinc-800/70 dark:text-zinc-300'}"
				title="สถานะกะทำงานปัจจุบัน"
			>
				{#if workStore.isClockedIn}
					{#if workStore.isOnBreak}
						<Coffee size={12} class="animate-bounce text-amber-600 dark:text-amber-400" />
						<span>พัก</span>
					{:else}
						<span class="relative flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
							></span>
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
						</span>
						<span class="font-bold">เข้างาน</span>
					{/if}
				{:else}
					<span class="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>
					<span>พร้อม</span>
				{/if}
			</button>

			<!-- Theme Toggle Button -->
			<button
				type="button"
				onclick={handleToggleTheme}
				aria-label={themeStore.isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
				class="relative flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-zinc-600 transition-all duration-150 hover:bg-zinc-100 active:scale-90 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
			>
				{#if themeStore.isDark}
					<Sun size={16} class="text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
				{:else}
					<Moon size={16} class="text-zinc-700 transition-transform duration-300 -rotate-12 hover:rotate-0" />
				{/if}
			</button>
		</div>
	</div>
</header>

<!-- Auth & Cloud Sync Modal -->
<AuthModal bind:isOpen={showAuthModal} />
