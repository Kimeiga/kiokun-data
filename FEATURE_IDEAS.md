# Kiokun Dictionary - Feature Ideas & Enhancements

This document outlines potential features and enhancements for the Kiokun dictionary webapp, leveraging the rich data we already have available.

## 📊 Data We Already Have

### Chinese Character Data
- **HSK Level** (1-6) - Chinese proficiency levels
- **Frequency Rankings** - Movie/book character and word rankings
- **Stroke Count** - Number of strokes
- **Components** - Character components with meanings and phonetic indicators
- **Pinyin Frequencies** - Most common pronunciations
- **Etymology/Shuowen** - Historical character explanations
- **Historical Images** - Character evolution images from Academia Sinica
- **Variants** - Simplified/Traditional variants
- **IDS Decomposition** - Ideographic Description Sequences
- **Top Words** - Most common words using this character
- **Statistics** - Movie/book appearance counts and percentages

### Japanese Character Data
- **JLPT Level** (N5-N1) - Japanese proficiency levels
- **Grade Level** - Japanese school grade (1-6, 8=jouyou)
- **Frequency** - Character frequency ranking
- **Stroke Count** - Number of strokes
- **Radicals** - Radical information
- **On/Kun Readings** - Chinese and Japanese readings
- **Nanori** - Name readings
- **IDS Decomposition** - Character component breakdown

### Word Data
- **Example Sentences** - Real usage examples
- **Part of Speech Tags** - Grammatical information
- **Common/Uncommon Flags** - Word frequency indicators
- **Field/Domain Tags** - Subject area classifications
- **Dialect Tags** - Regional usage information
- **Related Words** - Words that appear together
- **Contains/Appears In** - Substring relationships

---

## 🎯 High Priority Features (Quick Wins)

### 1. **Study Lists / Collections**
**What**: Let users create custom study lists of characters/words
**Why**: Users want to organize their learning
**Data Needed**: Just user preferences (new DB table)
**Implementation**:
- Add "Add to List" button on each character page
- Create `/lists` page to manage collections
- Store in D1: `user_lists` table with `list_id`, `user_id`, `name`, `items[]`
- Show progress indicators (how many studied, mastered, etc.)

### 2. **Frequency Indicators**
**What**: Show visual indicators for how common a character/word is
**Why**: Helps learners prioritize what to study
**Data Available**: 
- Chinese: `movieCharRank`, `bookCharRank`, `movieWordRank`, `bookWordRank`
- Japanese: `frequency` field (1-2500 scale)
**Implementation**:
- Add colored badges: "Very Common" (top 500), "Common" (500-2000), "Uncommon" (2000+)
- Show on character cards and in search results
- Filter search by frequency

### 3. **HSK/JLPT Level Badges**
**What**: Prominently display proficiency levels
**Why**: Critical for learners to know difficulty
**Data Available**:
- Chinese: `hskLevel` (1-6)
- Japanese: `jlptLevel` (1-5, where 1=N5, 5=N1)
**Implementation**:
- Add colored badges at top of character page
- Filter dictionary by level
- Show level distribution in study lists

### 4. **Component Search**
**What**: Search for characters by their components
**Why**: Helps learners find characters they partially remember
**Data Available**: `components` array with character breakdowns
**Implementation**:
- Add component picker UI (grid of common radicals/components)
- Search endpoint that filters by components
- Show "Characters using this component" on component pages

### 5. **Stroke Order Animation**
**What**: Animate the stroke order for characters
**Why**: Essential for learning to write
**Data Available**: `images` array has `makemeahanzi` stroke data
**Implementation**:
- Parse the stroke data JSON
- Use SVG animation to show strokes one by one
- Add play/pause/speed controls
- Show stroke count prominently

---

## 🚀 Medium Priority Features (More Complex)

### 6. **Spaced Repetition System (SRS)**
**What**: Built-in flashcard system with spaced repetition
**Why**: Most effective way to memorize characters
**Data Needed**: 
- User review history (new DB table)
- Algorithm: SM-2 or similar
**Implementation**:
- Track: `card_id`, `user_id`, `ease_factor`, `interval`, `next_review_date`
- Show daily review queue
- Generate cards from study lists
- Track statistics (retention rate, study streaks)

