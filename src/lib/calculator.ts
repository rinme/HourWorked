import type {
	WorkSession,
	BreakPeriod,
	UserConfig,
	RoundingMode,
	SessionCalculation,
	PeriodSummary,
	DayGroup
} from './types';

/**
 * Checks whether a given session or date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(sessionOrDate: WorkSession | string | number | Date): boolean {
	if (typeof sessionOrDate === 'object' && sessionOrDate !== null && 'startTime' in sessionOrDate) {
		const s = sessionOrDate as WorkSession;
		// Prefer date string if present to avoid local vs UTC drift
		if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
			const [y, m, d] = s.date.split('-').map(Number);
			const date = new Date(y, m - 1, d);
			const day = date.getDay();
			return day === 0 || day === 6;
		}
		const day = new Date(s.startTime).getDay();
		return day === 0 || day === 6;
	}

	if (typeof sessionOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sessionOrDate)) {
		const [y, m, d] = sessionOrDate.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const day = date.getDay();
		return day === 0 || day === 6;
	}

	const date = new Date(sessionOrDate);
	const day = date.getDay();
	return day === 0 || day === 6;
}

/**
 * Calculates total break duration in milliseconds for an array of breaks.
 * Ongoing breaks (end === null) use referenceTime (defaulting to Date.now()).
 */
export function calculateBreakDuration(
	breaks: BreakPeriod[] = [],
	referenceTime: number = Date.now()
): number {
	let total = 0;
	for (const b of breaks) {
		const start = b.start;
		const end = b.end !== null ? b.end : referenceTime;
		if (end > start) {
			total += end - start;
		}
	}
	return total;
}

/**
 * Calculates raw, break, and net duration in milliseconds for a session.
 */
export function calculateSessionDuration(
	session: WorkSession,
	referenceTime: number = Date.now()
): { rawDurationMs: number; breakDurationMs: number; netDurationMs: number } {
	const end = session.endTime !== null ? session.endTime : referenceTime;
	const rawDurationMs = Math.max(0, end - session.startTime);
	const breakDurationMs = calculateBreakDuration(session.breaks, end);
	const netDurationMs = Math.max(0, rawDurationMs - breakDurationMs);
	return { rawDurationMs, breakDurationMs, netDurationMs };
}

/**
 * Rounds duration in milliseconds based on the specified rounding mode.
 * - 'exact': accurate to exact fraction of hour/minute.
 * - '15m': rounds to nearest 15 minutes.
 * - '30m': rounds to nearest 30 minutes.
 */
export function roundDuration(
	netDurationMs: number,
	mode: RoundingMode
): { roundedMinutes: number; roundedHours: number } {
	if (netDurationMs <= 0) {
		return { roundedMinutes: 0, roundedHours: 0 };
	}

	const rawMinutes = netDurationMs / (60 * 1000);

	switch (mode) {
		case '15m': {
			const roundedMinutes = Math.round(rawMinutes / 15) * 15;
			return {
				roundedMinutes,
				roundedHours: roundedMinutes / 60
			};
		}
		case '30m': {
			const roundedMinutes = Math.round(rawMinutes / 30) * 30;
			return {
				roundedMinutes,
				roundedHours: roundedMinutes / 60
			};
		}
		case 'exact':
		default: {
			const roundedHours = netDurationMs / (60 * 60 * 1000);
			return {
				roundedMinutes: rawMinutes,
				roundedHours
			};
		}
	}
}

/**
 * Calculates full financial and duration metrics for a single work session.
 */
export function calculateSessionWage(
	session: WorkSession,
	config: UserConfig,
	referenceTime: number = Date.now()
): SessionCalculation {
	const { rawDurationMs, breakDurationMs, netDurationMs } = calculateSessionDuration(
		session,
		referenceTime
	);
	const { roundedMinutes, roundedHours } = roundDuration(netDurationMs, config.roundingMode);

	const weekend = isWeekend(session);
	const effectiveRate = weekend
		? config.hourlyRate * config.weekendMultiplier
		: config.hourlyRate;

	const grossWage = Math.round(roundedHours * effectiveRate * 100) / 100;
	const taxPercent = Math.max(0, config.taxDeductionPercent);
	const taxDeduction = Math.round(grossWage * (taxPercent / 100) * 100) / 100;
	const netWage = Math.round((grossWage - taxDeduction) * 100) / 100;

	return {
		rawDurationMs,
		breakDurationMs,
		netDurationMs,
		roundedDurationMinutes: roundedMinutes,
		roundedDurationHours: roundedHours,
		isWeekend: weekend,
		effectiveRate,
		grossWage,
		taxDeduction,
		netWage
	};
}

