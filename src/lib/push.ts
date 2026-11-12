/**
 * HourWorked Web Push & Service Worker Helper
 * Supports PWA Push Notifications on iOS (16.4+ standalone PWA) and Android Chrome/PWA
 */

export function isPushNotificationSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isStandalonePWA(): boolean {
	if (typeof window === 'undefined') return false;
	const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
	const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
	return isStandaloneMedia || isNavigatorStandalone;
}

export function isIOS(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

/**
 * Requests browser notification permission.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return 'denied';
	}
	if (Notification.permission === 'granted') {
		return 'granted';
	}
	return await Notification.requestPermission();
}

/**
 * Registers the service worker located at /sw.js.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		return null;
	}
	try {
		const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
		return reg;
	} catch (err) {
		console.error('Service worker registration error:', err);
		return null;
	}
}

/**
 * Converts a base64 URL safe string to a Uint8Array for VAPID applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData =
		typeof window !== 'undefined' && typeof window.atob === 'function'
			? window.atob(base64)
			: typeof atob === 'function'
				? atob(base64)
				: Buffer.from(base64, 'base64').toString('binary');
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * Subscribes user to Web Push and saves the subscription to the backend.
 */
export async function subscribeToPushNotifications(): Promise<{
	success: boolean;
	subscription?: PushSubscription;
	error?: string;
}> {
	if (!isPushNotificationSupported()) {
		return {
			success: false,
			error: 'เบราว์เซอร์นี้ยังไม่รองรับระบบแจ้งเตือนแบบ Web Push'
		};
	}

	const permission = await requestNotificationPermission();
	if (permission !== 'granted') {
		return {
			success: false,
			error: 'คุณปฏิเสธการอนุญาตรับการแจ้งเตือน กรุณาเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์'
		};
	}

	const registration = await registerServiceWorker();
	if (!registration) {
		return {
			success: false,
			error: 'ไม่สามารถลงทะเบียน Service Worker ได้'
		};
	}

	try {
		// Wait until active service worker is ready
		const readyReg = await navigator.serviceWorker.ready;
		let subscription = await readyReg.pushManager.getSubscription();

		if (!subscription) {
			// Fetch VAPID public key from backend endpoint
			const keyRes = await fetch('/api/push/subscribe');
			if (!keyRes.ok) {
				throw new Error('ไม่สามารถรับ VAPID public key จากเซิร์ฟเวอร์ได้');
			}
			const keyData = await keyRes.json();
			const publicKey = keyData.publicKey;
			if (!publicKey) {
				throw new Error('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า VAPID keys');
			}

			const applicationServerKey = urlBase64ToUint8Array(publicKey);
			subscription = await readyReg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: applicationServerKey as unknown as ArrayBuffer
			});
		}

		// Send subscription object to backend database
		const saveRes = await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subscription })
		});

		if (!saveRes.ok) {
			const err = await saveRes.json().catch(() => ({}));
			throw new Error(err.error || 'บันทึก subscription ไม่สำเร็จ');
		}

		return { success: true, subscription };
	} catch (err) {
		console.error('Push subscription failed:', err);
		return {
			success: false,
			error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียนการแจ้งเตือน'
		};
	}
}

/**
 * Unsubscribes from Web Push.
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (sub) {
			await sub.unsubscribe();
			await fetch('/api/push/subscribe', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: sub.endpoint })
			}).catch(() => {});
			return true;
		}
		return false;
	} catch (err) {
		console.error('Failed to unsubscribe', err);
		return false;
	}
}

/**
 * Displays an immediate local notification when safeguard threshold is reached.
 */
export async function showLocalSafeguardAlert(
	elapsedHours: number,
	maxHours: number = 12
): Promise<boolean> {
	if (typeof window === 'undefined' || !('Notification' in window)) return false;

	if (Notification.permission !== 'granted') {
		const perm = await Notification.requestPermission();
		if (perm !== 'granted') return false;
	}

	const title = `⚠️ ชั่วโมงทำงานเกินเกณฑ์ความปลอดภัย (${Math.floor(elapsedHours)} ชม.)`;
	const body = `คุณทำงานต่อเนื่องเกิน ${maxHours} ชั่วโมงแล้ว กรุณาตรวจสอบและตัดกะเพื่อความถูกต้องของสถิติและค่าจ้าง`;

	try {
		if ('serviceWorker' in navigator) {
			const reg = await navigator.serviceWorker.ready;
			if (reg && 'showNotification' in reg) {
				await reg.showNotification(title, {
					body,
					icon: '/icon-192.png',
					badge: '/icon-192.png',
					tag: 'safeguard-alert',
					vibrate: [300, 150, 300, 150, 300],
					data: { url: '/', type: 'SAFEGUARD' }
				} as any);
				return true;
			}
		}

		new Notification(title, {
			body,
			icon: '/icon-192.png'
		});
		return true;
	} catch (e) {
		console.error('Failed to show notification', e);
		return false;
	}
}

/**
 * Sends a test push alert through the backend API.
 */
export async function triggerTestPush(): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch('/api/push/notify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'HourWorked ทดสอบแจ้งเตือน',
				body: 'ระบบแจ้งเตือน Web Push พร้อมใช้งานแล้ว 🎉',
				url: '/'
			})
		});
		const data = await res.json();
		if (!res.ok || !data.success) {
			throw new Error(data.error || 'ส่งการแจ้งเตือนไม่สำเร็จ');
		}
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
		};
	}
}
