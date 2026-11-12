<script lang="ts">
	import {
		Calculator,
		Sliders,
		Settings,
		Database,
		Download,
		Upload,
		RotateCcw,
		Trash2,
		Check,
		AlertTriangle,
		Percent,
		Coins,
		DollarSign,
		ShieldCheck,
		Info,
		Calendar
	} from 'lucide-svelte';
	import { workStore } from '#lib/storage.svelte';
	import { simulateWage, formatCurrency } from '#lib/calculator';
	import type { RoundingMode } from '#lib/types';

	// Simulator sliders state
	let simHoursPerDay = $state(8);
	let simWeekdayDays = $state(5);
	let simWeekendDays = $state(1);

	// Confirmation modal states
	let showResetConfirm = $state(false);
	let showClearConfirm = $state(false);
	let importFeedback = $state<{ success: boolean; message: string } | null>(null);
	let saveFeedback = $state(false);

	let fileInputRef: HTMLInputElement | null = null;

	function triggerHaptic(duration = 10) {
		if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// ignore
			}
		}
	}

	function showSaveToast() {
		saveFeedback = true;
		setTimeout(() => {
			saveFeedback = false;
		}, 2000);
	}

	// Live simulator calculation
	const simResult = $derived.by(() => {
		return simulateWage(
			simHoursPerDay,
			simWeekdayDays,
			simWeekendDays,
			workStore.config
		);
	});

	// Quick weekend multipliers
	const multipliers = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

	// Quick tax presets
	const taxPresets = [0, 1, 3, 5];

	// Rounding modes
	const roundingOptions: { mode: RoundingMode; label: string; desc: string }[] = [
		{ mode: 'exact', label: 'ตามจริง (Exact)', desc: 'คิดตามเศษนาทีจริง ไม่มีปัด' },
		{ mode: '15m', label: 'ปัด 15 นาที', desc: 'ปัดเศษตามช่วง 15 นาทีที่ใกล้เคียงที่สุด' },
		{ mode: '30m', label: 'ปัด 30 นาที', desc: 'ปัดเศษตามช่วงครึ่งชั่วโมง (30 นาที)' }
	];

	// Config handlers
	function updateHourlyRate(val: number) {
		triggerHaptic(8);
		workStore.updateConfig({ hourlyRate: Math.max(1, val) });
		showSaveToast();
	}

	function updateWeekendMultiplier(val: number) {
		triggerHaptic(10);
		workStore.updateConfig({ weekendMultiplier: val });
		showSaveToast();
	}

	function updateRoundingMode(mode: RoundingMode) {
		triggerHaptic(10);
		workStore.updateConfig({ roundingMode: mode });
		showSaveToast();
	}

	function updateTaxPercent(tax: number) {
		triggerHaptic(8);
		workStore.updateConfig({ taxDeductionPercent: Math.max(0, tax) });
		showSaveToast();
	}

	function updateMonthlyGoal(goal: number) {
		triggerHaptic(8);
		workStore.updateConfig({ monthlyIncomeGoal: Math.max(0, goal) });
		showSaveToast();
	}

	// Backup & Restore
	function handleExportJSON() {
		triggerHaptic(15);
		const json = workStore.exportData();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `HourWorked_Backup_${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function handleImportFile(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			if (text) {
				const result = workStore.importData(text);
				importFeedback = result;
				triggerHaptic(result.success ? 20 : 40);
				setTimeout(() => {
					importFeedback = null;
				}, 4000);
			}
		};
		reader.readAsText(file);
		target.value = ''; // reset
	}

	function handleResetSample() {
		triggerHaptic(20);
		workStore.resetToSampleData();
		showResetConfirm = false;
	}

	function handleClearAll() {
		triggerHaptic(30);
		workStore.clearAllData();
		showClearConfirm = false;
	}
</script>

<div class="flex flex-col space-y-6 pb-8 pt-2">
	<!-- Page Title -->
	<div>
		<h2 class="text-base font-bold text-slate-900 dark:text-white">คำนวณ & ตั้งค่าระบบ</h2>
		<p class="text-xs text-slate-500 dark:text-slate-400">
			ตั้งค่าอัตราค่าจ้าง, ภาษีหัก ณ ที่จ่าย, และเครื่องมือจำลองรายได้ What-If
		</p>
	</div>

	<!-- SECTION 1: WHAT-IF WAGE SIMULATOR -->
	<div
		class="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
	>
		<div class="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
			>
				<Sliders size={18} />
			</div>
			<div>
				<h3 class="text-xs font-bold text-slate-900 dark:text-white">เครื่องมือจำลองรายได้ (What-If Simulator)</h3>
				<p class="text-[11px] text-slate-400">ลองปรับจำนวนชั่วโมงและวันทำงานเพื่อคำนวณผลตอบแทน</p>
			</div>
		</div>

		<!-- Sliders Controls -->
		<div class="mt-4 space-y-4">
			<!-- Slider 1: Hours per day -->
			<div>
				<div class="flex items-center justify-between text-xs">
					<label for="sim-hours-slider" class="font-semibold text-slate-700 dark:text-slate-300">ชั่วโมงทำงานต่อวัน</label>
					<span class="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
						{simHoursPerDay} ชม./วัน
					</span>
				</div>
				<input
					id="sim-hours-slider"
					type="range"
					min="1"
					max="16"
					step="0.5"
					bind:value={simHoursPerDay}
					class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-700"
				/>
				<div class="mt-1 flex justify-between text-[10px] text-slate-400">
					<span>1 ชม.</span>
					<span>4 ชม. (พาร์ทไทม์)</span>
					<span>8 ชม. (ฟูลไทม์)</span>
					<span>16 ชม.</span>
				</div>
			</div>

			<!-- Slider 2: Weekday days per week -->
			<div>
				<div class="flex items-center justify-between text-xs">
					<label for="sim-weekdays-slider" class="font-semibold text-slate-700 dark:text-slate-300">
						วันทำงานธรรมดา (จ.-ศ.)
					</label>
					<span class="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
						{simWeekdayDays} วัน/สัปดาห์
					</span>
				</div>
				<input
					id="sim-weekdays-slider"
					type="range"
					min="0"
					max="5"
					step="1"
					bind:value={simWeekdayDays}
					class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-700"
				/>
			</div>

			<!-- Slider 3: Weekend days per week -->
			<div>
				<div class="flex items-center justify-between text-xs">
					<label for="sim-weekend-slider" class="font-semibold text-purple-700 dark:text-purple-300">
						กะวันหยุด (ส.-อา. {workStore.config.weekendMultiplier}x)
					</label>
					<span class="font-mono text-sm font-bold text-purple-600 dark:text-purple-400">
						{simWeekendDays} วัน/สัปดาห์
					</span>
				</div>
				<input
					id="sim-weekend-slider"
					type="range"
					min="0"
					max="2"
					step="1"
					bind:value={simWeekendDays}
					class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-purple-100 accent-purple-600 dark:bg-purple-950"
				/>
			</div>
		</div>

		<!-- Simulator Calculated Output Display -->
		<div
			class="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50 space-y-3"
		>
			<div class="text-xs font-bold text-slate-800 dark:text-slate-200">
				ผลลัพธ์ประมาณการรายได้ (สุทธิหลังหักภาษี {workStore.config.taxDeductionPercent}%):
			</div>

			<div class="grid grid-cols-2 gap-2 text-xs">
				<div class="rounded-xl bg-white p-2.5 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
					<div class="text-[10px] text-slate-400">วันธรรมดา/วัน</div>
					<div class="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
						{formatCurrency(simResult.dailyWeekdayGross * (1 - workStore.config.taxDeductionPercent / 100), workStore.config.currency, 0)}
					</div>
					<div class="text-[9px] text-slate-400">
						(ก่อนหัก: {formatCurrency(simResult.dailyWeekdayGross, workStore.config.currency, 0)})
					</div>
				</div>

				<div class="rounded-xl bg-purple-50/80 p-2.5 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60">
					<div class="text-[10px] text-purple-600 dark:text-purple-400">วันหยุด ({workStore.config.weekendMultiplier}x)/วัน</div>
					<div class="font-mono text-sm font-bold text-purple-700 dark:text-purple-300">
						{formatCurrency(simResult.dailyWeekendGross * (1 - workStore.config.taxDeductionPercent / 100), workStore.config.currency, 0)}
					</div>
					<div class="text-[9px] text-purple-500/70">
						(ก่อนหัก: {formatCurrency(simResult.dailyWeekendGross, workStore.config.currency, 0)})
					</div>
				</div>
			</div>

			<!-- Big Monthly & Weekly Projection -->
			<div
				class="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-3.5 text-white shadow-md shadow-emerald-500/20"
			>
				<div class="flex items-center justify-between">
					<div>
						<div class="text-[11px] font-medium text-emerald-100">ประมาณการรายได้สุทธิรายเดือน</div>
						<div class="font-mono text-2xl font-black">
							{formatCurrency(simResult.monthlyNet, workStore.config.currency, 0)}
						</div>
					</div>
					<div class="text-right">
						<div class="text-[10px] text-emerald-100">รายสัปดาห์</div>
						<div class="font-mono text-sm font-bold">
							{formatCurrency(simResult.weeklyNet, workStore.config.currency, 0)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- SECTION 2: CONFIGURATION FORM -->
	<div
		class="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90"
	>
		<div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400"
				>
					<Settings size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-slate-900 dark:text-white">ตั้งค่าค่าจ้าง & การคำนวณ</h3>
					<p class="text-[11px] text-slate-400">บันทึกอัตโนมัติลงในเบราว์เซอร์</p>
				</div>
			</div>

			{#if saveFeedback}
				<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
					<Check size={13} /> บันทึกแล้ว
				</span>
			{/if}
		</div>

		<div class="mt-4 space-y-4 text-xs">
			<!-- 1. Base Hourly Rate -->
			<div>
				<label for="config-hourly-rate" class="block font-semibold text-slate-700 dark:text-slate-300">
					อัตราค่าจ้างพื้นฐาน (บาท / ชั่วโมง)
				</label>
				<div class="relative mt-1">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">
						{workStore.config.currency}
					</div>
					<input
						id="config-hourly-rate"
						type="number"
						min="1"
						step="5"
						value={workStore.config.hourlyRate}
						onchange={(e) => updateHourlyRate(Number(e.currentTarget.value))}
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-3 font-mono text-sm font-bold text-slate-800 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
				</div>
			</div>

			<!-- 2. Weekend Rate Multiplier -->
			<div>
				<label for="config-weekend-mult" class="block font-semibold text-slate-700 dark:text-slate-300">
					ตัวคูณค่าจ้างวันหยุด เสาร์-อาทิตย์ (Weekend Multiplier)
				</label>
				<div class="mt-1.5 flex flex-wrap gap-1.5">
					{#each multipliers as mult}
						<button
							type="button"
							onclick={() => updateWeekendMultiplier(mult)}
							class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all {workStore.config
								.weekendMultiplier === mult
								? 'bg-purple-600 text-white shadow-xs'
								: 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}"
						>
							{mult}x ({formatCurrency(workStore.config.hourlyRate * mult, workStore.config.currency, 0)}/ชม.)
						</button>
					{/each}
				</div>
			</div>

			<!-- 3. Rounding Mode -->
			<div>
				<label for="config-rounding-mode" class="block font-semibold text-slate-700 dark:text-slate-300">
					โหมดการปัดเศษเวลา (Rounding Mode)
				</label>
				<div class="mt-1.5 space-y-1.5">
					{#each roundingOptions as opt}
						{@const isSelected = workStore.config.roundingMode === opt.mode}
						<button
							type="button"
							onclick={() => updateRoundingMode(opt.mode)}
							class="flex w-full items-start justify-between rounded-xl border p-2.5 text-left transition-all {isSelected
								? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200'
								: 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300'}"
						>
							<div>
								<div class="font-bold">{opt.label}</div>
								<div class="text-[10px] text-slate-500 dark:text-slate-400">{opt.desc}</div>
							</div>
							{#if isSelected}
								<Check size={16} class="text-blue-600 dark:text-blue-400 mt-0.5" />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- 4. Tax / Deduction % -->
			<div>
				<label for="config-tax-percent" class="block font-semibold text-slate-700 dark:text-slate-300">
					หักภาษี ณ ที่จ่าย / หักอื่นๆ (%)
				</label>
				<div class="mt-1.5 flex items-center gap-2">
					<div class="relative flex-1">
						<input
							id="config-tax-percent"
							type="number"
							min="0"
							max="50"
							step="0.5"
							value={workStore.config.taxDeductionPercent}
							onchange={(e) => updateTaxPercent(Number(e.currentTarget.value))}
							class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 font-mono text-sm font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						/>
						<span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 font-bold">
							%
						</span>
					</div>

					<!-- Quick presets -->
					<div class="flex gap-1">
						{#each taxPresets as preset}
							<button
								type="button"
								onclick={() => updateTaxPercent(preset)}
								class="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
							>
								{preset}%
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- 5. Monthly Goal -->
			<div>
				<label for="config-monthly-goal" class="block font-semibold text-slate-700 dark:text-slate-300">
					เป้าหมายรายได้ต่อเดือน (บาท)
				</label>
				<div class="relative mt-1">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">
						{workStore.config.currency}
					</div>
					<input
						id="config-monthly-goal"
						type="number"
						min="0"
						step="1000"
						value={workStore.config.monthlyIncomeGoal}
						onchange={(e) => updateMonthlyGoal(Number(e.currentTarget.value))}
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-3 font-mono text-sm font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- SECTION 3: BACKUP & DATA MANAGEMENT -->
	<div
		class="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-xs backdrop-blur-xs dark:border-slate-800/90 dark:bg-slate-900/90 space-y-4"
	>
		<div class="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>
				<Database size={18} />
			</div>
			<div>
				<h3 class="text-xs font-bold text-slate-900 dark:text-white">จัดการข้อมูล & สำรองไฟล์</h3>
				<p class="text-[11px] text-slate-400">บันทึกหรือกู้คืนประวัติและข้อมูลการตั้งค่า</p>
			</div>
		</div>

		<!-- Feedback notification if any -->
		{#if importFeedback}
			<div
				class="rounded-xl p-3 text-xs {importFeedback.success
					? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
					: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}"
			>
				{importFeedback.message}
			</div>
		{/if}

		<!-- Export & Import Buttons -->
		<div class="grid grid-cols-2 gap-2 text-xs">
			<button
				type="button"
				onclick={handleExportJSON}
				class="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
			>
				<Download size={15} />
				<span>สำรองข้อมูล JSON</span>
			</button>

			<label
				class="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
			>
				<Upload size={15} />
				<span>นำเข้า JSON</span>
				<input
					type="file"
					accept=".json"
					onchange={handleImportFile}
					class="hidden"
				/>
			</label>
		</div>

		<!-- Reset to Sample Data & Clear Danger Zone -->
		<div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
			<!-- Reset to sample data -->
			<button
				type="button"
				onclick={() => {
					triggerHaptic(10);
					showResetConfirm = true;
				}}
				class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
			>
				<RotateCcw size={14} />
				<span>รีเซ็ตเป็นข้อมูลตัวอย่าง (10 กะ)</span>
			</button>

			<!-- Clear all data -->
			<button
				type="button"
				onclick={() => {
					triggerHaptic(15);
					showClearConfirm = true;
				}}
				class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
			>
				<Trash2 size={14} />
				<span>ล้างประวัติทั้งหมด (Clear All)</span>
			</button>
		</div>
	</div>
</div>

<!-- ============================================== -->
<!-- CONFIRM: RESET TO SAMPLE DATA                  -->
<!-- ============================================== -->
{#if showResetConfirm}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-xs"
		>
			<div class="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
				<RotateCcw size={18} class="text-blue-600" />
				<span>ยืนยันรีเซ็ตข้อมูลตัวอย่าง?</span>
			</div>
			<p class="mt-2 text-slate-500 dark:text-slate-400">
				ระบบจะสร้างรายการกะงานตัวอย่าง 10 รายการ และคืนค่าการตั้งค่าเป็นค่าเริ่มต้น
			</p>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (showResetConfirm = false)}
					class="rounded-xl border border-slate-200 bg-white py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleResetSample}
					class="rounded-xl bg-blue-600 py-2 font-bold text-white shadow-sm hover:bg-blue-700"
				>
					รีเซ็ตข้อมูล
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ============================================== -->
<!-- CONFIRM: CLEAR ALL DATA                        -->
<!-- ============================================== -->
{#if showClearConfirm}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-red-200 bg-white p-5 shadow-2xl dark:border-red-900/60 dark:bg-slate-900 text-xs"
		>
			<div class="flex items-center gap-2 font-bold text-rose-600 text-sm">
				<AlertTriangle size={18} />
				<span>ยืนยันการล้างข้อมูลทั้งหมด?</span>
			</div>
			<p class="mt-2 text-slate-600 dark:text-slate-400">
				รายการประวัติงานทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้ แนะนำให้สำรองข้อมูล JSON ไว้ก่อน
			</p>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (showClearConfirm = false)}
					class="rounded-xl border border-slate-200 bg-white py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleClearAll}
					class="rounded-xl bg-rose-600 py-2 font-bold text-white shadow-sm hover:bg-rose-700"
				>
					ล้างข้อมูลถาวร
				</button>
			</div>
		</div>
	</div>
{/if}
