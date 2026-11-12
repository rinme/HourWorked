import { json, type RequestHandler } from '@sveltejs/kit';
import { sendPushNotification } from '$lib/server/push';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { title, body: messageBody, url, tag, userId, all } = body || {};

		if (!title || !messageBody) {
			return json(
				{ error: 'Title and body are required for push notification' },
				{ status: 400 }
			);
		}

		// Target specific user or fallback to logged in user if not specified as all
		const targetUserId = userId !== undefined ? userId : locals.user?.id || null;
		const targetAll = Boolean(all || (!targetUserId && !userId));

		const result = await sendPushNotification(
			{
				userId: targetAll ? undefined : targetUserId,
				all: targetAll
			},
			{
				title,
				body: messageBody,
				url,
				tag
			}
		);

		return json({
			success: true,
			sent: result.sent,
			failed: result.failed,
			total: result.total
		});
	} catch (err: any) {
		console.error('Error in /api/push/notify:', err);
		return json({ error: 'Failed to send push notification', details: err.message }, { status: 500 });
	}
};
