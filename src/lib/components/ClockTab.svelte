<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Play,
		Square,
		Coffee,
		Clock,
		Sparkles,
		Flame,
		Edit3,
		Trash2,
		AlertCircle,
		CheckCircle2,
		Calendar,
		Coins,
		Timer,
		X,
		ShieldAlert,
		ArrowRight,
		Sliders,
		Check,
		RotateCw
	} from 'lucide-svelte';
	import confetti from 'canvas-confetti';
	import { workStore } from '#lib/storage.svelte';
	import {
		calculateLiveSession,
		calculateSessionWage,
		calculateSessionDuration,
		calculateBreakDuration,
		calculateTimedModeProgress,
		formatCountdown,
		formatDuration,
		formatCurrency,
		formatTime,
		formatThaiDate,
		isWeekend,
		roundDuration
	} from '#lib/calculator';
	import type { WorkSession } from '#lib/types';
	import SafeguardModal from './SafeguardModal.svelte';

	let { onNavigateToHistory }: { onNavigateToHistory?: () => void } = $props();

	// Live tick timestamp
	let now = $state(Date.now());
	let tickTimer: ReturnType<typeof setInterval> | null = null;

	// UI input states
	let clockInNote = $state('');
	let showClockOutConfirm = $state(false);
	let showDeleteConfirm = $state<string | null>(null);
	let showSafeguardModal = $state(false);

	// Edit session modal state
	let editingSession = $state<WorkSession | null>(null);
	let editDate = $state('');
	let editStartTime = $state('');
	let editEndTime = $state('');
	let editBreakMinutes = $state(0);
	let editNote = $state('');

	onMount(() => {
		now = Date.now();
		tickTimer = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (tickTimer) {
			clearInterval(tickTimer);
			tickTimer = null;
		}
	});

	function triggerHaptic(duration = 15) {
		if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// ignore
			}
		}
	}

	function fireConfetti() {
		if (typeof window === 'undefined') return;
		try {
			confetti({
				particleCount: 60,
				spread: 70,
				origin: { y: 0.6 }
			});
		} catch {
			// ignore
		}
	}

	// Live calculations for active session
	const liveSession = $derived.by(() => {
		if (!workStore.activeSession) return null;
		return calculateLiveSession(workStore.activeSession, workStore.config, now);
	});

	// Break duration for currently open break
	const currentOpenBreakDuration = $derived.by(() => {
		if (!workStore.activeSession) return 0;
		const openBreak = workStore.activeSession.breaks.find((b) => b.end === null);
		if (!openBreak) return 0;
		return Math.max(0, now - openBreak.start);
	});

	// Timed Mode progress calculations
	const timedProgress = $derived.by(() => {
		return calculateTimedModeProgress(workStore.config, now, workStore.activeSession);
	});

	// Weekend check for today
	const isTodayWeekend = $derived(isWeekend(new Date()));
	const effectiveCurrentRate = $derived(
		isTodayWeekend
			? workStore.config.hourlyRate * workStore.config.weekendMultiplier
			: workStore.config.hourlyRate
	);

	// Mode toggle
	function handleSetDualMode(isTimed: boolean) {
		triggerHaptic(12);
		workStore.updateConfig({ timedModeEnabled: isTimed });
	}

	// Actions
	function handleClockIn() {
		triggerHaptic(25);
		workStore.clockIn(clockInNote);
		clockInNote = '';
	}

	function handleClockOut() {
		triggerHaptic(30);
		const completed = workStore.clockOut();
		showClockOutConfirm = false;
		if (completed) {
			fireConfetti();
		}
	}

	function handleStartTimedShift() {
		triggerHaptic(25);
		workStore.startScheduledShift();
	}

	function handleCompleteTimedShift() {
		triggerHaptic(30);
		const completed = workStore.completeScheduledShift();
		if (completed) {
			fireConfetti();
		}
	}

	function handleToggleBreak() {
		triggerHaptic(18);
		workStore.toggleBreak();
	}

	function handleDeleteSession(id: string) {
		triggerHaptic(20);
		workStore.deleteSession(id);
		showDeleteConfirm = null;
	}

	function openEditModal(session: WorkSession) {
		editingSession = session;
		editDate = session.date;

		const startD = new Date(session.startTime);
		editStartTime = `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`;

		if (session.endTime) {
			const endD = new Date(session.endTime);
			editEndTime = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
		} else {
			editEndTime = '';
		}

		const breakMs = calculateBreakDuration(session.breaks, session.endTime || Date.now());
		editBreakMinutes = Math.round(breakMs / (60 * 1000));
		editNote = session.note || '';
	}

	function handleSaveEdit() {
		if (!editingSession || !editDate || !editStartTime || !editEndTime) return;

		const [startH, startM] = editStartTime.split(':').map(Number);
		const [endH, endM] = editEndTime.split(':').map(Number);
		const [year, month, day] = editDate.split('-').map(Number);

		const startDate = new Date(year, month - 1, day, startH, startM, 0, 0);
		const endDate = new Date(year, month - 1, day, endH, endM, 0, 0);

		let startTimeMs = startDate.getTime();
		let endTimeMs = endDate.getTime();

		if (endTimeMs < startTimeMs) {
			// Crosses midnight
			endTimeMs += 24 * 60 * 60 * 1000;
		}

		const breaks =
			editBreakMinutes > 0
				? [
						{
							start: startTimeMs + 60 * 1000,
							end: startTimeMs + (1 + editBreakMinutes) * 60 * 1000
						}
					]
				: [];

		workStore.updateSession(editingSession.id, {
			date: editDate,
			startTime: startTimeMs,
			endTime: endTimeMs,
			breaks,
			note: editNote.trim()
		});

		editingSession = null;
		triggerHaptic(15);
	}
