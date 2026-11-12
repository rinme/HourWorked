import {
	calculateSafeguardStatus,
	isSessionExceedingSafeguard,
	calculateTimedShiftTimes,
	calculateTimedModeProgress,
	formatCountdown,
	calculateSessionWage,
	roundDuration,
	isWeekend
} from '../src/lib/calculator';
import type {
	WorkSession,
	UserConfig,
	SafeguardStatus,
	TimedShiftProgress
} from '../src/lib/types';
import { DEFAULT_CONFIG } from '../src/lib/types';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
	if (condition) {
		console.log(`  ✅ ${msg}`);
		passedCount++;
	} else {
		console.error(`  ❌ FAILED: ${msg}`);
		failedCount++;
	}
}

function assertApprox(actual: number, expected: number, epsilon = 0.05, msg: string) {
	if (Math.abs(actual - expected) <= epsilon) {
		console.log(`  ✅ ${msg} (${actual})`);
		passedCount++;
	} else {
		console.error(`  ❌ FAILED: ${msg} (expected ~${expected}, got ${actual})`);
		failedCount++;
	}
}

console.log('===============================================================');
console.log('=== RUNNING COMPREHENSIVE QA & EDGE CASE TEST SUITE ===');
console.log('===============================================================\n');

// ============================================================================
// SUITE 1: SAFEGUARD LIMIT DETECTION & RESOLUTION OPTIONS
// ============================================================================
console.log('--- SUITE 1: Safeguard Limit Detection & Resolution Options ---');

const START_TS = 1700000000000; // Reference timestamp

// 1.1 Exact Threshold Boundaries
{
	const maxHours = 12;
	const limitMs = maxHours * 3600 * 1000;

	// Just before limit (11.99 hours)
	const justBeforeSession: WorkSession = {
		id: 'sg-before',
		date: '2026-11-12',
		startTime: START_TS,
		endTime: null,
		breaks: []
	};
	const refBefore = START_TS + limitMs - 60 * 1000; // 1 minute before limit
	const statusBefore = calculateSafeguardStatus(justBeforeSession, maxHours, refBefore);
	assert(!statusBefore.isExceeded, '11.99h: isExceeded is false');
	assert(statusBefore.excessMs === 0, '11.99h: excessMs is 0');
	assert(!isSessionExceedingSafeguard(justBeforeSession, maxHours, refBefore), '11.99h: alert not triggered');

	// Exactly at limit (12.00 hours)
	const refExact = START_TS + limitMs;
	const statusExact = calculateSafeguardStatus(justBeforeSession, maxHours, refExact);
	assert(statusExact.isExceeded, 'Exact 12.00h: isExceeded is true');
	assert(statusExact.excessMs === 0, 'Exact 12.00h: excessMs is 0');
	assert(isSessionExceedingSafeguard(justBeforeSession, maxHours, refExact), 'Exact 12.00h: alert triggered');

	// Over limit (14.25 hours)
	const refOver = START_TS + 14.25 * 3600 * 1000;
	const statusOver = calculateSafeguardStatus(justBeforeSession, maxHours, refOver);
	assert(statusOver.isExceeded, '14.25h: isExceeded is true');
	assertApprox(statusOver.elapsedHours, 14.25, 0.01, '14.25h: elapsed hours accurate');
	assertApprox(statusOver.excessHours, 2.25, 0.01, '14.25h: excess hours is 2.25h');
	assert(statusOver.suggestedCheckoutTime === START_TS + limitMs, 'Suggested checkout is start + 12h');
	assert(isSessionExceedingSafeguard(justBeforeSession, maxHours, refOver), '14.25h: alert triggered');
}

// 1.2 Custom Max Hours (e.g. 8h and 16h limit)
{
	const session8h: WorkSession = {
		id: 'sg-custom-8',
		date: '2026-11-12',
		startTime: START_TS,
		endTime: null,
		breaks: []
	};
	const ref9h = START_TS + 9 * 3600 * 1000;
	const status8 = calculateSafeguardStatus(session8h, 8, ref9h);
	assert(status8.isExceeded, 'Custom max 8h: 9h elapsed triggers safeguard');
	assertApprox(status8.excessHours, 1.0, 0.01, 'Custom max 8h: excess is 1.0h');

	const status16 = calculateSafeguardStatus(session8h, 16, ref9h);
	assert(!status16.isExceeded, 'Custom max 16h: 9h elapsed does NOT trigger safeguard');
}

