<script lang="ts">
	import { Clock, History, LayoutDashboard, Calculator } from 'lucide-svelte';
	import { workStore } from '../storage.svelte';

	export type TabId = 'clock' | 'history' | 'dashboard' | 'calculator';

	let {
		activeTab = $bindable('clock'),
		onTabChange
	}: {
		activeTab?: TabId;
		onTabChange?: (tab: TabId) => void;
	} = $props();

	interface NavTab {
		id: TabId;
		label: string;
		sublabel: string;
		icon: typeof Clock;
	}

	const tabs: NavTab[] = [
		{ id: 'clock', label: 'บันทึกเวลา', sublabel: 'Clock', icon: Clock },
		{ id: 'history', label: 'ประวัติ', sublabel: 'History', icon: History },
		{ id: 'dashboard', label: 'แดชบอร์ด', sublabel: 'Dashboard', icon: LayoutDashboard },
		{ id: 'calculator', label: 'คำนวณ & ตั้งค่า', sublabel: 'Config', icon: Calculator }
	];

	function triggerHaptic(duration = 12) {
		if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Vibration not supported or blocked by permissions
			}
		}
	}

	function handleSelect(id: TabId) {
		if (activeTab !== id) {
			triggerHaptic(14);
			activeTab = id;
			onTabChange?.(id);
		} else {
			triggerHaptic(6);
		}
	}
</script>

<nav
	aria-label="เมนูหลัก"
	class="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-slate-200/80 bg-white/90 px-3 pt-2 pb-[max(env(safe-area-inset-bottom,0px),8px)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
>
	<div role="tablist" class="grid grid-cols-4 items-center justify-between gap-1">
		{#each tabs as tab (tab.id)}
			{@const isActive = activeTab === tab.id}
			{@const isClockTab = tab.id === 'clock'}
			{@const isHistoryTab = tab.id === 'history'}
			{@const isWorking = isClockTab && workStore.isClockedIn}
			{@const isOnBreak = isClockTab && workStore.isOnBreak}
			{@const todayCount = isHistoryTab ? workStore.todaySessions.length : 0}

			<button
				type="button"
				role="tab"
				id={`tab-btn-${tab.id}`}
				aria-selected={isActive}
				aria-controls={`tab-panel-${tab.id}`}
				onclick={() => handleSelect(tab.id)}
				class="group relative flex flex-col items-center justify-center rounded-2xl py-1.5 transition-all duration-200 active:scale-90 {isActive
					? 'text-blue-600 dark:text-blue-400'
					: 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}"
			>
				<!-- Active Background Highlight Pill -->
				{#if isActive}
					<span
						class="absolute inset-x-2 -inset-y-0.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40"
						aria-hidden="true"
					></span>
				{/if}

				<!-- Icon container with badge -->
				<div class="relative z-10 flex items-center justify-center">
					<tab.icon
						size={22}
						strokeWidth={isActive ? 2.5 : 1.9}
						class="transition-transform duration-200 {isActive ? 'scale-110 drop-shadow-sm' : 'group-hover:scale-105'}"
					/>

					<!-- Status indicator for Clock tab (Active Session / Break) -->
					{#if isWorking}
						<span
							class="absolute -top-1 -right-1.5 flex h-3 w-3 items-center justify-center"
							title={isOnBreak ? 'กำลังพักเบรก' : 'กำลังบันทึกเวลา'}
						>
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 {isOnBreak
									? 'bg-amber-400'
									: 'bg-emerald-400'}"
							></span>
							<span
								class="relative inline-flex h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 {isOnBreak
									? 'bg-amber-500'
									: 'bg-emerald-500'}"
							></span>
						</span>
					{/if}

					<!-- Badge for History tab showing today's shift count -->
					{#if !isWorking && todayCount > 0}
						<span
							class="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-bold text-slate-700 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900"
						>
							{todayCount}
						</span>
					{/if}
				</div>

				<!-- Label -->
				<span
					class="relative z-10 mt-1 text-[11px] font-medium leading-none tracking-tight transition-colors duration-200 {isActive
						? 'font-semibold text-blue-600 dark:text-blue-400'
						: 'text-slate-500 dark:text-slate-400'}"
				>
					{tab.label}
				</span>

				<!-- Active Bottom Indicator Line -->
				{#if isActive}
					<span
						class="absolute bottom-0 h-0.5 w-6 rounded-full bg-blue-600 transition-all dark:bg-blue-400"
						aria-hidden="true"
					></span>
				{/if}
			</button>
		{/each}
	</div>
</nav>
