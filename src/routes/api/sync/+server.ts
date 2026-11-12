import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getUserConfig,
	upsertUserConfig,
	getUserWorkSessions,
	upsertWorkSession,
	type SessionRecord
} from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const serverConfig = await getUserConfig(userId);
	const serverSessions = await getUserWorkSessions(userId);

	return json({
		config: serverConfig?.config || null,
		configUpdatedAt: serverConfig?.updatedAt || 0,
		sessions: serverSessions,
		syncedAt: Date.now()
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const userId = locals.user.id;
		const body = await request.json();
		const { config, configUpdatedAt, sessions = [] } = body || {};

		// 1. Sync User Config (Last-Write-Wins)
		const serverConfigRecord = await getUserConfig(userId);
		let winningConfig = serverConfigRecord?.config || null;
		let winningConfigUpdatedAt = serverConfigRecord?.updatedAt || 0;

		if (config) {
			const clientUpdatedAt = Number(configUpdatedAt) || Date.now();
			if (!serverConfigRecord || clientUpdatedAt >= winningConfigUpdatedAt) {
				winningConfig = config;
				winningConfigUpdatedAt = clientUpdatedAt;
				await upsertUserConfig(userId, config, winningConfigUpdatedAt);
			}
		}

		// 2. Sync Work Sessions (Bidirectional Last-Write-Wins Merge)
		const serverSessions = await getUserWorkSessions(userId);
		const serverSessionsMap = new Map<string, SessionRecord>();
		for (const s of serverSessions) {
			serverSessionsMap.set(s.id, s);
		}

		const mergedSessionsMap = new Map<string, any>();

		// Process client sessions
		for (const clientSession of sessions) {
			if (!clientSession || !clientSession.id) continue;

			const clientUpdatedAt =
				Number(clientSession.updatedAt) || Number(clientSession.startTime) || Date.now();
			const serverSession = serverSessionsMap.get(clientSession.id);

			if (!serverSession) {
				// Client has a new session not yet on server
				await upsertWorkSession(userId, {
					...clientSession,
					updatedAt: clientUpdatedAt
				});
				mergedSessionsMap.set(clientSession.id, {
					...clientSession,
					updatedAt: clientUpdatedAt
				});
			} else {
				// Both have the session, compare timestamps
				const serverUpdatedAt = Number(serverSession.updatedAt) || Number(serverSession.startTime);
				if (clientUpdatedAt >= serverUpdatedAt) {
					// Client is newer or same -> write to server
					await upsertWorkSession(userId, {
						...clientSession,
						updatedAt: clientUpdatedAt
					});
					mergedSessionsMap.set(clientSession.id, {
						...clientSession,
						updatedAt: clientUpdatedAt
					});
				} else {
					// Server is newer -> keep server copy
					mergedSessionsMap.set(clientSession.id, serverSession);
				}
			}
		}

		// Include any server sessions that client didn't send
		for (const [id, s] of serverSessionsMap.entries()) {
			if (!mergedSessionsMap.has(id)) {
				mergedSessionsMap.set(id, s);
			}
		}

		const finalSessions = Array.from(mergedSessionsMap.values()).sort(
			(a, b) => (Number(b.startTime) || 0) - (Number(a.startTime) || 0)
		);

		return json({
			success: true,
			config: winningConfig,
			configUpdatedAt: winningConfigUpdatedAt,
			sessions: finalSessions,
			syncedAt: Date.now()
		});
	} catch (err: any) {
		console.error('Error in /api/sync:', err);
		return json({ error: 'Sync failed', details: err.message }, { status: 500 });
	}
};