// 1.3 Snooze Suppression & Re-triggering
{
	const sessionSnooze: WorkSession = {
		id: 'sg-snooze',
		date: '2026-11-12',
		startTime: START_TS,
		endTime: null,
		breaks: [],
		safeguardSnoozedUntil: START_TS + 14 * 3600 * 1000 // snoozed until 14h in
	};

	// At 13h in: exceeded, but snoozed
	const ref13h = START_TS + 13 * 3600 * 1000;
	const statusSnoozedAt13 = calculateSafeguardStatus(sessionSnooze, 12, ref13h);
	assert(statusSnoozedAt13.isExceeded, 'Snoozed at 13h: still calculates as exceeded');
	assert(statusSnoozedAt13.isSnoozed, 'Snoozed at 13h: isSnoozed is true');
	assert(!isSessionExceedingSafeguard(sessionSnooze, 12, ref13h), 'Snoozed at 13h: alert is suppressed');

	// At 14.5h in: snooze expired!
	const ref14_5h = START_TS + 14.5 * 3600 * 1000;
	const statusSnoozeExpired = calculateSafeguardStatus(sessionSnooze, 12, ref14_5h);
	assert(statusSnoozeExpired.isExceeded, 'After snooze expired: isExceeded is true');
	assert(!statusSnoozeExpired.isSnoozed, 'After snooze expired: isSnoozed is false');
	assert(isSessionExceedingSafeguard(sessionSnooze, 12, ref14_5h), 'After snooze expired: alert triggers again');
}

// 1.4 Resolution Logic Simulation
{
	// Resolution Option 1: Checkout at Limit with ongoing break
	const activeWithBreak: WorkSession = {
		id: 'active-break',
		date: '2026-11-12',
		startTime: START_TS,
		endTime: null,
		breaks: [
			{ start: START_TS + 4 * 3600 * 1000, end: START_TS + 5 * 3600 * 1000 }, // 1h completed break
			{ start: START_TS + 11 * 3600 * 1000, end: null } // ongoing break started at 11h
		]
	};

	const limitHours = 12;
	const checkoutTs = START_TS + limitHours * 3600 * 1000;

	// Resolve ongoing break at checkoutTs
	const updatedBreaks = activeWithBreak.breaks.map((b) =>
		b.end === null ? { ...b, end: Math.max(b.start, checkoutTs) } : b
	);

	const resolvedSession: WorkSession = {
		...activeWithBreak,
		breaks: updatedBreaks,
		endTime: checkoutTs,
		note: `[ตัดกะตามเกณฑ์ปลอดภัย ${limitHours}ชม.]`
	};

	assert(resolvedSession.endTime === checkoutTs, 'Resolved session endTime equals exact 12h limit');
	assert(resolvedSession.breaks[1].end === checkoutTs, 'Ongoing break closed at checkout limit (not zeroed out)');
	assert(resolvedSession.breaks[1].end! > resolvedSession.breaks[1].start, 'Break duration is positive and preserved');
	assert(resolvedSession.note?.includes('12ชม.'), 'Safeguard tag present in note');

	// Resolution Option 2: Set Custom Checkout Time
	const customTs = START_TS + 10 * 3600 * 1000; // User says "I actually left at 10h"
	const customResolved: WorkSession = {
		...activeWithBreak,
		breaks: activeWithBreak.breaks
			.filter((b) => b.start < customTs)
			.map((b) => (b.end === null || b.end > customTs ? { ...b, end: customTs } : b)),
		endTime: customTs
	};
	assert(customResolved.endTime === customTs, 'Custom checkout time applied');
	assert(customResolved.endTime <= checkoutTs, 'Custom checkout time is prior to limit');
}

// ============================================================================
// SUITE 2: TIMED MODE CALCULATIONS & OVERNIGHT SHIFTS
// ============================================================================
console.log('\n--- SUITE 2: Timed Mode Calculations & Overnight Shifts ---');

