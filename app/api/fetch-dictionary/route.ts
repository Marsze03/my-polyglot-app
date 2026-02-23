import { NextRequest, NextResponse } from 'next/server'
import { scrapeCambridgeDictionary, formatCambridgeData } from '@/lib/cambridge-scraper'
import { scrapeOxfordDictionary, formatOxfordData } from '@/lib/oxford-scraper'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter'

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

    // Try both dictionaries in parallel for faster results
    console.log(`📖 Searching both Cambridge and Oxford Dictionaries for: ${word}`)
    
    const [cambridgeData, oxfordData] = await Promise.all([
      scrapeCambridgeDictionary(word),
      scrapeOxfordDictionary(word)
    ])
    
    // Determine which source to use (prefer the one that found the word)
    let dictionaryData, scrapedDataText, source
    
    if (cambridgeData.found && oxfordData.found) {
      // Both found - use Cambridge as primary, Oxford as fallback for missing data
      console.log('✅ Found in both dictionaries, using Cambridge as primary')
      dictionaryData = cambridgeData
      scrapedDataText = formatCambridgeData(cambridgeData)
      source = 'Cambridge Dictionary'
      
      // Fill in missing data from Oxford if available
      if (!dictionaryData.cefrLevel && oxfordData.cefrLevel) {
        dictionaryData.cefrLevel = oxfordData.cefrLevel
        scrapedDataText += `\n(CEFR level from Oxford: ${oxfordData.cefrLevel})`
        source = 'Cambridge & Oxford Dictionaries'
      }
    } else if (cambridgeData.found) {
      console.log('✅ Found in Cambridge Dictionary only')
      dictionaryData = cambridgeData
      scrapedDataText = formatCambridgeData(cambridgeData)
      source = 'Cambridge Dictionary'
    } else if (oxfordData.found) {
      console.log('✅ Found in Oxford Dictionary only')
      dictionaryData = oxfordData
      scrapedDataText = formatOxfordData(oxfordData)
      source = 'Oxford Dictionary'
    } else {
      return NextResponse.json({ 
        error: `Word "${word}" not found in Cambridge or Oxford Dictionary. Please check spelling.` 
      }, { status: 404 })
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

    // Prepare the prompt content
    const systemPrompt = `You are a dictionary data processor. You receive scraped data from Cambridge Dictionary and must convert it to a structured JSON format.

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
        meaning_primary: processedData.meaning_primary || '',
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
