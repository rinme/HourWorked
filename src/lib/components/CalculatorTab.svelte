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
		Calendar,
		Clock,
		Bell,
		BellRing,
		BellOff,
		Sparkles,
		Zap,
		Cloud,
		RefreshCw
	} from 'lucide-svelte';
	import { workStore } from '#lib/storage.svelte';
	import { simulateWage, formatCurrency, formatThaiDate } from '#lib/calculator';
	import AuthModal from './AuthModal.svelte';
	import {
		isPushNotificationSupported,
		isStandalonePWA,
		isIOS,
		subscribeToPushNotifications,
		unsubscribeFromPushNotifications,
		triggerTestPush
	} from '#lib/push';
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

	// Push notification state
	let isPushSubscribed = $state(false);
	let pushLoading = $state(false);
	let pushMessage = $state<{ text: string; isError?: boolean } | null>(null);

	// Cloud auth & sync state
	let showAuthModal = $state(false);
	let isManualSyncing = $state(false);
	let syncMessage = $state<string | null>(null);

	async function handleManualSync() {
		triggerHaptic(15);
		isManualSyncing = true;
		syncMessage = null;
		const ok = await workStore.syncWithCloud();
		isManualSyncing = false;
		if (ok) {
			syncMessage = 'ซิงค์ข้อมูลกับคลาวด์สมบูรณ์แล้ว!';
			setTimeout(() => {
				syncMessage = null;
			}, 3000);
		} else {
			syncMessage = workStore.syncError || 'ไม่สามารถซิงค์ได้ กรุณาลองใหม่อีกครั้ง';
		}
	}

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

	// Safeguard presets
	const safeguardPresets = [8, 10, 12, 14, 16];

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

	function updateSafeguardMaxHours(hours: number) {
		triggerHaptic(10);
		workStore.updateConfig({ safeguardMaxHours: Math.max(1, hours) });
		showSaveToast();
	}

	function updateTimedMode(updates: Partial<typeof workStore.config>) {
		triggerHaptic(8);
		workStore.updateConfig(updates);
		showSaveToast();
	}

	// Push Notification handler
	async function handleTogglePush() {
		triggerHaptic(15);
		pushLoading = true;
		pushMessage = null;

		try {
			if (isPushSubscribed) {
				const ok = await unsubscribeFromPushNotifications();
				isPushSubscribed = !ok;
				pushMessage = { text: 'ยกเลิกการรับแจ้งเตือนแล้ว' };
			} else {
				const res = await subscribeToPushNotifications();
				if (res.success) {
					isPushSubscribed = true;
					pushMessage = { text: 'เปิดการแจ้งเตือน Web Push สำเร็จ!' };
				} else {
					pushMessage = { text: res.error || 'ไม่สามารถเปิดการแจ้งเตือนได้', isError: true };
				}
			}
		} catch (e) {
			pushMessage = { text: 'เกิดข้อผิดพลาดในการตั้งค่าการแจ้งเตือน', isError: true };
		} finally {
			pushLoading = false;
			setTimeout(() => {
				pushMessage = null;
			}, 4000);
		}
	}

	async function handleTestPush() {
		triggerHaptic(12);
		pushLoading = true;
		try {
			const res = await triggerTestPush();
			if (res.success) {
				pushMessage = { text: 'ส่งข้อความทดสอบสำเร็จแล้ว ตรวจสอบที่แถบแจ้งเตือนอุปกรณ์' };
			} else {
				pushMessage = { text: res.error || 'ส่งข้อความทดสอบไม่สำเร็จ', isError: true };
			}
		} catch (err) {
			pushMessage = { text: 'ส่งข้อความทดสอบไม่สำเร็จ', isError: true };
		} finally {
			pushLoading = false;
		}
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
		target.value = '';
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

<div class="flex flex-col space-y-5 pb-8 pt-2">
	<!-- Page Title -->
	<div>
		<h2 class="text-base font-bold text-zinc-900 dark:text-white">คำนวณ & ตั้งค่าระบบ</h2>
		<p class="text-xs text-zinc-500 dark:text-zinc-400">
			ตั้งค่าอัตราค่าจ้าง, ระบบป้องกันลืมออกงาน, กะตารางเวลา, และจำลองรายได้
		</p>
	</div>

	<!-- SECTION: CLOUD ACCOUNT & SYNC -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl {workStore.user ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400'}"
				>
					<Cloud size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-zinc-900 dark:text-white">ระบบคลาวด์และการซิงค์ (Cloud Sync)</h3>
					<p class="text-[11px] text-zinc-400">บันทึกข้อมูลกะทำงานบนคลาวด์และใช้งานได้ตรงกันทุกอุปกรณ์</p>
				</div>
			</div>

			<!-- Status Indicator -->
			<div
				class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold border {workStore.user
					? workStore.syncStatus === 'syncing'
						? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
						: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
					: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300'}"
			>
				{workStore.syncStatus === 'syncing' ? '↻ กำลังซิงค์' : workStore.user ? '● ซิงค์แล้ว' : '○ โหมดออฟไลน์ (Guest)'}
			</div>
		</div>

		{#if workStore.user}
			<!-- Logged In State -->
			<div class="mt-4 space-y-3">
				<div class="flex items-center justify-between rounded-2xl bg-zinc-50 p-3.5 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/5">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-200 text-zinc-800 font-bold dark:bg-zinc-800 dark:text-zinc-200 text-sm">
							{workStore.user.username.slice(0, 2).toUpperCase()}
						</div>
						<div>
							<div class="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
								<span>{workStore.user.username}</span>
								<span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">เข้าสู่ระบบแล้ว</span>
							</div>
							<div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono tabular-nums">
								ซิงค์ล่าสุด: {workStore.lastSyncedAt ? formatThaiDate(new Date(workStore.lastSyncedAt), { showTime: true }) : 'เมื่อสักครู่'}
							</div>
						</div>
					</div>

					<button
						type="button"
						onclick={() => (showAuthModal = true)}
						class="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
					>
						จัดการบัญชี
					</button>
				</div>

				<!-- Sync Now CTA Button -->
				<button
					type="button"
					onclick={handleManualSync}
					disabled={workStore.syncStatus === 'syncing' || isManualSyncing}
					class="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50"
				>
					<RefreshCw size={14} class={workStore.syncStatus === 'syncing' || isManualSyncing ? 'animate-spin' : ''} />
					<span>{workStore.syncStatus === 'syncing' || isManualSyncing ? 'กำลังซิงค์ข้อมูลกับคลาวด์...' : '🔄 ซิงค์ข้อมูลกับคลาวด์เดี๋ยวนี้ (Sync Now)'}</span>
				</button>
				{#if syncMessage}
					<p class="text-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{syncMessage}</p>
				{/if}
			</div>
		{:else}
			<!-- Guest State: Prompt to Login/Register -->
			<div class="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 border border-blue-100 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900/30">
				<p class="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
					ขณะนี้คุณใช้งานในโหมด <strong>ออฟไลน์ (Guest)</strong> ข้อมูลถูกเก็บไว้เฉพาะในเบราว์เซอร์เครื่องนี้ เข้าสู่ระบบหรือสร้างบัญชีฟรีเพื่อซิงค์ข้อมูลข้ามอุปกรณ์ (มือถือ, แท็บเล็ต, คอมพิวเตอร์) โดยอัตโนมัติ
				</p>
				<button
					type="button"
					onclick={() => (showAuthModal = true)}
					class="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
				>
					<Cloud size={15} />
					<span>เข้าสู่ระบบ / สร้างบัญชีเพื่อบันทึกลง Cloud</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- SECTION 1: WHAT-IF WAGE SIMULATOR -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-white/5">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
			>
				<Sliders size={18} />
			</div>
			<div>
				<h3 class="text-xs font-bold text-zinc-900 dark:text-white">เครื่องมือจำลองรายได้ (What-If Simulator)</h3>
				<p class="text-[11px] text-zinc-400">ลองปรับจำนวนชั่วโมงและวันทำงานเพื่อคำนวณผลตอบแทน</p>
			</div>
		</div>

		<!-- Sliders Controls -->
		<div class="mt-4 space-y-4">
			<!-- Slider 1: Hours per day -->
			<div>
				<div class="flex items-center justify-between text-xs">
					<label for="sim-hours-slider" class="font-semibold text-zinc-700 dark:text-zinc-300">ชั่วโมงทำงานต่อวัน</label>
					<span class="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
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
					class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-600 dark:bg-zinc-700"
				/>
				<div class="mt-1 flex justify-between text-[10px] text-zinc-400">
					<span>1 ชม.</span>
					<span>4 ชม. (พาร์ทไทม์)</span>
					<span>8 ชม. (ฟูลไทม์)</span>
					<span>16 ชม.</span>
				</div>
			</div>

			<!-- Slider 2: Weekday days per week -->
			<div>
				<div class="flex items-center justify-between text-xs">
					<label for="sim-weekdays-slider" class="font-semibold text-zinc-700 dark:text-zinc-300">
						วันทำงานธรรมดา (จ.-ศ.)
					</label>
					<span class="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
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
					class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-600 dark:bg-zinc-700"
				/>
			</div>

			<!-- Slider 3: Weekend days per week -->
			<div>
				<div class="flex items-center justify-between text-xs">
					<label for="sim-weekend-slider" class="font-semibold text-purple-700 dark:text-purple-300">
						กะวันหยุด (ส.-อา. {workStore.config.weekendMultiplier}x)
					</label>
					<span class="font-mono text-sm font-bold text-purple-600 dark:text-purple-400 tabular-nums">
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
			class="mt-5 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-white/5 dark:bg-zinc-900/50 space-y-3"
		>
			<div class="text-xs font-bold text-zinc-800 dark:text-zinc-200">
				ผลลัพธ์ประมาณการรายได้ (สุทธิหลังหักภาษี {workStore.config.taxDeductionPercent}%):
			</div>

			<div class="grid grid-cols-2 gap-2 text-xs">
				<div class="rounded-xl bg-white p-2.5 dark:bg-zinc-800/80 border border-zinc-100 dark:border-white/5">
					<div class="text-[10px] text-zinc-400">วันธรรมดา/วัน</div>
					<div class="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
						{formatCurrency(simResult.dailyWeekdayGross * (1 - workStore.config.taxDeductionPercent / 100), workStore.config.currency, 0)}
					</div>
					<div class="text-[9px] text-zinc-400">
						(ก่อนหัก: {formatCurrency(simResult.dailyWeekdayGross, workStore.config.currency, 0)})
					</div>
				</div>

				<div class="rounded-xl bg-purple-50/80 p-2.5 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60">
					<div class="text-[10px] text-purple-600 dark:text-purple-400">วันหยุด ({workStore.config.weekendMultiplier}x)/วัน</div>
					<div class="font-mono text-sm font-bold text-purple-700 dark:text-purple-300 tabular-nums">
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
						<div class="font-mono text-2xl font-black tabular-nums">
							{formatCurrency(simResult.monthlyNet, workStore.config.currency, 0)}
						</div>
					</div>
					<div class="text-right">
						<div class="text-[10px] text-emerald-100">รายสัปดาห์</div>
						<div class="font-mono text-sm font-bold tabular-nums">
							{formatCurrency(simResult.weeklyNet, workStore.config.currency, 0)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- SECTION 2: SAFEGUARD CONFIGURATION (PREVENT FORGOTTEN CLOCKOUT) -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400"
				>
					<ShieldCheck size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-zinc-900 dark:text-white">ระบบป้องกันการลืมลงเวลาออก (Safeguard)</h3>
					<p class="text-[11px] text-zinc-400">แจ้งเตือนและช่วยตัดกะเมื่อบันทึกเวลาทำงานเกินเกณฑ์</p>
				</div>
			</div>

			{#if saveFeedback}
				<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
					<Check size={13} /> บันทึกแล้ว
				</span>
			{/if}
		</div>

		<div class="mt-4 space-y-3.5 text-xs">
			<div>
				<div class="flex items-center justify-between font-semibold text-zinc-700 dark:text-zinc-300">
					<span>ขีดจำกัดชั่วโมงทำงานต่อเนื่องสูงสุด</span>
					<span class="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
						{workStore.config.safeguardMaxHours} ชั่วโมง
					</span>
				</div>
				<p class="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
					หากกะทำงานมีความยาวถึงเกณฑ์นี้ ระบบจะแสดงแบนเนอร์แจ้งเตือนพร้อม 3 ทางเลือกตัดเวลา (ตัดที่ขีดจำกัด, ระบุเวลาออกเอง, หรือทำงานอยู่จริง)
				</p>

				<!-- Presets -->
				<div class="mt-2.5 flex flex-wrap gap-2">
					{#each safeguardPresets as hours}
						<button
							type="button"
							onclick={() => updateSafeguardMaxHours(hours)}
							class="rounded-xl px-3 py-1.5 font-bold transition-all {workStore.config.safeguardMaxHours === hours
								? 'bg-amber-500 text-white shadow-xs'
								: 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300'}"
						>
							{hours} ชม. {hours === 12 ? '(แนะนำ)' : ''}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- SECTION 3: TIMED MODE & SCHEDULE CONFIGURATION -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
				>
					<Calendar size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-zinc-900 dark:text-white">ตั้งค่ากะตารางเวลา (Timed Schedule Mode)</h3>
					<p class="text-[11px] text-zinc-400">กำหนดช่วงเวลากะประจำวันสำหรับโหมด Dual Mode</p>
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-4 text-xs">
			<!-- Dual Mode Toggle -->
			<div class="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-white/5 dark:bg-zinc-900/40">
				<div>
					<div class="font-bold text-zinc-900 dark:text-white">เปิดใช้งานโหมดกะตารางเวลาเป็นค่าเริ่มต้น</div>
					<div class="text-[11px] text-zinc-500 dark:text-zinc-400">สลับการแสดงผลหน้าแรกเป็นแถบนับถอยหลังกะ</div>
				</div>
				<button
					type="button"
					onclick={() => updateTimedMode({ timedModeEnabled: !workStore.config.timedModeEnabled })}
					class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden {workStore.config.timedModeEnabled
						? 'bg-blue-600'
						: 'bg-zinc-300 dark:bg-zinc-700'}"
					role="switch"
					aria-checked={workStore.config.timedModeEnabled}
					aria-label="เปิดปิดโหมดกะตารางเวลา"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 {workStore.config.timedModeEnabled
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>

			<!-- Start & End Time Inputs -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="config-scheduled-start" class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
						เวลาเริ่มกะ (Start Time)
					</label>
					<input
						id="config-scheduled-start"
						type="time"
						value={workStore.config.scheduledStart}
						onchange={(e) => updateTimedMode({ scheduledStart: e.currentTarget.value })}
						class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm font-bold text-zinc-800 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
					/>
				</div>

				<div>
					<label for="config-scheduled-end" class="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
						เวลาเลิกกะ (End Time)
					</label>
					<input
						id="config-scheduled-end"
						type="time"
						value={workStore.config.scheduledEnd}
						onchange={(e) => updateTimedMode({ scheduledEnd: e.currentTarget.value })}
						class="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm font-bold text-zinc-800 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
					/>
				</div>
			</div>

			<!-- Auto Punch Toggle -->
			<div class="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-white/5 dark:bg-zinc-900/40">
				<div>
					<div class="font-bold text-zinc-900 dark:text-white">บันทึกเวลาอัตโนมัติ (Auto-Punch)</div>
					<div class="text-[11px] text-zinc-500 dark:text-zinc-400">เริ่มและจบลำดับกะอัตโนมัติเมื่อถึงเวลาที่กำหนด</div>
				</div>
				<button
					type="button"
					onclick={() => updateTimedMode({ autoPunchEnabled: !workStore.config.autoPunchEnabled })}
					class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden {workStore.config.autoPunchEnabled
						? 'bg-blue-600'
						: 'bg-zinc-300 dark:bg-zinc-700'}"
					role="switch"
					aria-checked={workStore.config.autoPunchEnabled}
					aria-label="เปิดปิดการบันทึกเวลาอัตโนมัติ"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 {workStore.config.autoPunchEnabled
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>
		</div>
	</div>

	<!-- SECTION 4: PUSH NOTIFICATIONS -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-400"
				>
					<Bell size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-zinc-900 dark:text-white">การแจ้งเตือนบนอุปกรณ์ (Web Push)</h3>
					<p class="text-[11px] text-zinc-400">รับแจ้งเตือนเมื่อถึงเวลาเลิกกะ หรือเมื่อเกินขีดจำกัดความปลอดภัย</p>
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-3.5 text-xs">
			{#if pushMessage}
				<div
					class="rounded-xl p-3 text-xs {pushMessage.isError
						? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
						: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}"
				>
					{pushMessage.text}
				</div>
			{/if}

			<div class="flex items-center justify-between">
				<div>
					<span class="font-bold text-zinc-800 dark:text-zinc-200">สิทธิ์รับการแจ้งเตือน</span>
					<p class="text-[11px] text-zinc-500 dark:text-zinc-400">
						{isPushSubscribed ? '● เปิดใช้งานเรียบร้อย' : '○ ยังไม่ได้ลงทะเบียน'}
					</p>
				</div>

				<button
					type="button"
					onclick={handleTogglePush}
					disabled={pushLoading}
					class="rounded-xl px-4 py-2 font-bold transition-all active:scale-[0.98] {isPushSubscribed
						? 'border border-zinc-300 bg-white text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300'
						: 'bg-blue-600 text-white shadow-xs hover:bg-blue-500'}"
				>
					{isPushSubscribed ? 'ปิดการแจ้งเตือน' : 'เปิดการแจ้งเตือน'}
				</button>
			</div>

			<div class="pt-2 flex justify-end">
				<button
					type="button"
					onclick={handleTestPush}
					disabled={pushLoading}
					class="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300"
				>
					<BellRing size={13} />
					<span>ส่งข้อความทดสอบ</span>
				</button>
			</div>

			<div
				class="rounded-xl bg-zinc-50/70 p-3 text-[11px] leading-relaxed text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400"
			>
				💡 สำหรับ iOS: ใช้งานได้เมื่อติดตั้งเว็บแอปนี้ผ่าน Safari ด้วยคำสั่ง "Add to Home Screen" (iOS 16.4 ขึ้นไป)
			</div>
		</div>
	</div>

	<!-- SECTION 5: WAGE & TAX CONFIGURATION -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215]"
	>
		<div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400"
				>
					<Settings size={18} />
				</div>
				<div>
					<h3 class="text-xs font-bold text-zinc-900 dark:text-white">ตั้งค่าค่าจ้าง & การคำนวณ</h3>
					<p class="text-[11px] text-zinc-400">อัตราค่าจ้าง, ตัวคูณ, และภาษีหัก ณ ที่จ่าย</p>
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-4 text-xs">
			<!-- 1. Base Hourly Rate -->
			<div>
				<label for="config-hourly-rate" class="block font-semibold text-zinc-700 dark:text-zinc-300">
					อัตราค่าจ้างพื้นฐาน (บาท / ชั่วโมง)
				</label>
				<div class="relative mt-1">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 font-bold">
						{workStore.config.currency}
					</div>
					<input
						id="config-hourly-rate"
						type="number"
						min="1"
						step="5"
						value={workStore.config.hourlyRate}
						onchange={(e) => updateHourlyRate(Number(e.currentTarget.value))}
						class="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-8 pr-3 font-mono text-sm font-bold text-zinc-800 tabular-nums transition-colors focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
					/>
				</div>
			</div>

			<!-- 2. Weekend Rate Multiplier -->
			<div>
				<label for="config-weekend-mult" class="block font-semibold text-zinc-700 dark:text-zinc-300">
					ตัวคูณค่าจ้างวันหยุด เสาร์-อาทิตย์ (Weekend Multiplier)
				</label>
				<div class="mt-1.5 flex flex-wrap gap-1.5">
					{#each multipliers as mult}
						<button
							type="button"
							onclick={() => updateWeekendMultiplier(mult)}
							class="rounded-xl px-3 py-1.5 text-xs font-bold font-mono tabular-nums transition-all {workStore.config
								.weekendMultiplier === mult
								? 'bg-purple-600 text-white shadow-xs'
								: 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300'}"
						>
							{mult}x ({formatCurrency(workStore.config.hourlyRate * mult, workStore.config.currency, 0)}/ชม.)
						</button>
					{/each}
				</div>
			</div>

			<!-- 3. Rounding Mode -->
			<div>
				<label for="config-rounding-mode" class="block font-semibold text-zinc-700 dark:text-zinc-300">
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
								: 'border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:bg-zinc-100/60 dark:border-white/10 dark:bg-zinc-800/40 dark:text-zinc-300'}"
						>
							<div>
								<div class="font-bold">{opt.label}</div>
								<div class="text-[10px] text-zinc-500 dark:text-zinc-400">{opt.desc}</div>
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
				<label for="config-tax-percent" class="block font-semibold text-zinc-700 dark:text-zinc-300">
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
							class="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 px-3 font-mono text-sm font-bold text-zinc-800 tabular-nums focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
						/>
						<span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400 font-bold">
							%
						</span>
					</div>

					<div class="flex gap-1">
						{#each taxPresets as preset}
							<button
								type="button"
								onclick={() => updateTaxPercent(preset)}
								class="rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 font-mono tabular-nums"
							>
								{preset}%
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- 5. Monthly Goal -->
			<div>
				<label for="config-monthly-goal" class="block font-semibold text-zinc-700 dark:text-zinc-300">
					เป้าหมายรายได้ต่อเดือน (บาท)
				</label>
				<div class="relative mt-1">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 font-bold">
						{workStore.config.currency}
					</div>
					<input
						id="config-monthly-goal"
						type="number"
						min="0"
						step="1000"
						value={workStore.config.monthlyIncomeGoal}
						onchange={(e) => updateMonthlyGoal(Number(e.currentTarget.value))}
						class="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-8 pr-3 font-mono text-sm font-bold text-zinc-800 tabular-nums focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- SECTION 6: BACKUP & DATA MANAGEMENT -->
	<div
		class="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-xs backdrop-blur-xs dark:border-white/10 dark:bg-[#121215] space-y-4"
	>
		<div class="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-white/5">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
			>
				<Database size={18} />
			</div>
			<div>
				<h3 class="text-xs font-bold text-zinc-900 dark:text-white">จัดการข้อมูล & สำรองไฟล์</h3>
				<p class="text-[11px] text-zinc-400">บันทึกหรือกู้คืนประวัติและข้อมูลการตั้งค่า</p>
			</div>
		</div>

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
				class="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2.5 font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
			>
				<Download size={15} />
				<span>สำรองข้อมูล JSON</span>
			</button>

			<label
				class="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2.5 font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
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
		<div class="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-2">
			<button
				type="button"
				onclick={() => {
					triggerHaptic(10);
					showResetConfirm = true;
				}}
				class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
			>
				<RotateCcw size={14} />
				<span>รีเซ็ตเป็นข้อมูลตัวอย่าง (10 กะ)</span>
			</button>

			<button
				type="button"
				onclick={() => {
					triggerHaptic(15);
					showClearConfirm = true;
				}}
				class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/70 active:scale-[0.98] transition-all dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121215] text-xs"
		>
			<div class="flex items-center gap-2 font-bold text-zinc-900 dark:text-white text-sm">
				<RotateCcw size={18} class="text-blue-600" />
				<span>ยืนยันรีเซ็ตข้อมูลตัวอย่าง?</span>
			</div>
			<p class="mt-2 text-zinc-500 dark:text-zinc-400">
				ระบบจะสร้างรายการกะงานตัวอย่าง 10 รายการ และคืนค่าการตั้งค่าเป็นค่าเริ่มต้น
			</p>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (showResetConfirm = false)}
					class="rounded-xl border border-zinc-200 bg-white py-2 font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleResetSample}
					class="rounded-xl bg-blue-600 py-2 font-bold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-sm rounded-3xl border border-red-200 bg-white p-5 shadow-2xl dark:border-red-900/60 dark:bg-[#121215] text-xs"
		>
			<div class="flex items-center gap-2 font-bold text-rose-600 text-sm">
				<AlertTriangle size={18} />
				<span>ยืนยันการล้างข้อมูลทั้งหมด?</span>
			</div>
			<p class="mt-2 text-zinc-600 dark:text-zinc-400">
				รายการประวัติงานทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้ แนะนำให้สำรองข้อมูล JSON ไว้ก่อน
			</p>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (showClearConfirm = false)}
					class="rounded-xl border border-zinc-200 bg-white py-2 font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleClearAll}
					class="rounded-xl bg-rose-600 py-2 font-bold text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] transition-all"
				>
					ล้างข้อมูลถาวร
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Cloud Account & Sync Modal -->
<AuthModal bind:isOpen={showAuthModal} />
