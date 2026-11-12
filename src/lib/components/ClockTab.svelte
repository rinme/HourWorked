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
		X
	} from 'lucide-svelte';
	import confetti from 'canvas-confetti';
	import { workStore } from '#lib/storage.svelte';
	import {
		calculateLiveSession,
		calculateSessionWage,
		calculateSessionDuration,
		calculateBreakDuration,
		formatDuration,
		formatCurrency,
		formatTime,
		formatThaiDate,
		isWeekend,
		roundDuration
	} from '#lib/calculator';
	import type { WorkSession } from '#lib/types';

	let { onNavigateToHistory }: { onNavigateToHistory?: () => void } = $props();

	// Live tick timestamp
	let now = $state(Date.now());
	let tickTimer: ReturnType<typeof setInterval> | null = null;

	// UI input states
	let clockInNote = $state('');
	let showClockOutConfirm = $state(false);
	let showDeleteConfirm = $state<string | null>(null);

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

	// Weekend check for today
	const isTodayWeekend = $derived(isWeekend(new Date()));
	const effectiveCurrentRate = $derived(
		isTodayWeekend
			? workStore.config.hourlyRate * workStore.config.weekendMultiplier
			: workStore.config.hourlyRate
	);

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

<div class="flex flex-col space-y-6 pb-6 pt-2">
	<!-- Rate Info Banner -->
	<div
		class="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white/80 p-3.5 shadow-xs backdrop-blur-xs dark:border-slate-800/80 dark:bg-slate-900/80"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
			>
				<Coins size={18} />
			</div>
			<div>
				<div class="text-xs font-medium text-slate-500 dark:text-slate-400">อัตราค่าจ้างปัจจุบัน</div>
				<div class="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
					<span>{formatCurrency(effectiveCurrentRate, workStore.config.currency, 0)}/ชม.</span>
					{#if isTodayWeekend}
						<span
							class="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-700 dark:bg-purple-950 dark:text-purple-300"
						>
							วันหยุด {workStore.config.weekendMultiplier}x
						</span>
					{:else}
						<span class="text-[11px] font-normal text-slate-400">
							(ปัด {workStore.config.roundingMode === 'exact'
								? 'ตามจริง'
								: workStore.config.roundingMode === '15m'
									? '15 นาที'
									: '30 นาที'})
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Today's Total Earned Badge -->
		<div class="text-right">
			<div class="text-xs font-medium text-slate-500 dark:text-slate-400">สะสมวันนี้ (สุทธิ)</div>
			<div class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
				{formatCurrency(workStore.todaySummary.netWage, workStore.config.currency)}
			</div>
		</div>
	</div>

	<!-- Central Hero: Giant Interactive Clock In / Clock Out Section -->
	<div
		class="relative flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70 p-6 shadow-sm dark:border-slate-800/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/70"
	>
		<!-- Background decorative glow -->
		<div
			class="pointer-events-none absolute -inset-1 rounded-3xl opacity-30 blur-2xl transition-all duration-700 {workStore.isClockedIn
				? workStore.isOnBreak
					? 'bg-amber-400/40'
					: 'bg-emerald-500/40'
				: 'bg-blue-500/20'}"
			aria-hidden="true"
		></div>

		{#if !workStore.isClockedIn}
			<!-- ============================================== -->
			<!-- STATE 1: READY TO CLOCK IN                     -->
			<!-- ============================================== -->
			<div class="flex w-full flex-col items-center text-center">
				<span
					class="mb-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
				>
					<Sparkles size={13} class="text-blue-500" /> พร้อมเริ่มงานวันนี้
				</span>

				<!-- Giant Circular Clock In Button -->
				<div class="relative my-4 flex items-center justify-center">
					<!-- Pulsing ring -->
					<div
						class="absolute -inset-3 rounded-full bg-emerald-500/20 animate-pulse dark:bg-emerald-500/10"
					></div>

					<button
						type="button"
						onclick={handleClockIn}
						class="group relative flex h-48 w-48 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-400/40"
					>
						<div
							class="absolute inset-1 rounded-full border-2 border-white/30 border-dashed animate-[spin_20s_linear_infinite]"
						></div>
						<Play size={44} class="ml-1 text-white drop-shadow-md transition-transform group-hover:scale-110" />
						<span class="mt-2 text-xl font-black tracking-wider drop-shadow-sm">เข้างาน</span>
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
						class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-900"
					/>
				</div>
			</div>
		{:else}
			<!-- ============================================== -->
			<!-- STATE 2: CLOCKED IN (WORKING OR ON BREAK)      -->
			<!-- ============================================== -->
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
						class="font-mono text-4xl font-black tracking-tight text-slate-900 drop-shadow-xs dark:text-white sm:text-5xl"
					>
						{formatDuration(liveSession?.netDurationMs ?? 0, 'digital')}
					</div>
					<div class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
						<Timer size={13} />
						<span>เวลาทำงานสุทธิ (หักเวลาพักแล้ว)</span>
					</div>
				</div>

				<!-- Live Estimated Earnings Ticker -->
				<div
					class="my-3 flex w-full max-w-xs flex-col items-center rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/60"
				>
					<span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
						ประมาณการค่าจ้างกะนี้ (สุทธิ)
					</span>
					<div
						class="flex items-baseline gap-1 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400"
					>
						<span>{workStore.config.currency}</span>
						<span>{(liveSession?.continuousNet ?? 0).toFixed(2)}</span>
					</div>
					<div class="text-[10px] text-slate-400 dark:text-slate-500">
						ยอดปัดเศษตามจริง: {formatCurrency(
							liveSession?.rounded.netWage ?? 0,
							workStore.config.currency
						)}
					</div>
				</div>

				<!-- Break status details if on break -->
				{#if workStore.isOnBreak}
					<div
						class="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
					>
						<Coffee size={15} class="text-amber-600 dark:text-amber-400" />
						<span>
							พักเบรกมาแล้ว {formatDuration(currentOpenBreakDuration, 'digital')}
						</span>
					</div>
				{/if}

				<!-- Giant Action Controls -->
				<div class="my-2 flex w-full max-w-xs flex-col items-center gap-3">
					<!-- Break / Resume Toggle Button -->
					<button
						type="button"
						onclick={handleToggleBreak}
						class="flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 font-bold transition-all duration-200 active:scale-95 shadow-sm {workStore.isOnBreak
							? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
							: 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}"
					>
						<Coffee size={18} />
						<span>{workStore.isOnBreak ? '☕ จบเวลาพัก & ทำงานต่อ' : '☕ กดพักเบรก (Pause)'}</span>
					</button>

					<!-- Giant Clock Out Button -->
					{#if !showClockOutConfirm}
						<button
							type="button"
							onclick={() => {
								triggerHaptic(15);
								showClockOutConfirm = true;
							}}
							class="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 py-3.5 px-4 font-extrabold text-white shadow-lg shadow-rose-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-95"
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
									class="rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
								>
									ยกเลิก
								</button>
								<button
									type="button"
									onclick={handleClockOut}
									class="rounded-xl bg-red-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700"
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
						class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
					/>
				</div>
			</div>
		{/if}
	</div>

	<!-- Today's Completed Sessions Card -->
	<div
		class="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
	>
		<div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
			<div class="flex items-center gap-2">
				<Calendar size={18} class="text-blue-600 dark:text-blue-400" />
				<h2 class="text-sm font-bold text-slate-900 dark:text-white">
					กะงานที่เสร็จสิ้นวันนี้ ({workStore.todaySessions.length})
				</h2>
			</div>

			{#if workStore.todaySessions.length > 0}
				<div class="text-right">
					<span class="text-xs font-bold text-slate-700 dark:text-slate-300">
						รวม {workStore.todaySummary.totalHours} ชม.
					</span>
				</div>
			{/if}
		</div>

		{#if workStore.todaySessions.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-center">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
				>
					<Clock size={24} />
				</div>
				<p class="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
					ยังไม่มีกะงานที่จบแล้วในวันนี้
				</p>
				<p class="text-[11px] text-slate-400 dark:text-slate-500">
					กดปุ่ม "เข้างาน" ด้านบนเพื่อเริ่มบันทึกกะแรกของวัน
				</p>
			</div>
		{:else}
			<div class="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80">
				{#each workStore.todaySessions as session (session.id)}
					{@const calc = calculateSessionWage(session, workStore.config)}
					<div class="flex items-center justify-between py-3">
						<div class="flex flex-col">
							<div class="flex items-center gap-2">
								<span class="font-mono text-sm font-bold text-slate-900 dark:text-white">
									{formatTime(session.startTime)} - {formatTime(session.endTime)}
								</span>
								<span
									class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
								<span class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
									📝 {session.note}
								</span>
							{/if}
						</div>

						<div class="flex items-center gap-2">
							<div class="text-right">
								<div class="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
									{formatCurrency(calc.netWage, workStore.config.currency)}
								</div>
								<div class="text-[10px] text-slate-400">
									สุทธิ (หักภาษี {workStore.config.taxDeductionPercent}%)
								</div>
							</div>

							<!-- Actions -->
							<button
								type="button"
								onclick={() => openEditModal(session)}
								class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
								title="แก้ไข"
								aria-label="แก้ไขกะงาน"
							>
								<Edit3 size={15} />
							</button>
							<button
								type="button"
								onclick={() => (showDeleteConfirm = session.id)}
								class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
							class="my-2 flex items-center justify-between rounded-xl bg-red-50 p-2.5 text-xs text-red-900 dark:bg-red-950/60 dark:text-red-200"
						>
							<span>ต้องการลบรายการนี้ใช่หรือไม่?</span>
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => (showDeleteConfirm = null)}
									class="rounded-lg border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
								>
									ยกเลิก
								</button>
								<button
									type="button"
									onclick={() => handleDeleteSession(session.id)}
									class="rounded-lg bg-red-600 px-2 py-1 font-bold text-white hover:bg-red-700"
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
				<div class="mt-4 pt-2 text-center border-t border-slate-100 dark:border-slate-800">
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
				<h3 class="text-base font-bold text-slate-900 dark:text-white">แก้ไขกะงาน</h3>
				<button
					type="button"
					onclick={() => (editingSession = null)}
					class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					aria-label="ปิด"
				>
					<X size={18} />
				</button>
			</div>

			<div class="mt-4 space-y-3">
				<div>
					<label for="edit-date-input" class="block text-xs font-medium text-slate-600 dark:text-slate-400">วันที่</label>
					<input
						id="edit-date-input"
						type="date"
						bind:value={editDate}
						class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<div>
						<label for="edit-starttime-input" class="block text-xs font-medium text-slate-600 dark:text-slate-400">เวลาเริ่ม</label>
						<input
							id="edit-starttime-input"
							type="time"
							bind:value={editStartTime}
							class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						/>
					</div>
					<div>
						<label for="edit-endtime-input" class="block text-xs font-medium text-slate-600 dark:text-slate-400">เวลาเลิกงาน</label>
						<input
							id="edit-endtime-input"
							type="time"
							bind:value={editEndTime}
							class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						/>
					</div>
				</div>

				<div>
					<label for="edit-break-input" class="block text-xs font-medium text-slate-600 dark:text-slate-400">เวลาพัก (นาที)</label>
					<input
						id="edit-break-input"
						type="number"
						min="0"
						step="5"
						bind:value={editBreakMinutes}
						class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
				</div>

				<div>
					<label for="edit-note-input" class="block text-xs font-medium text-slate-600 dark:text-slate-400">โน้ต</label>
					<input
						id="edit-note-input"
						type="text"
						bind:value={editNote}
						class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
				</div>
			</div>

			<div class="mt-5 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (editingSession = null)}
					class="rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleSaveEdit}
					class="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700"
				>
					บันทึกการแก้ไข
				</button>
			</div>
		</div>
	</div>
{/if}
