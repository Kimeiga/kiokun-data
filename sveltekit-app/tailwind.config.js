/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: ['class', '[data-theme="dark"]'],
	theme: {
		extend: {
			colors: {
				// Map to CSS variables for theme support
				primary: {
					DEFAULT: 'var(--bg-primary)',
					secondary: 'var(--bg-secondary)',
					tertiary: 'var(--bg-tertiary)'
				},
				text: {
					primary: 'var(--text-primary)',
					secondary: 'var(--text-secondary)',
					tertiary: 'var(--text-tertiary)',
					muted: 'var(--text-muted)'
				},
				border: {
					DEFAULT: 'var(--border-color)',
					light: 'var(--border-light)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					light: 'var(--accent-light)'
				},
				// Specific semantic colors
				pinyin: 'var(--color-pinyin)',
				cantonese: 'var(--color-cantonese)',
				onyomi: 'var(--color-onyomi)',
				kunyomi: 'var(--color-kunyomi)',
				korean: 'var(--color-korean)',
				gloss: 'var(--color-gloss)',
				// Hint/callout colors
				hint: {
					bg: 'var(--color-hint-bg)',
					border: 'var(--color-hint-border)',
					text: 'var(--color-hint-text)'
				}
			},
			boxShadow: {
				DEFAULT: '0 2px 10px var(--shadow)',
				hover: '0 4px 12px var(--shadow-hover)'
			},
			fontFamily: {
				cjk: [
					// Noto Serif fonts (Google Fonts) - consistent across all CJK
					'"Noto Serif TC"', // Traditional Chinese
					'"Noto Serif SC"', // Simplified Chinese
					'"Noto Serif JP"', // Japanese
					// System font fallbacks
					'Microsoft JhengHei', // Windows Traditional Chinese
					'PingFang TC', // macOS/iOS Traditional Chinese
					'Microsoft YaHei', // Windows Simplified Chinese
					'PingFang SC', // macOS/iOS Simplified Chinese
					'MS Mincho', // Windows Japanese serif
					'Hiragino Mincho ProN', // macOS Japanese serif
					// Generic fallback
					'serif'
				],
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
			}
		}
	},
	plugins: []
};