/**
 * Real-time continuous calculations for an active session (useful for live ticking display).
 */
export function calculateLiveSession(
	session: WorkSession,
	config: UserConfig,
	now: number = Date.now()
) {
	const isOnBreak = session.breaks.some((b) => b.end === null);
	const { rawDurationMs, breakDurationMs, netDurationMs } = calculateSessionDuration(session, now);

	const weekend = isWeekend(session);
	const effectiveRate = weekend
		? config.hourlyRate * config.weekendMultiplier
		: config.hourlyRate;

	// Continuous unrounded wage for smooth per-second ticker
	const exactHours = netDurationMs / (3600 * 1000);
	const continuousGross = exactHours * effectiveRate;
	const taxPercent = Math.max(0, config.taxDeductionPercent);
	const continuousTax = continuousGross * (taxPercent / 100);
	const continuousNet = continuousGross - continuousTax;

	// Also provide rounded version for standard display
	const rounded = calculateSessionWage(session, config, now);

	return {
		rawDurationMs,
		breakDurationMs,
		netDurationMs,
		isOnBreak,
		continuousGross,
		continuousNet,
		rounded
	};
}

/**
 * Calculates aggregate summary for a collection of sessions.
 */
export function calculateTotalSummary(
	sessions: WorkSession[],
	config: UserConfig,
	referenceTime: number = Date.now()
): PeriodSummary {
	let totalRawDurationMs = 0;
	let totalBreakDurationMs = 0;
	let totalNetDurationMs = 0;
	let totalHours = 0;
	let grossWage = 0;
	let taxDeduction = 0;
	let netWage = 0;

	const distinctDays = new Set<string>();

	for (const session of sessions) {
		const calc = calculateSessionWage(session, config, referenceTime);
		totalRawDurationMs += calc.rawDurationMs;
		totalBreakDurationMs += calc.breakDurationMs;
		totalNetDurationMs += calc.netDurationMs;
		totalHours += calc.roundedDurationHours;
		grossWage += calc.grossWage;
		taxDeduction += calc.taxDeduction;
		netWage += calc.netWage;
		if (session.date) {
			distinctDays.add(session.date);
		}
	}

	return {
		totalRawDurationMs,
		totalBreakDurationMs,
		totalNetDurationMs,
		totalHours: Math.round(totalHours * 100) / 100,
		grossWage: Math.round(grossWage * 100) / 100,
		taxDeduction: Math.round(taxDeduction * 100) / 100,
		netWage: Math.round(netWage * 100) / 100,
		sessionCount: sessions.length,
		daysWorked: distinctDays.size
	};
}

/**
 * Groups sessions by date (YYYY-MM-DD), sorted descending by date, with per-day summaries.
 */
export function groupSessionsByDate(
	sessions: WorkSession[],
	config: UserConfig,
	referenceTime: number = Date.now()
): DayGroup[] {
	const map = new Map<string, WorkSession[]>();

	for (const session of sessions) {
		const dateKey = session.date || new Date(session.startTime).toISOString().slice(0, 10);
		if (!map.has(dateKey)) {
			map.set(dateKey, []);
		}
		map.get(dateKey)!.push(session);
	}

	const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

	return sortedDates.map((date) => {
		const daySessions = map.get(date)!.sort((a, b) => b.startTime - a.startTime);
		const summary = calculateTotalSummary(daySessions, config, referenceTime);

		return {
			date,
			isWeekend: isWeekend(date),
			sessions: daySessions,
			totalNetDurationMs: summary.totalNetDurationMs,
			totalHours: summary.totalHours,
			grossWage: summary.grossWage,
			taxDeduction: summary.taxDeduction,
			netWage: summary.netWage
		};
	});
}

