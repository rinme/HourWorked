import type { Cookies } from '@sveltejs/kit';

const JWT_SECRET = process.env.JWT_SECRET || 'hourworked-default-super-secret-key-change-in-production';
const SESSION_COOKIE_NAME = 'hw_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// -------------------------------------------------------------
// Web Crypto PBKDF2 Password Hashing
// -------------------------------------------------------------
export async function hashPassword(
	password: string,
	existingSaltHex?: string
): Promise<{ hash: string; salt: string }> {
	const enc = new TextEncoder();
	let salt: Uint8Array;

	if (existingSaltHex) {
		const bytes = existingSaltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [];
		salt = new Uint8Array(bytes);
	} else {
		salt = crypto.getRandomValues(new Uint8Array(16));
	}

	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(password) as any,
		'PBKDF2',
		false,
		['deriveBits']
	);

	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: salt as any,
			iterations: 100000,
			hash: 'SHA-256'
		},
		key,
		256
	);

	const hashHex = Array.from(new Uint8Array(bits))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return { hash: hashHex, salt: saltHex };
}

export async function verifyPassword(
	password: string,
	expectedHash: string,
	saltHex: string
): Promise<boolean> {
	const { hash } = await hashPassword(password, saltHex);
	return hash === expectedHash;
}

// -------------------------------------------------------------
// Web Crypto JWT / Session Tokens
// -------------------------------------------------------------
function base64UrlEncode(str: string): string {
	return Buffer.from(str)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (base64.length % 4) {
		base64 += '=';
	}
	return Buffer.from(base64, 'base64').toString('utf-8');
}

export async function createSessionToken(user: { id: string; username: string }): Promise<string> {
	const header = { alg: 'HS256', typ: 'JWT' };
	const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
	const payload = {
		sub: user.id,
		username: user.username,
		exp,
		iat: Math.floor(Date.now() / 1000)
	};

	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const data = `${encodedHeader}.${encodedPayload}`;

	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(JWT_SECRET) as any,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data) as any);
	const signatureBase64 = Buffer.from(signatureBuffer)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');

	return `${data}.${signatureBase64}`;
}

export async function verifySessionToken(
	token: string
): Promise<{ id: string; username: string } | null> {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;
		const [encodedHeader, encodedPayload, signatureBase64] = parts;

		const enc = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			enc.encode(JWT_SECRET) as any,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);

		let base64Sig = signatureBase64.replace(/-/g, '+').replace(/_/g, '/');
		while (base64Sig.length % 4) {
			base64Sig += '=';
		}
		const sigBytes = Buffer.from(base64Sig, 'base64');

		const isValid = await crypto.subtle.verify(
			'HMAC',
			key,
			sigBytes as any,
			enc.encode(`${encodedHeader}.${encodedPayload}`) as any
		);

		if (!isValid) return null;

		const payloadJson = base64UrlDecode(encodedPayload);
		const payload = JSON.parse(payloadJson);

		if (payload.exp && Date.now() / 1000 > payload.exp) {
			return null;
		}

		return {
			id: payload.sub,
			username: payload.username
		};
	} catch (e) {
		return null;
	}
}

// -------------------------------------------------------------
// SvelteKit Cookie & Auth Helpers
// -------------------------------------------------------------
export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: SESSION_MAX_AGE_SECONDS
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, {
		path: '/'
	});
}

export async function getSessionUser(
	cookies: Cookies,
	headers?: Headers
): Promise<{ id: string; username: string } | null> {
	// 1. Try Cookie
	const cookieToken = cookies.get(SESSION_COOKIE_NAME);
	if (cookieToken) {
		const user = await verifySessionToken(cookieToken);
		if (user) return user;
	}

	// 2. Try Authorization: Bearer <token>
	if (headers) {
		const authHeader = headers.get('authorization');
		if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
			const bearerToken = authHeader.slice(7).trim();
			const user = await verifySessionToken(bearerToken);
			if (user) return user;
		}
	}

	return null;
}
