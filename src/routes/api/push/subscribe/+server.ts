import { json, type RequestHandler } from '@sveltejs/kit';
import { savePushSubscription } from '$lib/server/db';
import { VAPID_PUBLIC_KEY } from '$lib/server/push';

export const GET: RequestHandler = async () => {
	return json({
		vapidPublicKey: VAPID_PUBLIC_KEY
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { subscription } = body || {};

		if (!subscription || !subscription.endpoint || !subscription.keys) {
			return json(
				{ error: 'Invalid subscription object. Must contain endpoint and keys.' },
				{ status: 400 }
			);
		}

		const { endpoint, keys } = subscription;
		if (!keys.p256dh || !keys.auth) {
			return json(
				{ error: 'Missing p256dh or auth in subscription keys' },
				{ status: 400 }
			);
		}

		const subId = crypto.randomUUID();
		const userId = locals.user?.id || null;

		await savePushSubscription({
			id: subId,
			userId,
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth
		});

		return json({ success: true, id: subId });
	} catch (err: any) {
		console.error('Error in /api/push/subscribe:', err);
		return json({ error: 'Failed to save push subscription' }, { status: 500 });
	}
};