/**
 * Calculates monthly summary for a specific month (month: 1-12, year: e.g. 2026).
 */
export function calculateMonthlySummary(
	sessions: WorkSession[],
	config: UserConfig,
	year: number,
	month: number // 1 to 12
): PeriodSummary {
	const monthStr = month < 10 ? `0${month}` : `${month}`;
	const prefix = `${year}-${monthStr}`;

	const monthSessions = sessions.filter((s) => {
		if (s.date) {
			return s.date.startsWith(prefix);
		}
		const sessionDate = new Date(s.startTime).toISOString().slice(0, 7);
		return sessionDate === prefix;
	});

	return calculateTotalSummary(monthSessions, config);
}

/**
 * Calculates weekly summary for the week containing targetDate (Monday to Sunday).
 */
export function calculateWeeklySummary(
	sessions: WorkSession[],
	config: UserConfig,
	targetDate: Date | string = new Date()
): PeriodSummary {
	const d = typeof targetDate === 'string' ? new Date(targetDate) : new Date(targetDate);
	const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
	const diffToMonday = day === 0 ? -6 : 1 - day;

	const monday = new Date(d);
	monday.setDate(d.getDate() + diffToMonday);
	monday.setHours(0, 0, 0, 0);

	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	sunday.setHours(23, 59, 59, 999);

	const mondayTime = monday.getTime();
	const sundayTime = sunday.getTime();

	const weekSessions = sessions.filter((s) => {
		return s.startTime >= mondayTime && s.startTime <= sundayTime;
	});

	return calculateTotalSummary(weekSessions, config);
}

/**
 * Month-over-month comparison between current month and previous month.
 */
export function calculateMonthOverMonth(
	sessions: WorkSession[],
	config: UserConfig,
	currentYear: number,
	currentMonth: number // 1 to 12
) {
	const current = calculateMonthlySummary(sessions, config, currentYear, currentMonth);

	let prevYear = currentYear;
	let prevMonth = currentMonth - 1;
	if (prevMonth < 1) {
		prevMonth = 12;
		prevYear -= 1;
	}
	const previous = calculateMonthlySummary(sessions, config, prevYear, prevMonth);

	const hourDiff = Math.round((current.totalHours - previous.totalHours) * 100) / 100;
	const netWageDiff = Math.round((current.netWage - previous.netWage) * 100) / 100;

	const hourPercentChange =
		previous.totalHours > 0
			? Math.round(((current.totalHours - previous.totalHours) / previous.totalHours) * 1000) / 10
			: current.totalHours > 0
				? 100
				: 0;

	const netWagePercentChange =
		previous.netWage > 0
			? Math.round(((current.netWage - previous.netWage) / previous.netWage) * 1000) / 10
			: current.netWage > 0
				? 100
				: 0;

	return {
		current,
		previous,
		hourDiff,
		netWageDiff,
		hourPercentChange,
		netWagePercentChange
	};
}

/**
 * Goal progress calculations.
 */
export function calculateGoalProgress(
	netEarned: number,
	monthlyGoal: number
): { percent: number; remaining: number; isReached: boolean } {
	if (monthlyGoal <= 0) {
		return { percent: 100, remaining: 0, isReached: true };
	}
	const percent = Math.min(100, Math.round((netEarned / monthlyGoal) * 1000) / 10);
	const remaining = Math.max(0, Math.round((monthlyGoal - netEarned) * 100) / 100);
	return {
		percent,
		remaining,
		isReached: netEarned >= monthlyGoal
	};
}

/**
 * Interactive What-If Wage Simulator calculation.
 */
