export interface GeminiWordResult {
  word: string
  part_of_speech: string
  cefr_level: string
  meaning_primary: string
  usage_tips: string
  found: boolean
}

function truncateDefinition(text: string, maxWords = 20): string {
  if (!text) return text
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

function extractJSON(text: string): any {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/(\{[\s\S]*?\}|\[[\s\S]*?\])/)
    if (match) return JSON.parse(match[1])
    throw new Error('No valid JSON in Gemini response')
  }
}

// retries=0 for single-word lookups (fail fast, fall back immediately)
// retries=2 for batch lookups (waiting a bit between words is acceptable)
async function callGemini(prompt: string, retries = 0): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.1 },
  })

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (response.status === 429) {
      const waitMs = attempt * 5000 // 5s, 10s
      console.log(`Gemini rate limited (429), retrying in ${waitMs / 1000}s... (attempt ${attempt}/${retries})`)
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }
      throw new Error('Gemini rate limit exceeded after retries. Please wait a moment and try again.')
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`Gemini API ${response.status}: ${JSON.stringify(err)}`)
    }

    const data = await response.json()
    const text: string = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join('') || ''

    if (!text) throw new Error('Empty response from Gemini')
    return text
  }

  throw new Error('Gemini failed after all retries')
}

function buildPrompt(word: string): string {
  return `Search Cambridge Dictionary or Oxford Dictionary and look up the English word "${word}".

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
  "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "meaning_primary": "the primary definition (max 20 words)",
  "usage_tips": "one example sentence using the word"
}

Use the CEFR level from Cambridge if available. Return ONLY the JSON object.`
}

export async function geminiLookup(word: string): Promise<GeminiWordResult> {
  try {
    const text = await callGemini(buildPrompt(word), 0) // no retries — fail fast, fall back immediately
    const parsed = extractJSON(text)
    return {
      word,
      part_of_speech: parsed.part_of_speech || '',
      cefr_level: parsed.cefr_level || 'n.a.',
      meaning_primary: truncateDefinition(parsed.meaning_primary || ''),
      usage_tips: parsed.usage_tips || '',
      found: !!(parsed.meaning_primary),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Gemini lookup failed for "${word}": ${message}`)
    // Re-throw rate limit errors so the API route can return a proper error to the UI
    if (message.includes('rate limit') || message.includes('429')) {
      throw error
    }
    return { word, part_of_speech: '', cefr_level: 'n.a.', meaning_primary: '', usage_tips: '', found: false }
  }
}

// Gemini free tier: 15 requests/min — use 4s delay between calls
const RATE_LIMIT_DELAY_MS = 4000

export async function geminiLookupBatch(words: string[]): Promise<GeminiWordResult[]> {
  const results: GeminiWordResult[] = []

  for (let i = 0; i < words.length; i++) {
    console.log(`   Gemini [${i + 1}/${words.length}] looking up: ${words[i]}`)
    try {
      const text = await callGemini(buildPrompt(words[i]), 2)
      const parsed = extractJSON(text)
      results.push({
        word: words[i],
        part_of_speech: parsed.part_of_speech || '',
        cefr_level: parsed.cefr_level || 'n.a.',
        meaning_primary: truncateDefinition(parsed.meaning_primary || ''),
        usage_tips: parsed.usage_tips || '',
        found: !!(parsed.meaning_primary),
      })
    } catch (error) {
      console.error(`Gemini batch failed for "${words[i]}":`, error)
      results.push({ word: words[i], part_of_speech: '', cefr_level: 'n.a.', meaning_primary: '', usage_tips: '', found: false })
    }

    if (i < words.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }
  }

  return results
}
