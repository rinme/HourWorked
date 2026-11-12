import { json, type RequestHandler } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	clearSessionCookie(cookies);
	return json({ success: true });
};
