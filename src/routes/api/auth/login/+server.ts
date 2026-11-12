import { json, type RequestHandler } from '@sveltejs/kit';
import { getUserByUsername } from '$lib/server/db';
import { verifyPassword, createSessionToken, setSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { username, password } = body || {};

		if (!username || !password) {
			return json(
				{ error: 'Username and password are required' },
				{ status: 400 }
			);
		}

		const user = await getUserByUsername(username.trim());
		if (!user) {
			return json(
				{ error: 'Invalid username or password' },
				{ status: 401 }
			);
		}

		const isValid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
		if (!isValid) {
			return json(
				{ error: 'Invalid username or password' },
				{ status: 401 }
			);
		}

		const userPayload = { id: user.id, username: user.username };
		const token = await createSessionToken(userPayload);
		setSessionCookie(cookies, token);

		return json({ success: true, user: userPayload, token });
	} catch (err: any) {
		console.error('Error in /api/auth/login:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
