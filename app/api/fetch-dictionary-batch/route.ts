import { NextRequest, NextResponse } from 'next/server'
import { geminiLookupBatch } from '@/lib/gemini-dictionary'
import { scrapeFreeDictionary } from '@/lib/free-dictionary-scraper'
import { scrapeUrbanDictionary } from '@/lib/urban-dictionary-scraper'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter'

function truncateDefinition(text: string, maxWords: number = 20): string {
  if (!text) return text
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId + ':batch', { maxRequests: 10, windowMs: 60000 })

    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      return NextResponse.json(
        { error: `Rate limit exceeded for batch requests. Try again in ${resetIn} seconds.` },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': resetIn.toString(),
          },
        }
      )
    }

    const { words } = await request.json()
    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words array is required' }, { status: 400 })
    }

    console.log(`\n${'='.repeat(70)}`)
    console.log(`🚀 Starting batch dictionary fetch for ${words.length} words`)
    console.log('='.repeat(70))

    // --- PATH 1: Gemini with Google Search grounding ---
    // Each word gets its own search — Gemini fetches from Cambridge/Oxford directly.
    // Note: free tier is 15 req/min, so batch adds ~4s delay between words.
    if (process.env.USE_GEMINI === 'true') {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: 'GEMINI_API_KEY is not configured in environment variables.' },
          { status: 500 }
        )
      }

      console.log(`🤖 Using Gemini Search for ${words.length} words (4s delay between each for rate limit)`)
      const results = await geminiLookupBatch(words)

      const found = results.filter((r) => r.found)
      const failed = results.filter((r) => !r.found).map((r) => r.word)

      console.log(`✅ Gemini found ${found.length}/${words.length} words`)

      return NextResponse.json({
        success: true,
        data: found.map((r) => ({
          word: r.word,
          part_of_speech: r.part_of_speech,
          cefr_level: r.cefr_level,
          meaning_primary: r.meaning_primary,
          usage_tips: r.usage_tips,
        })),
        source: 'Cambridge/Oxford via Gemini Search',
        processed: found.length,
        total: words.length,
        failed,
      })
    }

    // --- PATH 2: Free Dictionary API + AI processing ---
    const scrapedResults: any[] = []

    for (const word of words) {
      console.log(`\n📖 [${scrapedResults.length + 1}/${words.length}] Searching: ${word}`)

      try {
        let dictionaryData: any = null
        let source = ''

        const freeData = await scrapeFreeDictionary(word)
        if (freeData.found && freeData.definition) {
          dictionaryData = freeData
          source = 'Free Dictionary'
          console.log(`   ✅ Found in Free Dictionary API`)
        }

        if (!dictionaryData) {
          const urbanData = await scrapeUrbanDictionary(word)
          if (urbanData.found && urbanData.definition) {
            dictionaryData = urbanData
            source = 'Urban Dictionary'
            console.log(`   ✅ Found in Urban Dictionary`)
          }
        }

        if (!dictionaryData) {
          console.log(`  ❌ Not found`)
          scrapedResults.push({ word, found: false, error: 'Not found' })
          continue
        }

        scrapedResults.push({
          word,
          partOfSpeech: dictionaryData.partOfSpeech || (source === 'Urban Dictionary' ? 'informal' : ''),
          definition: dictionaryData.definition,
          examples: dictionaryData.examples,
          pronunciation: dictionaryData.pronunciation,
          found: true,
          source,
        })
      } catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`)
        scrapedResults.push({ word, found: false, error: 'Lookup failed' })
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const successfulScrapes = scrapedResults.filter((r) => r.found)
    console.log(`\n📊 Found ${successfulScrapes.length}/${words.length} words`)

    if (successfulScrapes.length === 0) {
      return NextResponse.json(
        {
          error: 'No words found in any dictionary sources',
          results: scrapedResults.map((r: any) => ({ word: r.word, error: r.error || 'Not found' })),
        },
        { status: 404 }
      )
    }

    const useHuggingFace = process.env.USE_HUGGINGFACE === 'true'
    const useLMStudio = process.env.USE_LM_STUDIO === 'true'

    let apiUrl: string
    let apiKey: string
    let model: string

    if (useHuggingFace) {
      model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct'
      apiUrl = `https://api-inference.huggingface.co/models/${model}`
      apiKey = process.env.HUGGINGFACE_API_KEY || ''
      if (!apiKey) {
        return NextResponse.json(
          { error: 'HUGGINGFACE_API_KEY is not configured.' },
          { status: 500 }
        )
      }
    } else if (useLMStudio) {
      apiUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions'
      apiKey = 'lm-studio'
      model = process.env.LM_STUDIO_MODEL || 'local-model'
    } else {
      apiUrl = 'https://api.openai.com/v1/chat/completions'
      apiKey = process.env.OPENAI_API_KEY || ''
      model = 'gpt-4o-mini'
      if (!apiKey) {
        return NextResponse.json(
          { error: 'No AI backend configured. Set USE_GEMINI=true, USE_LM_STUDIO=true, USE_HUGGINGFACE=true, or OPENAI_API_KEY.' },
          { status: 500 }
        )
      }
    }

    const batchText = successfulScrapes
      .map((data: any, i) => {
        let text = `\n--- Word ${i + 1}: ${data.word} (${data.source}) ---\n`
        if (data.pronunciation) text += `Pronunciation: ${data.pronunciation}\n`
        if (data.partOfSpeech) text += `Part of Speech: ${data.partOfSpeech}\n`
        text += `Definition: ${data.definition}\n`
        if (data.examples?.length) {
          data.examples.forEach((ex: string, j: number) => { text += `  ${j + 1}. ${ex}\n` })
        }
        return text
      })
      .join('\n')

    const serviceName = useHuggingFace ? 'Hugging Face' : useLMStudio ? 'LM Studio' : 'OpenAI'
    console.log(`\n🤖 Sending ${successfulScrapes.length} words to ${serviceName}...`)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (useHuggingFace || (!useLMStudio && apiKey)) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const systemPrompt = `You are a dictionary assistant. Return ONLY a valid JSON array, one object per word:
[
  {
    "word": "the word",
    "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
    "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "meaning_primary": "the actual contextual meaning (max 20 words)",
    "usage_tips": "one example sentence"
  }
]
If a definition says "past tense/participle of X", provide the actual meaning instead. Return ONLY the JSON array.`

    const userPrompt = `Dictionary data for ${successfulScrapes.length} words:\n${batchText}\n\nConvert ALL to the required JSON array.`

    let requestBody: any
    if (useHuggingFace) {
      requestBody = {
        inputs: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
        parameters: { max_new_tokens: 3000, temperature: 0.2, return_full_text: false },
      }
    } else {
      requestBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ ${serviceName} Error:`, errorData)
      const fallback = successfulScrapes.map((d: any) => ({
        word: d.word,
        part_of_speech: d.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: truncateDefinition(d.definition || ''),
        usage_tips: d.examples?.[0] || '',
      }))
      return NextResponse.json({
        success: true,
        data: fallback,
        source: 'Free Dictionary (AI unavailable)',
        processed: fallback.length,
        total: words.length,
      })
    }

    const data = await response.json()
    const content: string = useHuggingFace
      ? (Array.isArray(data) ? data[0]?.generated_text : data.generated_text)
      : data.choices[0]?.message?.content

    if (!content) {
      const fallback = successfulScrapes.map((d: any) => ({
        word: d.word,
        part_of_speech: d.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: truncateDefinition(d.definition || ''),
        usage_tips: d.examples?.[0] || '',
      }))
      return NextResponse.json({
        success: true,
        data: fallback,
        source: 'Free Dictionary (fallback)',
        processed: fallback.length,
        total: words.length,
      })
    }

    let processedData
    try {
      const clean = content.replace(/```json\n?|\n?```/g, '').trim()
      processedData = JSON.parse(clean)
      if (!Array.isArray(processedData)) throw new Error('Not an array')
    } catch {
      processedData = successfulScrapes.map((d: any) => ({
        word: d.word,
        part_of_speech: d.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: truncateDefinition(d.definition || ''),
        usage_tips: d.examples?.[0] || '',
      }))
    }

    const finalResults = processedData.map((item: any) => {
      const scraped: any = successfulScrapes.find(
        (s: any) => s.word.toLowerCase() === item.word?.toLowerCase()
      )
      return {
        word: item.word || scraped?.word || '',
        part_of_speech: item.part_of_speech || scraped?.partOfSpeech || '',
        cefr_level: item.cefr_level || 'n.a.',
        meaning_primary: truncateDefinition(item.meaning_primary || scraped?.definition || ''),
        usage_tips: item.usage_tips || scraped?.examples?.[0] || '',
      }
    })

    console.log(`✅ Processed ${finalResults.length} words\n${'='.repeat(70)}`)

    return NextResponse.json({
      success: true,
      data: finalResults,
      source: `Free Dictionary + ${serviceName}`,
      processed: finalResults.length,
      total: words.length,
      failed: scrapedResults.filter((r: any) => !r.found).map((r: any) => r.word),
    })
  } catch (error) {
    console.error('❌ Batch dictionary fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dictionary data' },
      { status: 500 }
    )
  }
}
