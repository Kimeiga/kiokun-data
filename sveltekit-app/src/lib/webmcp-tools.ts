// WebMCP Tools for Kiokun Dictionary
// These tools expose Kiokun's functionality to AI assistants via Chrome DevTools

import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { themeStore } from '$lib/stores/theme.svelte';
import { languageStore, type Language } from '$lib/stores/languages.svelte';
import { navigateOrSearch } from '$lib/utils/search-navigation';

// Helper to create tool response
function toolResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export async function registerWebMCPTools() {
  if (!browser) return;

  // Dynamically import @mcp-b/global to avoid SSR issues
  await import('@mcp-b/global');

  const mc = (navigator as any).modelContext;
  if (!mc) {
    console.warn('WebMCP: navigator.modelContext not available');
    return;
  }

  // Tool 1: Get current page info
  mc.registerTool({
    name: 'get_page_info',
    description: 'Get the current page title and URL of the Kiokun dictionary',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const url = window.location.href;
      const title = document.title;
      const pathname = window.location.pathname;
      
      // Extract the current word from URL if on a word page
      const wordMatch = pathname.match(/^\/([^/]+)$/);
      const currentWord = wordMatch ? decodeURIComponent(wordMatch[1]) : null;
      
      return toolResponse(JSON.stringify({ title, url, pathname, currentWord }, null, 2));
    }
  });

  // Tool 2: Search the dictionary
  mc.registerTool({
    name: 'search_dictionary',
    description: 'Search for a word, character, or sentence in the Kiokun dictionary. Handles conjugated words and sentences.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The word, character, or sentence to search for' }
      },
      required: ['query']
    },
    execute: async (args: { query: string }) => {
      await navigateOrSearch(args.query);
      return toolResponse(`Searched for: ${args.query}. Page navigated to results.`);
    }
  });

  // Tool 3: Navigate to a specific word
  mc.registerTool({
    name: 'navigate_to_word',
    description: 'Navigate directly to a specific word or character page',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string', description: 'The word or character to navigate to' }
      },
      required: ['word']
    },
    execute: async (args: { word: string }) => {
      await goto(`/${encodeURIComponent(args.word)}`);
      return toolResponse(`Navigated to: ${args.word}`);
    }
  });

  // Tool 4: Navigate to home
  mc.registerTool({
    name: 'navigate_home',
    description: 'Navigate to the Kiokun dictionary homepage',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await goto('/');
      return toolResponse('Navigated to homepage');
    }
  });

  // Tool 5: Navigate to category
  mc.registerTool({
    name: 'navigate_to_category',
    description: 'Navigate to a character category page (e.g., "animals", "nature/plants")',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category path like "animals" or "nature/plants"' }
      },
      required: ['category']
    },
    execute: async (args: { category: string }) => {
      await goto(`/category/${args.category}`);
      return toolResponse(`Navigated to category: ${args.category}`);
    }
  });

  // Tool 6: Toggle theme
  mc.registerTool({
    name: 'toggle_theme',
    description: 'Toggle between light and dark theme',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      themeStore.toggle();
      return toolResponse(`Theme toggled to: ${themeStore.current}`);
    }
  });

  // Tool 7: Get current theme
  mc.registerTool({
    name: 'get_theme',
    description: 'Get the current theme (light or dark)',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      return toolResponse(`Current theme: ${themeStore.current}`);
    }
  });

  // Tool 8: Toggle language visibility
  mc.registerTool({
    name: 'toggle_language',
    description: 'Toggle visibility of a language in search results and word pages',
    inputSchema: {
      type: 'object',
      properties: {
        language: { 
          type: 'string', 
          enum: ['chinese', 'japanese', 'korean', 'cantonese'],
          description: 'The language to toggle'
        }
      },
      required: ['language']
    },
    execute: async (args: { language: Language }) => {
      languageStore.toggle(args.language);
      const enabled = languageStore.isEnabled(args.language);
      return toolResponse(`${args.language} is now ${enabled ? 'enabled' : 'disabled'}`);
    }
  });

  // Tool 9: Get enabled languages
  mc.registerTool({
    name: 'get_enabled_languages',
    description: 'Get which languages are currently enabled for display',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      return toolResponse(JSON.stringify(languageStore.preferences, null, 2));
    }
  });

  // Tool 10: Set language preference
  mc.registerTool({
    name: 'set_language',
    description: 'Enable or disable a specific language',
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['chinese', 'japanese', 'korean', 'cantonese'] },
        enabled: { type: 'boolean', description: 'Whether to enable or disable the language' }
      },
      required: ['language', 'enabled']
    },
    execute: async (args: { language: Language; enabled: boolean }) => {
      languageStore.set(args.language, args.enabled);
      return toolResponse(`${args.language} set to: ${args.enabled ? 'enabled' : 'disabled'}`);
    }
  });

  // Tool 11: Navigate to study page
  mc.registerTool({
    name: 'navigate_to_study',
    description: 'Navigate to the study page for spaced repetition flashcards',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await goto('/study');
      return toolResponse('Navigated to study page');
    }
  });

  // Tool 12: Navigate to community/users page
  mc.registerTool({
    name: 'navigate_to_community',
    description: 'Navigate to the community/users page',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await goto('/users');
      return toolResponse('Navigated to community page');
    }
  });

  // Tool 13: Get random character
  mc.registerTool({
    name: 'get_random_character',
    description: 'Navigate to a random Chinese character from the taxonomy',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      try {
        const response = await fetch('/game_data/char_taxonomy.json');
        if (!response.ok) throw new Error('Failed to load taxonomy');
        const taxonomy = await response.json();
        const characters = Object.keys(taxonomy);
        const randomChar = characters[Math.floor(Math.random() * characters.length)];
        await goto(`/${encodeURIComponent(randomChar)}`);
        return toolResponse(`Navigated to random character: ${randomChar}`);
      } catch (error) {
        return toolResponse(`Error getting random character: ${error}`);
      }
    }
  });

  // Tool 14: Copy text to clipboard
  mc.registerTool({
    name: 'copy_to_clipboard',
    description: 'Copy text to the clipboard',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy to clipboard' }
      },
      required: ['text']
    },
    execute: async (args: { text: string }) => {
      try {
        await navigator.clipboard.writeText(args.text);
        return toolResponse(`Copied to clipboard: ${args.text}`);
      } catch (error) {
        return toolResponse(`Failed to copy: ${error}`);
      }
    }
  });

  // Tool 15: Play pronunciation using Web Speech API
  mc.registerTool({
    name: 'play_pronunciation',
    description: 'Play pronunciation of text using text-to-speech',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to pronounce' },
        language: {
          type: 'string',
          enum: ['zh', 'ja', 'ko'],
          description: 'Language code: zh (Chinese), ja (Japanese), ko (Korean)'
        }
      },
      required: ['text', 'language']
    },
    execute: async (args: { text: string; language: 'zh' | 'ja' | 'ko' }) => {
      if (!('speechSynthesis' in window)) {
        return toolResponse('Speech synthesis not supported in this browser');
      }

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(args.text);
      utterance.lang = args.language === 'zh' ? 'zh-CN' : args.language === 'ko' ? 'ko-KR' : 'ja-JP';

      // Find best voice
      const voices = synth.getVoices();
      const langPrefix = args.language === 'zh' ? 'zh' : args.language === 'ko' ? 'ko' : 'ja';
      const voice = voices.find(v => v.lang.startsWith(langPrefix));
      if (voice) utterance.voice = voice;

      synth.speak(utterance);
      return toolResponse(`Playing pronunciation: "${args.text}" in ${args.language}`);
    }
  });

  // Tool 16: Get word details from current page
  mc.registerTool({
    name: 'get_word_details',
    description: 'Get detailed information about the word on the current page (definitions, readings, etymology)',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const pathname = window.location.pathname;
      const wordMatch = pathname.match(/^\/([^/]+)$/);
      if (!wordMatch) {
        return toolResponse('Not on a word page');
      }

      const word = decodeURIComponent(wordMatch[1]);
      const details: Record<string, unknown> = { word };

      // Get title/gloss from h1
      const h1 = document.querySelector('h1');
      if (h1) details.meaning = h1.textContent?.trim();

      // Get etymology hint
      const etymologyEl = document.querySelector('[class*="etymology"]') ||
                          Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes('💡'));
      if (etymologyEl) {
        const text = etymologyEl.textContent?.trim();
        if (text?.startsWith('💡')) details.etymology = text.replace('💡', '').trim();
      }

      // Get readings
      const readings: string[] = [];
      document.querySelectorAll('[class*="reading"], [class*="pinyin"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text) readings.push(text);
      });
      if (readings.length > 0) details.readings = readings;

      // Get HSK level if present
      const hskEl = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.match(/HSK\s*\d+/i));
      if (hskEl) {
        const match = hskEl.textContent?.match(/HSK\s*(\d+)/i);
        if (match) details.hskLevel = parseInt(match[1]);
      }

      return toolResponse(JSON.stringify(details, null, 2));
    }
  });

  // Tool 17: Get all categories
  mc.registerTool({
    name: 'get_all_categories',
    description: 'Get all available character categories',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      try {
        const response = await fetch('/game_data/char_taxonomy.json');
        if (!response.ok) throw new Error('Failed to load taxonomy');
        const taxonomy = await response.json();

        // Extract unique top-level categories
        const topLevel = new Set<string>();
        const subcategories: Record<string, Set<string>> = {};

        for (const cats of Object.values(taxonomy) as string[][]) {
          if (cats.length > 0) {
            topLevel.add(cats[0]);
            if (!subcategories[cats[0]]) subcategories[cats[0]] = new Set();
            if (cats.length > 1) subcategories[cats[0]].add(cats[1]);
          }
        }

        const result = Array.from(topLevel).map(cat => ({
          name: cat,
          path: `/category/${cat}`,
          subcategories: Array.from(subcategories[cat] || []).sort()
        }));

        return toolResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return toolResponse(`Error loading categories: ${error}`);
      }
    }
  });

  // Tool 18: Get characters in category
  mc.registerTool({
    name: 'get_characters_in_category',
    description: 'Get all characters in a specific category',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category path like "Nature" or "Nature/Animals/Mythical"'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of characters to return (default: 20)'
        }
      },
      required: ['category']
    },
    execute: async (args: { category: string; limit?: number }) => {
      try {
        const [taxonomyRes, glossesRes] = await Promise.all([
          fetch('/game_data/char_taxonomy.json'),
          fetch('/game_data/component_glosses.json')
        ]);

        if (!taxonomyRes.ok || !glossesRes.ok) throw new Error('Failed to load data');

        const taxonomy = await taxonomyRes.json();
        const glosses = await glossesRes.json();
        const categoryPath = args.category.split('/');
        const limit = args.limit || 20;

        const matches: { char: string; gloss: string }[] = [];

        for (const [char, cats] of Object.entries(taxonomy) as [string, string[]][]) {
          // Check if category path matches
          if (cats.length >= categoryPath.length &&
              categoryPath.every((c, i) => cats[i] === c)) {
            matches.push({ char, gloss: glosses[char] || '' });
            if (matches.length >= limit) break;
          }
        }

        return toolResponse(JSON.stringify({
          category: args.category,
          count: matches.length,
          characters: matches
        }, null, 2));
      } catch (error) {
        return toolResponse(`Error: ${error}`);
      }
    }
  });

  // Tool 19: Navigate to search results
  mc.registerTool({
    name: 'navigate_to_search',
    description: 'Navigate to search results page for a query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    },
    execute: async (args: { query: string }) => {
      await goto(`/search?q=${encodeURIComponent(args.query)}`);
      return toolResponse(`Navigated to search results for: ${args.query}`);
    }
  });

  // Tool 20: Get frequency list
  mc.registerTool({
    name: 'get_frequency_words',
    description: 'Get the most common words by frequency for a language',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['chinese', 'japanese', 'korean'],
          description: 'Language to get frequency list for'
        },
        count: {
          type: 'number',
          description: 'Number of words to return (default: 10, max: 50)'
        }
      },
      required: ['language']
    },
    execute: async (args: { language: 'chinese' | 'japanese' | 'korean'; count?: number }) => {
      try {
        const response = await fetch('/frequency_list.json');
        if (!response.ok) throw new Error('Failed to load frequency data');
        const data = await response.json();

        const count = Math.min(args.count || 10, 50);
        const words = data[args.language]?.slice(0, count) || [];

        return toolResponse(JSON.stringify({
          language: args.language,
          count: words.length,
          words: words.map((w: { rank: number; word: string; reading?: string; definition: string }) => ({
            rank: w.rank,
            word: w.word,
            reading: w.reading,
            definition: w.definition
          }))
        }, null, 2));
      } catch (error) {
        return toolResponse(`Error: ${error}`);
      }
    }
  });

  // Tool 21: Navigate to frequency list
  mc.registerTool({
    name: 'navigate_to_frequency',
    description: 'Navigate to the frequency list page showing most common words',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await goto('/frequency');
      return toolResponse('Navigated to frequency list page');
    }
  });

  // Tool 22: Navigate to Japanese emoji guide
  mc.registerTool({
    name: 'navigate_to_japanese_emoji',
    description: 'Navigate to the Japanese emoji guide page (explains 🈹 🈵 ㊗️ etc.)',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await goto('/japanese-emoji');
      return toolResponse('Navigated to Japanese emoji guide');
    }
  });

  console.log('WebMCP: Kiokun tools registered successfully (22 tools)');
}