### 7. **Example Sentence Browser**
**What**: Dedicated view for browsing example sentences
**Why**: Context is crucial for learning
**Data Available**: `examples` array in Japanese words
**Implementation**:
- Filter sentences by difficulty (based on word frequency)
- Highlight the target word in sentences
- Show translations
- Audio playback (future: TTS integration)

### 8. **Character Etymology Explorer**
**What**: Visual timeline of character evolution
**Why**: Understanding history aids memory
**Data Available**: 
- `images` with historical forms (oracle bone, bronze, seal script)
- `shuowen` explanations
- `hint` field with mnemonics
**Implementation**:
- Timeline view showing character evolution
- Side-by-side comparison of historical forms
- Integrate etymology hints into main view

### 9. **Word Network Visualization**
**What**: Interactive graph showing word relationships
**Why**: See connections between related words
**Data Available**:
- `contains` / `contained_in` relationships
- `components` for characters
- `topWords` for most common words using a character
**Implementation**:
- Use D3.js or similar for graph visualization
- Click nodes to navigate
- Color code by frequency/level
- Show "word families" (words sharing components)

### 10. **Smart Search with Filters**
**What**: Advanced search with multiple filters
**Why**: Help users find exactly what they need
**Filters**:
- HSK/JLPT level
- Frequency range
- Stroke count range
- Contains specific component
- Part of speech
- Has example sentences
- Common/uncommon
**Implementation**:
- Update search endpoint to accept filter params
- Add filter UI to search page
- Save filter presets

---

## 🎨 UI/UX Enhancements

### 11. **Reading Mode**
**What**: Paste text and get inline definitions
**Why**: Help users read real content
**Implementation**:
- Text input area
- Tokenize Chinese/Japanese text
- Show popup definitions on hover
- Highlight by frequency/level
- Export annotated text

### 12. **Comparison View**
**What**: Compare two characters side-by-side
**Why**: Useful for similar-looking characters
**Implementation**:
- "Compare with..." button
- Split-screen view
- Highlight differences in components
- Show usage statistics comparison

### 13. **Mobile-Optimized Handwriting Input**
**What**: Draw characters to search
**Why**: Easier than typing on mobile
**Implementation**:
- Canvas for drawing
- OCR/handwriting recognition API
- Show top matches
- Clear and redraw

### 14. **Dark/Light Theme Improvements**
**What**: Better theme support with more options
**Why**: User preference and accessibility
**Implementation**:
- Add "Auto" mode (follows system)
- Add "Sepia" mode for reading
- Remember preference per-device
- Smooth transitions

---

## 📱 Social & Community Features

### 15. **Public Study Lists**
**What**: Share and discover study lists
**Why**: Learn from others' curated content
**Implementation**:
- Make lists public/private
- Browse popular lists
- Clone others' lists
- Upvote/comment on lists

### 16. **Note Sharing & Discovery**
**What**: Browse community notes for characters
**Why**: Learn from others' mnemonics
**Current**: Already have community notes!
**Enhancements**:
- Upvote/downvote notes
- Sort by most helpful
- Report inappropriate notes
- Follow specific users
- "Note of the day" feature

### 17. **Study Streaks & Achievements**
**What**: Gamification with badges and streaks
**Why**: Motivation and engagement
**Implementation**:
- Track daily study activity
- Award badges (100-day streak, 1000 characters learned, etc.)
- Leaderboards (optional, privacy-respecting)
- Share achievements

---

## 🔧 Technical Enhancements

### 18. **Offline Support (PWA)**
**What**: Make dictionary work offline
**Why**: Study anywhere without internet
**Implementation**:
- Service worker for caching
- IndexedDB for offline data
- Sync when online
- Download specific HSK/JLPT levels for offline use