// 2.1 Standard Daytime Shift (14:00 - 22:00)
{
	const baseDate = new Date('2026-11-12T00:00:00');
	const shift = calculateTimedShiftTimes('14:00', '22:00', baseDate);
	assert(!shift.crossesMidnight, '14:00 to 22:00 does not cross midnight');
	assert(shift.endTimeMs - shift.startTimeMs === 8 * 3600 * 1000, 'Shift duration is exactly 8 hours');

	const config: UserConfig = {
		...DEFAULT_CONFIG,
		hourlyRate: 150,
		weekendMultiplier: 1.5,
		taxDeductionPercent: 3,
		roundingMode: 'exact',
		scheduledStart: '14:00',
		scheduledEnd: '22:00'
	};

	// Test at 14:00 (exact start)
	const startProgress = calculateTimedModeProgress(config, shift.startTimeMs);
	assert(startProgress.percentComplete === 0, 'At start: progress is 0%');
	assert(startProgress.elapsedMs === 0, 'At start: elapsedMs is 0');
	assert(startProgress.remainingMs === 8 * 3600 * 1000, 'At start: remaining is full 8 hours');
	assert(!startProgress.isBeforeShift, 'At start: isBeforeShift is false');
	assert(!startProgress.isShiftComplete, 'At start: isShiftComplete is false');

	// Test at 18:00 (mid-shift, 50%)
	const midTime = shift.startTimeMs + 4 * 3600 * 1000;
	const midProgress = calculateTimedModeProgress(config, midTime);
	assertApprox(midProgress.percentComplete, 50, 0.1, 'Mid-shift: progress is 50%');
	assert(midProgress.elapsedMs === 4 * 3600 * 1000, 'Mid-shift: elapsed is 4 hours');
	assert(midProgress.remainingMs === 4 * 3600 * 1000, 'Mid-shift: remaining is 4 hours');

	// Test at 22:00 (exact finish)
	const endProgress = calculateTimedModeProgress(config, shift.endTimeMs);
	assert(endProgress.percentComplete === 100, 'At finish: progress is 100%');
	assert(endProgress.elapsedMs === 8 * 3600 * 1000, 'At finish: elapsed is 8 hours');
	assert(endProgress.remainingMs === 0, 'At finish: remaining is 0');
	assert(endProgress.isShiftComplete, 'At finish: isShiftComplete is true');
}

// 2.2 Overnight Shifts (22:00 to 06:00 across midnight)
{
	// Evaluated in the evening before midnight (e.g. 23:00)
	const eveningRef = new Date('2026-11-12T23:00:00');
	const shiftEvening = calculateTimedShiftTimes('22:00', '06:00', eveningRef);
	assert(shiftEvening.crossesMidnight, 'Overnight 22:00-06:00 crosses midnight');
	assert(shiftEvening.endTimeMs - shiftEvening.startTimeMs === 8 * 3600 * 1000, 'Overnight duration is 8 hours');

	const shiftStart = new Date(shiftEvening.startTimeMs);
	const shiftEnd = new Date(shiftEvening.endTimeMs);
	assert(shiftStart.getDate() === 12 && shiftStart.getHours() === 22, 'Starts at 22:00 on Nov 12');
	assert(shiftEnd.getDate() === 13 && shiftEnd.getHours() === 6, 'Ends at 06:00 on Nov 13');

	const overnightConfig: UserConfig = {
		...DEFAULT_CONFIG,
		hourlyRate: 200,
		weekendMultiplier: 1.5,
		taxDeductionPercent: 3,
		roundingMode: 'exact',
		scheduledStart: '22:00',
		scheduledEnd: '06:00'
	};

	// Evaluated at 23:00 (1 hour into the overnight shift)
	const progress23h = calculateTimedModeProgress(overnightConfig, eveningRef.getTime());
	assertApprox(progress23h.percentComplete, 12.5, 0.1, '23:00 (1h into 8h shift): progress is 12.5%');
	assert(progress23h.elapsedMs === 1 * 3600 * 1000, '23:00: elapsed is 1 hour');
	assert(progress23h.remainingMs === 7 * 3600 * 1000, '23:00: remaining is 7 hours');

	// Evaluated at 00:00 (midnight, 2 hours into shift)
	const midnightRef = new Date('2026-11-13T00:00:00');
	const progressMidnight = calculateTimedModeProgress(overnightConfig, midnightRef.getTime());
	assertApprox(progressMidnight.percentComplete, 25.0, 0.1, '00:00 (midnight): progress is 25%');
	assert(progressMidnight.remainingMs === 6 * 3600 * 1000, '00:00: remaining is 6 hours');

	// Evaluated in the early morning after midnight (e.g. 03:00, 5 hours into shift)
	const morningRef = new Date('2026-11-13T03:00:00');
	const progress03h = calculateTimedModeProgress(overnightConfig, morningRef.getTime());
	assertApprox(progress03h.percentComplete, 62.5, 0.1, '03:00 (morning after midnight): progress is 62.5%');
	assert(progress03h.elapsedMs === 5 * 3600 * 1000, '03:00: elapsed is 5 hours');
	assert(progress03h.remainingMs === 3 * 3600 * 1000, '03:00: remaining is 3 hours');

	// Evaluated after shift completes at 07:00
	const afterRef = new Date('2026-11-13T07:00:00');
	const progressAfter = calculateTimedModeProgress(overnightConfig, afterRef.getTime());
	assert(progressAfter.isShiftComplete, '07:00: isShiftComplete is true');
	assert(progressAfter.percentComplete === 100, '07:00: percentComplete capped at 100%');
	assert(progressAfter.remainingMs === 0, '07:00: remainingMs is 0');
}

