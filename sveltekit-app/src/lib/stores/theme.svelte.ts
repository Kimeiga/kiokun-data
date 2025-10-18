// Theme store using Svelte 5 runes
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

// Initialize theme from localStorage or default to dark
const getInitialTheme = (): Theme => {
	if (!browser) return 'dark';
	const stored = localStorage.getItem('theme') as Theme | null;
	return stored || 'dark';
};

class ThemeStore {
	current = $state<Theme>(getInitialTheme());

	constructor() {
		// Apply theme on initialization
		if (browser) {
			this.applyTheme(this.current);
		}
	}

	toggle() {
		this.current = this.current === 'light' ? 'dark' : 'light';
		this.applyTheme(this.current);
	}

	private applyTheme(theme: Theme) {
		if (!browser) return;
		
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}
}

export const themeStore = new ThemeStore();