### 19. **API for Third-Party Apps**
**What**: Public API for dictionary data
**Why**: Enable integrations and extensions
**Implementation**:
- REST API with rate limiting
- API keys for authentication
- Documentation
- Browser extension using the API

### 20. **Performance Optimizations**
**What**: Faster loading and search
**Why**: Better user experience
**Implementation**:
- Implement search index (Algolia or similar)
- Lazy load images
- Prefetch likely next pages
- Optimize bundle size
- Add loading skeletons

---

## 📚 Content Enhancements

### 21. **Audio Pronunciations**
**What**: Native speaker audio for words
**Why**: Essential for learning pronunciation
**Implementation**:
- Integrate TTS API (Google Cloud TTS, Azure, etc.)
- Or crowdsource recordings
- Play button next to pronunciations
- Slow/normal speed options

### 22. **Video Examples**
**What**: Short video clips showing word usage
**Why**: Visual context aids learning
**Implementation**:
- Embed YouTube clips
- User-submitted videos
- Timestamp specific word usage
- Filter by difficulty

### 23. **Related Resources**
**What**: Link to external learning resources
**Why**: Comprehensive learning hub
**Implementation**:
- Link to Pleco, Jisho, etc.
- Grammar explanations
- Cultural notes
- Recommended textbooks/courses

---

## 🎓 Learning Tools

### 24. **Quiz Generator**
**What**: Auto-generate quizzes from study lists
**Why**: Test knowledge retention
**Quiz Types**:
- Multiple choice (character → meaning)
- Fill in the blank (sentences)
- Stroke order practice
- Component recognition
**Implementation**:
- Generate from study lists or HSK/JLPT levels
- Track scores over time
- Adaptive difficulty

### 25. **Writing Practice**
**What**: Practice writing characters
**Why**: Active recall improves retention
**Implementation**:
- Canvas for writing
- Compare with correct stroke order
- Scoring based on accuracy
- Timed challenges

### 26. **Sentence Mining**
**What**: Extract sentences from user content
**Why**: Learn from material you care about
**Implementation**:
- Paste article/book text
- Extract sentences with target words
- Save to study lists
- Generate flashcards

---

## 🔮 Future/Advanced Ideas

### 27. **AI-Powered Mnemonics**
**What**: Generate personalized memory aids
**Why**: Custom mnemonics are more effective
**Implementation**:
- Use GPT-4 to generate stories
- Based on user's native language
- Incorporate user interests
- Learn from upvoted community mnemonics

### 28. **Conversation Practice**
**What**: AI chatbot for practice
**Why**: Practice real conversations
**Implementation**:
- GPT-4 based chatbot
- Difficulty levels
- Correct mistakes
- Suggest better phrasing

### 29. **OCR for Images**
**What**: Upload image and get definitions
**Why**: Read signs, menus, etc.
**Implementation**:
- Google Cloud Vision API
- Detect text in images
- Show definitions inline
- Save to study lists

### 30. **Personalized Learning Path**
**What**: AI-recommended study order
**Why**: Optimize learning efficiency
**Implementation**:
- Analyze user's current level
- Recommend next characters/words
- Based on frequency, components, and difficulty
- Adapt to user's progress

---

## 📋 Implementation Priority Matrix

### Quick Wins (High Impact, Low Effort)
1. HSK/JLPT Level Badges
2. Frequency Indicators
3. Stroke Count Display
4. Component Highlighting

### High Impact (Worth the Effort)
1. Study Lists / Collections
2. Spaced Repetition System
3. Stroke Order Animation
4. Smart Search with Filters

### Nice to Have (Lower Priority)
1. Public Study Lists
2. Comparison View
3. Reading Mode
4. Audio Pronunciations

### Future Exploration
1. AI-Powered Features
2. OCR
3. Video Examples
4. API for Third-Party Apps

---

## 🎯 Next Steps

1. **Review this document** and prioritize features
2. **Create GitHub issues** for selected features
3. **Design mockups** for UI-heavy features
4. **Break down** large features into smaller tasks
5. **Start with Quick Wins** to build momentum

---

*Last Updated: 2025-10-24*