export function simulateWage(
	hoursPerDay: number,
	weekdayDaysPerWeek: number,
	weekendDaysPerWeek: number,
	config: UserConfig
) {
	const weekdayRate = config.hourlyRate;
	const weekendRate = config.hourlyRate * config.weekendMultiplier;
	const taxMultiplier = 1 - Math.max(0, config.taxDeductionPercent) / 100;

	const dailyWeekdayGross = hoursPerDay * weekdayRate;
	const dailyWeekendGross = hoursPerDay * weekendRate;

	const weeklyGross =
		dailyWeekdayGross * weekdayDaysPerWeek + dailyWeekendGross * weekendDaysPerWeek;
	const weeklyNet = weeklyGross * taxMultiplier;

	// Standard 4.33 weeks per month
	const monthlyGross = weeklyGross * 4.3333;
	const monthlyNet = monthlyGross * taxMultiplier;

	return {
		dailyWeekdayGross: Math.round(dailyWeekdayGross * 100) / 100,
		dailyWeekendGross: Math.round(dailyWeekendGross * 100) / 100,
		weeklyGross: Math.round(weeklyGross * 100) / 100,
		weeklyNet: Math.round(weeklyNet * 100) / 100,
		monthlyGross: Math.round(monthlyGross * 100) / 100,
		monthlyNet: Math.round(monthlyNet * 100) / 100
	};
}

// -------------------------------------------------------------
// Formatters
// -------------------------------------------------------------

/**
 * Formats duration milliseconds into human-readable strings.
 */
export function formatDuration(
	ms: number,
	format: 'digital' | 'thai-short' | 'thai-full' = 'thai-short'
): string {
	if (ms < 0) ms = 0;
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (format === 'digital') {
		const hh = String(hours).padStart(2, '0');
		const mm = String(minutes).padStart(2, '0');
		const ss = String(seconds).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	}

	if (format === 'thai-full') {
		const parts: string[] = [];
		if (hours > 0) parts.push(`${hours} ชั่วโมง`);
		if (minutes > 0 || hours === 0) parts.push(`${minutes} นาที`);
		return parts.join(' ');
	}

	// 'thai-short'
	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours} ชม.`);
	if (minutes > 0 || hours === 0) parts.push(`${minutes} นาที`);
	return parts.join(' ');
}

/**
 * Formats hours (decimal) into human-readable format, e.g. 7.5 -> "7 ชม. 30 นาที".
 */
export function formatHours(hours: number): string {
	const h = Math.floor(hours);
	const m = Math.round((hours - h) * 60);
	if (m === 0) return `${h} ชม.`;
	if (h === 0) return `${m} นาที`;
	return `${h} ชม. ${m} นาที`;
}

/**
 * Formats monetary amounts with commas, currency symbol, and decimals.
 */
export function formatCurrency(
	amount: number,
	currency: string = '฿',
	decimals: number = 2
): string {
	const formatted = (amount || 0).toLocaleString('th-TH', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
	return `${currency}${formatted}`;
}

const THAI_MONTHS_SHORT = [
	'ม.ค.',
	'ก.พ.',
	'มี.ค.',
	'เม.ย.',
	'พ.ค.',
	'มิ.ย.',
	'ก.ค.',
	'ส.ค.',
	'ก.ย.',
	'ต.ค.',
	'พ.ย.',
	'ธ.ค.'
];

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/**
 * Formats a date string (YYYY-MM-DD) or timestamp into Thai readable format.
 * e.g. "พฤหัสฯ 12 พ.ย. 2026"
 */
export function formatThaiDate(
	dateInput: string | number | Date,
	options: { showDayOfWeek?: boolean; showYear?: boolean } = {
		showDayOfWeek: true,
		showYear: true
	}
): string {
	let d: Date;
	if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
		const [y, m, day] = dateInput.split('-').map(Number);
		d = new Date(y, m - 1, day);
	} else {
		d = new Date(dateInput);
	}

	const dayOfWeek = THAI_DAYS[d.getDay()];
	const dayNum = d.getDate();
	const month = THAI_MONTHS_SHORT[d.getMonth()];
	const year = d.getFullYear();

	const parts: string[] = [];
	if (options.showDayOfWeek) {
		parts.push(`วัน${dayOfWeek}`);
	}
	parts.push(`${dayNum} ${month}`);
	if (options.showYear) {
		parts.push(`${year}`);
	}

	return parts.join(' ');
}

/**
 * Formats timestamp to HH:mm (e.g. 09:15).
 */
export function formatTime(timestamp: number | null): string {
	if (!timestamp) return '--:--';
	const d = new Date(timestamp);
	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	return `${hh}:${mm}`;
}

export function getLocalDateString(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

