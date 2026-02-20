// Language preferences store using Svelte 5 runes
import { browser } from '$app/environment';

export type Language = 'chinese' | 'japanese' | 'korean' | 'cantonese';

export interface LanguagePreferences {
	chinese: boolean;
	japanese: boolean;
	korean: boolean;
	cantonese: boolean;
}

// Check if device is mobile (used for default Korean setting)
const isMobile = (): boolean => {
	if (!browser) return false;
	return window.innerWidth < 768;
};

// Initialize preferences from localStorage or defaults
const getInitialPreferences = (): LanguagePreferences => {
	if (!browser) {
		return { chinese: true, japanese: true, korean: true, cantonese: true };
	}

	const stored = localStorage.getItem('languagePreferences');
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			// Ensure all keys exist (for backwards compatibility when adding new languages)
			return {
				chinese: parsed.chinese ?? true,
				japanese: parsed.japanese ?? true,
				korean: parsed.korean ?? true,
				cantonese: parsed.cantonese ?? true
			};
		} catch {
			// Invalid JSON, use defaults
		}
	}

	// Default: all on for desktop, Korean off for mobile
	return {
		chinese: true,
		japanese: true,
		korean: !isMobile(),
		cantonese: true  // Cantonese on by default
	};
};

class LanguageStore {
	preferences = $state<LanguagePreferences>(getInitialPreferences());

	constructor() {
		// Listen for window resize to potentially update mobile status
		if (browser) {
			// Re-check on mount in case SSR had wrong value
			const initial = getInitialPreferences();
			this.preferences = initial;
		}
	}

	toggle(lang: Language) {
		this.preferences[lang] = !this.preferences[lang];
		this.save();
	}

	set(lang: Language, enabled: boolean) {
		this.preferences[lang] = enabled;
		this.save();
	}

	setAll(prefs: Partial<LanguagePreferences>) {
		this.preferences = { ...this.preferences, ...prefs };
		this.save();
	}

	isEnabled(lang: Language): boolean {
		return this.preferences[lang];
	}

	// Get count of enabled languages
	get enabledCount(): number {
		return Object.values(this.preferences).filter(Boolean).length;
	}

	// Check if at least one language is enabled
	get hasAnyEnabled(): boolean {
		return this.enabledCount > 0;
	}

	private save() {
		if (!browser) return;
		localStorage.setItem('languagePreferences', JSON.stringify(this.preferences));
	}
}

export const languageStore = new LanguageStore();

