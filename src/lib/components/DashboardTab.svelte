<script lang="ts">
	import {
		TrendingUp,
		Clock,
		Coins,
		Target,
		Calendar,
		ArrowUpRight,
		ArrowDownRight,
		Sparkles,
		Award,
		Zap,
		ChevronRight,
		Info
	} from 'lucide-svelte';
	import confetti from 'canvas-confetti';
	import { workStore } from '#lib/storage.svelte';
	import {
		calculateMonthOverMonth,
		calculateGoalProgress,
		calculateMonthlySummary,
		groupSessionsByDate,
		formatCurrency,
		formatHours,
		formatThaiDate,
		isWeekend,
		calculateSessionWage,
		getLocalDateString
	} from '#lib/calculator';

	let {
		onNavigateToClock,
		onNavigateToConfig
	}: {
		onNavigateToClock?: () => void;
		onNavigateToConfig?: () => void;
	} = $props();

	// Selected timeframe for chart: 'this-month' | 'last-30'
	let chartTimeframe = $state<'this-month' | 'last-30'>('this-month');
	let activeBarIndex = $state<number | null>(null);

	function triggerHaptic(duration = 10) {
		if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// ignore
			}
		}
	}

	function fireGoalConfetti() {
		triggerHaptic(25);
		if (typeof window === 'undefined') return;
		try {
			confetti({
				particleCount: 80,
				spread: 90,
				origin: { y: 0.5 }
			});
		} catch {
			// ignore
		}
	}

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	// Month-over-month calculation
	const mom = $derived.by(() => {
		return calculateMonthOverMonth(
			workStore.sessions,
			workStore.config,
			currentYear,
			currentMonth
		);
	});

	// Current month summary
	const monthSummary = $derived(workStore.currentMonthSummary);

	// Goal progress
	const goalProgress = $derived(workStore.monthlyGoalProgress);

	// Daily average hours
	const dailyAverageHours = $derived.by(() => {
		if (monthSummary.daysWorked === 0) return 0;
		return Math.round((monthSummary.totalHours / monthSummary.daysWorked) * 10) / 10;
	});

	// Chart daily points
	interface ChartDayPoint {
		dateStr: string;
		dayLabel: string;
		hours: number;
		netWage: number;
		isWeekend: boolean;
	}

	const chartData = $derived.by<ChartDayPoint[]>(() => {
		const points: ChartDayPoint[] = [];

		if (chartTimeframe === 'this-month') {
			// Days of this month up to today (or end of month)
			const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
			const todayDate = now.getDate();
			const maxDay = Math.min(daysInMonth, todayDate);

			// Pre-index grouped sessions for this month
			const monthGroups = groupSessionsByDate(workStore.sessions, workStore.config);
			const map = new Map<string, { totalHours: number; netWage: number }>();
			for (const g of monthGroups) {
				map.set(g.date, { totalHours: g.totalHours, netWage: g.netWage });
			}

			// Generate points for days 1 to today
			for (let d = 1; d <= maxDay; d++) {
				const dayFormatted = String(d).padStart(2, '0');
				const monthFormatted = String(currentMonth).padStart(2, '0');
				const dateStr = `${currentYear}-${monthFormatted}-${dayFormatted}`;
				const entry = map.get(dateStr) || { totalHours: 0, netWage: 0 };

				points.push({
					dateStr,
					dayLabel: `${d}`,
					hours: entry.totalHours,
					netWage: entry.netWage,
					isWeekend: isWeekend(dateStr)
				});
			}
		} else {
			// Last 14 days
			const monthGroups = groupSessionsByDate(workStore.sessions, workStore.config);
			const map = new Map<string, { totalHours: number; netWage: number }>();
			for (const g of monthGroups) {
				map.set(g.date, { totalHours: g.totalHours, netWage: g.netWage });
			}

			for (let i = 13; i >= 0; i--) {
				const target = new Date();
				target.setDate(now.getDate() - i);
				const dateStr = getLocalDateString(target);
				const entry = map.get(dateStr) || { totalHours: 0, netWage: 0 };

				points.push({
					dateStr,
					dayLabel: `${target.getDate()}/${target.getMonth() + 1}`,
					hours: entry.totalHours,
					netWage: entry.netWage,
					isWeekend: isWeekend(dateStr)
				});
			}
		}

		return points;
	});

	// Max hours for chart Y-scaling
	const maxChartHours = $derived.by(() => {
		const max = Math.max(...chartData.map((p) => p.hours), 8);
		return Math.ceil(max);
	});

	// Weekday vs Weekend earnings breakdown
	const splitBreakdown = $derived.by(() => {
		let weekdayHours = 0;
		let weekdayWage = 0;
		let weekendHours = 0;
		let weekendWage = 0;

		const currentPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
		const thisMonthSessions = workStore.sessions.filter((s) => s.date.startsWith(currentPrefix));

		for (const s of thisMonthSessions) {
			const weekend = isWeekend(s);
			const calc = calculateSessionWage(s, workStore.config);
			if (weekend) {
				weekendHours += calc.roundedDurationHours;
				weekendWage += calc.netWage;
			} else {
				weekdayHours += calc.roundedDurationHours;
				weekdayWage += calc.netWage;
			}
		}

		return {
			weekdayHours: Math.round(weekdayHours * 10) / 10,
			weekdayWage: Math.round(weekdayWage),
			weekendHours: Math.round(weekendHours * 10) / 10,
			weekendWage: Math.round(weekendWage)
		};
	});
