<script lang="ts">
	import {
		Calendar,
		Plus,
		Download,
		Printer,
		Share2,
		Search,
		Filter,
		Trash2,
		Edit3,
		X,
		Check,
		FileSpreadsheet,
		Clock,
		Coins,
		ChevronRight,
		Copy,
		ExternalLink,
		AlertCircle
	} from 'lucide-svelte';
	import { workStore } from '#lib/storage.svelte';
	import {
		groupSessionsByDate,
		calculateTotalSummary,
		calculateSessionWage,
		calculateBreakDuration,
		formatDuration,
		formatHours,
		formatCurrency,
		formatTime,
		formatThaiDate,
		isWeekend,
		getLocalDateString
	} from '#lib/calculator';
	import type { WorkSession } from '#lib/types';

	// Filters
	let selectedMonth = $state<string>('all'); // 'all' or 'YYYY-MM'
	let filterWeekendOnly = $state(false);
	let searchQuery = $state('');

	// Modals
	let showManualEntryModal = $state(false);
	let showPayslipModal = $state(false);
	let showLineShareModal = $state(false);
	let copySuccess = $state(false);
	let deletingSessionId = $state<string | null>(null);

	// Edit modal state
	let editingSession = $state<WorkSession | null>(null);
	let editDate = $state('');
	let editStartTime = $state('09:00');
	let editEndTime = $state('17:00');
	let editBreakMinutes = $state(60);
	let editNote = $state('');

	// Manual entry form state
	let manualDate = $state(getLocalDateString(new Date()));
	let manualStartTime = $state('09:00');
	let manualEndTime = $state('17:00');
	let manualBreakMinutes = $state(60);
	let manualNote = $state('');

	// Payslip metadata
	let payslipWorkerName = $state('พนักงาน / ผู้ปฏิบัติงาน');
	let payslipCompanyName = $state('HourWorked Timesheet');

	function triggerHaptic(duration = 12) {
		if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// ignore
			}
		}
	}

	// Available months from sessions
	const availableMonths = $derived.by(() => {
		const set = new Set<string>();
		for (const s of workStore.sessions) {
			const m = s.date.slice(0, 7);
			set.add(m);
		}
		const cur = getLocalDateString().slice(0, 7);
		set.add(cur);
		return Array.from(set).sort((a, b) => b.localeCompare(a));
	});

	// Filtered sessions
	const filteredSessions = $derived.by(() => {
		return workStore.sessions.filter((s) => {
			if (selectedMonth !== 'all' && !s.date.startsWith(selectedMonth)) {
				return false;
			}
			if (filterWeekendOnly && !isWeekend(s)) {
				return false;
			}
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchNote = s.note?.toLowerCase().includes(q);
				const matchDate = s.date.includes(q);
				if (!matchNote && !matchDate) return false;
			}
			return true;
		});
	});

	// Filtered group by date
	const filteredGroups = $derived.by(() => {
		return groupSessionsByDate(filteredSessions, workStore.config);
	});

	// Filtered summary
	const filteredSummary = $derived.by(() => {
		return calculateTotalSummary(filteredSessions, workStore.config);
	});

	// Live preview for manual entry
	const manualPreview = $derived.by(() => {
		if (!manualDate || !manualStartTime || !manualEndTime) return null;
		const [sH, sM] = manualStartTime.split(':').map(Number);
		const [eH, eM] = manualEndTime.split(':').map(Number);
		const [y, m, d] = manualDate.split('-').map(Number);

		const startMs = new Date(y, m - 1, d, sH, sM).getTime();
		let endMs = new Date(y, m - 1, d, eH, eM).getTime();
		if (endMs < startMs) endMs += 24 * 3600 * 1000;

		const breaks =
			manualBreakMinutes > 0
				? [{ start: startMs + 60000, end: startMs + (1 + manualBreakMinutes) * 60000 }]
				: [];

		const dummySession: WorkSession = {
			id: 'preview',
			date: manualDate,
			startTime: startMs,
			endTime: endMs,
			breaks,
			note: manualNote
		};

		return calculateSessionWage(dummySession, workStore.config);
	});

	// Actions
	function handleAddManualEntry() {
		if (!manualDate || !manualStartTime || !manualEndTime) return;

		const [sH, sM] = manualStartTime.split(':').map(Number);
		const [eH, eM] = manualEndTime.split(':').map(Number);
		const [y, m, d] = manualDate.split('-').map(Number);

		const startMs = new Date(y, m - 1, d, sH, sM).getTime();
		let endMs = new Date(y, m - 1, d, eH, eM).getTime();
		if (endMs < startMs) endMs += 24 * 3600 * 1000;

		const breaks =
			manualBreakMinutes > 0
				? [{ start: startMs + 60000, end: startMs + (1 + manualBreakMinutes) * 60000 }]
				: [];

		workStore.addManualEntry({
			date: manualDate,
			startTime: startMs,
			endTime: endMs,
			breaks,
			note: manualNote.trim()
		});

		triggerHaptic(20);
		showManualEntryModal = false;
		manualNote = '';
	}

	function openEditModal(session: WorkSession) {
		editingSession = session;
		editDate = session.date;

		const sD = new Date(session.startTime);
		editStartTime = `${String(sD.getHours()).padStart(2, '0')}:${String(sD.getMinutes()).padStart(2, '0')}`;

		if (session.endTime) {
			const eD = new Date(session.endTime);
			editEndTime = `${String(eD.getHours()).padStart(2, '0')}:${String(eD.getMinutes()).padStart(2, '0')}`;
		} else {
			editEndTime = '';
		}

		const breakMs = calculateBreakDuration(session.breaks, session.endTime || Date.now());
		editBreakMinutes = Math.round(breakMs / 60000);
		editNote = session.note || '';
	}

	function handleSaveEdit() {
		if (!editingSession || !editDate || !editStartTime || !editEndTime) return;

		const [sH, sM] = editStartTime.split(':').map(Number);
		const [eH, eM] = editEndTime.split(':').map(Number);
		const [y, m, d] = editDate.split('-').map(Number);

		const startMs = new Date(y, m - 1, d, sH, sM).getTime();
		let endMs = new Date(y, m - 1, d, eH, eM).getTime();
		if (endMs < startMs) endMs += 24 * 3600 * 1000;

		const breaks =
			editBreakMinutes > 0
				? [{ start: startMs + 60000, end: startMs + (1 + editBreakMinutes) * 60000 }]
				: [];

		workStore.updateSession(editingSession.id, {
			date: editDate,
			startTime: startMs,
			endTime: endMs,
			breaks,
			note: editNote.trim()
		});

		triggerHaptic(15);
		editingSession = null;
	}

	function handleDeleteSession(id: string) {
		triggerHaptic(20);
		workStore.deleteSession(id);
		deletingSessionId = null;
	}

	// Export to CSV with UTF-8 BOM
	function handleExportCSV() {
		triggerHaptic(15);
		const headers = [
			'วันที่',
			'วันในสัปดาห์',
			'เวลาเริ่ม',
			'เวลาเลิก',
			'เวลาพัก (นาที)',
			'เวลาทำงานสุทธิ (ชม.)',
			'อัตราต่อชม. (บาท)',
			'ค่าจ้างรวม (บาท)',
			'หัก ณ ที่จ่าย (บาท)',
			'ค่าจ้างสุทธิ (บาท)',
			'หมายเหตุ'
		];

		const rows = filteredSessions.map((session) => {
			const calc = calculateSessionWage(session, workStore.config);
			const dayOfWeek = isWeekend(session) ? 'วันหยุด' : 'วันธรรมดา';
			const breakMin = Math.round(calc.breakDurationMs / 60000);
			const startStr = formatTime(session.startTime);
			const endStr = formatTime(session.endTime);
			const noteClean = (session.note || '').replace(/"/g, '""');

			return [
				`"${session.date}"`,
				`"${dayOfWeek}"`,
				`"${startStr}"`,
				`"${endStr}"`,
				breakMin,
				calc.roundedDurationHours,
				calc.effectiveRate,
				calc.grossWage,
				calc.taxDeduction,
				calc.netWage,
				`"${noteClean}"`
			].join(',');
		});

		const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `HourWorked_Report_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	// Generate LINE formatted share text
	const lineShareText = $derived.by(() => {
		const periodName =
			selectedMonth === 'all' ? 'ทุกช่วงเวลา' : `เดือน ${selectedMonth}`;
		const lines = [
			'📋 สรุปเวลาทำงาน - HourWorked',
			'━━━━━━━━━━━━━━━━━━━━',
			`📅 ช่วงเวลา: ${periodName}`,
			`⏱️ ชั่วโมงทำงานรวม: ${formatHours(filteredSummary.totalHours)}`,
			`💵 ค่าจ้างสุทธิ: ${formatCurrency(filteredSummary.netWage, workStore.config.currency)}`,
			`🏢 จำนวนกะ: ${filteredSummary.sessionCount} กะ (${filteredSummary.daysWorked} วัน)`,
			'━━━━━━━━━━━━━━━━━━━━',
			'สรุปแต่ละวัน:'
		];

		for (const g of filteredGroups.slice(0, 10)) {
			lines.push(`• ${formatThaiDate(g.date, { showDayOfWeek: true, showYear: false })}: ${g.totalHours} ชม. (${formatCurrency(g.netWage, workStore.config.currency)})`);
		}

		if (filteredGroups.length > 10) {
			lines.push(`...และอีก ${filteredGroups.length - 10} วัน`);
		}

		return lines.join('\n');
	});

	function handleCopyLineText() {
		triggerHaptic(15);
		if (navigator.clipboard) {
			navigator.clipboard.writeText(lineShareText);
			copySuccess = true;
			setTimeout(() => {
				copySuccess = false;
			}, 2500);
		}
	}

	function handleOpenLineApp() {
		triggerHaptic(20);
		const encoded = encodeURIComponent(lineShareText);
		const url = `https://line.me/R/msg/text/?${encoded}`;
		window.open(url, '_blank');
	}

	function handlePrint() {
		if (typeof window !== 'undefined') {
			window.print();
		}
	}
</script>

<div class="flex flex-col space-y-4 pb-8 pt-2">
	<!-- Top Action Bar & Add Manual Entry Button -->
	<div class="flex items-center justify-between gap-2">
		<div>
			<h2 class="text-base font-bold text-zinc-900 dark:text-white">ประวัติการทำงาน</h2>
			<p class="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
				บันทึกทั้งหมด {workStore.sessions.length} รายการ
			</p>
		</div>

		<button
			type="button"
			onclick={() => {
				triggerHaptic(14);
				showManualEntryModal = true;
			}}
			class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
		>
			<Plus size={16} />
			<span>เพิ่มเวลาย้อนหลัง</span>
		</button>
	</div>

	<!-- Month Filter & Chips -->
	<div
		class="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215] space-y-3"
	>
		<div class="flex items-center gap-2">
			<!-- Month Selector -->
			<div class="relative flex-1">
				<label for="history-month-select" class="sr-only">เลือกเดือน</label>
				<select
					id="history-month-select"
					bind:value={selectedMonth}
					class="w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800 transition-colors focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-100 font-mono"
				>
					<option value="all">📅 แสดงทั้งหมด ({workStore.sessions.length} กะ)</option>
					{#each availableMonths as m}
						<option value={m}>เดือน {m}</option>
					{/each}
				</select>
			</div>

			<!-- Weekend Only Filter Chip -->
			<button
				type="button"
				onclick={() => {
					triggerHaptic(10);
					filterWeekendOnly = !filterWeekendOnly;
				}}
				class="rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] {filterWeekendOnly
					? 'bg-purple-600 text-white shadow-xs'
					: 'border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-300'}"
			>
				วันหยุด ({workStore.config.weekendMultiplier}x)
			</button>
		</div>

		<!-- Search Bar -->
		<div class="relative">
			<Search size={14} class="absolute left-3 top-2.5 text-zinc-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="ค้นหาโน้ต, งาน, หรือวันที่ (YYYY-MM-DD)..."
				class="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder-zinc-500"
			/>
		</div>

		<!-- Export & Share Buttons Row -->
		<div class="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-white/5">
			<span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
				พบ {filteredSessions.length} กะ
			</span>

			<div class="flex items-center gap-1.5">
				<!-- Export CSV -->
				<button
					type="button"
					onclick={handleExportCSV}
					class="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
					title="ดาวน์โหลด CSV"
				>
					<FileSpreadsheet size={13} class="text-emerald-600 dark:text-emerald-400" />
					<span>CSV</span>
				</button>

				<!-- Printable Pay Slip Modal -->
				<button
					type="button"
					onclick={() => {
						triggerHaptic(10);
						showPayslipModal = true;
					}}
					class="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
					title="ใบสรุปค่าจ้าง"
				>
					<Printer size={13} class="text-blue-600 dark:text-blue-400" />
					<span>ใบเสร็จ</span>
				</button>

				<!-- LINE Share Format -->
				<button
					type="button"
					onclick={() => {
						triggerHaptic(10);
						showLineShareModal = true;
					}}
					class="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 active:scale-[0.98] transition-all dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-300"
					title="แชร์สรุปเข้า LINE"
				>
					<Share2 size={13} />
					<span>แชร์ LINE</span>
				</button>
			</div>
		</div>
	</div>

	<!-- Period Summary Mini-Card -->
	<div
		class="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200/80 bg-white/70 p-3 shadow-2xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="text-center">
			<div class="text-[10px] text-zinc-400">ชั่วโมงรวม</div>
			<div class="font-mono text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
				{filteredSummary.totalHours} ชม.
			</div>
		</div>
		<div class="text-center border-x border-zinc-200 dark:border-white/10">
			<div class="text-[10px] text-zinc-400">ค่าจ้างรวม</div>
			<div class="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
				{formatCurrency(filteredSummary.grossWage, workStore.config.currency, 0)}
			</div>
		</div>
		<div class="text-center">
			<div class="text-[10px] text-zinc-400">สุทธิ (หัก {workStore.config.taxDeductionPercent}%)</div>
			<div class="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
				{formatCurrency(filteredSummary.netWage, workStore.config.currency, 0)}
			</div>
		</div>
	</div>

	<!-- Sessions Grouped By Date List -->
	{#if filteredGroups.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center rounded-3xl border border-zinc-200/80 bg-white p-6 dark:border-white/10 dark:bg-[#121215]">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
			>
				<Calendar size={24} />
			</div>
			<p class="mt-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
				ไม่พบรายการประวัติงาน
			</p>
			<p class="text-xs text-zinc-400 mt-1 max-w-xs">
				ลองเปลี่ยนเงื่อนไขการค้นหา หรือกดปุ่ม "เพิ่มเวลาย้อนหลัง" เพื่อบันทึกเวลาทำงาน
			</p>
		</div>
	{:else}
		<div class="space-y-3.5">
			{#each filteredGroups as group (group.date)}
				<div
					class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
				>
					<!-- Date Group Header -->
					<div
						class="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 dark:border-white/5 dark:bg-zinc-900/60"
					>
						<div class="flex items-center gap-2">
							<span class="text-xs font-bold text-zinc-800 dark:text-zinc-100">
								{formatThaiDate(group.date, { showDayOfWeek: true, showYear: true })}
							</span>
							{#if group.isWeekend}
								<span
									class="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300"
								>
									วันหยุด ({workStore.config.weekendMultiplier}x)
								</span>
							{/if}
						</div>

						<div class="text-right">
							<span class="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
								{formatCurrency(group.netWage, workStore.config.currency)}
							</span>
							<span class="text-[10px] text-zinc-400 font-mono tabular-nums"> ({group.totalHours} ชม.)</span>
						</div>
					</div>

					<!-- Session Items in this Day -->
					<div class="divide-y divide-zinc-100 px-4 dark:divide-white/5">
						{#each group.sessions as session (session.id)}
							{@const calc = calculateSessionWage(session, workStore.config)}
							<div class="flex items-center justify-between py-3">
								<div class="flex flex-col">
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
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
										<span class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
											📝 {session.note}
										</span>
									{/if}
								</div>

								<div class="flex items-center gap-1.5">
									<div class="text-right">
										<div class="text-xs font-bold font-mono text-zinc-900 dark:text-white tabular-nums">
											{formatCurrency(calc.netWage, workStore.config.currency)}
										</div>
										<div class="text-[9px] text-zinc-400 font-mono tabular-nums">
											@{calc.effectiveRate}฿
										</div>
									</div>

									<!-- Action buttons -->
									<button
										type="button"
										onclick={() => openEditModal(session)}
										class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
										title="แก้ไข"
										aria-label="แก้ไขกะนี้"
									>
										<Edit3 size={14} />
									</button>
									<button
										type="button"
										onclick={() => (deletingSessionId = session.id)}
										class="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
										title="ลบ"
										aria-label="ลบกะนี้"
									>
										<Trash2 size={14} />
									</button>
								</div>
							</div>

							<!-- Delete Confirmation Inline -->
							{#if deletingSessionId === session.id}
								<div
									class="my-2 flex items-center justify-between rounded-xl bg-rose-50 p-2.5 text-xs text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
								>
									<span>ยืนยันลบกะงานนี้?</span>
									<div class="flex items-center gap-1.5">
										<button
											type="button"
											onclick={() => (deletingSessionId = null)}
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
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- ============================================== -->
<!-- MODAL: MANUAL ENTRY ("เพิ่มเวลาย้อนหลัง")     -->
<!-- ============================================== -->
{#if showManualEntryModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121215]"
		>
			<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
				<div class="flex items-center gap-2">
					<Plus size={18} class="text-blue-600 dark:text-blue-400" />
					<h3 class="text-base font-bold text-zinc-900 dark:text-white">เพิ่มเวลาย้อนหลัง</h3>
				</div>
				<button
					type="button"
					onclick={() => (showManualEntryModal = false)}
					class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
					aria-label="ปิด"
				>
					<X size={18} />
				</button>
			</div>

			<div class="mt-4 space-y-3">
				<div>
					<label for="manual-date-input" class="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">วันที่ทำงาน</label>
					<input
						id="manual-date-input"
						type="date"
						bind:value={manualDate}
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<div>
						<label for="manual-start-input" class="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">เวลาเริ่มงาน</label>
						<input
							id="manual-start-input"
							type="time"
							bind:value={manualStartTime}
							class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono font-medium text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
					</div>
					<div>
						<label for="manual-end-input" class="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">เวลาเลิกงาน</label>
						<input
							id="manual-end-input"
							type="time"
							bind:value={manualEndTime}
							class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono font-medium text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
					</div>
				</div>

				<div>
					<label for="manual-break-input" class="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
						เวลาพักเบรก (นาที)
					</label>
					<div class="mt-1 flex items-center gap-2">
						<input
							id="manual-break-input"
							type="number"
							min="0"
							step="5"
							bind:value={manualBreakMinutes}
							class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono font-medium text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
						<div class="flex gap-1 font-mono">
							<button
								type="button"
								onclick={() => (manualBreakMinutes = 0)}
								class="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] dark:border-white/10"
							>
								0น.
							</button>
							<button
								type="button"
								onclick={() => (manualBreakMinutes = 30)}
								class="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] dark:border-white/10"
							>
								30น.
							</button>
							<button
								type="button"
								onclick={() => (manualBreakMinutes = 60)}
								class="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] dark:border-white/10"
							>
								60น.
							</button>
						</div>
					</div>
				</div>

				<div>
					<label for="manual-note-input" class="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
						โน้ตช่วยจำ (ตัวเลือก)
					</label>
					<input
						id="manual-note-input"
						type="text"
						bind:value={manualNote}
						placeholder="เช่น กะเช้า, ซัพพอร์ตลูกค้า..."
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder-zinc-500"
					/>
				</div>

				<!-- Live Preview in Modal -->
				{#if manualPreview}
					<div
						class="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs dark:border-blue-900/60 dark:bg-blue-950/40"
					>
						<div class="flex items-center justify-between text-blue-900 dark:text-blue-200">
							<span>ชั่วโมงสุทธิ:</span>
							<span class="font-bold font-mono tabular-nums">{manualPreview.roundedDurationHours} ชม.</span>
						</div>
						<div class="flex items-center justify-between text-blue-900 dark:text-blue-200">
							<span>อัตราคำนวณ:</span>
							<span class="font-bold font-mono tabular-nums">
								{manualPreview.effectiveRate}฿/ชม. {manualPreview.isWeekend
									? `(วันหยุด ${workStore.config.weekendMultiplier}x)`
									: ''}
							</span>
						</div>
						<div
							class="mt-1 flex items-center justify-between pt-1 border-t border-blue-200/60 font-bold text-emerald-700 dark:text-emerald-300 dark:border-blue-800"
						>
							<span>ค่าจ้างสุทธิ:</span>
							<span class="font-mono tabular-nums">{formatCurrency(manualPreview.netWage, workStore.config.currency)}</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-5 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (showManualEntryModal = false)}
					class="rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleAddManualEntry}
					class="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
				>
					บันทึกกะงาน
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ============================================== -->
<!-- MODAL: EDIT SESSION                            -->
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
					<label for="edit-hist-date-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">วันที่</label>
					<input
						id="edit-hist-date-input"
						type="date"
						bind:value={editDate}
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
					/>
				</div>

				<div class="grid grid-cols-2 gap-2">
					<div>
						<label for="edit-hist-start-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">เวลาเริ่ม</label>
						<input
							id="edit-hist-start-input"
							type="time"
							bind:value={editStartTime}
							class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
					</div>
					<div>
						<label for="edit-hist-end-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">เวลาเลิกงาน</label>
						<input
							id="edit-hist-end-input"
							type="time"
							bind:value={editEndTime}
							class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
						/>
					</div>
				</div>

				<div>
					<label for="edit-hist-break-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">เวลาพัก (นาที)</label>
					<input
						id="edit-hist-break-input"
						type="number"
						min="0"
						step="5"
						bind:value={editBreakMinutes}
						class="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100"
					/>
				</div>

				<div>
					<label for="edit-hist-note-input" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">โน้ต</label>
					<input
						id="edit-hist-note-input"
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

<!-- ============================================== -->
<!-- MODAL: PRINTABLE PAYSLIP ("ใบสรุปค่าจ้าง")     -->
<!-- ============================================== -->
{#if showPayslipModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#121215]"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-white/10"
			>
				<div class="flex items-center gap-2">
					<Printer size={18} class="text-blue-600 dark:text-blue-400" />
					<h3 class="text-sm font-bold text-zinc-900 dark:text-white">ใบสรุปค่าจ้าง (Payslip)</h3>
				</div>
				<button
					type="button"
					onclick={() => (showPayslipModal = false)}
					class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
					aria-label="ปิด"
				>
					<X size={18} />
				</button>
			</div>

			<!-- Payslip Body (Print area) -->
			<div class="flex-1 overflow-y-auto p-5 text-zinc-900 dark:text-zinc-100" id="payslip-print-area">
				<div class="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
					<!-- Title -->
					<div class="text-center pb-3 border-b border-zinc-200 dark:border-white/10">
						<h2 class="text-base font-black tracking-tight text-zinc-900 dark:text-white">
							{payslipCompanyName}
						</h2>
						<p class="text-xs text-zinc-500">ใบแสดงยอดค่าจ้างการปฏิบัติงานรายชั่วโมง</p>
					</div>

					<!-- Metadata -->
					<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div>
							<span class="text-zinc-400">ชื่อผู้รับเงิน:</span>
							<input
								type="text"
								bind:value={payslipWorkerName}
								class="mt-0.5 w-full rounded-md border border-transparent bg-transparent font-semibold focus:border-zinc-300 dark:focus:border-zinc-700"
							/>
						</div>
						<div class="text-right">
							<span class="text-zinc-400">ช่วงเวลา:</span>
							<div class="font-semibold font-mono">{selectedMonth === 'all' ? 'ประวัติทั้งหมด' : selectedMonth}</div>
						</div>
						<div>
							<span class="text-zinc-400">วันที่พิมพ์:</span>
							<div>{formatThaiDate(new Date(), { showDayOfWeek: false, showYear: true })}</div>
						</div>
						<div class="text-right">
							<span class="text-zinc-400">โหมดปัดเศษ:</span>
							<div class="font-mono">{workStore.config.roundingMode}</div>
						</div>
					</div>

					<!-- Summary Table -->
					<div class="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10">
						<table class="w-full text-left text-xs">
							<thead class="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
								<tr>
									<th class="py-1.5 px-2.5">รายการ</th>
									<th class="py-1.5 px-2.5 text-right">จำนวน</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-zinc-100 dark:divide-white/5">
								<tr>
									<td class="py-1.5 px-2.5">จำนวนกะที่ปฏิบัติงาน</td>
									<td class="py-1.5 px-2.5 text-right font-medium font-mono tabular-nums">{filteredSummary.sessionCount} กะ</td>
								</tr>
								<tr>
									<td class="py-1.5 px-2.5">ชั่วโมงปฏิบัติงานรวม</td>
									<td class="py-1.5 px-2.5 text-right font-medium font-mono tabular-nums">{filteredSummary.totalHours} ชม.</td>
								</tr>
								<tr>
									<td class="py-1.5 px-2.5">ค่าจ้างรวม (Gross)</td>
									<td class="py-1.5 px-2.5 text-right font-medium font-mono tabular-nums">
										{formatCurrency(filteredSummary.grossWage, workStore.config.currency)}
									</td>
								</tr>
								<tr class="text-rose-600 dark:text-rose-400">
									<td class="py-1.5 px-2.5">หัก ณ ที่จ่าย ({workStore.config.taxDeductionPercent}%)</td>
									<td class="py-1.5 px-2.5 text-right font-medium font-mono tabular-nums">
										-{formatCurrency(filteredSummary.taxDeduction, workStore.config.currency)}
									</td>
								</tr>
								<tr class="bg-emerald-50/80 font-bold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
									<td class="py-2 px-2.5 text-sm">ยอดจ่ายสุทธิ (Net Payout)</td>
									<td class="py-2 px-2.5 text-right text-base font-black font-mono tabular-nums">
										{formatCurrency(filteredSummary.netWage, workStore.config.currency)}
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<!-- Signature Placeholders -->
					<div class="mt-6 grid grid-cols-2 gap-4 text-center text-[10px] text-zinc-400">
						<div>
							<div class="mx-auto h-8 border-b border-dashed border-zinc-300 dark:border-zinc-700"></div>
							<div class="mt-1">ลงชื่อ ผู้ปฏิบัติงาน</div>
						</div>
						<div>
							<div class="mx-auto h-8 border-b border-dashed border-zinc-300 dark:border-zinc-700"></div>
							<div class="mt-1">ลงชื่อ ผู้ตรวจสอบ / อนุมัติ</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-white/10 dark:bg-[#121215]">
				<button
					type="button"
					onclick={() => (showPayslipModal = false)}
					class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
				>
					ปิด
				</button>
				<button
					type="button"
					onclick={handlePrint}
					class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
				>
					<Printer size={15} />
					<span>พิมพ์เอกสาร (Print)</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ============================================== -->
<!-- MODAL: LINE SHARE FORMAT                       -->
<!-- ============================================== -->
{#if showLineShareModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121215]"
		>
			<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
				<div class="flex items-center gap-2">
					<Share2 size={18} class="text-emerald-600 dark:text-emerald-400" />
					<h3 class="text-base font-bold text-zinc-900 dark:text-white">แชร์สรุปเข้า LINE</h3>
				</div>
				<button
					type="button"
					onclick={() => (showLineShareModal = false)}
					class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
					aria-label="ปิด"
				>
					<X size={18} />
				</button>
			</div>

			<p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
				ข้อความสรุปพร้อมส่งใน LINE หรือแชททีม:
			</p>

			<pre
				class="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-zinc-50 p-3 font-sans text-xs text-zinc-800 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">{lineShareText}</pre>

			<div class="mt-4 flex flex-col gap-2">
				<button
					type="button"
					onclick={handleCopyLineText}
					class="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
				>
					{#if copySuccess}
						<Check size={16} class="text-emerald-600" />
						<span class="text-emerald-600">คัดลอกข้อความสำเร็จแล้ว!</span>
					{:else}
						<Copy size={16} />
						<span>คัดลอกข้อความ (Copy to Clipboard)</span>
					{/if}
				</button>

				<button
					type="button"
					onclick={handleOpenLineApp}
					class="flex items-center justify-center gap-2 rounded-xl bg-[#06C755] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#05b34c] active:scale-[0.98] transition-all"
				>
					<ExternalLink size={16} />
					<span>เปิดแอป LINE เพื่อส่งทันที</span>
				</button>
			</div>
		</div>
	</div>
{/if}
