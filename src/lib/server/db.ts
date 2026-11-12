import { Pool } from '@neondatabase/serverless';

export interface UserRecord {
	id: string;
	username: string;
	passwordHash: string;
	passwordSalt: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface SessionRecord {
	id: string;
	userId: string;
	date: string;
	startTime: number;
	endTime: number | null;
	breaks: any[];
	note?: string;
	updatedAt: number;
	deletedAt?: number | null;
}

export interface PushSubscriptionRecord {
	id: string;
	userId?: string | null;
	endpoint: string;
	p256dh: string;
	auth: string;
	createdAt: Date;
}

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
export const isPostgresConfigured = Boolean(
	connectionString && connectionString.trim().length > 0 && !connectionString.includes('[SENSITIVE]')
);

// Initialize Neon pooled connection pool if configured
export const pool = isPostgresConfigured
	? new Pool({
			connectionString,
			max: 10,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000
		})
	: null;

if (isPostgresConfigured) {
	console.log('⚡ [DB] Initialized Neon Serverless Postgres pool (ap-southeast-1 / sin1)');
} else {
	console.warn('⚠️ [DB] POSTGRES_URL not provided; running in-memory fallback database for local dev / tests.');
}

// -------------------------------------------------------------
// Fallback In-Memory Stores
// -------------------------------------------------------------
const memUsers = new Map<string, UserRecord>();
const memConfigs = new Map<string, { config: any; updatedAt: number }>();
const memSessions = new Map<string, Map<string, SessionRecord>>(); // userId -> sessionId -> SessionRecord
const memPushSubs = new Map<string, PushSubscriptionRecord>();

// -------------------------------------------------------------
// Database Migration SQL
// -------------------------------------------------------------
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_configs (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
    note TEXT,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date ON work_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_updated_at ON work_sessions(user_id, updated_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
`;

export async function runMigration(): Promise<{ success: boolean; message: string }> {
	if (!pool) {
		return {
			success: true,
			message: 'Mock database initialized in-memory (no POSTGRES_URL configured).'
		};
	}

	try {
		await pool.query(SCHEMA_SQL);
		return { success: true, message: 'Postgres schema migrations applied successfully.' };
	} catch (err: any) {
		console.error('Migration failed:', err);
		throw err;
	}
}

// -------------------------------------------------------------
// User Operations
// -------------------------------------------------------------
export async function getUserByUsername(username: string): Promise<UserRecord | null> {
	const normalized = username.trim().toLowerCase();
	if (pool) {
		const res = await pool.query(
			'SELECT id, username, password_hash as "passwordHash", password_salt as "passwordSalt", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE LOWER(username) = $1 LIMIT 1',
			[normalized]
		);
		return res.rows[0] || null;
	}

	for (const u of memUsers.values()) {
		if (u.username.toLowerCase() === normalized) {
			return u;
		}
	}
	return null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
	if (pool) {
		const res = await pool.query(
			'SELECT id, username, password_hash as "passwordHash", password_salt as "passwordSalt", created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1 LIMIT 1',
			[id]
		);
		return res.rows[0] || null;
	}
	return memUsers.get(id) || null;
}

export async function createUser(data: {
	id: string;
	username: string;
	passwordHash: string;
	passwordSalt: string;
}): Promise<UserRecord> {
	const record: UserRecord = {
		id: data.id,
		username: data.username.trim(),
		passwordHash: data.passwordHash,
		passwordSalt: data.passwordSalt,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	if (pool) {
		await pool.query(
			'INSERT INTO users (id, username, password_hash, password_salt, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
			[
				record.id,
				record.username,
				record.passwordHash,
				record.passwordSalt,
				record.createdAt,
				record.updatedAt
			]
		);
	} else {
		memUsers.set(record.id, record);
	}

	return record;
}

// -------------------------------------------------------------
// User Config Operations
// -------------------------------------------------------------
export async function getUserConfig(
	userId: string
): Promise<{ config: any; updatedAt: number } | null> {
	if (pool) {
		const res = await pool.query(
			'SELECT config, updated_at as "updatedAt" FROM user_configs WHERE user_id = $1 LIMIT 1',
			[userId]
		);
		if (res.rows.length === 0) return null;
		const row = res.rows[0];
		return {
			config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
			updatedAt: Number(row.updatedAt)
		};
	}

	return memConfigs.get(userId) || null;
}

export async function upsertUserConfig(
	userId: string,
	config: any,
	updatedAt: number = Date.now()
): Promise<void> {
	if (pool) {
		await pool.query(
			`INSERT INTO user_configs (user_id, config, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET config = EXCLUDED.config, updated_at = EXCLUDED.updated_at`,
			[userId, JSON.stringify(config), updatedAt]
		);
	} else {
		memConfigs.set(userId, { config, updatedAt });
	}
}

// -------------------------------------------------------------
// Work Sessions Operations
// -------------------------------------------------------------
export async function getUserWorkSessions(userId: string): Promise<SessionRecord[]> {
	if (pool) {
		const res = await pool.query(
			`SELECT id, user_id as "userId", date, start_time as "startTime", end_time as "endTime",
              breaks, note, updated_at as "updatedAt", deleted_at as "deletedAt"
       FROM work_sessions
       WHERE user_id = $1
       ORDER BY start_time DESC`,
			[userId]
		);
		return res.rows.map((row) => ({
			...row,
			startTime: Number(row.startTime),
			endTime: row.endTime !== null ? Number(row.endTime) : null,
			updatedAt: Number(row.updatedAt),
			deletedAt: row.deletedAt !== null ? Number(row.deletedAt) : null,
			breaks: typeof row.breaks === 'string' ? JSON.parse(row.breaks) : row.breaks || []
		}));
	}

	const userMap = memSessions.get(userId);
	if (!userMap) return [];
	return Array.from(userMap.values()).sort((a, b) => b.startTime - a.startTime);
}

export async function upsertWorkSession(
	userId: string,
	session: {
		id: string;
		date: string;
		startTime: number;
		endTime: number | null;
		breaks: any[];
		note?: string;
		updatedAt?: number;
		deletedAt?: number | null;
	}
): Promise<void> {
	const updatedAt = session.updatedAt || Date.now();
	const deletedAt = session.deletedAt ?? null;

	if (pool) {
		await pool.query(
			`INSERT INTO work_sessions (id, user_id, date, start_time, end_time, breaks, note, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE
       SET date = EXCLUDED.date,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           breaks = EXCLUDED.breaks,
           note = EXCLUDED.note,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
			[
				session.id,
				userId,
				session.date,
				session.startTime,
				session.endTime,
				JSON.stringify(session.breaks || []),
				session.note || null,
				updatedAt,
				deletedAt
			]
		);
	} else {
		let userMap = memSessions.get(userId);
		if (!userMap) {
			userMap = new Map();
			memSessions.set(userId, userMap);
		}
		userMap.set(session.id, {
			id: session.id,
			userId,
			date: session.date,
			startTime: session.startTime,
			endTime: session.endTime,
			breaks: session.breaks || [],
			note: session.note,
			updatedAt,
			deletedAt
		});
	}
}

// -------------------------------------------------------------
// Push Subscriptions Operations
// -------------------------------------------------------------
export async function savePushSubscription(sub: {
	id: string;
	userId?: string | null;
	endpoint: string;
	p256dh: string;
	auth: string;
}): Promise<void> {
	if (pool) {
		await pool.query(
			`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth`,
			[sub.id, sub.userId || null, sub.endpoint, sub.p256dh, sub.auth]
		);
	} else {
		memPushSubs.set(sub.endpoint, {
			id: sub.id,
			userId: sub.userId || null,
			endpoint: sub.endpoint,
			p256dh: sub.p256dh,
			auth: sub.auth,
			createdAt: new Date()
		});
	}
}

export async function getPushSubscriptions(
	userId?: string | null
): Promise<PushSubscriptionRecord[]> {
	if (pool) {
		const query = userId
			? 'SELECT id, user_id as "userId", endpoint, p256dh, auth, created_at as "createdAt" FROM push_subscriptions WHERE user_id = $1'
			: 'SELECT id, user_id as "userId", endpoint, p256dh, auth, created_at as "createdAt" FROM push_subscriptions';
		const params = userId ? [userId] : [];
		const res = await pool.query(query, params);
		return res.rows;
	}

	const all = Array.from(memPushSubs.values());
	if (userId) {
		return all.filter((s) => s.userId === userId);
	}
	return all;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
	if (pool) {
		await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
	} else {
		memPushSubs.delete(endpoint);
	}
}
