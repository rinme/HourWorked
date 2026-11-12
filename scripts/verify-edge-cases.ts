import {
	calculateSessionDuration,
	calculateBreakDuration,
	roundDuration,
	isWeekend,
	calculateSessionWage,
	calculateLiveSession,
	calculateTotalSummary,
	groupSessionsByDate,
	calculateMonthlySummary,
	calculateWeeklySummary,
	calculateMonthOverMonth,
	calculateGoalProgress,
	simulateWage
} from '../src/lib/calculator';
import type { WorkSession, UserConfig } from '../src/lib/types';

function assert(condition: boolean, message: string) {
	if (!condition) {
		console.error(`❌ ASSERTION FAILED: ${message}`);
		process.exit(1);
	}
	console.log(`✅ ${message}`);
}

function assertApprox(actual: number, expected: number, epsilon = 0.01, message: string) {
	if (Math.abs(actual - expected) > epsilon) {
		console.error(`❌ ASSERTION FAILED: ${message} (expected ~${expected}, got ${actual})`);
		process.exit(1);
	}
	console.log(`✅ ${message} (${actual})`);
}

console.log('=== RUNNING COMPREHENSIVE VERIFICATION SUITE ===\n');

// -------------------------------------------------------------
// Test 1: Weekend Detection
// -------------------------------------------------------------
console.log('--- 1. Weekend Detection (Sat/Sun) ---');
// 2026-11-14 is Saturday, 2026-11-15 is Sunday, 2026-11-13 is Friday, 2026-11-16 is Monday
assert(isWeekend('2026-11-14') === true, 'Saturday 2026-11-14 is weekend');
assert(isWeekend('2026-11-15') === true, 'Sunday 2026-11-15 is weekend');
assert(isWeekend('2026-11-13') === false, 'Friday 2026-11-13 is not weekend');
assert(isWeekend('2026-11-16') === false, 'Monday 2026-11-16 is not weekend');

// WorkSession object check
const saturdaySession: WorkSession = {
	id: 'sat-1',
	date: '2026-11-14',
	startTime: new Date('2026-11-14T09:00:00').getTime(),
	endTime: new Date('2026-11-14T17:00:00').getTime(),
	breaks: []
};
assert(isWeekend(saturdaySession) === true, 'Session with Saturday date is detected as weekend');

const mondaySession: WorkSession = {
	id: 'mon-1',
	date: '2026-11-16',
	startTime: new Date('2026-11-16T09:00:00').getTime(),
	endTime: new Date('2026-11-16T17:00:00').getTime(),
	breaks: []
};
assert(isWeekend(mondaySession) === false, 'Session with Monday date is not weekend');

// -------------------------------------------------------------
// Test 2: Break Time Subtraction
// -------------------------------------------------------------
console.log('\n--- 2. Break Time Subtraction ---');
// Session from 09:00 to 17:00 (8 hours = 28,800,000 ms)
// Break 1: 12:00 to 13:00 (1 hour = 3,600,000 ms)
// Break 2: 15:00 to 15:30 (30 min = 1,800,000 ms)
// Total break = 1.5 hours = 5,400,000 ms
// Net work = 6.5 hours = 23,400,000 ms
const sessionWithBreaks: WorkSession = {
	id: 'break-test',
	date: '2026-11-12',
	startTime: 10000000,
	endTime: 10000000 + 8 * 3600 * 1000,
	breaks: [
		{ start: 10000000 + 3 * 3600 * 1000, end: 10000000 + 4 * 3600 * 1000 },
		{ start: 10000000 + 6 * 3600 * 1000, end: 10000000 + 6.5 * 3600 * 1000 }
	]
};

const dur = calculateSessionDuration(sessionWithBreaks);
assert(dur.rawDurationMs === 8 * 3600 * 1000, 'Raw duration is exactly 8 hours');
assert(dur.breakDurationMs === 1.5 * 3600 * 1000, 'Break duration is exactly 1.5 hours');
assert(dur.netDurationMs === 6.5 * 3600 * 1000, 'Net duration is 6.5 hours after subtracting breaks');

// Test ongoing break (end is null)
const sessionOngoingBreak: WorkSession = {
	id: 'ongoing-break',
	date: '2026-11-12',
	startTime: 10000000,
	endTime: null,
	breaks: [{ start: 10000000 + 2 * 3600 * 1000, end: null }]
};
const nowTime = 10000000 + 3 * 3600 * 1000; // 3 hours in, break started 1 hour ago
const durOngoing = calculateSessionDuration(sessionOngoingBreak, nowTime);
assert(durOngoing.rawDurationMs === 3 * 3600 * 1000, 'Raw duration is 3 hours');
assert(durOngoing.breakDurationMs === 1 * 3600 * 1000, 'Ongoing break duration is 1 hour');
assert(durOngoing.netDurationMs === 2 * 3600 * 1000, 'Net duration is 2 hours');

