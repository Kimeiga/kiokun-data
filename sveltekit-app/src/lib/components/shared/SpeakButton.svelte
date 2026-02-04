<script lang="ts">
	/**
	 * SpeakButton - A button that uses the Web SpeechSynthesis API to speak text
	 * Supports Chinese (Mandarin) and Japanese with automatic language detection
	 */

	interface Props {
		/** The text to speak (should be the actual characters, not romanization) */
		text: string;
		/** The language code: 'zh' for Chinese, 'ja' for Japanese */
		lang: 'zh' | 'ja';
		/** Optional: size of the icon (default: 16) */
		size?: number;
	}

	let { text, lang, size = 16 }: Props = $props();

	let isSpeaking = $state(false);
	let isSupported = $state(true);

	// Check if SpeechSynthesis is supported
	$effect(() => {
		if (typeof window !== 'undefined') {
			isSupported = 'speechSynthesis' in window;
		}
	});

	function speak() {
		if (!isSupported || !text) return;

		// Cancel any ongoing speech
		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(text);
		
		// Set language based on prop
		// Use specific locale codes for better voice matching
		utterance.lang = lang === 'zh' ? 'zh-CN' : 'ja-JP';
		
		// Slightly slower rate for clearer pronunciation
		utterance.rate = 0.9;
		
		// Try to find a native voice for the language
		const voices = window.speechSynthesis.getVoices();
		const langPrefix = lang === 'zh' ? 'zh' : 'ja';
		const nativeVoice = voices.find(v => v.lang.startsWith(langPrefix));
		if (nativeVoice) {
			utterance.voice = nativeVoice;
		}

		utterance.onstart = () => {
			isSpeaking = true;
		};

		utterance.onend = () => {
			isSpeaking = false;
		};

		utterance.onerror = () => {
			isSpeaking = false;
		};

		window.speechSynthesis.speak(utterance);
	}

	// Preload voices (they may not be available immediately)
	$effect(() => {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			// Voices are loaded asynchronously in some browsers
			window.speechSynthesis.getVoices();
			window.speechSynthesis.onvoiceschanged = () => {
				window.speechSynthesis.getVoices();
			};
		}
	});
</script>

{#if isSupported}
	<button
		class="speak-button"
		class:speaking={isSpeaking}
		onclick={speak}
		title={lang === 'zh' ? 'Listen (Chinese)' : 'Listen (Japanese)'}
		aria-label={lang === 'zh' ? 'Listen to Chinese pronunciation' : 'Listen to Japanese pronunciation'}
	>
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<!-- Speaker icon -->
			<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
			<!-- Sound waves (animated when speaking) -->
			<path class="wave wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
			<path class="wave wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
		</svg>
	</button>
{/if}

<style>
	.speak-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--text-tertiary, #888);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s ease;
		vertical-align: middle;
	}

	.speak-button:hover {
		color: var(--text-primary, #333);
		background: var(--bg-secondary, #f5f5f5);
	}

	.speak-button:active {
		transform: scale(0.95);
	}

	.speak-button.speaking {
		color: var(--accent-color, #3b82f6);
	}

	.wave {
		opacity: 0.5;
		transition: opacity 0.2s ease;
	}

	.speak-button:hover .wave,
	.speak-button.speaking .wave {
		opacity: 1;
	}

	.speak-button.speaking .wave-1 {
		animation: pulse 0.5s ease-in-out infinite alternate;
	}

	.speak-button.speaking .wave-2 {
		animation: pulse 0.5s ease-in-out 0.15s infinite alternate;
	}

	@keyframes pulse {
		from { opacity: 0.3; }
		to { opacity: 1; }
	}
</style>

