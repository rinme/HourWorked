import { json, type RequestHandler } from '@sveltejs/kit';
import { getUserByUsername, createUser } from '$lib/server/db';
import { hashPassword, createSessionToken, setSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { username, password } = body || {};

		if (!username || typeof username !== 'string' || username.trim().length < 3) {
			return json(
				{ error: 'Username must be at least 3 characters long' },
				{ status: 400 }
			);
		}

		if (!password || typeof password !== 'string' || password.length < 6) {
			return json(
				{ error: 'Password must be at least 6 characters long' },
				{ status: 400 }
			);
		}

		const cleanUsername = username.trim();
		const existingUser = await getUserByUsername(cleanUsername);
		if (existingUser) {
			return json(
				{ error: 'Username is already taken' },
				{ status: 409 }
			);
		}

		const { hash, salt } = await hashPassword(password);
		const userId = crypto.randomUUID();

		const newUser = await createUser({
			id: userId,
			username: cleanUsername,
			passwordHash: hash,
			passwordSalt: salt
		});

		const userPayload = { id: newUser.id, username: newUser.username };
		const token = await createSessionToken(userPayload);
		setSessionCookie(cookies, token);

		return json({ user: userPayload, token }, { status: 201 });
	} catch (err: any) {
		console.error('Error in /api/auth/register:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
