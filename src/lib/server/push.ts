import * as webPush from 'web-push';
import {
	savePushSubscription,
	getPushSubscriptions,
	deletePushSubscription,
	type PushSubscriptionRecord
} from './db';

const DEFAULT_VAPID_PUBLIC =
	'BBDKJCtwk4-qoiufaMn3TNo4Z7naPIRCoV6bZc8jCYK9PdrFZiADi0159l9HEqQg4qlL0f7e4lFB-tvBxEQZB64';
const DEFAULT_VAPID_PRIVATE = 'DNjjpLwglAr-L4S5fJhk_khKrgbH_Rhh-xvzQe3rK5Q';
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@rinme.me';

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC;
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE;
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

try {
	webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
	console.error('Failed to configure web-push VAPID details:', e);
}

export interface PushNotificationPayload {
	title: string;
	body: string;
	url?: string;
	tag?: string;
	icon?: string;
	badge?: string;
	data?: any;
}

export async function sendNotificationToSubscription(
	sub: PushSubscriptionRecord | { endpoint: string; p256dh: string; auth: string },
	payload: PushNotificationPayload
): Promise<boolean> {
	try {
		const pushSubscription = {
			endpoint: sub.endpoint,
			keys: {
				p256dh: sub.p256dh,
				auth: sub.auth
			}
		};

		await webPush.sendNotification(
			pushSubscription,
			JSON.stringify({
				title: payload.title,
				body: payload.body,
				url: payload.url || '/',
				tag: payload.tag || 'hw-notification',
				icon: payload.icon || '/icon-192.png',
				badge: payload.badge || '/icon.svg',
				data: payload.data
			})
		);
		return true;
	} catch (err: any) {
		// 404 or 410 Gone means the subscription is no longer valid or unsubscribed
		if (err.statusCode === 404 || err.statusCode === 410) {
			console.log(`[push] Subscription expired/gone (${err.statusCode}), pruning ${sub.endpoint}`);
			await deletePushSubscription(sub.endpoint);
		} else {
			console.error(`[push] Error sending push to ${sub.endpoint}:`, err.message || err);
		}
		return false;
	}
}

export async function sendPushNotification(
	target: { userId?: string | null; all?: boolean },
	payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; total: number }> {
	const subs = await getPushSubscriptions(target.all ? undefined : target.userId);
	let sent = 0;
	let failed = 0;

	for (const sub of subs) {
		const success = await sendNotificationToSubscription(sub, payload);
		if (success) {
			sent++;
		} else {
			failed++;
		}
	}

	return { sent, failed, total: subs.length };
}