// -------------------------------------------------------------
// Test 3: Rounding Modes ('exact', '15m', '30m')
// -------------------------------------------------------------
console.log('\n--- 3. Rounding Modes ---');
// 7 minutes = 420,000 ms -> 15m mode should round to 0
assert(roundDuration(7 * 60 * 1000, '15m').roundedMinutes === 0, '7 mins rounds down to 0 in 15m mode');
// 8 minutes = 480,000 ms -> 15m mode should round to 15
assert(roundDuration(8 * 60 * 1000, '15m').roundedMinutes === 15, '8 mins rounds up to 15 in 15m mode');
// 22 minutes -> 15m mode should round to 15
assert(roundDuration(22 * 60 * 1000, '15m').roundedMinutes === 15, '22 mins rounds down to 15 in 15m mode');
// 23 minutes -> 15m mode should round to 30
assert(roundDuration(23 * 60 * 1000, '15m').roundedMinutes === 30, '23 mins rounds up to 30 in 15m mode');

// 14 minutes -> 30m mode should round to 0
assert(roundDuration(14 * 60 * 1000, '30m').roundedMinutes === 0, '14 mins rounds down to 0 in 30m mode');
// 15 minutes -> 30m mode should round to 30
assert(roundDuration(15 * 60 * 1000, '30m').roundedMinutes === 30, '15 mins rounds up to 30 in 30m mode');
// 44 minutes -> 30m mode should round to 30
assert(roundDuration(44 * 60 * 1000, '30m').roundedMinutes === 30, '44 mins rounds down to 30 in 30m mode');
// 45 minutes -> 30m mode should round to 60
assert(roundDuration(45 * 60 * 1000, '30m').roundedMinutes === 60, '45 mins rounds up to 60 in 30m mode');

// 'exact' mode
const exactTest = roundDuration(45 * 60 * 1000, 'exact');
assert(exactTest.roundedMinutes === 45, 'Exact mode preserves 45 minutes');
assert(exactTest.roundedHours === 0.75, 'Exact mode produces 0.75 hours');

// 0 duration test
assert(roundDuration(0, '15m').roundedMinutes === 0, '0 ms yields 0 rounded');
assert(roundDuration(-1000, '30m').roundedMinutes === 0, 'Negative ms yields 0 rounded');

// -------------------------------------------------------------
// Test 4: Weekend Multiplier & Tax Deduction
// -------------------------------------------------------------
console.log('\n--- 4. Wage, Weekend Multiplier & Tax Deduction ---');
const config: UserConfig = {
	hourlyRate: 200, // 200 THB/hr
	weekendMultiplier: 1.5, // 300 THB/hr on weekends
	roundingMode: 'exact',
	taxDeductionPercent: 3, // 3% withholding tax
	monthlyIncomeGoal: 30000,
	currency: 'THB'
};

// 4 hours on Monday: 4 * 200 = 800 gross. Tax = 800 * 0.03 = 24. Net = 776
const weekdayCalc = calculateSessionWage(
	{
		id: 'wd-1',
		date: '2026-11-16', // Monday
		startTime: 1000000,
		endTime: 1000000 + 4 * 3600 * 1000,
		breaks: []
	},
	config
);
assert(weekdayCalc.isWeekend === false, 'Weekday correctly identified');
assert(weekdayCalc.effectiveRate === 200, 'Effective rate is 200 THB');
assert(weekdayCalc.grossWage === 800, 'Gross wage is 800 THB');
assert(weekdayCalc.taxDeduction === 24, '3% tax deduction is 24 THB');
assert(weekdayCalc.netWage === 776, 'Net wage is 776 THB');

// 4 hours on Saturday: 4 * (200 * 1.5) = 1200 gross. Tax = 1200 * 0.03 = 36. Net = 1164
const weekendCalc = calculateSessionWage(
	{
		id: 'we-1',
		date: '2026-11-14', // Saturday
		startTime: 1000000,
		endTime: 1000000 + 4 * 3600 * 1000,
		breaks: []
	},
	config
);
assert(weekendCalc.isWeekend === true, 'Weekend correctly identified');
assert(weekendCalc.effectiveRate === 300, 'Effective rate is 300 THB (1.5x)');
assert(weekendCalc.grossWage === 1200, 'Gross wage is 1200 THB');
assert(weekendCalc.taxDeduction === 36, '3% tax deduction is 36 THB');
assert(weekendCalc.netWage === 1164, 'Net wage is 1164 THB');

