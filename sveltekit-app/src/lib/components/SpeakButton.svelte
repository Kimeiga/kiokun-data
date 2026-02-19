<script lang="ts">
	/**
	 * SpeakButton - Text-to-speech button using Web Speech API
	 * Supports Japanese, Chinese, and Korean pronunciation
	 */

	interface Props {
		text: string;
		language: 'ja' | 'zh' | 'ko';
		size?: 'sm' | 'md' | 'lg';
	}

	let { text, language, size = 'md' }: Props = $props();

	let isSpeaking = $state(false);

	// Map language codes to BCP 47 locale tags
	const langMap: Record<string, string> = {
		ja: 'ja-JP',
		zh: 'zh-CN',
		ko: 'ko-KR',
	};

	const sizeClasses: Record<string, string> = {
		sm: 'text-sm p-1',
		md: 'text-base p-2',
		lg: 'text-lg p-3',
	};

	function speak() {
		if (!('speechSynthesis' in window)) {
			console.warn('Speech synthesis not supported');
			return;
		}

		// Cancel any ongoing speech
		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = langMap[language] || 'ja-JP';
		utterance.rate = 0.9; // Slightly slower for language learning

		// Try to find a native voice for the language
		const voices = window.speechSynthesis.getVoices();
		const nativeVoice = voices.find(v => v.lang.startsWith(language));
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

	function handleClick(e: MouseEvent) {
		e.stopPropagation(); // Don't trigger card flip
		speak();
	}
</script>

<button
	type="button"
	onclick={handleClick}
	class="rounded-full hover:bg-base-300 transition-colors {sizeClasses[size]} {isSpeaking ? 'text-accent animate-pulse' : 'text-base-content/60 hover:text-base-content'}"
	title="Listen to pronunciation"
	aria-label="Listen to pronunciation"
>
	🔊
</button>

