// HourWorked Service Worker for PWA Offline Support & Web Push Notifications
const CACHE_NAME = 'hourworked-cache-v1';
const STATIC_ASSETS = [
	'/',
	'/manifest.webmanifest',
	'/icon-192.png',
	'/icon-512.png',
	'/icon.svg',
	'/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS).catch((err) => {
				console.warn('Cache addAll warning:', err);
			});
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			clients.claim(),
			caches.keys().then((keys) =>
				Promise.all(
					keys.map((key) => {
						if (key !== CACHE_NAME) {
							return caches.delete(key);
						}
					})
				)
			)
		])
	);
});

// Push notification received from Web Push server
self.addEventListener('push', (event) => {
	let data = {
		title: 'HourWorked แจ้งเตือน',
		body: 'มีการแจ้งเตือนจาก HourWorked',
		icon: '/icon-192.png',
		badge: '/icon-192.png',
		url: '/'
	};

	if (event.data) {
		try {
			data = { ...data, ...event.data.json() };
		} catch {
			data.body = event.data.text() || data.body;
		}
	}

	const title = data.title;
	const options = {
		body: data.body,
		icon: data.icon || '/icon-192.png',
		badge: data.badge || '/icon-192.png',
		vibrate: [200, 100, 200],
		tag: data.tag || 'hourworked-notification',
		renotify: true,
		data: {
			url: data.url || '/',
			action: data.action,
			sessionId: data.sessionId,
			type: data.type
		},
		actions: [
			{ action: 'open', title: 'เปิดแอป' },
			{ action: 'checkout', title: 'ตัดกะทำงาน' }
		]
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

// User clicked notification
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const action = event.action;
	const targetUrl = (event.notification.data && event.notification.data.url) || '/';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
			for (const client of windowClients) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					if (action === 'checkout') {
						client.postMessage({
							type: 'SAFEGUARD_CHECKOUT',
							data: event.notification.data
						});
					}
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow(targetUrl);
			}
		})
	);
});
