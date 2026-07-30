<script lang="ts">
	/**
	 * SpeakButton - A button that uses the Web SpeechSynthesis API to speak text
	 * Supports Chinese (Mandarin), Japanese, and Korean with platform-optimized voice selection
	 *
	 * Voice quality priority (based on https://github.com/readium/speech):
	 * - veryHigh: Microsoft Natural voices (Edge), Apple Siri voices
	 * - high: Google voices (Chrome Desktop), Apple Enhanced voices, Android Google voices
	 * - normal: Windows preloaded voices, Apple standard voices
	 * - low: Fallback voices
	 */

	interface Props {
		/** The text to speak (should be the actual characters, not romanization) */
		text: string;
		/** The language code: 'zh' for Chinese, 'ja' for Japanese, 'ko' for Korean */
		lang: 'zh' | 'ja' | 'ko';
		/** Optional: size of the icon (default: 16) */
		size?: number;
		/** Optional: visible text label rendered inside the button (e.g. "Listen").
		 *  When set, the whole button — icon + label — is one click target. */
		label?: string;
		/** Optional: render as a bordered pill that matches themed pill buttons.
		 *  Intended for use together with `label`. */
		pill?: boolean;
		/** Optional: use the compact inline control size for dense dictionary rows. */
		compact?: boolean;
	}

	let { text, lang, size = 16, label, pill = false, compact = false }: Props = $props();

	let isSpeaking = $state(false);
	let isSupported = $state(true);
	let cachedVoices: SpeechSynthesisVoice[] = $state([]);

	// Recommended voices ordered by quality (best first)
	// Based on https://github.com/readium/speech
	const KOREAN_VOICES = [
		// veryHigh quality - Microsoft Edge Natural voices
		{ name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', quality: 'veryHigh' },
		{ name: 'Microsoft InJoon Online (Natural) - Korean (Korea)', quality: 'veryHigh' },
		// high quality - Google Chrome Desktop
		{ name: 'Google 한국의', quality: 'high' },
		// high quality - Apple premium/enhanced voices
		{ name: 'Yuna', quality: 'high', altNames: ['Yuna (Enhanced)', 'Yuna (Korean (Korea))'] },
		// high quality - Android/ChromeOS Google voices
		{ name: 'Android Speech Recognition and Synthesis from Google ko-KR-x-koc-network', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google ko-KR-x-koc-local'] },
		{ name: 'Android Speech Recognition and Synthesis from Google ko-KR-x-kod-network', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google ko-KR-x-kod-local'] },
		// normal quality - Windows preloaded
		{ name: 'Microsoft Heami - Korean (Korea)', quality: 'normal' },
	];

	const JAPANESE_VOICES = [
		// veryHigh quality - Microsoft Edge Natural voices
		{ name: 'Microsoft Nanami Online (Natural) - Japanese (Japan)', quality: 'veryHigh' },
		{ name: 'Microsoft Keita Online (Natural) - Japanese (Japan)', quality: 'veryHigh' },
		// high quality - Apple Siri premium
		{ name: 'Hattori', quality: 'high', altNames: ['com.apple.ttsbundle.siri_Hattori_ja-JP_premium'] },
		// high quality - Google Chrome Desktop
		{ name: 'Google 日本語', quality: 'high' },
		// high quality - Android/ChromeOS Google voices
		{ name: 'Google 日本語 1 (Natural)', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google ja-jp-x-htm-network', 'Android Speech Recognition and Synthesis from Google ja-jp-x-htm-local'] },
		{ name: 'Google 日本語 2 (Natural)', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google ja-jp-x-jac-network', 'Android Speech Recognition and Synthesis from Google ja-jp-x-jac-local'] },
		{ name: 'Chrome OS 日本語 2', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google ja-jp-x-jab-network', 'Android Speech Recognition and Synthesis from Google ja-jp-x-jab-local'] },
		// normal quality - Apple preloaded
		{ name: 'O-Ren', quality: 'normal' },
		{ name: 'Kyoko', quality: 'normal', altNames: ['Kyoko (Enhanced)', 'Kyoko (Japanese (Japan))'] },
		{ name: 'Otoya', quality: 'normal', altNames: ['Otoya (Enhanced)', 'Otoya (Japanese (Japan))'] },
		// normal quality - Windows preloaded
		{ name: 'Microsoft Ayumi - Japanese (Japan)', quality: 'normal' },
		{ name: 'Microsoft Haruka - Japanese (Japan)', quality: 'normal' },
		{ name: 'Microsoft Ichiro - Japanese (Japan)', quality: 'normal' },
	];

	const CHINESE_VOICES = [
		// veryHigh quality - Microsoft Edge Natural voices (Mainland)
		{ name: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', quality: 'veryHigh' },
		{ name: 'Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)', quality: 'veryHigh' },
		{ name: 'Microsoft Yunxi Online (Natural) - Chinese (Mainland)', quality: 'veryHigh' },
		{ name: 'Microsoft Yunyang Online (Natural) - Chinese (Mainland)', quality: 'veryHigh' },
		{ name: 'Microsoft Yunjian Online (Natural) - Chinese (Mainland)', quality: 'veryHigh' },
		// veryHigh quality - Microsoft Edge Natural voices (Taiwan)
		{ name: 'Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)', quality: 'veryHigh' },
		{ name: 'Microsoft HsiaoYu Online (Natural) - Chinese (Taiwanese Mandarin)', quality: 'veryHigh' },
		{ name: 'Microsoft YunJhe Online (Natural) - Chinese (Taiwan)', quality: 'veryHigh' },
		// high quality - Google Chrome Desktop
		{ name: 'Google 普通话（中国大陆）', quality: 'high' },
		{ name: 'Google 國語（臺灣）', quality: 'high' },
		// high quality - Apple premium/enhanced voices
		{ name: 'Lilian', quality: 'high', altNames: ['Lilian (Enhanced)', 'Lilian (Chinese (China))'] },
		{ name: 'Yue', quality: 'high' },
		{ name: 'Lili', quality: 'high', altNames: ['Lili (Enhanced)', 'Lili (Chinese (China))'] },
		{ name: 'Han', quality: 'high', altNames: ['Han (Enhanced)', 'Han (Chinese (China))'] },
		{ name: 'Meijia', quality: 'high', altNames: ['Meijia (Enhanced)', 'Meijia (Chinese (Taiwan))'] },
		// high quality - Android/ChromeOS Google voices
		{ name: 'Android Speech Recognition and Synthesis from Google cmn-CN-x-ccc-network', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google cmn-CN-x-ccc-local', 'Android Speech Recognition and Synthesis from Google zh-CN-language'] },
		{ name: 'Android Speech Recognition and Synthesis from Google cmn-CN-x-ssa-network', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google cmn-CN-x-ssa-local'] },
		{ name: 'Android Speech Recognition and Synthesis from Google cmn-TW-x-ctc-network', quality: 'high', altNames: ['Android Speech Recognition and Synthesis from Google cmn-TW-x-ctc-local'] },
		// normal quality - Apple standard voices
		{ name: 'Tingting', quality: 'normal', altNames: ['Tingting (Enhanced)', 'Tingting (Chinese (China))'] },
		{ name: 'Tiantian', quality: 'normal' },
		{ name: 'Shasha', quality: 'normal' },
		// normal quality - Windows preloaded
		{ name: 'Microsoft Huihui - Chinese (Simplified, PRC)', quality: 'normal' },
		{ name: 'Microsoft Yaoyao - Chinese (Simplified, PRC)', quality: 'normal' },
		{ name: 'Microsoft Kangkang - Chinese (Simplified, PRC)', quality: 'normal' },
		{ name: 'Microsoft Yating - Chinese (Traditional, Taiwan)', quality: 'normal' },
		{ name: 'Microsoft Hanhan - Chinese (Traditional, Taiwan)', quality: 'normal' },
		{ name: 'Microsoft Zhiwei - Chinese (Traditional, Taiwan)', quality: 'normal' },
	];

	// Check if SpeechSynthesis is supported
	$effect(() => {
		if (typeof window !== 'undefined') {
			isSupported = 'speechSynthesis' in window;
		}
	});

	/**
	 * Find the best available voice for the given language
	 * Iterates through recommended voices in quality order and returns first match
	 */
	function findBestVoice(voices: SpeechSynthesisVoice[], targetLang: 'zh' | 'ja' | 'ko'): SpeechSynthesisVoice | null {
		const recommendedVoices = targetLang === 'ja' ? JAPANESE_VOICES
			: targetLang === 'ko' ? KOREAN_VOICES
			: CHINESE_VOICES;
		const langPrefixes = targetLang === 'ja'
			? ['ja-JP', 'ja']
			: targetLang === 'ko'
			? ['ko-KR', 'ko']
			: ['zh-CN', 'zh-TW', 'cmn-CN', 'cmn-TW', 'zh'];

		// First, try to find a voice from our recommended list (in quality order)
		for (const recommended of recommendedVoices) {
			// Check primary name
			let found = voices.find(v => v.name === recommended.name);

			// Check alternate names if not found
			if (!found && recommended.altNames) {
				for (const altName of recommended.altNames) {
					found = voices.find(v => v.name === altName || v.name.includes(altName));
					if (found) break;
				}
			}

			// Also try partial matching for localized names (Apple voices)
			if (!found) {
				found = voices.find(v => v.name.startsWith(recommended.name + ' ('));
			}

			if (found) {
				console.log(`[TTS] Selected voice: "${found.name}" (quality: ${recommended.quality})`);
				return found;
			}
		}

		// Fallback: find any voice matching the language
		for (const prefix of langPrefixes) {
			const fallback = voices.find(v => v.lang.startsWith(prefix));
			if (fallback) {
				console.log(`[TTS] Fallback voice: "${fallback.name}" (lang: ${fallback.lang})`);
				return fallback;
			}
		}

		console.warn(`[TTS] No voice found for language: ${targetLang}`);
		return null;
	}

	function speak() {
		if (!isSupported || !text) return;

		const synth = window.speechSynthesis;

		// Cancel any ongoing speech
		synth.cancel();

		// Chrome bug workaround: Chrome enters a "paused" state after ~15 seconds of inactivity
		// Calling resume() resets this state so subsequent speak() calls work
		// See: https://bugs.chromium.org/p/chromium/issues/detail?id=679437
		synth.resume();

		// Small delay after cancel() to ensure it takes effect before speak()
		// This is another Chrome quirk where speaking immediately after cancel can fail
		setTimeout(() => {
			const utterance = new SpeechSynthesisUtterance(text);

			// Set language based on prop
			// Use specific locale codes for better voice matching
			utterance.lang = lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko-KR' : 'ja-JP';

			// Find the best available voice
			const voices = cachedVoices.length > 0 ? cachedVoices : synth.getVoices();
			const bestVoice = findBestVoice(voices, lang);

			if (bestVoice) {
				utterance.voice = bestVoice;
				// Adjust language to match voice's language for better results
				if (bestVoice.lang) {
					utterance.lang = bestVoice.lang;
				}
			}

			// Use natural rate (most high-quality voices sound best at 1.0)
			utterance.rate = 1.0;
			utterance.pitch = 1.0;

			utterance.onstart = () => {
				isSpeaking = true;
			};

			utterance.onend = () => {
				isSpeaking = false;
			};

			utterance.onerror = (event) => {
				console.error('[TTS] Speech error:', event.error);
				isSpeaking = false;
			};

			synth.speak(utterance);
		}, 50);
	}

	// Preload and cache voices (they may not be available immediately)
	$effect(() => {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			// Initial load
			const loadVoices = () => {
				const voices = window.speechSynthesis.getVoices();
				if (voices.length > 0) {
					cachedVoices = voices;
					console.log(`[TTS] Loaded ${voices.length} voices`);
				}
			};

			loadVoices();

			// Voices are loaded asynchronously in some browsers
			window.speechSynthesis.onvoiceschanged = loadVoices;
		}
	});
</script>

{#if isSupported}
	<button
		class="speak-button"
		class:speaking={isSpeaking}
		class:pill
		class:compact
		onclick={speak}
		title={lang === 'zh' ? 'Listen (Chinese)' : lang === 'ko' ? 'Listen (Korean)' : 'Listen (Japanese)'}
		aria-label={lang === 'zh' ? 'Listen to Chinese pronunciation' : lang === 'ko' ? 'Listen to Korean pronunciation' : 'Listen to Japanese pronunciation'}
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
		{#if label}<span class="speak-button-label">{label}</span>{/if}
	</button>
{/if}

<style>
	.speak-button {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--text-tertiary, #888);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color 0.15s ease, background 0.15s ease;
		vertical-align: middle;
	}

	.speak-button:hover {
		color: var(--text-primary, #333);
		background: var(--bg-secondary, #f5f5f5);
	}

	.speak-button.compact {
		min-width: 44px;
		min-height: 44px;
		padding: 2px;
	}

	.speak-button:active {
		transform: scale(0.95);
	}

	.speak-button.speaking {
		color: var(--accent-color, #3b82f6);
	}

	.speak-button-label {
		font-size: 1rem;
		font-weight: 600;
		line-height: 1;
	}

	/* Pill variant: matches the game's themed .btn pill buttons (same
	   padding / font / shadow / press), so it lines up in size with the
	   adjacent Continue button. The whole element is one click target. */
	.speak-button.pill {
		gap: 0.5rem;
		padding: 0.75rem 2rem;
		border: 2px solid var(--border-color, #ddd);
		border-radius: 12px;
		background: var(--bg-secondary, #f5f5f5);
		color: var(--text-primary, #333);
		box-shadow: 0 4px 0 var(--border-color, #ddd);
		font-family: inherit;
		transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, transform 0.15s ease;
	}

	.speak-button.pill:hover {
		background: var(--bg-tertiary, #eee);
		color: var(--text-primary, #333);
	}

	.speak-button.pill:active {
		transform: translateY(4px);
		box-shadow: none;
	}

	.speak-button.pill.speaking {
		border-color: var(--blue-primary, var(--accent-color, #3b82f6));
		color: var(--blue-primary, var(--accent-color, #3b82f6));
		background: var(--bg-secondary, #f5f5f5);
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
