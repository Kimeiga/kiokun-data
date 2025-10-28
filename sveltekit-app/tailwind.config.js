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
				gloss: 'var(--color-gloss)'
			},
			boxShadow: {
				DEFAULT: '0 2px 10px var(--shadow)',
				hover: '0 4px 12px var(--shadow-hover)'
			},
			fontFamily: {
				cjk: ['SimSun', 'MS Mincho', 'serif'],
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
			}
		}
	},
	plugins: []
};