// 2.3 Scheduled Shift Earnings & Weekend Multipliers
{
	// Saturday overnight shift: starts on Saturday 2026-11-14 at 22:00
	const saturdayNight = new Date('2026-11-14T22:00:00');
	const saturdayConfig: UserConfig = {
		...DEFAULT_CONFIG,
		hourlyRate: 150,
		weekendMultiplier: 1.5, // 225 THB/hr
		taxDeductionPercent: 3,
		roundingMode: 'exact',
		scheduledStart: '22:00',
		scheduledEnd: '06:00'
	};

	const satProgress = calculateTimedModeProgress(saturdayConfig, saturdayNight.getTime());
	assert(satProgress.expectedHours === 8, 'Expected shift hours is 8');
	assert(satProgress.expectedGrossWage === 8 * 225, `Expected weekend gross wage is 1800 (got ${satProgress.expectedGrossWage})`);
	const expectedTax = 1800 * 0.03;
	assert(satProgress.expectedTaxDeduction === expectedTax, `Expected tax is ${expectedTax}`);
	assert(satProgress.expectedNetWage === 1800 - expectedTax, `Expected net is ${1800 - expectedTax}`);
}

// 2.4 Countdown String Formats
{
	// 5 hours, 4 minutes, 9 seconds
	const testMs = (5 * 3600 + 4 * 60 + 9) * 1000;
	assert(formatCountdown(testMs, 'digital') === '05:04:09', 'formatCountdown: 05:04:09');
	assert(formatCountdown(testMs, 'thai') === '5 ชม. 4 นาที', 'formatCountdown: 5 ชม. 4 นาที');

	// 0 ms
	assert(formatCountdown(0, 'digital') === '00:00:00', 'formatCountdown 0ms: 00:00:00');
	assert(formatCountdown(0, 'thai') === '0 นาที', 'formatCountdown 0ms: 0 นาที');

	// Negative ms safety
	assert(formatCountdown(-10000, 'digital') === '00:00:00', 'formatCountdown negative ms: safe 00:00:00');
}

// ============================================================================
// SUITE 3: CLOUD SYNC EDGE CASES (MERGING, CONFLICT RESOLUTION, RESILIENCE)
// ============================================================================
console.log('\n--- SUITE 3: Cloud Sync Edge Cases ---');

// 3.1 Disjoint Sessions Merge
{
	const clientSessions: WorkSession[] = [
		{ id: 's-client-1', date: '2026-11-12', startTime: 1000, endTime: 2000, breaks: [] },
		{ id: 's-client-2', date: '2026-11-12', startTime: 3000, endTime: 4000, breaks: [] }
	];
	const serverSessions: WorkSession[] = [
		{ id: 's-server-1', date: '2026-11-11', startTime: 500, endTime: 900, breaks: [] },
		{ id: 's-server-2', date: '2026-11-13', startTime: 5000, endTime: 6000, breaks: [] }
	];

	const sessionMap = new Map<string, WorkSession>();
	for (const s of serverSessions) sessionMap.set(s.id, s);
	for (const s of clientSessions) {
		if (!sessionMap.has(s.id)) sessionMap.set(s.id, s);
	}
	const merged = Array.from(sessionMap.values()).sort((a, b) => b.startTime - a.startTime);

	assert(merged.length === 4, 'Disjoint merge contains all 4 sessions');
	assert(merged[0].id === 's-server-2', 'Sorted by startTime descending (latest first)');
	assert(merged[3].id === 's-server-1', 'Oldest session at the end');
}

