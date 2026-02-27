# Dictionary Definition Quality Ranking

## Overview

This system addresses the issue where dictionary fetches return low-quality definitions like "past simple of vet" instead of more descriptive meanings like "make a careful and critical examination of (something)".

## How It Works

### 1. Multi-Source Fetching

The system now fetches dictionary data from **three sources** in parallel:
- **Cambridge Dictionary** - Academic, learner-focused definitions
- **Oxford Learner's Dictionary** - Clear, pedagogical definitions
- **Google Translate / Dictionary API** - Alternative definitions and translations

### 2. Definition Quality Ranking

Each definition is scored based on quality criteria:

#### High Quality (60-100 points)
- Descriptive explanations of meaning
- Contains action phrases ("to examine", "to investigate")
- Uses relative clauses (that, which, who)
- Contains specific terminology
- 5+ words long

#### Low Quality (0-40 points)
- Simple tense/form changes ("past simple of...", "plural of...")
- Very short definitions (< 3 words)
- Grammatical descriptions without meaning

### 3. Intelligent Selection

The system:
1. Collects definitions from all available sources
2. Scores each definition for quality
3. Selects the highest-scoring definition
4. Merges supplementary data (CEFR level, pronunciation, examples) from other sources

## Example: "vetted"

**Before:**
```
Source: Cambridge Dictionary
Meaning: past simple of vet
```

**After:**
```
Source: Google Translate/Dictionary API (+ Cambridge Dictionary, Oxford Dictionary)
Meaning: make a careful and critical examination of (something)
Part of Speech: verb
CEFR Level: B2
```

## Files Modified/Added

### New Files
1. **`lib/google-translate-scraper.ts`** - Scrapes Google Translate and free Dictionary API
2. **`lib/definition-ranker.ts`** - Implements quality scoring and selection logic
3. **`test-definition-ranker.mjs`** - Test script for verifying improvements

### Modified Files
1. **`app/api/fetch-dictionary/route.ts`** - Updated to use all three sources and ranking
2. **`app/api/fetch-dictionary-batch/route.ts`** - Updated batch processing with new system

## Testing

Run the test script to verify the improvements:

```bash
# Start the development server
npm run dev

# In another terminal, run the test
node test-definition-ranker.mjs
```

The test will check:
- Word "vetted" gets a descriptive definition
- Other past participles are handled correctly
- Quality ranking is working as expected

## Technical Details

### Quality Scoring Algorithm

```typescript
function scoreDefinitionQuality(definition: string): number {
  let score = 50 // Base score
  
  // Penalties
  if (isFormChangeDefinition(definition)) score -= 40
  if (wordCount < 3) score -= 15
  
  // Bonuses
  if (wordCount >= 5) score += 15
  if (wordCount >= 10) score += 10
  if (/to\s+\w+/.test(definition)) score += 5
  if (/that|which|who/.test(definition)) score += 5
  if (hasSpecificTerminology) score += 10
  
  return score // 0-100
}
```

### Form Change Detection

The system detects low-quality definitions using regex patterns:
- `past simple of`, `past tense of`
- `past participle of`, `present participle of`
- `plural of`, `comparative form of`
- `third person singular of`
- And more grammatical form patterns

## Benefits

1. **More Informative** - Users get actual meanings instead of grammatical descriptions
2. **Better Learning** - Learners understand word meanings, not just forms
3. **Redundancy** - Three sources provide better coverage
4. **Smart Fallback** - If one source fails, others are available
5. **Quality First** - Always prioritizes the most descriptive definition

## Future Improvements

- Add more dictionary sources (Merriam-Webster, Collins, etc.)
- Machine learning-based quality scoring
- Context-aware definition selection
- Caching of high-quality definitions
- User feedback loop for ranking improvements
