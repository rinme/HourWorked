export type RoundingMode = 'exact' | '15m' | '30m';

export interface BreakPeriod {
	start: number;
	end: number | null;
}

export interface WorkSession {
	id: string;
	date: string; // YYYY-MM-DD
	startTime: number; // Unix timestamp in ms
	endTime: number | null; // Unix timestamp in ms, or null if currently in progress
	breaks: BreakPeriod[];
	note?: string;
	safeguardSnoozedUntil?: number | null; // Unix timestamp in ms until when safeguard alert is suppressed
	isScheduledShift?: boolean; // Whether this session was clocked via scheduled timed shift mode
	updatedAt?: number;
}

export interface UserConfig {
	hourlyRate: number; // e.g. 150 (THB/hr)
	weekendMultiplier: number; // e.g. 1.5 or 2.0 (for Sat/Sun)
	roundingMode: RoundingMode; // 'exact' | '15m' | '30m'
	taxDeductionPercent: number; // e.g. 3.0 (%)
	monthlyIncomeGoal: number; // e.g. 25000 (THB)
	currency: string; // e.g. '฿' or 'THB'
	safeguardMaxHours: number; // e.g. 12 (hours before active shift alert triggers)
	timedModeEnabled: boolean; // Dual Mode: true for Timed Schedule, false for Stopwatch
	scheduledStart: string; // e.g. '14:00' (HH:mm)
	scheduledEnd: string; // e.g. '22:00' (HH:mm)
	autoPunchEnabled: boolean; // Auto start/complete scheduled shifts
}

export const DEFAULT_CONFIG: UserConfig = {
	hourlyRate: 150,
	weekendMultiplier: 1.5,
	roundingMode: '15m',
	taxDeductionPercent: 3,
	monthlyIncomeGoal: 25000,
	currency: '฿',
	safeguardMaxHours: 12,
	timedModeEnabled: false,
	scheduledStart: '14:00',
	scheduledEnd: '22:00',
	autoPunchEnabled: false
};

export interface SafeguardStatus {
	isExceeded: boolean;
	elapsedMs: number;
	elapsedHours: number;
	maxHours: number;
	excessMs: number;
	excessHours: number;
	isSnoozed: boolean;
	snoozedUntil: number | null;
	suggestedCheckoutTime: number; // startTime + maxHours in ms
}

export interface TimedShiftProgress {
	startTimeMs: number;
	endTimeMs: number;
	nowMs: number;
	durationMs: number;
	elapsedMs: number;
	remainingMs: number;
	percentComplete: number; // 0 to 100
	isShiftActive: boolean;
	isBeforeShift: boolean;
	isShiftComplete: boolean;
	expectedHours: number;
	expectedGrossWage: number;
	expectedTaxDeduction: number;
	expectedNetWage: number;
}

export interface User {
	id: string;
	username: string;
	createdAt?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'guest';

export interface CloudSyncState {
	status: SyncStatus;
	lastSyncedAt: number | null;
	errorMessage: string | null;
	user: User | null;
	isGuest: boolean;
}

export interface AuthResponse {
	success: boolean;
	user?: User;
	error?: string;
	message?: string;
}

export interface SyncPayload {
	sessions: WorkSession[];
	config: UserConfig;
	configUpdatedAt?: number;
	lastSyncedAt?: number | null;
}

export interface SyncResponse {
	success: boolean;
	sessions: WorkSession[];
	config: UserConfig;
	syncedAt: number;
	error?: string;
}

export interface SessionCalculation {
	rawDurationMs: number;
	breakDurationMs: number;
	netDurationMs: number;
	roundedDurationMinutes: number;
	roundedDurationHours: number;
	isWeekend: boolean;
	effectiveRate: number;
	grossWage: number;
	taxDeduction: number;
	netWage: number;
}

export interface PeriodSummary {
	totalRawDurationMs: number;
	totalBreakDurationMs: number;
	totalNetDurationMs: number;
	totalHours: number;
	grossWage: number;
	taxDeduction: number;
	netWage: number;
	sessionCount: number;
	daysWorked: number;
}

export interface DayGroup {
	date: string; // YYYY-MM-DD
	isWeekend: boolean;
	sessions: WorkSession[];
	totalNetDurationMs: number;
	totalHours: number;
	grossWage: number;
	taxDeduction: number;
	netWage: number;
}

export interface ExportData {
	version: number;
	appName: string;
	exportedAt: string;
	config: UserConfig;
	sessions: WorkSession[];
}
