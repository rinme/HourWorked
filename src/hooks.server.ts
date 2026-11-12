import type { Handle } from '@sveltejs/kit/hooks';
import { getSessionUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') || event.url.host;
	// Redirect any *.vercel.app requests to the custom domain hours.rinme.me
	if (host.includes('vercel.app')) {
		const targetUrl = new URL(event.url);
		targetUrl.protocol = 'https:';
		targetUrl.host = 'hours.rinme.me';
		targetUrl.port = '';
		return Response.redirect(targetUrl.toString(), 308);
	}

	event.locals.user = await getSessionUser(event.cookies, event.request.headers);

	return resolve(event);
};
