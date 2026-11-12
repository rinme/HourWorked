import {
	hashPassword,
	verifyPassword,
	createSessionToken,
	verifySessionToken
} from '../src/lib/server/auth';
import {
	getUserByUsername,
	createUser,
	getUserConfig,
	upsertUserConfig,
	getUserWorkSessions,
	upsertWorkSession,
	savePushSubscription,
	getPushSubscriptions,
	deletePushSubscription,
	runMigration
} from '../src/lib/server/db';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } from '../src/lib/server/push';

function assert(cond: boolean, msg: string) {
	if (!cond) {
		console.error(`❌ BACKEND TEST FAILED: ${msg}`);
		process.exit(1);
	}
	console.log(`✅ ${msg}`);
}

async function run() {
	console.log('=== RUNNING BACKEND VERIFICATION SUITE ===\n');

	// 1. Web Crypto PBKDF2 Password Hashing
	console.log('--- 1. Web Crypto PBKDF2 Hashing ---');
	const testPass = 'SuperSecurePass123!';
	const { hash, salt } = await hashPassword(testPass);
	assert(typeof hash === 'string' && hash.length === 64, 'Hash is 64-char hex string (SHA-256)');
	assert(typeof salt === 'string' && salt.length === 32, 'Salt is 32-char hex string (16 bytes)');

	const isValid = await verifyPassword(testPass, hash, salt);
	assert(isValid === true, 'Correct password verifies successfully');

	const isWrongValid = await verifyPassword('WrongPassword', hash, salt);
	assert(isWrongValid === false, 'Wrong password rejected');

	// 2. Web Crypto JWT Sessions
	console.log('\n--- 2. Web Crypto Session Tokens ---');
	const mockUser = { id: 'u-' + Math.random().toString(36).slice(2), username: 'testuser' };
	const token = await createSessionToken(mockUser);
	assert(typeof token === 'string' && token.split('.').length === 3, 'JWT has 3 parts');

	const verified = await verifySessionToken(token);
	assert(verified !== null, 'Token verified successfully');
	assert(verified?.id === mockUser.id, 'User ID matches in token');
	assert(verified?.username === mockUser.username, 'Username matches in token');

	const tamperedToken = token.slice(0, -4) + 'abcd';
	const tamperedVerified = await verifySessionToken(tamperedToken);
	assert(tamperedVerified === null, 'Tampered token rejected');

	// 3. Database Layer (Users, Configs, Sessions, Push)
	console.log('\n--- 3. Database Layer & Mock Fallback ---');
	await runMigration();

	const createdUser = await createUser({
		id: mockUser.id,
		username: mockUser.username,
		passwordHash: hash,
		passwordSalt: salt
	});
	assert(createdUser.username === mockUser.username, 'User created in database');

	const fetchedUser = await getUserByUsername(mockUser.username);
	assert(fetchedUser?.id === mockUser.id, 'User fetched by username');

	// User config upsert & fetch
	const configData = { hourlyRate: 250, currency: '฿', roundingMode: '15m' };
	const now = Date.now();
	await upsertUserConfig(mockUser.id, configData, now);

	const fetchedConfig = await getUserConfig(mockUser.id);
	assert(fetchedConfig !== null, 'User config retrieved');
	assert(fetchedConfig?.config.hourlyRate === 250, 'Config hourlyRate matches');
	assert(fetchedConfig?.updatedAt === now, 'Config updatedAt matches');

	// Work session upsert & fetch
	const session1 = {
		id: 's-1',
		date: '2026-11-12',
		startTime: now - 3600000,
		endTime: now,
		breaks: [],
		note: 'Test shift',
		updatedAt: now
	};
	await upsertWorkSession(mockUser.id, session1);

	const sessions = await getUserWorkSessions(mockUser.id);
	assert(sessions.length === 1, '1 work session in database');
	assert(sessions[0].id === 's-1', 'Session ID matches');
	assert(sessions[0].note === 'Test shift', 'Session note matches');

	// Push subscription
	const subEndpoint = 'https://push.example.com/sub/12345';
	await savePushSubscription({
		id: 'sub-1',
		userId: mockUser.id,
		endpoint: subEndpoint,
		p256dh: 'test-p256dh-key',
		auth: 'test-auth-secret'
	});

	const subs = await getPushSubscriptions(mockUser.id);
	assert(subs.length === 1, 'Push subscription saved');
	assert(subs[0].endpoint === subEndpoint, 'Push subscription endpoint matches');

	await deletePushSubscription(subEndpoint);
	const subsAfterDelete = await getPushSubscriptions(mockUser.id);
	assert(subsAfterDelete.length === 0, 'Push subscription deleted');

	// 4. VAPID Keys Check
	console.log('\n--- 4. VAPID Configuration ---');
	assert(typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.length > 20, 'VAPID public key present');
	assert(typeof VAPID_PRIVATE_KEY === 'string' && VAPID_PRIVATE_KEY.length > 20, 'VAPID private key present');

	console.log('\n🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