</script>

<div class="flex flex-col space-y-4 pb-6 pt-2">
	<!-- SAFEGUARD ALERT BANNER (High-Priority Alert when active shift >= safeguardMaxHours) -->
	{#if workStore.isSafeguardTriggered}
		<div
			class="flex items-start justify-between gap-3 rounded-2xl border border-amber-400 bg-amber-500/10 p-4 shadow-sm backdrop-blur-xs dark:border-amber-500/40 dark:bg-amber-950/40"
		>
			<div class="flex items-start gap-3">
				<div
					class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs"
				>
					<ShieldAlert size={20} class="animate-pulse" />
				</div>
				<div>
					<div class="text-sm font-bold text-amber-900 dark:text-amber-200">
						แจ้งเตือน: บันทึกเวลาเกิน {workStore.config.safeguardMaxHours} ชม. แล้ว
					</div>
					<div class="mt-0.5 text-xs text-amber-700/90 dark:text-amber-400">
						คุณอาจลืมกดออกงานเมื่อจบกะ มี 3 ตัวเลือกจัดการทันที
					</div>
				</div>
			</div>

			<button
				type="button"
				onclick={() => {
					triggerHaptic(12);
					showSafeguardModal = true;
				}}
				class="shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 active:scale-[0.98] transition-all"
			>
				จัดการ
			</button>
		</div>
	{/if}

	<!-- DUAL MODE SWITCH (⏱️ Stopwatch Mode vs 📅 Timed Schedule Mode) -->
	<div class="flex rounded-2xl border border-zinc-200/80 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#121215]">
		<button
			type="button"
			onclick={() => handleSetDualMode(false)}
			class="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all duration-150 {workStore.config.timedModeEnabled === false
				? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
				: 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}"
		>
			<Timer size={14} />
			<span>⏱️ โหมดจับเวลาสด</span>
		</button>
		<button
			type="button"
			onclick={() => handleSetDualMode(true)}
			class="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all duration-150 {workStore.config.timedModeEnabled === true
				? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
				: 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}"
		>
			<Calendar size={14} />
			<span>📅 โหมดกะตารางเวลา</span>
		</button>
	</div>

	<!-- RATE & TODAY'S ACCUMULATED STATS -->
	<div
		class="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
			>
				<Coins size={18} />
			</div>
			<div>
				<div class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">อัตราค่าจ้าง</div>
				<div class="flex items-center gap-1.5 font-bold font-mono text-zinc-900 dark:text-white tabular-nums">
					<span>{formatCurrency(effectiveCurrentRate, workStore.config.currency, 0)}/ชม.</span>
					{#if isTodayWeekend}
						<span
							class="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-700 dark:bg-purple-950 dark:text-purple-300"
						>
							วันหยุด {workStore.config.weekendMultiplier}x
						</span>
					{:else}
						<span class="text-[11px] font-normal text-zinc-400 font-sans">
							({workStore.config.roundingMode === 'exact'
								? 'ตามจริง'
								: workStore.config.roundingMode === '15m'
									? 'ปัด 15น.'
									: 'ปัด 30น.'})
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Today's Total Earned Badge -->
		<div class="text-right">
			<div class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">สะสมวันนี้ (สุทธิ)</div>
			<div class="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
				{formatCurrency(workStore.todaySummary.netWage, workStore.config.currency)}
			</div>
		</div>
	</div>

	<!-- CENTRAL HERO SECTION: DUAL MODE PRESENTATION -->
	{#if workStore.config.timedModeEnabled}
		<!-- ============================================== -->
		<!-- TIMED SCHEDULE MODE (📅 Scheduled Shift)        -->
		<!-- ============================================== -->
		<div
			class="relative flex flex-col items-center justify-center rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121215]"
		>
			<!-- Scheduled Shift Header -->
			<div class="flex w-full items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
						<Clock size={16} />
					</div>
					<div>
						<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">ตารางกะวันนี้</span>
						<div class="font-mono text-xs font-bold text-zinc-900 dark:text-white tabular-nums">
							{workStore.config.scheduledStart} - {workStore.config.scheduledEnd}
						</div>
					</div>
				</div>

				<div class="text-right">
					<span
						class="rounded-full px-2 py-0.5 text-[11px] font-bold {timedProgress.isShiftComplete
							? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
							: timedProgress.isShiftActive
								? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
								: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'}"
					>
						{timedProgress.isShiftComplete
							? '🏁 สิ้นสุดเวลากะ'
							: timedProgress.isShiftActive
								? '● กำลังทำงาน'
								: '⏳ รอเริ่มกะ'}
					</span>
				</div>
			</div>

			<!-- Large Circular / Linear Progress Meter -->
			<div class="my-5 flex w-full flex-col items-center">
				<!-- Countdown Display -->
				<div class="text-center">
					<span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
						{timedProgress.isShiftComplete
							? 'สิ้นสุดกะทำงานแล้ว'
							: timedProgress.isShiftActive
								? 'เวลาที่เหลือก่อนเลิกกะ'
								: 'นับถอยหลังสู่เวลากะ'}
					</span>
					<div class="font-mono text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white tabular-nums">
						{formatCountdown(
							timedProgress.isShiftComplete ? 0 : timedProgress.remainingMs,
							'digital'
						)}
					</div>
				</div>

				<!-- Progress Bar -->
				<div class="mt-4 w-full max-w-xs">
					<div class="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5 font-mono tabular-nums">
						<span>ความคืบหน้า</span>
						<span class="font-bold text-blue-600 dark:text-blue-400">{timedProgress.percentComplete}%</span>
					</div>
					<div class="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300"
							style="width: {timedProgress.percentComplete}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Estimated Shift Earnings Card -->
			<div
				class="w-full max-w-xs rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-white/5 dark:bg-zinc-900/40 mb-4"
			>
				<div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pb-2 border-b border-zinc-200/60 dark:border-white/5">
					<span>ระยะเวลากะ</span>
					<span class="font-mono tabular-nums font-bold text-zinc-800 dark:text-zinc-200">
						{timedProgress.expectedHours} ชม.
					</span>
				</div>
				<div class="flex items-center justify-between pt-2">
					<div>
						<span class="text-[11px] text-zinc-500 dark:text-zinc-400 block">ประมาณการค่าจ้างกะนี้</span>
						<span class="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
							{formatCurrency(timedProgress.expectedNetWage, workStore.config.currency)}
						</span>
					</div>
					<div class="text-right text-[10px] text-zinc-400">
						(ก่อนภาษี {formatCurrency(timedProgress.expectedGrossWage, workStore.config.currency)})
					</div>
				</div>
			</div>

			<!-- 1-Tap Quick Actions for Timed Mode -->
			<div class="w-full max-w-xs space-y-2.5">
				{#if !workStore.isClockedIn}
					<button
						type="button"
						onclick={handleStartTimedShift}
						class="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 px-4 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-[0.98] transition-all"
					>
						<Play size={18} class="fill-current" />
						<span>เริ่มกะตามตารางทันที</span>
					</button>
				{:else}
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={handleToggleBreak}
							class="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 px-2 text-xs font-bold text-amber-800 hover:bg-amber-100 active:scale-[0.98] transition-all dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-300"
						>
							<Coffee size={15} />
							<span>{workStore.isOnBreak ? 'สิ้นสุดพัก' : 'พักเบรก'}</span>
						</button>

						<button
							type="button"
							onclick={handleCompleteTimedShift}
							class="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-[0.98] transition-all"
						>
							<CheckCircle2 size={15} />
							<span>จบกะตามกำหนด</span>
						</button>
					</div>

					<button
						type="button"
						onclick={handleClockOut}
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-[0.98] transition-all dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
					>
						<Square size={14} class="fill-current" />
						<span>ออกงานทันที (ตัดเวลาปัจจุบัน)</span>
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<!-- ============================================== -->
		<!-- STOPWATCH MODE (⏱️ Classic Live Timer)         -->
		<!-- ============================================== -->
		<div
			class="relative flex flex-col items-center justify-center rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121215]"
		>
			{#if !workStore.isClockedIn}
				<!-- READY TO CLOCK IN -->
				<div class="flex w-full flex-col items-center text-center">
					<span
						class="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
					>
						<Sparkles size={13} class="text-blue-500" /> พร้อมเริ่มงานวันนี้
					</span>

					<!-- Giant Circular Clock In Button -->
					<div class="relative my-4 flex items-center justify-center">
						<div
							class="absolute -inset-3 rounded-full bg-emerald-500/20 animate-pulse dark:bg-emerald-500/10"
						></div>

						<button
							type="button"
							onclick={handleClockIn}
							class="group relative flex h-48 w-48 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-hidden"
						>
							<div
								class="absolute inset-1 rounded-full border-2 border-white/30 border-dashed animate-[spin_20s_linear_infinite]"
							></div>
							<Play size={44} class="ml-1 text-white drop-shadow-md transition-transform group-hover:scale-110" />
							<span class="mt-2 text-xl font-black tracking-wider drop-shadow-xs">เข้างาน</span>
							<span class="text-[11px] font-medium tracking-wide text-emerald-100 uppercase">CLOCK IN</span>
						</button>
					</div>

					<!-- Quick Note Input for Clock In -->
					<div class="mt-4 w-full max-w-xs">
						<label for="clockin-note-input" class="sr-only">โน้ตช่วยจำก่อนเข้างาน</label>
						<input
							id="clockin-note-input"
							type="text"
							bind:value={clockInNote}
							placeholder="โน้ตช่วยจำ เช่น กะเช้า, ประชุมทีม (ไม่บังคับ)..."
							class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-800 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:placeholder-zinc-500"
						/>
					</div>
				</div>
			{:else}
				<!-- CLOCKED IN (WORKING OR ON BREAK) -->
				<div class="flex w-full flex-col items-center text-center">
					<!-- Status Banner -->
					<div class="mb-2 flex items-center justify-center gap-2">
						{#if workStore.isOnBreak}
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:ring-amber-700"
							>
								<Coffee size={14} class="animate-bounce" /> กำลังพักเบรก
							</span>
						{:else}
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:ring-emerald-700"
							>
								<span class="relative flex h-2 w-2">
									<span
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
									></span>
									<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
								</span>
								กำลังบันทึกเวลาทำงาน
							</span>
						{/if}
					</div>

					<!-- Live Digital Ticking Timer -->
					<div class="my-1 flex flex-col items-center">
						<div
							class="font-mono text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white tabular-nums drop-shadow-xs"
						>
							{formatDuration(liveSession?.netDurationMs ?? 0, 'digital')}
						</div>
						<div class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
							<Timer size={13} />
							<span>เวลาทำงานสุทธิ (หักเวลาพักแล้ว)</span>
						</div>
					</div>

					<!-- Live Estimated Earnings Ticker -->
					<div
						class="my-3 flex w-full max-w-xs flex-col items-center rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-white/5 dark:bg-zinc-900/50"
					>
						<span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
							ประมาณการค่าจ้างกะนี้ (สุทธิ)
						</span>
						<div
							class="flex items-baseline gap-1 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums"
						>
							<span>{workStore.config.currency}</span>
							<span>{(liveSession?.continuousNet ?? 0).toFixed(2)}</span>
						</div>
						<div class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tabular-nums">
							ยอดปัดเศษตามจริง: {formatCurrency(
								liveSession?.rounded.netWage ?? 0,
								workStore.config.currency
							)}
						</div>
					</div>

					<!-- Break status details if on break -->
					{#if workStore.isOnBreak}
						<div
							class="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 font-mono tabular-nums"
						>
							<Coffee size={15} class="text-amber-600 dark:text-amber-400" />
							<span>
								พักเบรกมาแล้ว {formatDuration(currentOpenBreakDuration, 'digital')}
							</span>
						</div>
					{/if}

					<!-- Action Controls -->
					<div class="my-2 flex w-full max-w-xs flex-col items-center gap-3">
						<!-- Break / Resume Toggle Button -->
						<button
							type="button"
							onclick={handleToggleBreak}
							class="flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 font-bold transition-all duration-150 active:scale-[0.98] shadow-xs {workStore.isOnBreak
								? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
								: 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}"
						>
							<Coffee size={18} />
							<span>{workStore.isOnBreak ? '☕ จบเวลาพัก & ทำงานต่อ' : '☕ กดพักเบรก (Pause)'}</span>
						</button>

						<!-- Clock Out Button -->
						{#if !showClockOutConfirm}
							<button
								type="button"
								onclick={() => {
									triggerHaptic(15);
									showClockOutConfirm = true;
								}}
								class="group flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3.5 px-4 font-extrabold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-500 active:scale-[0.98] transition-all"
							>
								<Square size={18} class="fill-current text-white" />
								<span class="text-base tracking-wide">ออกงาน (CLOCK OUT)</span>
							</button>
						{:else}
							<!-- Confirmation Card for Clock Out -->
							<div
								class="flex w-full flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 dark:border-red-900/60 dark:bg-red-950/40"
							>
								<div class="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-300">
									<AlertCircle size={15} />
									<span>ยืนยันการสิ้นสุดการทำงานกะนี้?</span>
								</div>
								<div class="text-[11px] text-red-700/80 dark:text-red-400">
									ระบบจะสรุปชั่วโมงและบันทึกเข้าประวัติงานทันที
								</div>
								<div class="mt-1 grid grid-cols-2 gap-2">
									<button
										type="button"
										onclick={() => (showClockOutConfirm = false)}
										class="rounded-xl border border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
									>
										ยกเลิก
									</button>
									<button
										type="button"
										onclick={handleClockOut}
										class="rounded-xl bg-red-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 active:scale-[0.98] transition-all"
									>
										ยืนยันออกงาน
									</button>
								</div>
							</div>
						{/if}
					</div>

					<!-- Active Session Note Editing -->
					<div class="mt-2 flex w-full max-w-xs items-center gap-2">
						<input
							type="text"
							value={workStore.activeSession?.note || ''}
							placeholder="เพิ่มหรือแก้ไขโน้ตช่วยจำ..."
							onblur={(e) => {
								const target = e.currentTarget;
								workStore.updateSession(workStore.activeSession!.id, {
									note: target.value
								});
							}}
							class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:placeholder-zinc-500"
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TODAY'S COMPLETED SESSIONS CARD -->
	<div
		class="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
			<div class="flex items-center gap-2">
				<Calendar size={18} class="text-blue-600 dark:text-blue-400" />
				<h2 class="text-sm font-bold text-zinc-900 dark:text-white">
					กะงานที่เสร็จสิ้นวันนี้ ({workStore.todaySessions.length})
				</h2>
			</div>

			{#if workStore.todaySessions.length > 0}
				<div class="text-right">
					<span class="text-xs font-bold font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
						รวม {workStore.todaySummary.totalHours} ชม.
					</span>
				</div>
			{/if}
		</div>

		{#if workStore.todaySessions.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-center">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
				>
					<Clock size={24} />
				</div>
				<p class="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
					ยังไม่มีกะงานที่จบแล้วในวันนี้
				</p>
				<p class="text-[11px] text-zinc-400 dark:text-zinc-500">
					กดปุ่ม "เข้างาน" ด้านบนเพื่อเริ่มบันทึกกะแรกของวัน
				</p>
			</div>
		{:else}
			<div class="mt-3 divide-y divide-zinc-100 dark:divide-white/5">
				{#each workStore.todaySessions as session (session.id)}
					{@const calc = calculateSessionWage(session, workStore.config)}
					<div class="flex items-center justify-between py-3">
						<div class="flex flex-col">
							<div class="flex items-center gap-2">
								<span class="font-mono text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
									{formatTime(session.startTime)} - {formatTime(session.endTime)}
								</span>
								<span
									class="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
								>
									{formatDuration(calc.netDurationMs, 'thai-short')}
								</span>
								{#if calc.breakDurationMs > 0}
									<span
										class="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
									>
										พัก {Math.round(calc.breakDurationMs / 60000)}น.
									</span>
								{/if}
							</div>

							{#if session.note}
								<span class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
									📝 {session.note}
								</span>
							{/if}
						</div>

						<div class="flex items-center gap-2">
							<div class="text-right">
								<div class="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
									{formatCurrency(calc.netWage, workStore.config.currency)}
								</div>
								<div class="text-[10px] text-zinc-400">
									สุทธิ (หักภาษี {workStore.config.taxDeductionPercent}%)
								</div>
							</div>

							<!-- Actions -->
							<button
								type="button"
								onclick={() => openEditModal(session)}
								class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
								title="แก้ไข"
								aria-label="แก้ไขกะงาน"
							>
								<Edit3 size={15} />
							</button>
							<button
								type="button"
								onclick={() => (showDeleteConfirm = session.id)}
								class="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
								title="ลบ"
								aria-label="ลบกะงาน"
							>
								<Trash2 size={15} />
							</button>
						</div>
					</div>

					<!-- Delete inline confirmation -->
					{#if showDeleteConfirm === session.id}
						<div
							class="my-2 flex items-center justify-between rounded-xl bg-rose-50 p-2.5 text-xs text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
						>
							<span>ต้องการลบรายการนี้ใช่หรือไม่?</span>
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => (showDeleteConfirm = null)}
									class="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
								>
									ยกเลิก
								</button>
								<button
									type="button"
									onclick={() => handleDeleteSession(session.id)}
									class="rounded-lg bg-rose-600 px-2 py-1 font-bold text-white hover:bg-rose-700 active:scale-[0.98] transition-all"
								>
									ลบ
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>

			<!-- Quick Link to History -->
			{#if onNavigateToHistory}
				<div class="mt-4 pt-2 text-center border-t border-zinc-100 dark:border-white/5">
					<button
						type="button"
						onclick={onNavigateToHistory}
						class="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
					>
						ดูประวัติย้อนหลังทั้งหมด →
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- ============================================== -->
<!-- EDIT SESSION MODAL                             -->
<!-- ============================================== -->
{#if editingSession}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121215]"
		>
			<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
				<h3 class="text-base font-bold text-zinc-900 dark:text-white">แก้ไขกะงาน</h3>
				<button
					type="button"
					onclick={() => (editingSession = null)}
					class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
					aria-label="ปิด"
				>
					<X size={18} />
				</button>
			</div>

			<div class="mt-4 space-y-3">
				<div>
					<label for="edit-date-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">วันที่</label>
					<input
						id="edit-date-input"
						type="date"
						bind:value={editDate}
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<div>
						<label for="edit-starttime-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">เวลาเริ่ม</label>
						<input
							id="edit-starttime-input"
							type="time"
							bind:value={editStartTime}
							class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
					</div>
					<div>
						<label for="edit-endtime-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">เวลาเลิกงาน</label>
						<input
							id="edit-endtime-input"
							type="time"
							bind:value={editEndTime}
							class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
					</div>
				</div>

				<div>
					<label for="edit-break-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">เวลาพัก (นาที)</label>
					<input
						id="edit-break-input"
						type="number"
						min="0"
						step="5"
						bind:value={editBreakMinutes}
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
					/>
				</div>

				<div>
					<label for="edit-note-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">โน้ต</label>
					<input
						id="edit-note-input"
						type="text"
						bind:value={editNote}
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
					/>
				</div>
			</div>

			<div class="mt-5 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (editingSession = null)}
					class="rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleSaveEdit}
					class="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
				>
					บันทึกการแก้ไข
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Safeguard Modal Component -->
<SafeguardModal bind:isOpen={showSafeguardModal} />
