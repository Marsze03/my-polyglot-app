import { NextRequest, NextResponse } from 'next/server'
import { geminiLookup } from '@/lib/gemini-dictionary'
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
    const rateLimit = checkRateLimit(clientId, { maxRequests: 30, windowMs: 60000 })

    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${resetIn} seconds.` },
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

    const { word } = await request.json()
    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    // --- PATH 1: Gemini (primary) → Free Dictionary + AI (fallback) ---
    // Gemini searches Cambridge/Oxford/Google Translate via Google Search grounding.
    // If Gemini fails or is rate-limited, falls back to Free Dictionary + HuggingFace/LM Studio/OpenAI.
    if (process.env.USE_GEMINI?.trim() === 'true') {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: 'GEMINI_API_KEY is not configured in environment variables.' },
          { status: 500 }
        )
      }

      console.log(`📖 [Gemini] Looking up: ${word}`)
      try {
        const result = await geminiLookup(word)
        if (result.found) {
          console.log(`✅ [Gemini] Found: ${word}`)
          return NextResponse.json({
            success: true,
            data: {
              part_of_speech: result.part_of_speech,
              cefr_level: result.cefr_level,
              meaning_primary: result.meaning_primary,
              usage_tips: result.usage_tips,
            },
            source: 'Cambridge/Oxford via Gemini Search',
          })
        }
        console.log(`⚠️ [Gemini] "${word}" not found — falling back to secondary sources`)
      } catch (err) {
        console.log(`⚠️ [Gemini] Failed (${err instanceof Error ? err.message : err}) — falling back to secondary sources`)
      }
    }

    // --- PATH 2: Free Dictionary API + AI processing (standalone or fallback) ---
    console.log(`📖 Searching dictionaries for: ${word}`)

    let dictionaryData: any = null
    let source = ''

    console.log(`   Trying Free Dictionary API...`)
    const freeData = await scrapeFreeDictionary(word)
    if (freeData.found && freeData.definition) {
      console.log(`   ✅ Found in Free Dictionary API`)
      dictionaryData = freeData
      source = 'Free Dictionary'
    }

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
      return NextResponse.json(
        { error: `Word "${word}" not found in any dictionary` },
        { status: 404 }
      )
    }

    let scrapedDataText = `Word: ${word}\nSource: ${source}\n`
    if (dictionaryData.pronunciation) scrapedDataText += `Pronunciation: ${dictionaryData.pronunciation}\n`
    if (dictionaryData.partOfSpeech) scrapedDataText += `Part of Speech: ${dictionaryData.partOfSpeech}\n`
    scrapedDataText += `Definition: ${dictionaryData.definition}\n`
    if (dictionaryData.examples?.length) {
      scrapedDataText += `Examples:\n`
      dictionaryData.examples.forEach((ex: string, i: number) => {
        scrapedDataText += `  ${i + 1}. ${ex}\n`
      })
    }

    console.log(`✅ Dictionary data from ${source}:`, dictionaryData)

    const cleanEnv = (v?: string) => (v || '').replace(/^﻿/, '').replace(/\r?\n/g, '').trim()
    const useHuggingFace = cleanEnv(process.env.USE_HUGGINGFACE) === 'true'
    const useLMStudio = cleanEnv(process.env.USE_LM_STUDIO) === 'true'

    let apiUrl: string
    let apiKey: string
    let model: string

    if (useHuggingFace) {
      model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct'
      apiUrl = `https://api-inference.huggingface.co/models/${model}`
      apiKey = cleanEnv(process.env.HUGGINGFACE_API_KEY)
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
      apiKey = cleanEnv(process.env.OPENAI_API_KEY)
      model = 'gpt-4o-mini'
      if (!apiKey) {
        return NextResponse.json(
          { error: 'No AI backend configured. Set USE_GEMINI=true, USE_LM_STUDIO=true, USE_HUGGINGFACE=true, or OPENAI_API_KEY.' },
          { status: 500 }
        )
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (useHuggingFace || (!useLMStudio && apiKey)) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const serviceName = useHuggingFace ? 'Hugging Face' : useLMStudio ? 'LM Studio' : 'OpenAI'
    console.log(`🤖 Sending to ${serviceName} for processing...`)

    const systemPrompt = `You are a dictionary assistant. Return ONLY a valid JSON object:
{
  "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
  "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "meaning_primary": "the primary definition",
  "usage_tips": "one example sentence"
}
Estimate cefr_level if not provided. Return ONLY the JSON, no markdown.`

    const userPrompt = `Dictionary data:\n\n${scrapedDataText}\n\nConvert to the required JSON format.`

    let requestBody: any
    if (useHuggingFace) {
      requestBody = {
        inputs: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
        parameters: { max_new_tokens: 500, temperature: 0.2, return_full_text: false },
      }
    } else {
      requestBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
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
      return NextResponse.json(
        { error: `Failed to process with ${serviceName}.` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content: string = useHuggingFace
      ? (Array.isArray(data) ? data[0]?.generated_text : data.generated_text)
      : data.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let processedData
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      processedData = JSON.parse(cleanContent)
    } catch {
      processedData = {
        part_of_speech: dictionaryData.partOfSpeech || '',
        cefr_level: 'n.a.',
        meaning_primary: dictionaryData.definition || '',
        usage_tips: dictionaryData.examples?.[0] || '',
      }
    }

    if (!processedData.part_of_speech || !processedData.meaning_primary) {
      processedData = {
        part_of_speech: dictionaryData.partOfSpeech || processedData.part_of_speech || '',
        cefr_level: processedData.cefr_level || 'n.a.',
        meaning_primary: dictionaryData.definition || processedData.meaning_primary || '',
        usage_tips: dictionaryData.examples?.[0] || processedData.usage_tips || '',
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        part_of_speech: processedData.part_of_speech || '',
        cefr_level: processedData.cefr_level || 'n.a.',
        meaning_primary: truncateDefinition(processedData.meaning_primary || ''),
        usage_tips: processedData.usage_tips || '',
      },
      source: source + ` + ${serviceName}`,
    })
  } catch (error) {
    console.error('❌ Dictionary fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dictionary data' },
      { status: 500 }
    )
  }
}
