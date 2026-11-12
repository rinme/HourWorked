import {
	calculateSafeguardStatus,
	isSessionExceedingSafeguard,
	calculateTimedShiftTimes,
	calculateTimedModeProgress,
	formatCountdown
} from '../src/lib/calculator';
import { urlBase64ToUint8Array } from '../src/lib/push';
import type { WorkSession, UserConfig } from '../src/lib/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
	if (condition) {
		console.log(`✅ ${msg}`);
		passed++;
	} else {
		console.error(`❌ FAILED: ${msg}`);
		failed++;
	}
}

console.log('=== RUNNING FEATURES & SAFEGUARD VERIFICATION SUITE ===\n');

// 1. Safeguard Calculations
console.log('--- 1. Safeguard Calculations ---');
const baseTime = 1700000000000;
const normalSession: WorkSession = {
	id: 's1',
	date: '2026-11-12',
	startTime: baseTime,
	endTime: null,
	breaks: []
};

// 8 hours in: should NOT exceed 12h
const ref8h = baseTime + 8 * 3600 * 1000;
const status8h = calculateSafeguardStatus(normalSession, 12, ref8h);
assert(!status8h.isExceeded, '8 hours active does not trigger safeguard');
assert(status8h.elapsedHours === 8, 'Elapsed hours is 8');
assert(status8h.excessHours === 0, 'Excess hours is 0');
assert(!isSessionExceedingSafeguard(normalSession, 12, ref8h), 'isSessionExceedingSafeguard is false at 8h');

// 13.5 hours in: should exceed 12h
const ref13_5h = baseTime + 13.5 * 3600 * 1000;
const status13_5h = calculateSafeguardStatus(normalSession, 12, ref13_5h);
assert(status13_5h.isExceeded, '13.5 hours active triggers safeguard');
assert(status13_5h.elapsedHours === 13.5, 'Elapsed hours is 13.5');
assert(status13_5h.excessHours === 1.5, 'Excess hours is 1.5');
assert(status13_5h.suggestedCheckoutTime === baseTime + 12 * 3600 * 1000, 'Suggested checkout is start + 12h');
assert(isSessionExceedingSafeguard(normalSession, 12, ref13_5h), 'isSessionExceedingSafeguard is true at 13.5h');

// Snoozed session: should be marked snoozed and isSessionExceedingSafeguard should be false
const snoozedSession: WorkSession = {
	...normalSession,
	safeguardSnoozedUntil: ref13_5h + 30 * 60 * 1000 // snoozed 30 min into the future
};
const statusSnoozed = calculateSafeguardStatus(snoozedSession, 12, ref13_5h);
assert(statusSnoozed.isExceeded, 'Snoozed session is still exceeded in calculation');
assert(statusSnoozed.isSnoozed, 'Snoozed session is flagged isSnoozed: true');
assert(!isSessionExceedingSafeguard(snoozedSession, 12, ref13_5h), 'isSessionExceedingSafeguard returns false when snoozed');

// 2. Timed Mode (Scheduled Shift) Progress & Overnight Shifts
console.log('\n--- 2. Timed Shift Progress & Overnight Shifts ---');
const testDate = new Date('2026-11-12T10:00:00');
const normalShift = calculateTimedShiftTimes('14:00', '22:00', testDate);
assert(!normalShift.crossesMidnight, '14:00 - 22:00 does not cross midnight');
assert(normalShift.endTimeMs - normalShift.startTimeMs === 8 * 3600 * 1000, 'Duration is 8 hours');

// Overnight shift (22:00 to 06:00)
const overnightShift = calculateTimedShiftTimes('22:00', '06:00', new Date('2026-11-12T23:00:00'));
assert(overnightShift.crossesMidnight, '22:00 - 06:00 crosses midnight');
assert(overnightShift.endTimeMs - overnightShift.startTimeMs === 8 * 3600 * 1000, 'Overnight duration is 8 hours');

// Shift progress at 50%
const mockConfig: UserConfig = {
	hourlyRate: 200,
	weekendMultiplier: 1.5,
	taxDeductionPercent: 3,
	roundingMode: 'exact',
	monthlyIncomeGoal: 25000,
	currency: '฿',
	safeguardMaxHours: 12,
	scheduledStart: '14:00',
	scheduledEnd: '22:00',
	timedModeEnabled: true,
	autoPunchEnabled: false
};

const halfwayTime = new Date('2026-11-12T18:00:00').getTime();
const progressHalfway = calculateTimedModeProgress(mockConfig, halfwayTime);
assert(progressHalfway.percentComplete === 50, `Progress halfway is 50% (got ${progressHalfway.percentComplete}%)`);
assert(progressHalfway.remainingMs === 4 * 3600 * 1000, 'Remaining time is 4 hours');
assert(progressHalfway.expectedHours === 8, 'Expected shift hours is 8');
assert(progressHalfway.expectedGrossWage === 1600, `Expected gross wage is 1600 (got ${progressHalfway.expectedGrossWage})`);
assert(progressHalfway.expectedTaxDeduction === 48, 'Expected tax deduction 3% is 48');
assert(progressHalfway.expectedNetWage === 1552, 'Expected net wage is 1552');

// Shift progress before start
const beforeShiftTime = new Date('2026-11-12T12:00:00').getTime();
const progressBefore = calculateTimedModeProgress(mockConfig, beforeShiftTime);
assert(progressBefore.isBeforeShift, 'isBeforeShift is true before start time');
assert(progressBefore.percentComplete === 0, 'percentComplete is 0 before shift');
assert(progressBefore.remainingMs === 8 * 3600 * 1000, 'remainingMs is full 8h before shift');

// Shift progress after end
const afterShiftTime = new Date('2026-11-12T23:00:00').getTime();
const progressAfter = calculateTimedModeProgress(mockConfig, afterShiftTime);
assert(progressAfter.isShiftComplete, 'isShiftComplete is true after end time');
assert(progressAfter.percentComplete === 100, 'percentComplete is 100 after shift');
assert(progressAfter.remainingMs === 0, 'remainingMs is 0 after shift');

// Countdown formatting
assert(formatCountdown(3600 * 1000 + 120 * 1000 + 5000, 'digital') === '01:02:05', 'formatCountdown digital format');
assert(formatCountdown(3600 * 1000 + 120 * 1000, 'thai') === '1 ชม. 2 นาที', 'formatCountdown thai format');

// 3. Push Helper Utilities
console.log('\n--- 3. Push Helper Utilities ---');
const bytes = urlBase64ToUint8Array('AQIDBA==');
assert(bytes instanceof Uint8Array, 'urlBase64ToUint8Array returns Uint8Array');
assert(bytes.length === 4 && bytes[0] === 1 && bytes[3] === 4, 'urlBase64ToUint8Array decodes byte sequence [1,2,3,4]');

console.log(`\n========================================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
	process.exit(1);
}
