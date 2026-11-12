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
}

export interface UserConfig {
	hourlyRate: number; // e.g. 150 (THB/hr)
	weekendMultiplier: number; // e.g. 1.5 or 2.0 (for Sat/Sun)
	roundingMode: RoundingMode; // 'exact' | '15m' | '30m'
	taxDeductionPercent: number; // e.g. 3.0 (%)
	monthlyIncomeGoal: number; // e.g. 25000 (THB)
	currency: string; // e.g. '฿' or 'THB'
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
