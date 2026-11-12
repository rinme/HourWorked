<script lang="ts">
	import {
		AlertTriangle,
		Clock,
		CheckCircle2,
		X,
		ArrowRight,
		ShieldAlert,
		Calendar,
		Sparkles
	} from 'lucide-svelte';
	import { workStore } from '../storage.svelte';
	import {
		calculateSafeguardStatus,
		formatDuration,
		formatTime,
		formatThaiDate,
		getLocalDateString
	} from '../calculator';

	let {
		isOpen = $bindable(false),
		onClose,
		onResolved
	}: {
		isOpen: boolean;
		onClose?: () => void;
		onResolved?: () => void;
	} = $props();

	// Custom checkout time sub-view
	let isCustomMode = $state(false);
	let customDate = $state(getLocalDateString(new Date()));
	let customTime = $state('20:00');
	let errorMessage = $state<string | null>(null);

	const safeguardStatus = $derived.by(() => {
		if (!workStore.activeSession) return null;
		return calculateSafeguardStatus(
			workStore.activeSession,
			workStore.config.safeguardMaxHours,
			Date.now()
		);
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

	function handleClose() {
		triggerHaptic(8);
		isOpen = false;
		isCustomMode = false;
		errorMessage = null;
		onClose?.();
	}

	// 1. Checkout at safeguard limit (e.g. exactly 12h)
	function handleCheckoutAtLimit() {
		triggerHaptic(20);
		workStore.checkoutAtSafeguardLimit();
		isOpen = false;
		onResolved?.();
	}

	// 2. Set custom end time
	function handleSaveCustomEndTime() {
		if (!workStore.activeSession) return;
		if (!customDate || !customTime) {
			errorMessage = 'กรุณาเลือกวันที่และเวลาออก';
			return;
		}

		const [hours, minutes] = customTime.split(':').map(Number);
		const targetDate = new Date(customDate);
		targetDate.setHours(hours, minutes, 0, 0);
		const customTs = targetDate.getTime();

		if (customTs <= workStore.activeSession.startTime) {
			errorMessage = 'เวลาออกงานต้องมากกว่าเวลาเข้างาน';
			return;
		}

		triggerHaptic(20);
		workStore.setCustomCheckoutTime(workStore.activeSession.id, customTs);
		isOpen = false;
		isCustomMode = false;
		onResolved?.();
	}

	// 3. Still working (snooze alert)
	function handleStillWorking(snoozeHours: number = 4) {
		triggerHaptic(12);
		if (workStore.activeSession) {
			workStore.snoozeSafeguard(workStore.activeSession.id, snoozeHours * 60);
		} else {
			workStore.snoozeSafeguard(snoozeHours);
		}
		isOpen = false;
		onResolved?.();
	}
</script>

{#if isOpen && safeguardStatus}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
		role="dialog"
		aria-modal="true"
		aria-labelledby="safeguard-modal-title"
	>
		<!-- Backdrop click listener -->
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-transparent"
			onclick={handleClose}
			aria-label="ปิดหน้าต่าง"
		></button>

		<!-- Modal Sheet -->
		<div
			class="relative w-full max-w-md rounded-t-[28px] sm:rounded-3xl border border-amber-300/60 bg-white p-6 shadow-2xl transition-all duration-300 dark:border-amber-500/30 dark:bg-[#121215] dark:text-zinc-100 max-h-[92vh] overflow-y-auto"
		>
			<!-- Top Drag Handle on Mobile -->
			<div class="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden"></div>

			<!-- Header -->
			<div class="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
				<div class="flex items-center gap-3">
					<div
						class="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 ring-4 ring-amber-500/10"
					>
						<ShieldAlert size={24} />
					</div>
					<div>
						<h2 id="safeguard-modal-title" class="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
							ระบบป้องกันการลืมลงเวลาออก
						</h2>
						<p class="text-xs text-amber-600 dark:text-amber-400 font-medium">
							บันทึกเวลาต่อเนื่องเกิน {safeguardStatus.maxHours} ชั่วโมง
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={handleClose}
					class="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
					aria-label="ปิด"
				>
					<X size={18} />
				</button>
			</div>

			<!-- Status Info Card -->
			<div class="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
				<div class="grid grid-cols-2 gap-3 text-center">
					<div class="rounded-xl bg-white/80 p-2.5 dark:bg-zinc-900/60">
						<span class="text-[11px] text-zinc-500 dark:text-zinc-400 block">เวลาที่บันทึกแล้ว</span>
						<span class="text-base font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
							{Math.floor(safeguardStatus.elapsedHours)} ชม. {Math.floor((safeguardStatus.elapsedMs % 3600000) / 60000)} นาที
						</span>
					</div>
					<div class="rounded-xl bg-white/80 p-2.5 dark:bg-zinc-900/60">
						<span class="text-[11px] text-zinc-500 dark:text-zinc-400 block">เกินขีดจำกัดไป</span>
						<span class="text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
							+{Math.floor(safeguardStatus.excessHours)} ชม. {Math.floor((safeguardStatus.excessMs % 3600000) / 60000)} นาที
						</span>
					</div>
				</div>

				<p class="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
					คุณอาจลืมกดบันทึกออกงานเมื่อกะทำงานสิ้นสุด สามารถเลือกวิธีจัดการกะนี้ได้ทันที:
				</p>
			</div>

			{#if errorMessage}
				<div
					class="mt-3.5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
				>
					<AlertTriangle size={15} class="shrink-0" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			{#if !isCustomMode}
				<!-- 3 Instant Resolution Options -->
				<div class="mt-4 space-y-2.5">
					<!-- Resolution 1: Checkout at Limit -->
					<button
						type="button"
						onclick={handleCheckoutAtLimit}
						class="w-full flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-left transition-all hover:border-blue-500 hover:bg-blue-50/50 active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900/50 dark:hover:border-blue-500/50 dark:hover:bg-blue-950/30"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
							>
								<Clock size={18} />
							</div>
							<div>
								<div class="text-sm font-bold text-zinc-900 dark:text-white">
									ออกงานที่ขีดจำกัด ({safeguardStatus.maxHours} ชม.)
								</div>
								<div class="text-xs text-zinc-500 dark:text-zinc-400">
									ตัดยอดที่เวลา {formatTime(safeguardStatus.suggestedCheckoutTime)} อัตโนมัติ
								</div>
							</div>
						</div>
						<ArrowRight size={16} class="text-zinc-400 shrink-0" />
					</button>

					<!-- Resolution 2: Set Custom End Time -->
					<button
						type="button"
						onclick={() => {
							triggerHaptic(10);
							isCustomMode = true;
							errorMessage = null;
						}}
						class="w-full flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-left transition-all hover:border-indigo-500 hover:bg-indigo-50/50 active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900/50 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/30"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
							>
								<Calendar size={18} />
							</div>
							<div>
								<div class="text-sm font-bold text-zinc-900 dark:text-white">
									ระบุเวลาออกงานเอง
								</div>
								<div class="text-xs text-zinc-500 dark:text-zinc-400">
									เลือกวันที่และเวลาออกงานที่ถูกต้องตามจริง
								</div>
							</div>
						</div>
						<ArrowRight size={16} class="text-zinc-400 shrink-0" />
					</button>

					<!-- Resolution 3: Still Working (Snooze Alert) -->
					<div
						class="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-white/10 dark:bg-zinc-900/50"
					>
						<div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
							กำลังทำงานอยู่จริง (ขยายเวลาแจ้งเตือน):
						</div>
						<div class="grid grid-cols-3 gap-2">
							<button
								type="button"
								onclick={() => handleStillWorking(2)}
								class="rounded-xl border border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
							>
								+2 ชั่วโมง
							</button>
							<button
								type="button"
								onclick={() => handleStillWorking(4)}
								class="rounded-xl border border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
							>
								+4 ชั่วโมง
							</button>
							<button
								type="button"
								onclick={() => handleStillWorking(6)}
								class="rounded-xl border border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
							>
								+6 ชั่วโมง
							</button>
						</div>
					</div>
				</div>
			{:else}
				<!-- Custom Time Form -->
				<div class="mt-4 space-y-3.5">
					<div>
						<label for="custom-end-date" class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
							วันที่ออกงาน
						</label>
						<input
							id="custom-end-date"
							type="date"
							bind:value={customDate}
							class="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-zinc-900/60 dark:text-white"
						/>
					</div>

					<div>
						<label for="custom-end-time" class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
							เวลาที่ออกงานจริง (HH:mm)
						</label>
						<input
							id="custom-end-time"
							type="time"
							bind:value={customTime}
							class="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm font-mono text-zinc-900 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-zinc-900/60 dark:text-white"
						/>
					</div>

					<div class="grid grid-cols-2 gap-2 pt-2">
						<button
							type="button"
							onclick={() => (isCustomMode = false)}
							class="rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
						>
							ย้อนกลับ
						</button>
						<button
							type="button"
							onclick={handleSaveCustomEndTime}
							class="rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all"
						>
							บันทึกเวลาออก
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
