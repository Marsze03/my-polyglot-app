import { NextRequest, NextResponse } from 'next/server'
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

    // Step 1: Look up all words
    const scrapedResults = []
    for (const word of words) {
      console.log(`\n📖 [${scrapedResults.length + 1}/${words.length}] Searching: ${word}`)

      try {
        let dictionaryData: any = null
        let source = ''

        // 1. Try Free Dictionary API
        console.log(`   Trying Free Dictionary API...`)
        const freeData = await scrapeFreeDictionary(word)
        if (freeData.found && freeData.definition) {
          console.log(`   ✅ Found in Free Dictionary API`)
          dictionaryData = freeData
          source = 'Free Dictionary'
        }

        // 2. Fallback to Urban Dictionary
        if (!dictionaryData) {
          console.log(`   Trying Urban Dictionary...`)
          const urbanData = await scrapeUrbanDictionary(word)
          if (urbanData.found && urbanData.definition) {
            console.log(`   ✅ Found in Urban Dictionary`)
            dictionaryData = urbanData
            source = 'Urban Dictionary'
          }
        }

        if (!dictionaryData) {
          console.log(`  ❌ Not found in any dictionary`)
          scrapedResults.push({ word, found: false, error: 'Not found' })
          continue
        }

        const finalData = {
          word,
          partOfSpeech: dictionaryData.partOfSpeech || (source === 'Urban Dictionary' ? 'informal' : ''),
          definition: dictionaryData.definition,
          examples: dictionaryData.examples,
          pronunciation: dictionaryData.pronunciation,
          found: true,
          source,
        }

        console.log(`     ${finalData.partOfSpeech || 'unknown'} - ${finalData.definition?.substring(0, 50)}...`)
        scrapedResults.push(finalData)
      } catch (error) {
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        scrapedResults.push({ word, found: false, error: 'Lookup failed' })
      }

      // Small delay to be polite to API servers
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

    // Step 2: AI batch processing
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
          { error: 'Hugging Face API key not configured. Add HUGGINGFACE_API_KEY to your environment.' },
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
          { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your environment, or set USE_LM_STUDIO=true or USE_HUGGINGFACE=true.' },
          { status: 500 }
        )
      }
    }

    // Prepare batch data text for AI
    const batchScrapedData = successfulScrapes
      .map((data: any, index) => {
        let text = `\n--- Word ${index + 1}: ${data.word} (from ${data.source}) ---\n`
        text += `Word: ${data.word}\n`
        if (data.pronunciation) text += `Pronunciation: ${data.pronunciation}\n`
        if (data.partOfSpeech) text += `Part of Speech: ${data.partOfSpeech}\n`
        text += `Definition: ${data.definition}\n`
        if (data.examples?.length) {
          text += `Examples:\n`
          data.examples.forEach((ex: string, i: number) => {
            text += `  ${i + 1}. ${ex}\n`
          })
        }
        return text
      })
      .join('\n')

    const serviceName = useHuggingFace ? 'Hugging Face' : useLMStudio ? 'LM Studio' : 'OpenAI'
    console.log(`\n🤖 Sending ${successfulScrapes.length} words to ${serviceName} for batch processing...`)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (useHuggingFace || (!useLMStudio && apiKey)) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const systemPrompt = `You are an intelligent dictionary assistant processing MULTIPLE words.

Return ONLY a valid JSON array with this exact structure:
[
  {
    "word": "the word",
    "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
    "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "meaning_primary": "the actual contextual meaning or definition",
    "usage_tips": "example sentence showing real-world usage"
  }
]

Rules:
- Return a JSON ARRAY with one object per word
- For part_of_speech: convert to lowercase full word (e.g., "noun" not "n.")
- For cefr_level: estimate based on word complexity if not provided
- For meaning_primary: if the definition is "past tense/participle of X", provide the actual contextual meaning instead
- For usage_tips: use a scraped example or write a practical sentence
- Return ONLY the JSON array, no markdown code blocks or additional text
- Process ALL words provided`

    const userPrompt = `Here is the dictionary data for ${successfulScrapes.length} words:\n${batchScrapedData}\n\nConvert ALL of these to the required JSON array format.`

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

      // Fallback: return scraped data without AI processing
      const fallbackResults = successfulScrapes.map((data: any) => ({
        word: data.word,
        part_of_speech: data.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: truncateDefinition(data.definition || ''),
        usage_tips: data.examples?.[0] || '',
      }))

      return NextResponse.json({
        success: true,
        data: fallbackResults,
        source: 'Free Dictionary (AI unavailable)',
        processed: fallbackResults.length,
        total: words.length,
      })
    }

    const data = await response.json()

    let content: string
    if (useHuggingFace) {
      content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text
    } else {
      content = data.choices[0]?.message?.content
    }

    if (!content) {
      const fallbackResults = successfulScrapes.map((data: any) => ({
        word: data.word,
        part_of_speech: data.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: truncateDefinition(data.definition || ''),
        usage_tips: data.examples?.[0] || '',
      }))

      return NextResponse.json({
        success: true,
        data: fallbackResults,
        source: 'Free Dictionary (fallback)',
        processed: fallbackResults.length,
        total: words.length,
      })
    }

    console.log('🤖 AI processed batch response received')

    let processedData
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      processedData = JSON.parse(cleanContent)
      if (!Array.isArray(processedData)) throw new Error('Response is not an array')
    } catch {
      console.error('Failed to parse AI response, using scraped data as fallback')
      processedData = successfulScrapes.map((data: any) => ({
        word: data.word,
        part_of_speech: data.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: truncateDefinition(data.definition || ''),
        usage_tips: data.examples?.[0] || '',
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

    console.log(`✅ Successfully processed ${finalResults.length} words\n`)
    console.log('='.repeat(70))

    return NextResponse.json({
      success: true,
      data: finalResults,
      source: 'Free Dictionary + AI Batch Processing',
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