// -------------------------------------------------------------
// Test 5: Multiple Sessions in One Day
// -------------------------------------------------------------
console.log('\n--- 5. Multiple Sessions in One Day ---');
// Day 2026-11-12 (Thursday)
// Morning shift: 09:00 - 12:00 (3h)
// Afternoon shift: 13:00 - 17:00 (4h, with 30m break -> 3.5h net)
// Evening shift: 18:00 - 20:00 (2h)
// Total hours = 3 + 3.5 + 2 = 8.5 hours
// Rate = 200 THB/hr -> Gross = 8.5 * 200 = 1700 THB
// Tax (3%) = 51 THB -> Net = 1649 THB
const sessionsDay: WorkSession[] = [
	{
		id: 's-1',
		date: '2026-11-12',
		startTime: new Date('2026-11-12T09:00:00').getTime(),
		endTime: new Date('2026-11-12T12:00:00').getTime(),
		breaks: []
	},
	{
		id: 's-2',
		date: '2026-11-12',
		startTime: new Date('2026-11-12T13:00:00').getTime(),
		endTime: new Date('2026-11-12T17:00:00').getTime(),
		breaks: [
			{
				start: new Date('2026-11-12T15:00:00').getTime(),
				end: new Date('2026-11-12T15:30:00').getTime()
			}
		]
	},
	{
		id: 's-3',
		date: '2026-11-12',
		startTime: new Date('2026-11-12T18:00:00').getTime(),
		endTime: new Date('2026-11-12T20:00:00').getTime(),
		breaks: []
	}
];

const daySummary = calculateTotalSummary(sessionsDay, config);
assert(daySummary.sessionCount === 3, 'Summary includes all 3 sessions');
assert(daySummary.daysWorked === 1, 'Distinct days worked is 1');
assertApprox(daySummary.totalHours, 8.5, 0.01, 'Total hours is 8.5');
assertApprox(daySummary.grossWage, 1700, 0.01, 'Total gross wage is 1700 THB');
assertApprox(daySummary.taxDeduction, 51, 0.01, 'Total tax is 51 THB');
assertApprox(daySummary.netWage, 1649, 0.01, 'Total net wage is 1649 THB');

const groups = groupSessionsByDate(sessionsDay, config);
assert(groups.length === 1, 'Grouped into 1 day group');
assert(groups[0].date === '2026-11-12', 'Group date is 2026-11-12');
assert(groups[0].sessions.length === 3, 'Group has 3 sessions');
assertApprox(groups[0].totalHours, 8.5, 0.01, 'Group total hours is 8.5');

// -------------------------------------------------------------
// Test 6: Goal Progress & What-If Wage Simulator
// -------------------------------------------------------------
console.log('\n--- 6. Goal Progress & Wage Simulator ---');
const goalTest1 = calculateGoalProgress(15000, 30000);
assert(goalTest1.percent === 50, '15,000 / 30,000 is 50%');
assert(goalTest1.remaining === 15000, 'Remaining is 15,000 THB');
assert(goalTest1.isReached === false, 'Goal not reached yet');

const goalTest2 = calculateGoalProgress(35000, 30000);
assert(goalTest2.percent === 100, '35,000 / 30,000 caps at 100%');
assert(goalTest2.remaining === 0, 'Remaining is 0 THB');
assert(goalTest2.isReached === true, 'Goal reached');

// Simulator: 8 hrs/day, 4 weekdays (4 * 8 * 200 = 6400), 1 weekend day (1 * 8 * 300 = 2400)
// Total weekly gross = 8800 THB
// Tax (3%) -> multiplier = 0.97 -> Net = 8800 * 0.97 = 8536 THB
const sim = simulateWage(8, 4, 1, config);
assertApprox(sim.dailyWeekdayGross, 1600, 0.01, 'Daily weekday gross is 1600');
assertApprox(sim.dailyWeekendGross, 2400, 0.01, 'Daily weekend gross is 2400');
assertApprox(sim.weeklyGross, 8800, 0.01, 'Weekly gross is 8800');
assertApprox(sim.weeklyNet, 8536, 0.01, 'Weekly net is 8536');

// -------------------------------------------------------------
// Test 7: Month-over-Month Comparison
// -------------------------------------------------------------
console.log('\n--- 7. Month-over-Month Comparison ---');
const momSessions: WorkSession[] = [
	// October 2026: 10 hours @ 200 = 2000 gross, 1940 net
	{
		id: 'oct-1',
		date: '2026-10-15',
		startTime: new Date('2026-10-15T09:00:00').getTime(),
		endTime: new Date('2026-10-15T19:00:00').getTime(),
		breaks: []
	},
	// November 2026: 20 hours @ 200 = 4000 gross, 3880 net
	{
		id: 'nov-1',
		date: '2026-11-10',
		startTime: new Date('2026-11-10T09:00:00').getTime(),
		endTime: new Date('2026-11-10T19:00:00').getTime(),
		breaks: []
	},
	{
		id: 'nov-2',
		date: '2026-11-11',
		startTime: new Date('2026-11-11T09:00:00').getTime(),
		endTime: new Date('2026-11-11T19:00:00').getTime(),
		breaks: []
	}
];

const mom = calculateMonthOverMonth(momSessions, config, 2026, 11);
assertApprox(mom.current.totalHours, 20, 0.01, 'Current month hours is 20');
assertApprox(mom.previous.totalHours, 10, 0.01, 'Previous month hours is 10');
assertApprox(mom.hourDiff, 10, 0.01, 'Hour diff is +10');
assertApprox(mom.hourPercentChange, 100, 0.1, 'Hour percent change is +100%');
assertApprox(mom.netWageDiff, 1940, 0.01, 'Net wage diff is +1940 THB');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED WITH 0 ERRORS!');
