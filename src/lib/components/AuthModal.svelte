<script lang="ts">
	import {
		X,
		Cloud,
		CloudOff,
		RefreshCw,
		CheckCircle2,
		AlertCircle,
		User,
		Lock,
		LogIn,
		UserPlus,
		LogOut,
		ShieldCheck,
		ArrowRight,
		Eye,
		EyeOff
	} from 'lucide-svelte';
	import { workStore } from '../storage.svelte';
	import { formatThaiDate } from '../calculator';

	let {
		isOpen = $bindable(false),
		onClose
	}: {
		isOpen: boolean;
		onClose?: () => void;
	} = $props();

	let mode = $state<'login' | 'register'>('login');
	let username = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	function triggerHaptic(duration = 10) {
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
		errorMessage = null;
		successMessage = null;
		onClose?.();
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!username.trim() || !password.trim()) {
			errorMessage = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
			return;
		}

		triggerHaptic(15);
		isSubmitting = true;
		errorMessage = null;
		successMessage = null;

		try {
			if (mode === 'register') {
				const res = await workStore.register(username.trim(), password);
				if (res.success) {
					successMessage = 'สมัครสมาชิกและซิงค์ข้อมูล Cloud สำเร็จ!';
					setTimeout(() => {
						handleClose();
					}, 1200);
				} else {
					errorMessage = res.error || 'ไม่สามารถสมัครสมาชิกได้';
				}
			} else {
				const res = await workStore.login(username.trim(), password);
				if (res.success) {
					successMessage = 'เข้าสู่ระบบสำเร็จ!';
					setTimeout(() => {
						handleClose();
					}, 1000);
				} else {
					errorMessage = res.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
				}
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSyncNow() {
		triggerHaptic(12);
		errorMessage = null;
		successMessage = null;
		const ok = await workStore.syncWithCloud();
		if (ok) {
			successMessage = 'ซิงค์ข้อมูลกับ Cloud สำเร็จแล้ว';
			setTimeout(() => {
				successMessage = null;
			}, 3000);
		} else {
			errorMessage = workStore.syncError || 'ไม่สามารถซิงค์ข้อมูลได้ในขณะนี้';
		}
	}

	async function handleLogout() {
		triggerHaptic(15);
		await workStore.logout();
		successMessage = 'ออกจากระบบแล้ว กลับสู่โหมดออฟไลน์ (Guest)';
		setTimeout(() => {
			successMessage = null;
		}, 2500);
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
		role="dialog"
		aria-modal="true"
		aria-labelledby="auth-modal-title"
	>
		<!-- Backdrop click listener -->
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-transparent"
			onclick={handleClose}
			aria-label="ปิดหน้าต่าง"
		></button>

		<!-- Modal Container -->
		<div
			class="relative w-full max-w-md rounded-t-[28px] sm:rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-2xl transition-all duration-300 dark:border-white/10 dark:bg-[#121215] dark:text-zinc-100 max-h-[90vh] overflow-y-auto"
		>
			<!-- Top Handle on Mobile -->
			<div class="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden"></div>

			<!-- Header -->
			<div class="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
				<div class="flex items-center gap-2.5">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
					>
						<Cloud size={20} />
					</div>
					<div>
						<h2 id="auth-modal-title" class="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
							{workStore.user ? 'บัญชีผู้ใช้ & คลาวด์' : 'Cloud Sync & บัญชี'}
						</h2>
						<p class="text-xs text-zinc-500 dark:text-zinc-400">
							{workStore.user ? 'เชื่อมต่อฐานข้อมูล Neon Serverless' : 'ซิงค์ข้อมูลการทำงานข้ามอุปกรณ์'}
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

			<!-- Alert Messages -->
			{#if errorMessage}
				<div
					class="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
				>
					<AlertCircle size={16} class="shrink-0 mt-0.5" />
					<div class="flex-1">
						<div>{errorMessage}</div>
						{#if mode === 'register' && errorMessage.includes('มีผู้ใช้งานแล้ว')}
							<button
								type="button"
								onclick={() => {
									mode = 'login';
									errorMessage = null;
								}}
								class="mt-1.5 font-semibold underline hover:text-rose-800 dark:hover:text-rose-200 block"
							>
								สลับไปที่แท็บ "เข้าสู่ระบบ" ทันที →
							</button>
						{/if}
					</div>
				</div>
			{/if}

			{#if successMessage}
				<div
					class="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
				>
					<CheckCircle2 size={16} class="shrink-0 mt-0.5" />
					<div class="flex-1">{successMessage}</div>
				</div>
			{/if}

			{#if workStore.user}
				<!-- Logged In View -->
				<div class="mt-5 space-y-4">
					<!-- Account Card -->
					<div
						class="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-200 text-zinc-700 font-semibold dark:bg-zinc-800 dark:text-zinc-200 text-base"
								>
									{workStore.user.username.slice(0, 2).toUpperCase()}
								</div>
								<div>
									<div class="font-bold text-zinc-900 dark:text-white">
										{workStore.user.username}
									</div>
									<div class="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
										<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
										<span>เชื่อมต่อคลาวด์แล้ว</span>
									</div>
								</div>
							</div>

							<!-- Sync Status Pill -->
							<div
								class="rounded-full px-2.5 py-1 text-[11px] font-medium {workStore.syncStatus === 'syncing'
									? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
									: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'}"
							>
								{workStore.syncStatus === 'syncing' ? '↻ กำลังซิงค์' : '● ซิงค์สมบูรณ์'}
							</div>
						</div>

						<!-- Last Sync Info -->
						<div class="mt-3.5 pt-3 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
							<span>ซิงค์ล่าสุด:</span>
							<span class="font-mono tabular-nums">
								{workStore.lastSyncedAt
									? formatThaiDate(new Date(workStore.lastSyncedAt), { showTime: true })
									: 'ยังไม่ได้บันทึก'}
							</span>
						</div>
					</div>

					<!-- Actions -->
					<div class="grid grid-cols-2 gap-2.5 pt-2">
						<button
							type="button"
							onclick={handleSyncNow}
							disabled={workStore.syncStatus === 'syncing'}
							class="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
						>
							<RefreshCw
								size={15}
								class={workStore.syncStatus === 'syncing' ? 'animate-spin' : ''}
							/>
							<span>ซิงค์ทันที</span>
						</button>

						<button
							type="button"
							onclick={handleLogout}
							class="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
						>
							<LogOut size={15} />
							<span>ออกจากระบบ</span>
						</button>
					</div>
				</div>
			{:else}
				<!-- Log In / Register Tabs -->
				<div class="mt-5">
					<div class="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
						<button
							type="button"
							onclick={() => {
								mode = 'login';
								errorMessage = null;
							}}
							class="rounded-lg py-2 text-xs font-semibold transition-all {mode === 'login'
								? 'bg-white text-zinc-900 shadow-xs dark:bg-[#121215] dark:text-white'
								: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
						>
							เข้าสู่ระบบ
						</button>
						<button
							type="button"
							onclick={() => {
								mode = 'register';
								errorMessage = null;
							}}
							class="rounded-lg py-2 text-xs font-semibold transition-all {mode === 'register'
								? 'bg-white text-zinc-900 shadow-xs dark:bg-[#121215] dark:text-white'
								: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
						>
							สร้างบัญชีใหม่
						</button>
					</div>

					<form onsubmit={handleSubmit} class="mt-4 space-y-3.5">
						<!-- Username -->
						<div>
							<label for="auth-username" class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								ชื่อผู้ใช้ (Username)
							</label>
							<div class="relative">
								<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
									<User size={16} />
								</div>
								<input
									id="auth-username"
									type="text"
									autocomplete="username"
									bind:value={username}
									placeholder="เช่น user123 หรือ somchai"
									required
									minlength="3"
									class="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-zinc-900/60 dark:text-white dark:placeholder:text-zinc-500"
								/>
							</div>
						</div>

						<!-- Password -->
						<div>
							<label for="auth-password" class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								รหัสผ่าน (Password)
							</label>
							<div class="relative">
								<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
									<Lock size={16} />
								</div>
								<input
									id="auth-password"
									type={showPassword ? 'text' : 'password'}
									autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
									bind:value={password}
									placeholder="อย่างน้อย 6 ตัวอักษร"
									required
									minlength="6"
									class="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-zinc-900/60 dark:text-white dark:placeholder:text-zinc-500"
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
									aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
								>
									{#if showPassword}
										<EyeOff size={16} />
									{:else}
										<Eye size={16} />
									{/if}
								</button>
							</div>
						</div>

						<!-- Submit Button -->
						<button
							type="submit"
							disabled={isSubmitting}
							class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
						>
							{#if isSubmitting}
								<RefreshCw size={16} class="animate-spin" />
								<span>กำลังดำเนินการ...</span>
							{:else if mode === 'login'}
								<LogIn size={16} />
								<span>เข้าสู่ระบบ & ซิงค์ข้อมูล</span>
							{:else}
								<UserPlus size={16} />
								<span>สร้างบัญชี & ซิงค์ข้อมูล</span>
							{/if}
						</button>
					</form>

					<!-- Offline/Guest note -->
					<div
						class="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center text-[11px] leading-relaxed text-zinc-500 dark:border-white/5 dark:bg-zinc-900/30 dark:text-zinc-400"
					>
						💡 หากไม่เข้าสู่ระบบ ข้อมูลจะถูกบันทึกอย่างปลอดภัยในบราวเซอร์นี้ (Guest Mode) คุณสามารถเปิดใช้งาน Cloud Sync ได้ทุกเมื่อ
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
