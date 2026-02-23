import { NextRequest, NextResponse } from 'next/server'
import { scrapeCambridgeDictionary, formatCambridgeData } from '@/lib/cambridge-scraper'
import { scrapeOxfordDictionary, formatOxfordData } from '@/lib/oxford-scraper'

export async function POST(request: NextRequest) {
  try {
    const { words } = await request.json()
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words array is required' }, { status: 400 })
    }

    console.log(`\n${'='.repeat(70)}`)
    console.log(`🚀 Starting batch dictionary fetch for ${words.length} words`)
    console.log('='.repeat(70))

    // Step 1: Scrape both Cambridge and Oxford dictionaries for all words
    const scrapedResults = []
    for (const word of words) {
      console.log(`\n📖 [${scrapedResults.length + 1}/${words.length}] Searching: ${word}`)
      
      try {
        // Try both dictionaries in parallel
        const [cambridgeData, oxfordData] = await Promise.all([
          scrapeCambridgeDictionary(word),
          scrapeOxfordDictionary(word)
        ])
        
        // Determine which source to use
        let finalData, source
        
        if (cambridgeData.found && oxfordData.found) {
          console.log(`  ✅ Found in both - Using Cambridge`)
          finalData = cambridgeData
          source = 'Cambridge & Oxford'
          // Fill missing CEFR from Oxford if needed
          if (!finalData.cefrLevel && oxfordData.cefrLevel) {
            finalData.cefrLevel = oxfordData.cefrLevel
          }
        } else if (cambridgeData.found) {
          console.log(`  ✅ Found in Cambridge`)
          finalData = cambridgeData
          source = 'Cambridge'
        } else if (oxfordData.found) {
          console.log(`  ✅ Found in Oxford`)
          finalData = oxfordData
          source = 'Oxford'
        } else {
          console.log(`  ❌ Not found in either dictionary`)
          scrapedResults.push({ word, found: false, error: 'Not found' })
          continue
        }
        
        console.log(`     ${finalData.partOfSpeech || 'unknown'} - ${finalData.definition?.substring(0, 50)}...`)
        scrapedResults.push({ ...finalData, source })
        
      } catch (error) {
        console.log(`  ❌ Error scraping: ${error instanceof Error ? error.message : 'Unknown error'}`)
        scrapedResults.push({ word, found: false, error: 'Scraping failed' })
      }
      
      // Small delay to be polite to dictionary servers
      await new Promise(resolve => setTimeout(resolve, 400))
    }

    const successfulScrapes = scrapedResults.filter(r => r.found)
    console.log(`\n📊 Scraped ${successfulScrapes.length}/${words.length} words successfully`)

    if (successfulScrapes.length === 0) {
      return NextResponse.json({ 
        error: 'No words found in Cambridge or Oxford Dictionary',
        results: scrapedResults.map(r => ({ word: r.word, error: r.error || 'Not found' }))
      }, { status: 404 })
    }

    // Step 2: Use AI to process all scraped data in one batch
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

    // Prepare batch data for AI - handle both Cambridge and Oxford formats
    const batchScrapedData = successfulScrapes.map((data, index) => {
      const source = (data as any).source || 'Cambridge'
      const formattedData = source.includes('Oxford') && !source.includes('Cambridge')
        ? formatOxfordData(data)
        : formatCambridgeData(data)
      return `\n--- Word ${index + 1}: ${data.word} (from ${source}) ---\n${formattedData}`
    }).join('\n')

    const serviceName = useHuggingFace ? 'Hugging Face' : (useLMStudio ? 'LM Studio' : 'OpenAI')
    console.log(`\n🤖 Sending ${successfulScrapes.length} words to ${serviceName} for batch processing...`)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (useHuggingFace || (!useLMStudio && apiKey)) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Prepare prompts
    const systemPrompt = `You are a dictionary data processor. You receive scraped data for MULTIPLE words from Cambridge and/or Oxford Dictionary and must convert ALL of them to structured JSON format.

Return ONLY a valid JSON array with this exact structure:
[
  {
    "word": "the word",
    "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
    "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "meaning_primary": "the primary definition",
    "usage_tips": "example sentence in quotes"
  },
  ... (more words)
]

CRITICAL Rules:
- Return a JSON ARRAY with one object per word
- Use the EXACT data from the Cambridge Dictionary scrape provided
- For part_of_speech: convert to lowercase full word (e.g., "noun" not "n.")
- For cefr_level: use the exact level if provided, otherwise estimate: basic words (A1-A2), common words (B1-B2), advanced words (C1-C2)
- For meaning_primary: use the first definition exactly as scraped
- For usage_tips: use the first example sentence from the scraped data
- Return ONLY the JSON array, no markdown code blocks or additional text
- Process ALL words provided`
    
    const userPrompt = `Here is the data scraped from Cambridge Dictionary for ${successfulScrapes.length} words:\n${batchScrapedData}\n\nConvert ALL of these words to the required JSON array format.`

    let requestBody: any
    
    if (useHuggingFace) {
      // Hugging Face uses a simpler text-to-text format
      requestBody = {
        inputs: `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`,
        parameters: {
          max_new_tokens: 3000,
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
        max_tokens: 3000 // Increased for batch processing
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
      
      // Fallback: use scraped data directly
      console.log('📝 Using scraped data as fallback (no AI processing)')
      const fallbackResults = successfulScrapes.map(data => ({
        word: data.word,
        part_of_speech: (data as any).partOfSpeech || '',
        cefr_level: (data as any).cefrLevel || 'n.a.',
        meaning_primary: (data as any).definition || '',
        usage_tips: (data as any).examples?.[0] || ''
      }))
      
      return NextResponse.json({
        success: true,
        data: fallbackResults,
        source: 'Cambridge Dictionary (AI unavailable)',
        processed: fallbackResults.length,
        total: words.length
      })
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
      console.error('❌ No response from AI')
      // Fallback
      const fallbackResults = successfulScrapes.map(data => ({
        word: data.word,
        part_of_speech: (data as any).partOfSpeech || '',
        cefr_level: (data as any).cefrLevel || 'n.a.',
        meaning_primary: (data as any).definition || '',
        usage_tips: (data as any).examples?.[0] || ''
      }))
      
      return NextResponse.json({
        success: true,
        data: fallbackResults,
        source: 'Cambridge Dictionary (fallback)',
        processed: fallbackResults.length,
        total: words.length
      })
    }

    console.log('🤖 AI processed batch response received')

    // Parse the JSON array response
    let processedData
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      processedData = JSON.parse(cleanContent)
      
      if (!Array.isArray(processedData)) {
        throw new Error('Response is not an array')
      }
    } catch (parseError) {
      console.error('Failed to parse AI response, using scraped data as fallback')
      processedData = successfulScrapes.map(data => ({
        word: data.word,
        part_of_speech: (data as any).partOfSpeech || '',
        cefr_level: (data as any).cefrLevel || 'n.a.',
        meaning_primary: (data as any).definition || '',
        usage_tips: (data as any).examples?.[0] || ''
      }))
    }

    // Validate and ensure all words are present
    const finalResults = processedData.map((item: any) => {
      // Find original scraped data for this word
      const scraped: any = successfulScrapes.find(s => s.word.toLowerCase() === item.word?.toLowerCase())
      
      return {
        word: item.word || scraped?.word || '',
        part_of_speech: item.part_of_speech || scraped?.partOfSpeech || '',
        cefr_level: item.cefr_level || scraped?.cefrLevel || 'n.a.',
        meaning_primary: item.meaning_primary || scraped?.definition || '',
        usage_tips: item.usage_tips || scraped?.examples?.[0] || ''
      }
    })

    console.log(`✅ Successfully processed ${finalResults.length} words\n`)
    console.log('='.repeat(70))

    return NextResponse.json({
      success: true,
      data: finalResults,
      source: 'Cambridge Dictionary + AI Batch Processing',
      processed: finalResults.length,
      total: words.length,
      failed: scrapedResults.filter(r => !r.found).map(r => r.word)
    })

  } catch (error) {
    console.error('❌ Batch dictionary fetch error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch dictionary data' 
    }, { status: 500 })
  }
}