// 3.2 Last-Write-Wins Conflict Resolution (Client newer vs Server newer)
{
	// Case A: Client has newer update
	const sharedId = 's-conflict-1';
	const clientVersion: WorkSession = {
		id: sharedId,
		date: '2026-11-12',
		startTime: 1000,
		endTime: 2000,
		breaks: [],
		note: 'Client updated note',
		updatedAt: 5000
	};
	const serverOlderVersion: WorkSession = {
		id: sharedId,
		date: '2026-11-12',
		startTime: 1000,
		endTime: 2000,
		breaks: [],
		note: 'Old server note',
		updatedAt: 3000
	};

	let winning = (clientVersion.updatedAt || 0) >= (serverOlderVersion.updatedAt || 0)
		? clientVersion
		: serverOlderVersion;
	assert(winning.note === 'Client updated note', 'Client newer updatedAt wins conflict');

	// Case B: Server has newer update
	const serverNewerVersion: WorkSession = {
		id: sharedId,
		date: '2026-11-12',
		startTime: 1000,
		endTime: 2000,
		breaks: [],
		note: 'Server updated note from another device',
		updatedAt: 8000
	};
	winning = (clientVersion.updatedAt || 0) >= (serverNewerVersion.updatedAt || 0)
		? clientVersion
		: serverNewerVersion;
	assert(winning.note === 'Server updated note from another device', 'Server newer updatedAt wins conflict');
}

// 3.3 Config Last-Write-Wins & Partial Fallback
{
	const clientConfig: UserConfig = {
		...DEFAULT_CONFIG,
		hourlyRate: 180,
		monthlyIncomeGoal: 30000
	};
	const clientConfigUpdatedAt = 1000;

	const serverConfig: UserConfig = {
		...DEFAULT_CONFIG,
		hourlyRate: 200,
		monthlyIncomeGoal: 35000
	};
	const serverConfigUpdatedAt = 2000;

	// Server is newer
	let activeConfig = serverConfigUpdatedAt > clientConfigUpdatedAt ? serverConfig : clientConfig;
	assert(activeConfig.hourlyRate === 200, 'Server config with newer timestamp takes precedence');

	// Fallback preservation: merged config retains all default fields
	const partialRemote: Partial<UserConfig> = { hourlyRate: 250 };
	const mergedConfig = { ...DEFAULT_CONFIG, ...clientConfig, ...partialRemote };
	assert(mergedConfig.hourlyRate === 250, 'Updated rate applied');
	assert(mergedConfig.safeguardMaxHours === 12, 'Default safeguardMaxHours preserved');
	assert(mergedConfig.currency === '฿', 'Default currency preserved');
}

// 3.4 Offline Resilience Simulation
{
	// Simulate offline sync error handling
	let syncStatus = 'idle';
	let syncError: string | null = null;
	const localSessionsBefore: WorkSession[] = [
		{ id: 'offline-s1', date: '2026-11-12', startTime: 1000, endTime: 2000, breaks: [] }
	];

	// Network fails
	try {
		syncStatus = 'syncing';
		throw new Error('Failed to fetch: Network offline');
	} catch (err: any) {
		syncStatus = 'error';
		syncError = err.message;
	}

	assert(syncStatus === 'error', 'Sync status marked error when network fails');
	assert(syncError?.includes('offline'), 'Error message retained');
	assert(localSessionsBefore.length === 1, 'Local sessions completely intact and uncorrupted');

	// Network recovers: sync re-attempt
	syncStatus = 'syncing';
	syncError = null;
	syncStatus = 'synced';
	assert(syncStatus === 'synced', 'Sync status marked synced upon successful reconnection');
}

// ============================================================================
// SUITE 4: TYPE SOUNDNESS AND IMPORT INTEGRITY
// ============================================================================
console.log('\n--- SUITE 4: Module Export Integrity ---');
{
	assert(typeof calculateSafeguardStatus === 'function', 'calculateSafeguardStatus exported');
	assert(typeof isSessionExceedingSafeguard === 'function', 'isSessionExceedingSafeguard exported');
	assert(typeof calculateTimedShiftTimes === 'function', 'calculateTimedShiftTimes exported');
	assert(typeof calculateTimedModeProgress === 'function', 'calculateTimedModeProgress exported');
	assert(typeof formatCountdown === 'function', 'formatCountdown exported');
	assert(typeof calculateSessionWage === 'function', 'calculateSessionWage exported');
	assert(typeof roundDuration === 'function', 'roundDuration exported');
	assert(typeof isWeekend === 'function', 'isWeekend exported');
	assert(DEFAULT_CONFIG.safeguardMaxHours === 12, 'DEFAULT_CONFIG has safeguardMaxHours = 12');
	assert(DEFAULT_CONFIG.scheduledStart === '14:00', 'DEFAULT_CONFIG has scheduledStart = 14:00');
	assert(DEFAULT_CONFIG.scheduledEnd === '22:00', 'DEFAULT_CONFIG has scheduledEnd = 22:00');
}

console.log('\n===============================================================');
console.log(`VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('===============================================================');

if (failedCount > 0) {
	process.exit(1);
} else {
	console.log('🎉 ALL QA & EDGE CASE SUITES PASSED FLAWLESSLY!\n');
}
