import * as cheerio from 'cheerio'

export interface GoogleTranslateData {
  word: string
  partOfSpeech?: string
  definition?: string
  examples?: string[]
  synonyms?: string[]
  found: boolean
}

/**
 * Scrapes vocabulary information from Google Translate
 * @param word - The word to look up
 * @returns Scraped data from Google Translate
 */
export async function scrapeGoogleTranslate(word: string): Promise<GoogleTranslateData> {
  const result: GoogleTranslateData = {
    word,
    found: false,
  }

  try {
    // Google Translate URL with dictionary features
    const url = `https://translate.google.com/details?sl=en&tl=en&text=${encodeURIComponent(word.toLowerCase())}&op=translate`
    
    // Fetch the page with proper headers to avoid blocks
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`Google Translate returned status ${response.status} for word: ${word}`)
      // Try alternative approach using the main translate page
      return await scrapeGoogleTranslateAlternative(word)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Google Translate provides definitions in their details page
    // Extract definition
    const definitionElement = $('[data-phrase-index="0"] .fw3bVc').first()
    if (definitionElement.length > 0) {
      result.definition = definitionElement.text().trim()
      result.found = true
    }

    // Extract part of speech
    const posElement = $('[data-phrase-index="0"] .YrbPuc').first()
    if (posElement.length > 0) {
      result.partOfSpeech = posElement.text().trim()
    }

    // Extract examples
    const examples: string[] = []
    $('[data-phrase-index="0"] .AZAKKf').each((i, elem) => {
      if (i < 2) { // Limit to 2 examples
        const exampleText = $(elem).text().trim()
        if (exampleText) {
          examples.push(exampleText)
        }
      }
    })
    if (examples.length > 0) {
      result.examples = examples
    }

    // If no data found, try alternative method
    if (!result.found) {
      return await scrapeGoogleTranslateAlternative(word)
    }

  } catch (error) {
    console.error('Error scraping Google Translate:', error)
    // Try alternative method on error
    try {
      return await scrapeGoogleTranslateAlternative(word)
    } catch (altError) {
      console.error('Alternative Google Translate scraping also failed:', altError)
    }
  }

  return result
}

/**
 * Alternative method: Use Google's Dictionary API endpoint
 */
async function scrapeGoogleTranslateAlternative(word: string): Promise<GoogleTranslateData> {
  const result: GoogleTranslateData = {
    word,
    found: false,
  }

  try {
    // Use the free Dictionary API as an alternative
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.log(`Dictionary API returned status ${response.status} for word: ${word}`)
      return result
    }

    const data = await response.json()
    
    if (Array.isArray(data) && data.length > 0) {
      const entry = data[0]
      
      // Get first meaning
      if (entry.meanings && entry.meanings.length > 0) {
        const meaning = entry.meanings[0]
        
        result.found = true
        result.partOfSpeech = meaning.partOfSpeech
        
        // Get first definition
        if (meaning.definitions && meaning.definitions.length > 0) {
          result.definition = meaning.definitions[0].definition
          
          // Get example if available
          if (meaning.definitions[0].example) {
            result.examples = [meaning.definitions[0].example]
          }
          
          // Get synonyms if available
          if (meaning.definitions[0].synonyms && meaning.definitions[0].synonyms.length > 0) {
            result.synonyms = meaning.definitions[0].synonyms.slice(0, 3)
          }
        }
      }
    }

  } catch (error) {
    console.error('Error with Dictionary API:', error)
  }

  return result
}

/**
 * Formats Google Translate data for AI processing
 * @param data - The scraped Google Translate data
 * @returns Formatted string for AI
 */
export function formatGoogleTranslateData(data: GoogleTranslateData): string {
  if (!data.found) {
    return `No entry found for "${data.word}" in Google Translate/Dictionary API.`
  }

  let formatted = `Word: ${data.word}\n`
  
  if (data.partOfSpeech) {
    formatted += `Part of Speech: ${data.partOfSpeech}\n`
  }
  
  if (data.definition) {
    formatted += `Definition: ${data.definition}\n`
  }
  
  if (data.synonyms && data.synonyms.length > 0) {
    formatted += `Synonyms: ${data.synonyms.join(', ')}\n`
  }
  
  if (data.examples && data.examples.length > 0) {
    formatted += `Examples:\n`
    data.examples.forEach((ex, i) => {
      formatted += `  ${i + 1}. ${ex}\n`
    })
  }
  
  return formatted
}