</script>

<div class="flex flex-col space-y-5 pb-8 pt-2">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-base font-bold text-slate-900 dark:text-white">ภาพรวมและแดชบอร์ด</h2>
			<p class="text-xs text-slate-500 dark:text-slate-400">
				สรุปผลการทำงานประจำเดือน {currentMonth}/{currentYear}
			</p>
		</div>

		<div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
			<button
				type="button"
				onclick={() => {
					triggerHaptic(8);
					chartTimeframe = 'this-month';
				}}
				class="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all {chartTimeframe ===
				'this-month'
					? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-blue-400'
					: 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
			>
				เดือนนี้
			</button>
			<button
				type="button"
				onclick={() => {
					triggerHaptic(8);
					chartTimeframe = 'last-30';
				}}
				class="rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all {chartTimeframe ===
				'last-30'
					? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-blue-400'
					: 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
			>
				14 วันล่าสุด
			</button>
		</div>
	</div>

	<!-- Monthly Income Goal Progress Card -->
	<div
		class="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-tr from-white via-white to-blue-50/60 p-5 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
				>
					<Target size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-slate-800 dark:text-slate-200">เป้าหมายรายได้เดือนนี้</h3>
					<span class="text-[11px] text-slate-400">
						เป้าหมาย: {formatCurrency(workStore.config.monthlyIncomeGoal, workStore.config.currency, 0)}
					</span>
				</div>
			</div>

			<div class="text-right">
				<span class="font-mono text-xl font-black text-blue-600 dark:text-blue-400">
					{goalProgress.percent}%
				</span>
			</div>
		</div>

		<!-- Progress Bar -->
		<div class="relative mt-3 h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
			<div
				class="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-700"
				style="width: {goalProgress.percent}%;"
			></div>
		</div>

		<!-- Status details under bar -->
		<div class="mt-2.5 flex items-center justify-between text-xs font-medium">
			<span class="text-slate-600 dark:text-slate-300">
				ทำได้แล้ว: <strong class="text-emerald-600 dark:text-emerald-400"
					>{formatCurrency(monthSummary.netWage, workStore.config.currency)}</strong
				>
			</span>

			{#if goalProgress.isReached}
				<button
					type="button"
					onclick={fireGoalConfetti}
					class="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:scale-105 active:scale-95 dark:text-amber-400"
				>
					<Sparkles size={14} />
					<span>🎉 บรรลุเป้าแล้ว!</span>
				</button>
			{:else}
				<span class="text-slate-500 dark:text-slate-400">
					เหลืออีก {formatCurrency(goalProgress.remaining, workStore.config.currency)}
				</span>
			{/if}
		</div>
	</div>

	<!-- Key KPI Cards (2x2 Grid) -->
	<div class="grid grid-cols-2 gap-3">
		<!-- KPI 1: Net Pay This Month -->
		<div
			class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 dark:text-slate-400">ค่าจ้างสุทธิเดือนนี้</span>
				<div
					class="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
				>
					<Coins size={15} />
				</div>
			</div>
			<div class="mt-2 font-mono text-xl font-black text-slate-900 dark:text-white">
				{formatCurrency(monthSummary.netWage, workStore.config.currency, 0)}
			</div>
			<div class="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
				<span>หักภาษี {workStore.config.taxDeductionPercent}% แล้ว</span>
			</div>
		</div>

		<!-- KPI 2: Total Hours This Month -->
		<div
			class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 dark:text-slate-400">ชั่วโมงสะสมเดือนนี้</span>
				<div
					class="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
				>
					<Clock size={15} />
				</div>
			</div>
			<div class="mt-2 font-mono text-xl font-black text-slate-900 dark:text-white">
				{monthSummary.totalHours} <span class="text-xs font-normal">ชม.</span>
			</div>
			<div class="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
				<span>รวม {monthSummary.sessionCount} กะการทำงาน</span>
			</div>
		</div>

		<!-- KPI 3: Daily Average Hours -->
		<div
			class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 dark:text-slate-400">เฉลี่ยชั่วโมง/วัน</span>
				<div
					class="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
				>
					<Zap size={15} />
				</div>
			</div>
			<div class="mt-2 font-mono text-xl font-black text-slate-900 dark:text-white">
				{dailyAverageHours} <span class="text-xs font-normal">ชม./วัน</span>
			</div>
			<div class="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
				<span>ทำงานทั้งหมด {monthSummary.daysWorked} วัน</span>
			</div>
		</div>

		<!-- KPI 4: Month-over-Month Net Pay Change -->
		<div
			class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 dark:text-slate-400">เทียบเดือนก่อน (MoM)</span>
				<div
					class="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
				>
					<TrendingUp size={15} />
				</div>
			</div>
			<div
				class="mt-2 flex items-baseline gap-1 font-mono text-xl font-black {mom.netWageDiff >= 0
					? 'text-emerald-600 dark:text-emerald-400'
					: 'text-rose-600 dark:text-rose-400'}"
			>
				<span>{mom.netWageDiff >= 0 ? '+' : ''}{mom.netWagePercentChange}%</span>
			</div>
			<div class="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
				<span>{mom.netWageDiff >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} {formatCurrency(Math.abs(mom.netWageDiff), workStore.config.currency, 0)}</span>
			</div>
		</div>
	</div>

	<!-- Interactive SVG Bar Chart -->
	<div
		class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
	>
		<div class="flex items-center justify-between pb-3">
			<div class="flex items-center gap-1.5">
				<Calendar size={16} class="text-blue-600 dark:text-blue-400" />
				<h3 class="text-xs font-bold text-slate-900 dark:text-white">กราฟชั่วโมงทำงานรายวัน</h3>
			</div>

			<!-- Legend -->
			<div class="flex items-center gap-3 text-[10px]">
				<div class="flex items-center gap-1 text-slate-500">
					<span class="h-2 w-2 rounded-xs bg-blue-500"></span>
					<span>วันธรรมดา</span>
				</div>
				<div class="flex items-center gap-1 text-purple-600 dark:text-purple-400">
					<span class="h-2 w-2 rounded-xs bg-purple-500"></span>
					<span>วันหยุด (1.5x)</span>
				</div>
			</div>
		</div>

		<!-- SVG Chart Canvas -->
		<div class="relative mt-2 w-full">
			<svg
				viewBox="0 0 320 150"
				class="w-full overflow-visible font-sans select-none"
				role="img"
				aria-label="กราฟแสดงชั่วโมงทำงานรายวัน"
			>
				<!-- Horizontal Grid Lines -->
				<line x1="0" y1="120" x2="320" y2="120" stroke="currentColor" class="text-slate-200 dark:text-slate-800" stroke-width="1" />
				<line x1="0" y1="70" x2="320" y2="70" stroke="currentColor" class="text-slate-200/70 dark:text-slate-800/70" stroke-width="0.75" stroke-dasharray="3 3" />
				<line x1="0" y1="20" x2="320" y2="20" stroke="currentColor" class="text-slate-200/70 dark:text-slate-800/70" stroke-width="0.75" stroke-dasharray="3 3" />

				<!-- Y Axis Labels -->
				<text x="316" y="23" text-anchor="end" class="text-[8px] fill-slate-400">{maxChartHours}h</text>
				<text x="316" y="73" text-anchor="end" class="text-[8px] fill-slate-400">{Math.round(maxChartHours / 2)}h</text>

				<!-- Bars -->
				{#each chartData as point, idx}
					{@const totalPoints = chartData.length}
					{@const slotWidth = 300 / Math.max(totalPoints, 1)}
					{@const barWidth = Math.max(3, Math.min(16, slotWidth * 0.68))}
					{@const x = 10 + idx * slotWidth + (slotWidth - barWidth) / 2}
					{@const barHeight = point.hours > 0 ? (point.hours / maxChartHours) * 100 : 2}
					{@const y = 120 - barHeight}
					{@const isSelected = activeBarIndex === idx}

					<!-- Bar Click / Touch Target -->
					<g
						tabindex="0"
						role="button"
						aria-label={`วันที่ ${point.dayLabel}: ${point.hours} ชม.`}
						onclick={() => {
							triggerHaptic(8);
							activeBarIndex = activeBarIndex === idx ? null : idx;
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								activeBarIndex = activeBarIndex === idx ? null : idx;
							}
						}}
						class="cursor-pointer transition-all duration-150"
					>
						<!-- Interactive Hit Area -->
						<rect
							{x}
							y="10"
							width={barWidth}
							height="120"
							fill="transparent"
						/>

						<!-- Actual Visual Bar -->
						<rect
							{x}
							{y}
							width={barWidth}
							height={barHeight}
							rx="3"
							class="transition-all duration-200 {point.isWeekend
								? isSelected
									? 'fill-purple-400 brightness-125'
									: 'fill-purple-500 hover:fill-purple-400'
								: isSelected
									? 'fill-blue-400 brightness-125'
									: 'fill-blue-500 hover:fill-blue-400'}"
						/>

						<!-- X-axis Date label (show every few bars to prevent clutter) -->
						{#if totalPoints <= 15 || idx % Math.ceil(totalPoints / 8) === 0 || idx === totalPoints - 1}
							<text
								x={x + barWidth / 2}
								y="134"
								text-anchor="middle"
								class="text-[8px] font-medium {point.isWeekend
									? 'fill-purple-500 font-bold'
									: 'fill-slate-400'}"
							>
								{point.dayLabel}
							</text>
						{/if}
					</g>
				{/each}
			</svg>
		</div>

		<!-- Interactive Tooltip Display for Selected Bar -->
		{#if activeBarIndex !== null && chartData[activeBarIndex]}
			{@const p = chartData[activeBarIndex]}
			<div
				class="mt-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-xs dark:border-blue-900/60 dark:bg-blue-950/40"
			>
				<div>
					<div class="font-bold text-blue-900 dark:text-blue-200">
						{formatThaiDate(p.dateStr, { showDayOfWeek: true, showYear: false })}
						{#if p.isWeekend}
							<span class="rounded bg-purple-200 px-1 text-[9px] text-purple-800 dark:bg-purple-900 dark:text-purple-200">
								วันหยุด 1.5x
							</span>
						{/if}
					</div>
					<div class="text-[11px] text-blue-700 dark:text-blue-300">
						ทำงาน: <strong>{p.hours} ชม.</strong> ({formatCurrency(p.netWage, workStore.config.currency)})
					</div>
				</div>
				<button
					type="button"
					onclick={() => (activeBarIndex = null)}
					class="rounded-lg p-1 text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900 text-[10px]"
				>
					ปิด
				</button>
			</div>
		{/if}
	</div>

	<!-- Month-Over-Month Detailed Comparison Card -->
	<div
		class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
	>
		<div class="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
			<TrendingUp size={16} class="text-blue-600 dark:text-blue-400" />
			<h3 class="text-xs font-bold text-slate-900 dark:text-white">
				เปรียบเทียบกับเดือนที่แล้ว
			</h3>
		</div>

		<div class="mt-3 space-y-3 text-xs">
			<!-- Hours comparison row -->
			<div class="flex items-center justify-between">
				<div>
					<div class="font-semibold text-slate-700 dark:text-slate-300">ชั่วโมงทำงานรวม</div>
					<div class="text-[10px] text-slate-400">
						เดือนนี้: {mom.current.totalHours} ชม. | เดือนก่อน: {mom.previous.totalHours} ชม.
					</div>
				</div>
				<div
					class="flex items-center gap-1 font-mono font-bold {mom.hourDiff >= 0
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-rose-600 dark:text-rose-400'}"
				>
					{#if mom.hourDiff >= 0}
						<ArrowUpRight size={14} />
						<span>+{mom.hourDiff} ชม. (+{mom.hourPercentChange}%)</span>
					{:else}
						<ArrowDownRight size={14} />
						<span>{mom.hourDiff} ชม. ({mom.hourPercentChange}%)</span>
					{/if}
				</div>
			</div>

			<!-- Net Wage comparison row -->
			<div class="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
				<div>
					<div class="font-semibold text-slate-700 dark:text-slate-300">ค่าจ้างสุทธิ (บาท)</div>
					<div class="text-[10px] text-slate-400">
						เดือนนี้: {formatCurrency(mom.current.netWage, workStore.config.currency, 0)} | เดือนก่อน: {formatCurrency(mom.previous.netWage, workStore.config.currency, 0)}
					</div>
				</div>
				<div
					class="flex items-center gap-1 font-mono font-bold {mom.netWageDiff >= 0
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-rose-600 dark:text-rose-400'}"
				>
					{#if mom.netWageDiff >= 0}
						<ArrowUpRight size={14} />
						<span>+{formatCurrency(mom.netWageDiff, workStore.config.currency, 0)} (+{mom.netWagePercentChange}%)</span>
					{:else}
						<ArrowDownRight size={14} />
						<span>{formatCurrency(mom.netWageDiff, workStore.config.currency, 0)} ({mom.netWagePercentChange}%)</span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Weekday vs Weekend Split Breakdown -->
	<div
		class="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
	>
		<h3 class="text-xs font-bold text-slate-900 dark:text-white mb-3">
			สัดส่วนรายได้ วันธรรมดา vs วันหยุด
		</h3>

		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-2xl bg-blue-50/70 p-3 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60">
				<div class="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
					<span class="h-2 w-2 rounded-full bg-blue-500"></span>
					<span>วันธรรมดา (1.0x)</span>
				</div>
				<div class="mt-2 font-mono text-base font-black text-slate-900 dark:text-white">
					{formatCurrency(splitBreakdown.weekdayWage, workStore.config.currency, 0)}
				</div>
				<div class="text-[10px] text-slate-500 dark:text-slate-400">
					{splitBreakdown.weekdayHours} ชม.
				</div>
			</div>

			<div class="rounded-2xl bg-purple-50/70 p-3 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60">
				<div class="flex items-center gap-1.5 text-xs font-bold text-purple-800 dark:text-purple-300">
					<span class="h-2 w-2 rounded-full bg-purple-500"></span>
					<span>วันหยุด ({workStore.config.weekendMultiplier}x)</span>
				</div>
				<div class="mt-2 font-mono text-base font-black text-purple-700 dark:text-purple-300">
					{formatCurrency(splitBreakdown.weekendWage, workStore.config.currency, 0)}
				</div>
				<div class="text-[10px] text-slate-500 dark:text-slate-400">
					{splitBreakdown.weekendHours} ชม.
				</div>
			</div>
		</div>
	</div>
</div>
