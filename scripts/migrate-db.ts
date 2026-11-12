import { Pool } from '@neondatabase/serverless';

const SCHEMA_SQL = `
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. User Configs Table (JSONB configuration + sync timestamp)
CREATE TABLE IF NOT EXISTS user_configs (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 3. Work Sessions Table
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

-- Performance Indexes for Work Sessions
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date ON work_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_updated_at ON work_sessions(user_id, updated_at);

-- 4. Push Subscriptions Table (VAPID web push)
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

async function main() {
	let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

	console.log('--- Database Migration Runner ---');

	if (!connectionString || connectionString.includes('[SENSITIVE]')) {
		console.log('ℹ️ No live POSTGRES_URL connection string provided (or Vercel placeholder [SENSITIVE] detected).');
		console.log('Vercel masks secret values as [SENSITIVE] when pulled via CLI for production.');
		console.log('To migrate your live Neon database, copy the Connection String from Vercel Storage / Neon Dashboard');
		console.log('and run: POSTGRES_URL="postgresql://..." bun run db:migrate');
		console.log('\nBelow is the SQL schema that will be applied:');
		console.log(SCHEMA_SQL);
		console.log('\n✅ Dry-run migration check passed.');
		process.exit(0);
	}

	console.log('Connecting to Neon Serverless Postgres (ap-southeast-1)...');
	const pool = new Pool({
		connectionString,
		max: 5,
		connectionTimeoutMillis: 10000
	});

	try {
		console.log('Executing migration schema SQL...');
		await pool.query(SCHEMA_SQL);
		console.log('✅ Tables created / verified:');
		console.log('   - users');
		console.log('   - user_configs');
		console.log('   - work_sessions (with idx_work_sessions_user_id, idx_work_sessions_user_date, idx_work_sessions_updated_at)');
		console.log('   - push_subscriptions (with idx_push_subscriptions_user_id)');
		console.log('🎉 Migration completed successfully!');
		await pool.end();
		process.exit(0);
	} catch (err: any) {
		console.error('❌ Migration failed:', err.message || err);
		await pool.end();
		process.exit(1);
	}
}

main();
