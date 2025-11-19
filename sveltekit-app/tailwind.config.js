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
				onyomi: 'var(--color-onyomi)',
				kunyomi: 'var(--color-kunyomi)',
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
					// Traditional Chinese fonts
					'Microsoft JhengHei', // Windows Traditional Chinese
					'PingFang TC', // macOS/iOS Traditional Chinese
					'Heiti TC', // macOS Traditional Chinese fallback
					'Apple LiGothic', // macOS Traditional Chinese fallback
					// Simplified Chinese fonts
					'Microsoft YaHei', // Windows Simplified Chinese
					'PingFang SC', // macOS/iOS Simplified Chinese
					'Heiti SC', // macOS Simplified Chinese fallback
					'SimSun', // Windows Simplified Chinese fallback
					// Japanese fonts
					'MS Mincho', // Windows Japanese serif
					'Hiragino Mincho ProN', // macOS Japanese serif
					'Yu Mincho', // Windows/macOS Japanese serif
					'Meiryo', // Windows Japanese sans-serif fallback
					'Hiragino Kaku Gothic ProN', // macOS Japanese sans-serif fallback
					// Generic fallbacks
					'serif'
				],
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
			}
		}
	},
	plugins: []
};

