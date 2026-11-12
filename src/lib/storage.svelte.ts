import type {
	WorkSession,
	UserConfig,
	BreakPeriod,
	ExportData,
	User,
	SyncStatus,
	AuthResponse,
	SyncPayload,
	SyncResponse,
	SafeguardStatus,
	TimedShiftProgress
} from './types';
import {
	calculateTotalSummary,
	calculateMonthlySummary,
	calculateGoalProgress,
	groupSessionsByDate,
	calculateSessionWage,
	getLocalDateString,
	calculateSafeguardStatus,
	isSessionExceedingSafeguard,
	calculateTimedModeProgress
} from './calculator';

import { DEFAULT_CONFIG } from './types';
export { DEFAULT_CONFIG };

const STORAGE_KEYS = {
	SESSIONS: 'hourworked_sessions_v1',
	CONFIG: 'hourworked_config_v1',
	ACTIVE: 'hourworked_active_session_v1',
	USER: 'hourworked_user_v1',
	TOKEN: 'hourworked_token_v1',
	DELETED: 'hourworked_deleted_sessions_v1',
	LAST_SYNCED: 'hourworked_last_synced_v1'
} as const;

export function generateId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Creates 10-12 realistic sample sessions relative to the current date.
 */
export function createSampleSessions(referenceDate: Date = new Date()): WorkSession[] {
	const sessions: WorkSession[] = [];
	const base = new Date(referenceDate);

	const samples = [
		{
			daysAgo: 1,
			startHour: 9,
			startMin: 0,
			endHour: 17,
			endMin: 30,
			breakDurationMin: 60,
			note: 'งานประจำ ประชุมทีม & อัปเดตงาน'
		},
		{
			daysAgo: 2,
			startHour: 10,
			startMin: 0,
			endHour: 19,
			endMin: 0,
			breakDurationMin: 60,
			note: 'ประสานงานลูกค้า & จัดเตรียมระบบ'
		},
		{
			daysAgo: 3,
			startHour: 13,
			startMin: 0,
			endHour: 18,
			endMin: 0,
			breakDurationMin: 0,
			note: 'กะบ่าย ช่วยงานพิเศษหน้าร้าน'
		},
		{
			daysAgo: 4,
			startHour: 10,
			startMin: 0,
			endHour: 17,
			endMin: 0,
			breakDurationMin: 45,
			note: 'กะเสาร์ งานซัพพอร์ตด่วน (เรทพิเศษ 1.5x)'
		},
		{
			daysAgo: 5,
			startHour: 11,
			startMin: 0,
			endHour: 16,
			endMin: 30,
			breakDurationMin: 30,
			note: 'กะอาทิตย์ ดูแลลูกค้านอกสถานที่ (1.5x)'
		},
		{
			daysAgo: 6,
			startHour: 9,
			startMin: 30,
			endHour: 18,
			endMin: 30,
			breakDurationMin: 60,
			note: 'พัฒนาระบบหลังบ้าน & สรุปยอดขาย'
		},
		{
			daysAgo: 7,
			startHour: 9,
			startMin: 0,
			endHour: 17,
			endMin: 0,
			breakDurationMin: 60,
			note: 'เทรนนิ่งระบบและตรวจสอบเอกสาร'
		},
		{
			daysAgo: 8,
			startHour: 13,
			startMin: 30,
			endHour: 21,
			endMin: 0,
			breakDurationMin: 30,
			note: 'กะเย็น ปิดยอดประจำวัน'
		},
		{
			daysAgo: 9,
			startHour: 8,
			startMin: 30,
			endHour: 16,
			endMin: 30,
			breakDurationMin: 60,
			note: 'จัดสต็อกสินค้า & เช็คยอดคงเหลือ'
		},
		{
			daysAgo: 10,
			startHour: 9,
			startMin: 0,
			endHour: 18,
			endMin: 0,
			breakDurationMin: 60,
			note: 'วางแผนงานโปรเจกต์ & รีวิวผลงาน'
		}
	];

	for (const s of samples) {
		const targetDate = new Date(base);
		targetDate.setDate(targetDate.getDate() - s.daysAgo);

		const startTime = new Date(targetDate);
		startTime.setHours(s.startHour, s.startMin, 0, 0);

		const endTime = new Date(targetDate);
		endTime.setHours(s.endHour, s.endMin, 0, 0);

		const breaks: BreakPeriod[] = [];
		if (s.breakDurationMin > 0) {
			const breakStart = new Date(startTime);
			breakStart.setHours(12, 0, 0, 0);
			const breakEnd = new Date(breakStart.getTime() + s.breakDurationMin * 60 * 1000);
			breaks.push({
				start: breakStart.getTime(),
				end: breakEnd.getTime()
			});
		}

		sessions.push({
			id: 'sample_' + (samples.indexOf(s) + 1),
			isSample: true,
			date: getLocalDateString(targetDate),
			startTime: startTime.getTime(),
			endTime: endTime.getTime(),
			breaks,
			note: s.note
		});
	}

	return sessions.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Svelte 5 Reactive WorkStore managing state with runes and localStorage persistence.
 */
export class WorkStore {
	activeSession = $state<WorkSession | null>(null);
	sessions = $state<WorkSession[]>([]);
	config = $state<UserConfig>({ ...DEFAULT_CONFIG });
	isLoaded = $state<boolean>(false);

	// User Auth & Cloud Sync States
	user = $state<User | null>(null);
	token = $state<string | null>(null);
	deletedSessionIds = $state<string[]>([]);
	syncStatus = $state<SyncStatus>('guest');
	lastSyncedAt = $state<number | null>(null);
	syncError = $state<string | null>(null);
	private autoSyncTimer: any = null;

	constructor() {
		this.init();
	}

	private init() {
		if (typeof window === 'undefined') {
			this.sessions = createSampleSessions();
			this.isLoaded = true;
			return;
		}

		try {
			// 1. Load config
			const storedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
			if (storedConfig) {
				this.config = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
			} else {
				this.config = { ...DEFAULT_CONFIG };
			}

			// 2. Load sessions
			const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
			if (storedSessions) {
				const parsed = JSON.parse(storedSessions);
				if (Array.isArray(parsed) && parsed.length > 0) {
					this.sessions = parsed;
				} else {
					this.sessions = createSampleSessions();
					this.saveSessions();
				}
			} else {
				this.sessions = createSampleSessions();
				this.saveSessions();
			}

			// 3. Load active session
			const storedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE);
			if (storedActive) {
				this.activeSession = JSON.parse(storedActive);
			}

			// 4. Load cached user & sync metadata
			const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
			const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
			if (storedToken) {
				this.token = storedToken;
			}
			if (storedUser) {
				try {
					this.user = JSON.parse(storedUser);
					this.syncStatus = 'idle';
				} catch {
					this.user = null;
					this.syncStatus = 'guest';
				}
			} else {
				this.user = null;
				this.syncStatus = 'guest';
			}

			const storedLastSynced = localStorage.getItem(STORAGE_KEYS.LAST_SYNCED);
			if (storedLastSynced) {
				this.lastSyncedAt = Number(storedLastSynced) || null;
			}

			const storedDeleted = localStorage.getItem(STORAGE_KEYS.DELETED);
			if (storedDeleted) {
				try {
					this.deletedSessionIds = JSON.parse(storedDeleted) || [];
				} catch {
					this.deletedSessionIds = [];
				}
			}
		} catch (err) {
			console.error('Error loading data from localStorage, falling back to defaults', err);
			this.sessions = createSampleSessions();
			this.config = { ...DEFAULT_CONFIG };
		} finally {
			this.isLoaded = true;
		}

		// Asynchronously verify authentication status with server if online
		if (typeof window !== 'undefined') {
			if (this.user) {
				this.fetchUserStatus().catch(() => {});
				setTimeout(() => {
					this.syncWithCloud().catch(() => {});
				}, 400);
			}

			// Automatically re-sync from cloud when switching back to app / tab focus
			window.addEventListener('focus', () => {
				if (this.user && this.syncStatus !== 'syncing') {
					this.syncWithCloud().catch(() => {});
				}
			});

			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && this.user && this.syncStatus !== 'syncing') {
					this.syncWithCloud().catch(() => {});
				}
			});

			// Periodic background sync every 45s while active
			setInterval(() => {
				if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.user && this.syncStatus !== 'syncing') {
					this.syncWithCloud().catch(() => {});
				}
			}, 45000);
		}
	}

	private saveSessions() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
		} catch (e) {
			console.error('Failed to save sessions', e);
		}
	}

	private saveConfig() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
		} catch (e) {
			console.error('Failed to save config', e);
		}
	}

	private saveActive() {
		if (typeof window === 'undefined') return;
		try {
			if (this.activeSession) {
				localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(this.activeSession));
			} else {
				localStorage.removeItem(STORAGE_KEYS.ACTIVE);
			}
		} catch (e) {
			console.error('Failed to save active session', e);
		}
	}

	private saveUser() {
		if (typeof window === 'undefined') return;
		try {
			if (this.user) {
				localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.user));
			} else {
				localStorage.removeItem(STORAGE_KEYS.USER);
			}
		} catch (e) {
			console.error('Failed to save user state', e);
		}
	}

	private saveToken() {
		if (typeof window === 'undefined') return;
		try {
			if (this.token) {
				localStorage.setItem(STORAGE_KEYS.TOKEN, this.token);
			} else {
				localStorage.removeItem(STORAGE_KEYS.TOKEN);
			}
		} catch (e) {
			console.error('Failed to save token', e);
		}
	}

	private saveDeleted() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEYS.DELETED, JSON.stringify(this.deletedSessionIds));
		} catch (e) {
			console.error('Failed to save deleted sessions', e);
		}
	}

	scheduleAutoSync(delayMs: number = 800) {
		if (typeof window === 'undefined') return;
		if (!this.user) return;
		if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
		this.autoSyncTimer = setTimeout(() => {
			this.syncWithCloud().catch(() => {});
		}, delayMs);
	}

	// -------------------------------------------------------------
	// Actions
	// -------------------------------------------------------------

	/**
	 * Starts a new work session.
	 */
	clockIn(note: string = ''): WorkSession {
		if (this.activeSession) {
			return this.activeSession;
		}

		const now = Date.now();
		const newSession: WorkSession = {
			id: generateId(),
			date: getLocalDateString(new Date(now)),
			startTime: now,
			endTime: null,
			breaks: [],
			note: note.trim()
		};

		this.activeSession = newSession;
		this.saveActive();
		this.scheduleAutoSync(500);
		return newSession;
	}

	/**
	 * Stops the active work session and appends it to sessions history.
	 */
	clockOut(note?: string): WorkSession | null {
		if (!this.activeSession) {
			return null;
		}

		const now = Date.now();
		// If there is an ongoing break, close it
		const updatedBreaks = this.activeSession.breaks.map((b) =>
			b.end === null ? { ...b, end: now } : b
		);

		const completedSession: WorkSession = {
			...this.activeSession,
			breaks: updatedBreaks,
			endTime: now,
			note: note !== undefined ? note.trim() : this.activeSession.note,
			updatedAt: now
		};

		this.sessions = [completedSession, ...this.sessions].sort(
			(a, b) => b.startTime - a.startTime
		);
		this.activeSession = null;

		this.saveSessions();
		this.saveActive();
		this.scheduleAutoSync(100);

		return completedSession;
	}

	/**
	 * Toggles break status for the active session.
	 * If on break, ends current break. If working, starts a new break.
	 */
	toggleBreak(): boolean {
		if (!this.activeSession) return false;

		const now = Date.now();
		const currentBreaks = [...this.activeSession.breaks];
		const openBreakIndex = currentBreaks.findIndex((b) => b.end === null);

		if (openBreakIndex !== -1) {
			// End break
			currentBreaks[openBreakIndex] = {
				...currentBreaks[openBreakIndex],
				end: now
			};
		} else {
			// Start new break
			currentBreaks.push({
				start: now,
				end: null
			});
		}

		this.activeSession = {
			...this.activeSession,
			breaks: currentBreaks,
			updatedAt: now
		};
		this.saveActive();
		this.scheduleAutoSync(300);

		return openBreakIndex === -1; // returns true if now on break
	}

	/**
	 * Adds a completed session manually (e.g. from modal entry).
	 */
	addManualEntry(entry: Omit<WorkSession, 'id'> | WorkSession): WorkSession {
		const now = Date.now();
		const newSession: WorkSession = {
			id: 'id' in entry && entry.id ? entry.id : generateId(),
			date: entry.date,
			startTime: entry.startTime,
			endTime: entry.endTime,
			breaks: entry.breaks || [],
			note: entry.note?.trim() || '',
			updatedAt: now
		};

		this.sessions = [newSession, ...this.sessions].sort((a, b) => b.startTime - a.startTime);
		this.saveSessions();
		this.scheduleAutoSync(100);
		return newSession;
	}

	/**
	 * Updates an existing session by ID (can be in history or active session).
	 */
	updateSession(id: string, updates: Partial<WorkSession>): boolean {
		const now = Date.now();
		if (this.activeSession && this.activeSession.id === id) {
			this.activeSession = { ...this.activeSession, ...updates, updatedAt: now };
			this.saveActive();
			this.scheduleAutoSync(100);
			return true;
		}

		const index = this.sessions.findIndex((s) => s.id === id);
		if (index !== -1) {
			this.sessions[index] = { ...this.sessions[index], ...updates, updatedAt: now };
			this.sessions = [...this.sessions].sort((a, b) => b.startTime - a.startTime);
			this.saveSessions();
			this.scheduleAutoSync(100);
			return true;
		}

		return false;
	}

	/**
	 * Deletes a session from history or discards the active session.
	 */
	deleteSession(id: string): boolean {
		if (this.activeSession && this.activeSession.id === id) {
			this.activeSession = null;
			this.saveActive();
			this.scheduleAutoSync(100);
			return true;
		}

		const initialLen = this.sessions.length;
		this.sessions = this.sessions.filter((s) => s.id !== id);
		if (this.sessions.length !== initialLen) {
			if (!id.startsWith('sample_')) {
				if (!this.deletedSessionIds.includes(id)) {
					this.deletedSessionIds.push(id);
					this.saveDeleted();
				}
			}
			this.saveSessions();
			this.scheduleAutoSync(100);
			return true;
		}

		return false;
	}

	/**
	 * Updates user configuration settings.
	 */
	updateConfig(updates: Partial<UserConfig>) {
		this.config = { ...this.config, ...updates };
		this.saveConfig();
		this.scheduleAutoSync(400);
	}

	// -------------------------------------------------------------
	// Safeguard Resolution Methods
	// -------------------------------------------------------------

	/**
	 * Resolves safeguard alert by ending session at the exact maximum continuous limit.
	 * E.g. If clocked in at 08:00 with 12h max limit, end time is recorded at 20:00.
	 */
	checkoutAtSafeguardLimit(id?: string): WorkSession | null {
		const targetSession =
			id && this.activeSession?.id !== id
				? this.sessions.find((s) => s.id === id)
				: this.activeSession;

		if (!targetSession) return null;

		const limitMs = this.config.safeguardMaxHours * 3600 * 1000;
		const checkoutTime = targetSession.startTime + limitMs;

		if (this.activeSession && this.activeSession.id === targetSession.id) {
			// Close any ongoing breaks at checkoutTime
			const updatedBreaks = this.activeSession.breaks.map((b) =>
				b.end === null ? { ...b, end: Math.max(b.start, checkoutTime) } : b
			);

			const completedSession: WorkSession = {
				...this.activeSession,
				breaks: updatedBreaks,
				endTime: checkoutTime,
				note:
					(this.activeSession.note ? this.activeSession.note + ' ' : '') +
					`[ตัดกะตามเกณฑ์ปลอดภัย ${this.config.safeguardMaxHours}ชม.]`
			};

			this.sessions = [completedSession, ...this.sessions].sort(
				(a, b) => b.startTime - a.startTime
			);
			this.activeSession = null;
			this.saveSessions();
			this.saveActive();
			return completedSession;
		} else {
			const index = this.sessions.findIndex((s) => s.id === targetSession.id);
			if (index !== -1) {
				this.sessions[index] = {
					...this.sessions[index],
					endTime: checkoutTime
				};
				this.sessions = [...this.sessions].sort((a, b) => b.startTime - a.startTime);
				this.saveSessions();
				return this.sessions[index];
			}
			return null;
		}
	}

	/**
	 * Sets a specific custom checkout timestamp for an active or completed session.
	 */
	setCustomCheckoutTime(id: string, timestamp: number): boolean {
		if (this.activeSession && this.activeSession.id === id) {
			const updatedBreaks = this.activeSession.breaks.map((b) =>
				b.end === null ? { ...b, end: Math.max(b.start, timestamp) } : b
			);

			const completedSession: WorkSession = {
				...this.activeSession,
				breaks: updatedBreaks,
				endTime: timestamp
			};

			this.sessions = [completedSession, ...this.sessions].sort(
				(a, b) => b.startTime - a.startTime
			);
			this.activeSession = null;
			this.saveSessions();
			this.saveActive();
			return true;
		}

		const index = this.sessions.findIndex((s) => s.id === id);
		if (index !== -1) {
			this.sessions[index] = {
				...this.sessions[index],
				endTime: timestamp
			};
			this.sessions = [...this.sessions].sort((a, b) => b.startTime - a.startTime);
			this.saveSessions();
			return true;
		}

		return false;
	}

	/**
	 * Snoozes safeguard warnings for a session by a number of minutes or hours (default 60 minutes).
	 */
	snoozeSafeguard(idOrMinutes?: string | number, snoozeMinutes: number = 60): boolean {
		let targetId: string | undefined;
		let durationMinutes = snoozeMinutes;

		if (typeof idOrMinutes === 'number') {
			targetId = this.activeSession?.id;
			durationMinutes = idOrMinutes <= 12 ? idOrMinutes * 60 : idOrMinutes;
		} else {
			targetId = idOrMinutes ?? this.activeSession?.id;
		}

		if (!targetId) return false;

		const snoozedUntil = Date.now() + durationMinutes * 60 * 1000;

		if (this.activeSession && this.activeSession.id === targetId) {
			this.activeSession = {
				...this.activeSession,
				safeguardSnoozedUntil: snoozedUntil
			};
			this.saveActive();
			return true;
		}

		const index = this.sessions.findIndex((s) => s.id === targetId);
		if (index !== -1) {
			this.sessions[index] = {
				...this.sessions[index],
				safeguardSnoozedUntil: snoozedUntil
			};
			this.saveSessions();
			return true;
		}

		return false;
	}

	// -------------------------------------------------------------
	// Timed Mode (Scheduled Shift) Methods
	// -------------------------------------------------------------

	/**
	 * Starts a scheduled shift session.
	 */
	startScheduledShift(note?: string): WorkSession {
		if (this.activeSession) {
			return this.activeSession;
		}

		const now = Date.now();
		const defaultNote = `กะงานตามเวลา (${this.config.scheduledStart} - ${this.config.scheduledEnd})`;
		const newSession: WorkSession = {
			id: generateId(),
			date: getLocalDateString(new Date(now)),
			startTime: now,
			endTime: null,
			breaks: [],
			note: note !== undefined ? note.trim() : defaultNote,
			isScheduledShift: true
		};

		this.activeSession = newSession;
		this.saveActive();
		return newSession;
	}

	/**
	 * Completes the active scheduled shift.
	 */
	completeScheduledShift(note?: string): WorkSession | null {
		return this.clockOut(note);
	}

	// -------------------------------------------------------------
	// Cloud Sync & Auth Methods
	// -------------------------------------------------------------

	/**
	 * Fetches user profile from server session to verify login state.
	 */
	async fetchUserStatus(): Promise<User | null> {
		if (typeof window === 'undefined') return null;
		try {
			const headers: Record<string, string> = {};
			if (this.token) {
				headers['Authorization'] = `Bearer ${this.token}`;
			}
			const res = await fetch('/api/auth/me', { headers });
			if (res.ok) {
				const data = await res.json().catch(() => ({}));
				if (data.user) {
					this.user = data.user;
					this.syncStatus = 'idle';
					this.saveUser();
					return data.user;
				}
			}
			if (res.status === 401) {
				this.user = null;
				this.token = null;
				this.saveToken();
				this.syncStatus = 'guest';
				this.saveUser();
			}
			return null;
		} catch (err) {
			console.warn('Failed to fetch auth status', err);
			return null;
		}
	}

	/**
	 * Registers a new user account and immediately performs cloud sync.
	 */
	async register(username: string, password: string): Promise<AuthResponse> {
		if (typeof window === 'undefined') return { success: false, error: 'Browser only' };
		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || (!data.success && !data.user)) {
				return { success: false, error: data.error || 'การลงทะเบียนไม่สำเร็จ' };
			}
			this.user = data.user;
			if (data.token) {
				this.token = data.token;
				this.saveToken();
			}
			this.syncStatus = 'idle';
			this.saveUser();
			await this.syncWithCloud();
			return { success: true, user: data.user, message: data.message };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
			};
		}
	}

	/**
	 * Logs into an existing account and immediately performs cloud sync.
	 */
	async login(username: string, password: string): Promise<AuthResponse> {
		if (typeof window === 'undefined') return { success: false, error: 'Browser only' };
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || (!data.success && !data.user)) {
				return { success: false, error: data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
			}
			this.user = data.user;
			if (data.token) {
				this.token = data.token;
				this.saveToken();
			}
			this.syncStatus = 'idle';
			this.saveUser();
			await this.syncWithCloud();
			return { success: true, user: data.user };
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
			};
		}
	}

	/**
	 * Logs out current user and switches back to local guest mode.
	 */
	async logout(): Promise<void> {
		if (typeof window === 'undefined') return;
		try {
			const headers: Record<string, string> = {};
			if (this.token) {
				headers['Authorization'] = `Bearer ${this.token}`;
			}
			await fetch('/api/auth/logout', { method: 'POST', headers });
		} catch (e) {
			console.warn('Logout fetch failed:', e);
		}
		this.user = null;
		this.token = null;
		this.saveToken();
		this.syncStatus = 'guest';
		this.syncError = null;
		this.saveUser();
	}

	/**
	 * Syncs local sessions and configuration with cloud database.
	 */
	async syncWithCloud(): Promise<boolean> {
		if (typeof window === 'undefined') return false;
		if (!this.user) {
			this.syncStatus = 'guest';
			return false;
		}

		this.syncStatus = 'syncing';
		this.syncError = null;

		try {
			// Filter out demo sample sessions so they never pollute cloud
			const realSessions = this.sessions.filter(
				(s) => !s.id.startsWith('sample_') && !s.isSample
			);

			const payload: SyncPayload = {
				sessions: realSessions,
				deletedSessionIds: [...this.deletedSessionIds],
				config: this.config,
				lastSyncedAt: this.lastSyncedAt
			};

			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			if (this.token) {
				headers['Authorization'] = `Bearer ${this.token}`;
			}

			const res = await fetch('/api/sync', {
				method: 'POST',
				headers,
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || `ซิงค์ไม่สำเร็จ (${res.status})`);
			}

			const data: SyncResponse = await res.json();
			if (data.success) {
				this.deletedSessionIds = [];
				this.saveDeleted();

				if (Array.isArray(data.sessions)) {
					const sessionMap = new Map<string, WorkSession>();
					for (const s of data.sessions) {
						if (!s.id.startsWith('sample_')) {
							sessionMap.set(s.id, s);
						}
					}
					for (const s of realSessions) {
						if (!sessionMap.has(s.id)) {
							sessionMap.set(s.id, s);
						}
					}
					this.sessions = Array.from(sessionMap.values()).sort(
						(a, b) => (Number(b.startTime) || 0) - (Number(a.startTime) || 0)
					);
					this.saveSessions();
				}

				if (data.config) {
					this.config = { ...DEFAULT_CONFIG, ...this.config, ...data.config };
					this.saveConfig();
				}

				this.lastSyncedAt = data.syncedAt || Date.now();
				localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, String(this.lastSyncedAt));
				this.syncStatus = 'synced';
				return true;
			} else {
				throw new Error(data.error || 'ซิงค์ไม่สำเร็จ');
			}
		} catch (err) {
			console.error('Cloud sync error:', err);
			this.syncStatus = 'error';
			this.syncError = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล';
			return false;
		}
	}

	// -------------------------------------------------------------
	// Import / Export / Maintenance
	// -------------------------------------------------------------

	/**
	 * Exports all data to a structured JSON string.
	 */
	exportData(): string {
		const payload: ExportData = {
			version: 1,
			appName: 'HourWorked',
			exportedAt: new Date().toISOString(),
			config: { ...this.config },
			sessions: [...this.sessions]
		};
		return JSON.stringify(payload, null, 2);
	}

	/**
	 * Imports data from JSON string.
	 */
	importData(jsonString: string): { success: boolean; message: string } {
		try {
			const data = JSON.parse(jsonString);
			if (!data || !Array.isArray(data.sessions)) {
				return {
					success: false,
					message: 'รูปแบบไฟล์ไม่ถูกต้อง: ไม่พบรายการประวัติงาน'
				};
			}

			this.sessions = data.sessions.sort(
				(a: WorkSession, b: WorkSession) => b.startTime - a.startTime
			);

			if (data.config && typeof data.config === 'object') {
				this.config = { ...DEFAULT_CONFIG, ...data.config };
				this.saveConfig();
			}

			this.saveSessions();
			return {
				success: true,
				message: `นำเข้าข้อมูลสำเร็จ: ${this.sessions.length} รายการ`
			};
		} catch (err) {
			return {
				success: false,
				message: 'เกิดข้อผิดพลาดในการอ่านไฟล์ JSON: ' + (err instanceof Error ? err.message : '')
			};
		}
	}

	/**
	 * Resets all sessions to realistic sample data and resets config to default.
	 */
	resetToSampleData() {
		this.sessions = createSampleSessions();
		this.config = { ...DEFAULT_CONFIG };
		this.activeSession = null;
		this.saveSessions();
		this.saveConfig();
		this.saveActive();
	}

	/**
	 * Clears all sessions and active session.
	 */
	clearAllData() {
		this.sessions = [];
		this.activeSession = null;
		this.saveSessions();
		this.saveActive();
	}

	// -------------------------------------------------------------
	// Getters & Derived Helpers
	// -------------------------------------------------------------

	/**
	 * Checks if currently clocked in.
	 */
	get isClockedIn(): boolean {
		return this.activeSession !== null;
	}

	/**
	 * Checks if active session is currently on break.
	 */
	get isOnBreak(): boolean {
		if (!this.activeSession) return false;
		return this.activeSession.breaks.some((b) => b.end === null);
	}

	/**
	 * Returns current open break if any.
	 */
	get currentBreak(): BreakPeriod | null {
		if (!this.activeSession) return null;
		return this.activeSession.breaks.find((b) => b.end === null) || null;
	}

	/**
	 * Returns completed sessions for today.
	 */
	get todaySessions(): WorkSession[] {
		const todayStr = getLocalDateString();
		return this.sessions.filter((s) => s.date === todayStr);
	}

	/**
	 * Summary for today's completed sessions.
	 */
	get todaySummary() {
		return calculateTotalSummary(this.todaySessions, this.config);
	}

	/**
	 * Summary for the current month.
	 */
	get currentMonthSummary() {
		const now = new Date();
		return calculateMonthlySummary(this.sessions, this.config, now.getFullYear(), now.getMonth() + 1);
	}

	/**
	 * Monthly goal progress metrics.
	 */
	get monthlyGoalProgress() {
		const summary = this.currentMonthSummary;
		return calculateGoalProgress(summary.netWage, this.config.monthlyIncomeGoal);
	}

	/**
	 * Sessions grouped by date.
	 */
	get groupedSessions() {
		return groupSessionsByDate(this.sessions, this.config);
	}

	/**
	 * Active safeguard status if active session exists.
	 */
	get activeSafeguardStatus(): SafeguardStatus | null {
		if (!this.activeSession) return null;
		return calculateSafeguardStatus(this.activeSession, this.config.safeguardMaxHours);
	}

	/**
	 * Whether active session exceeds safeguard max hours and is not snoozed.
	 */
	get isSafeguardTriggered(): boolean {
		if (!this.activeSession) return false;
		return isSessionExceedingSafeguard(this.activeSession, this.config.safeguardMaxHours);
	}

	/**
	 * Timed mode shift progress and earnings.
	 */
	get timedProgress(): TimedShiftProgress {
		return calculateTimedModeProgress(this.config, Date.now(), this.activeSession);
	}
}

export const workStore = new WorkStore();
