import type {
	WorkSession,
	UserConfig,
	BreakPeriod,
	ExportData
} from './types';
import {
	calculateTotalSummary,
	calculateMonthlySummary,
	calculateGoalProgress,
	groupSessionsByDate,
	calculateSessionWage,
	getLocalDateString
} from './calculator';

export const DEFAULT_CONFIG: UserConfig = {
	hourlyRate: 150,
	weekendMultiplier: 1.5,
	roundingMode: '15m',
	taxDeductionPercent: 3,
	monthlyIncomeGoal: 25000,
	currency: '฿'
};

const STORAGE_KEYS = {
	SESSIONS: 'hourworked_sessions_v1',
	CONFIG: 'hourworked_config_v1',
	ACTIVE: 'hourworked_active_session_v1'
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
			id: generateId(),
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
		} catch (err) {
			console.error('Error loading data from localStorage, falling back to defaults', err);
			this.sessions = createSampleSessions();
			this.config = { ...DEFAULT_CONFIG };
		} finally {
			this.isLoaded = true;
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
			note: note !== undefined ? note.trim() : this.activeSession.note
		};

		this.sessions = [completedSession, ...this.sessions].sort(
			(a, b) => b.startTime - a.startTime
		);
		this.activeSession = null;

		this.saveSessions();
		this.saveActive();

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
			breaks: currentBreaks
		};
		this.saveActive();

		return openBreakIndex === -1; // returns true if now on break
	}

	/**
	 * Adds a completed session manually (e.g. from modal entry).
	 */
	addManualEntry(entry: Omit<WorkSession, 'id'> | WorkSession): WorkSession {
		const newSession: WorkSession = {
			id: 'id' in entry && entry.id ? entry.id : generateId(),
			date: entry.date,
			startTime: entry.startTime,
			endTime: entry.endTime,
			breaks: entry.breaks || [],
			note: entry.note?.trim() || ''
		};

		this.sessions = [newSession, ...this.sessions].sort((a, b) => b.startTime - a.startTime);
		this.saveSessions();
		return newSession;
	}

	/**
	 * Updates an existing session by ID (can be in history or active session).
	 */
	updateSession(id: string, updates: Partial<WorkSession>): boolean {
		if (this.activeSession && this.activeSession.id === id) {
			this.activeSession = { ...this.activeSession, ...updates };
			this.saveActive();
			return true;
		}

		const index = this.sessions.findIndex((s) => s.id === id);
		if (index !== -1) {
			this.sessions[index] = { ...this.sessions[index], ...updates };
			this.sessions = [...this.sessions].sort((a, b) => b.startTime - a.startTime);
			this.saveSessions();
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
			return true;
		}

		const initialLen = this.sessions.length;
		this.sessions = this.sessions.filter((s) => s.id !== id);
		if (this.sessions.length !== initialLen) {
			this.saveSessions();
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
	}

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
}

export const workStore = new WorkStore();
