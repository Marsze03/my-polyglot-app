import { NextRequest, NextResponse } from 'next/server'
import { scrapeCambridgeDictionary, formatCambridgeData } from '@/lib/cambridge-scraper'
import { scrapeOxfordDictionary, formatOxfordData } from '@/lib/oxford-scraper'

export async function POST(request: NextRequest) {
  try {
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
    const useLMStudio = process.env.USE_LM_STUDIO === 'true'
    const apiUrl = useLMStudio 
      ? (process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions')
      : 'https://api.openai.com/v1/chat/completions'
    
    const apiKey = process.env.OPENAI_API_KEY || 'lm-studio' // LM Studio doesn't require a real key
    const model = useLMStudio 
      ? (process.env.LM_STUDIO_MODEL || 'local-model') // LM Studio uses loaded model
      : 'gpt-4o-mini'

    if (!useLMStudio && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file or set USE_LM_STUDIO=true' 
      }, { status: 500 })
    }

    // Call AI API to structure the scraped information
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Only add Authorization header if not using LM Studio or if LM Studio has auth
    if (!useLMStudio || process.env.OPENAI_API_KEY) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    console.log(`🤖 Sending to ${useLMStudio ? 'LM Studio' : 'OpenAI'} for processing...`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a dictionary data processor. You receive scraped data from Cambridge Dictionary and must convert it to a structured JSON format.

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
          },
          {
            role: 'user',
            content: `Here is the data scraped from a dictionary:\n\n${scrapedDataText}\n\nConvert this to the required JSON format.`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error(`❌ ${useLMStudio ? 'LM Studio' : 'OpenAI'} Error:`, errorData)
      return NextResponse.json({ 
        error: `Failed to process dictionary data with AI${useLMStudio ? ' (LM Studio)' : ''}. Is the server running?` 
      }, { status: response.status })
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

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
