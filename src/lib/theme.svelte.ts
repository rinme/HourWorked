/**
 * Theme manager for HourWorked mobile app
 */

class ThemeStore {
	isDark = $state(true);
	isInitialized = $state(false);

	constructor() {
		// Browser check
		if (typeof window !== 'undefined') {
			this.initTheme();
		}
	}

	initTheme() {
		if (typeof window === 'undefined') return;

		try {
			const saved = localStorage.getItem('hourworked_theme');
			if (saved === 'dark' || saved === 'light') {
				this.isDark = saved === 'dark';
			} else {
				// System preference
				this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
			this.applyClass();
			this.isInitialized = true;
		} catch {
			this.isDark = true;
			this.applyClass();
			this.isInitialized = true;
		}
	}

	toggleTheme() {
		this.isDark = !this.isDark;
		this.applyClass();
		try {
			localStorage.setItem('hourworked_theme', this.isDark ? 'dark' : 'light');
		} catch {
			// ignore quota error
		}
	}

	setTheme(dark: boolean) {
		this.isDark = dark;
		this.applyClass();
		try {
			localStorage.setItem('hourworked_theme', this.isDark ? 'dark' : 'light');
		} catch {
			// ignore
		}
	}

	private applyClass() {
		if (typeof document === 'undefined') return;
		if (this.isDark) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
}

export const themeStore = new ThemeStore();
