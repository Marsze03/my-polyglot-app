import { NextRequest, NextResponse } from 'next/server'
import { scrapeCambridgeDictionary, formatCambridgeData } from '@/lib/cambridge-scraper'
import { scrapeOxfordDictionary, formatOxfordData } from '@/lib/oxford-scraper'
import { scrapeGoogleTranslate, formatGoogleTranslateData } from '@/lib/google-translate-scraper'
import { scrapeUrbanDictionary, formatUrbanDictionaryData, shouldPrioritizeUrbanDictionary } from '@/lib/urban-dictionary-scraper'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter'
import { mergeDefinitionSources, type DefinitionSource } from '@/lib/definition-ranker'

// Helper function to truncate definition to max 20 words
function truncateDefinition(text: string, maxWords: number = 20): string {
  if (!text) return text
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '...'
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 30 requests per minute per IP
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
            'Retry-After': resetIn.toString()
          }
        }
      )
    }
    
    const { word } = await request.json()
    
    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    // Try all four dictionaries in parallel for faster results
    console.log(`📖 Searching Cambridge, Oxford, Google, and Urban Dictionary for: ${word}`)
    
    const [cambridgeData, oxfordData, googleData, urbanData] = await Promise.all([
      scrapeCambridgeDictionary(word),
      scrapeOxfordDictionary(word),
      scrapeGoogleTranslate(word),
      scrapeUrbanDictionary(word)
    ])
    
    // Prepare sources for ranking
    const sources: DefinitionSource[] = []
    
    if (cambridgeData.found && cambridgeData.definition) {
      sources.push({
        source: 'Cambridge Dictionary',
        definition: cambridgeData.definition,
        partOfSpeech: cambridgeData.partOfSpeech,
        examples: cambridgeData.examples,
        cefrLevel: cambridgeData.cefrLevel,
        pronunciation: cambridgeData.pronunciation,
      })
    }
    
    if (oxfordData.found && oxfordData.definition) {
      sources.push({
        source: 'Oxford Dictionary',
        definition: oxfordData.definition,
        partOfSpeech: oxfordData.partOfSpeech,
        examples: oxfordData.examples,
        cefrLevel: oxfordData.cefrLevel,
        pronunciation: oxfordData.pronunciation,
      })
    }
    
    if (googleData.found && googleData.definition) {
      sources.push({
        source: 'Google Translate/Dictionary API',
        definition: googleData.definition,
        partOfSpeech: googleData.partOfSpeech,
        examples: googleData.examples,
      })
    }
    
    // Urban Dictionary can be particularly valuable for jargon and colloquial terms
    if (urbanData.found && urbanData.definition) {
      sources.push({
        source: 'Urban Dictionary',
        definition: urbanData.definition,
        partOfSpeech: 'informal',
        examples: urbanData.examples,
      })
    }
    
    // Check if we found the word in at least one source
    if (sources.length === 0) {
      return NextResponse.json({ 
        error: `Word "${word}" not found in any dictionary. Please check spelling.` 
      }, { status: 404 })
    }
    
    // Use the definition ranker to select the best definition
    console.log(`✅ Found in ${sources.length} source(s), selecting best definition...`)
    const mergedData = mergeDefinitionSources(sources)
    
    // Prepare data for AI processing
    let scrapedDataText = `Word: ${word}\n`
    scrapedDataText += `Source: ${mergedData.source}\n`
    if (mergedData.pronunciation) {
      scrapedDataText += `Pronunciation: ${mergedData.pronunciation}\n`
    }
    if (mergedData.partOfSpeech) {
      scrapedDataText += `Part of Speech: ${mergedData.partOfSpeech}\n`
    }
    if (mergedData.cefrLevel) {
      scrapedDataText += `CEFR Level: ${mergedData.cefrLevel}\n`
    }
    scrapedDataText += `Definition: ${mergedData.definition}\n`
    if (mergedData.examples && mergedData.examples.length > 0) {
      scrapedDataText += `Examples:\n`
      mergedData.examples.forEach((ex, i) => {
        scrapedDataText += `  ${i + 1}. ${ex}\n`
      })
    }
    
    const source = mergedData.source
    const dictionaryData = {
      word,
      partOfSpeech: mergedData.partOfSpeech,
      cefrLevel: mergedData.cefrLevel,
      definition: mergedData.definition,
      examples: mergedData.examples,
      pronunciation: mergedData.pronunciation,
      found: true,
    }

    console.log(`✅ Dictionary data from ${source}:`, dictionaryData)
    
    // Determine which AI service to use
    const useHuggingFace = process.env.USE_HUGGINGFACE === 'true'
    const useLMStudio = process.env.USE_LM_STUDIO === 'true'
    
    let apiUrl: string
    let apiKey: string
    let model: string
    
    if (useHuggingFace) {
      // Hugging Face Inference API
      model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.2-3B-Instruct'
      apiUrl = `https://api-inference.huggingface.co/models/${model}`
      apiKey = process.env.HUGGINGFACE_API_KEY || ''
      if (!apiKey) {
        return NextResponse.json({ 
          error: 'Hugging Face API key not configured. Please add HUGGINGFACE_API_KEY to your .env.local file' 
        }, { status: 500 })
      }
    } else if (useLMStudio) {
      // LM Studio (local)
      apiUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions'
      apiKey = 'lm-studio'
      model = process.env.LM_STUDIO_MODEL || 'local-model'
    } else {
      // OpenAI
      apiUrl = 'https://api.openai.com/v1/chat/completions'
      apiKey = process.env.OPENAI_API_KEY || ''
      model = 'gpt-4o-mini'
      if (!apiKey) {
        return NextResponse.json({ 
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file or set USE_LM_STUDIO=true or USE_HUGGINGFACE=true' 
        }, { status: 500 })
      }
    }

    // Call AI API to structure the scraped information
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Add Authorization header based on service
    if (useHuggingFace || (!useLMStudio && apiKey)) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const serviceName = useHuggingFace ? 'Hugging Face' : (useLMStudio ? 'LM Studio' : 'OpenAI')
    console.log(`🤖 Sending to ${serviceName} for processing...`)

    // Check if AI enhancement is needed (all sources gave low-quality definitions)
    const needsEnhancement = mergedData.needsAIEnhancement
    if (needsEnhancement) {
      console.log('⚡ AI Enhancement Mode: Will generate contextual definition')
    }

    // Prepare the prompt content based on whether enhancement is needed
    let systemPrompt: string
    
    if (needsEnhancement) {
      // Enhanced mode: AI should provide a more contextual, real-world definition
      systemPrompt = `You are an intelligent dictionary assistant. The word provided has only grammatical definitions (like "past tense of X") from standard dictionaries, but we need the actual CONTEXTUAL MEANING.

Your task: Provide the real-world, practical meaning of this word as it's commonly used.

Return ONLY a valid JSON object with this exact structure:
{
  "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
  "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "meaning_primary": "the actual contextual meaning (NOT just 'past tense of...')",
  "usage_tips": "a practical example sentence showing real-world usage"
}

CRITICAL RULES:
- DO NOT just say "past participle of X" or "present participle of X"
- Instead, explain what the word MEANS in practice
- For example, "cramming" should be explained as "studying intensively in a short time before an exam", NOT "present participle of cram"
- Focus on how the word is actually used in real life
- Estimate CEFR level based on word complexity and usage context
- Provide a realistic, natural example sentence
- Return ONLY the JSON object, no markdown code blocks or additional text

The dictionary data below may be incomplete or just show word forms. Use your knowledge to provide the REAL meaning.`
    } else {
      // Standard mode: Process dictionary data as usual
      systemPrompt = `You are a dictionary data processor. You receive scraped data from multiple dictionaries and must convert it to a structured JSON format.

Return ONLY a valid JSON object with this exact structure:
{
  "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
  "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "meaning_primary": "the primary definition",
  "usage_tips": "example sentence in quotes"
}

Rules:
- Use the EXACT data from the dictionary scrape provided
- For part_of_speech: convert to lowercase full word (e.g., "noun" not "n.")
- For cefr_level: use the exact level if provided, otherwise estimate based on word complexity
- For meaning_primary: use the first definition exactly as scraped
- For usage_tips: use the first example sentence from the scraped data, or create a brief usage note if no examples
- Return ONLY the JSON object, no markdown code blocks or additional text`
    }
    
    const userPrompt = `Here is the data scraped from a dictionary:\n\n${scrapedDataText}\n\nConvert this to the required JSON format.`

    let requestBody: any
    
    if (useHuggingFace) {
      // Hugging Face uses a simpler text-to-text format
      requestBody = {
        inputs: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.2,
          return_full_text: false
        }
      }
    } else {
      // OpenAI/LM Studio use chat completions format
      requestBody = {
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ ${serviceName} Error:`, errorData)
      return NextResponse.json({ 
        error: `Failed to process dictionary data with ${serviceName}${useHuggingFace ? '. Check your API key and model availability.' : useLMStudio ? '. Is the server running?' : ''}` 
      }, { status: response.status })
    }

    const data = await response.json()
    
    // Extract content based on API response format
    let content: string
    if (useHuggingFace) {
      // Hugging Face returns array or object with generated_text
      content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text
    } else {
      // OpenAI/LM Studio format
      content = data.choices[0]?.message?.content
    }

    if (!content) {
      return NextResponse.json({ 
        error: 'No response from AI' 
      }, { status: 500 })
    }

    console.log('🤖 AI processed response:', content)

    // Parse the JSON response
    let processedData
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      processedData = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      // Fallback: use the scraped data directly
      console.log('📝 Using scraped data as fallback')
      processedData = {
        part_of_speech: dictionaryData.partOfSpeech || '',
        cefr_level: dictionaryData.cefrLevel || 'n.a.',
        meaning_primary: dictionaryData.definition || '',
        usage_tips: dictionaryData.examples?.[0] || ''
      }
    }

    // Validate the response structure
    if (!processedData.part_of_speech || !processedData.meaning_primary) {
      console.log('⚠️ Incomplete AI response, using scraped data')
      processedData = {
        part_of_speech: dictionaryData.partOfSpeech || processedData.part_of_speech || '',
        cefr_level: dictionaryData.cefrLevel || processedData.cefr_level || 'n.a.',
        meaning_primary: dictionaryData.definition || processedData.meaning_primary || '',
        usage_tips: dictionaryData.examples?.[0] || processedData.usage_tips || ''
      }
    }

    console.log('✅ Final structured data:', processedData)

    return NextResponse.json({
      success: true,
      data: {
        part_of_speech: processedData.part_of_speech || '',
        cefr_level: processedData.cefr_level || 'n.a.',
        meaning_primary: truncateDefinition(processedData.meaning_primary || ''),
        usage_tips: processedData.usage_tips || ''
      },
      source: source + ' + AI Processing'
    })

  } catch (error) {
    console.error('❌ Dictionary fetch error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch dictionary data' 
    }, { status: 500 })
  }
}
