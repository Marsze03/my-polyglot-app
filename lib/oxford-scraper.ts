import * as cheerio from 'cheerio'

export interface OxfordData {
  word: string
  partOfSpeech?: string
  cefrLevel?: string
  definition?: string
  examples?: string[]
  pronunciation?: string
  found: boolean
}

/**
 * Scrapes vocabulary information from Oxford Learner's Dictionary
 * @param word - The word to look up
 * @returns Scraped data from Oxford Dictionary
 */
export async function scrapeOxfordDictionary(word: string): Promise<OxfordData> {
  const result: OxfordData = {
    word,
    found: false,
  }

  try {
    // Oxford Learner's Dictionary URL
    const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.toLowerCase())}`
    
    // Fetch the page with proper headers to avoid blocks
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`Oxford Dictionary returned status ${response.status} for word: ${word}`)
      return result
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Check if word was found
    const entryContent = $('.entry').first()
    if (entryContent.length === 0) {
      console.log(`No entry found in Oxford Dictionary for word: ${word}`)
      return result
    }

    result.found = true

    // Extract part of speech (noun, verb, adjective, etc.)
    const posElement = $('.pos').first()
    if (posElement.length > 0) {
      result.partOfSpeech = posElement.text().trim()
    }

    // Extract CEFR level (A1, A2, B1, B2, C1, C2)
    const cefrElement = $('.symbols .pos-icon').first()
    if (cefrElement.length > 0) {
      const cefrText = cefrElement.attr('class') || ''
      const cefrMatch = cefrText.match(/ox-([abc][12])/i)
      if (cefrMatch) {
        result.cefrLevel = cefrMatch[1].toUpperCase()
      }
    }
    
    // Alternative CEFR extraction
    if (!result.cefrLevel) {
      const headerSymbols = $('.top-container .symbols').first()
      const symbolsText = headerSymbols.text().trim()
      const cefrMatch = symbolsText.match(/([ABC][12])/i)
      if (cefrMatch) {
        result.cefrLevel = cefrMatch[1].toUpperCase()
      }
    }

    // Extract the first definition
    const defElement = $('.def').first()
    if (defElement.length > 0) {
      result.definition = defElement.text().trim()
    }

    // Extract example sentences
    const examples: string[] = []
    $('.examples .x').each((i, elem) => {
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

    // Extract pronunciation (IPA) - both US and UK
    const phonElement = $('.phon').first()
    if (phonElement.length > 0) {
      result.pronunciation = phonElement.text().trim()
    }

  } catch (error) {
    console.error('Error scraping Oxford Dictionary:', error)
  }

  return result
}

/**
 * Formats Oxford Dictionary data for AI processing
 * @param data - The scraped Oxford Dictionary data
 * @returns Formatted string for AI
 */
export function formatOxfordData(data: OxfordData): string {
  let formatted = `Word: ${data.word}\n`
  
  if (data.partOfSpeech) {
    formatted += `Part of Speech: ${data.partOfSpeech}\n`
  }
  
  if (data.cefrLevel) {
    formatted += `CEFR Level: ${data.cefrLevel}\n`
  }
  
  if (data.pronunciation) {
    formatted += `Pronunciation: ${data.pronunciation}\n`
  }
  
  if (data.definition) {
    formatted += `Definition: ${data.definition}\n`
  }
  
  if (data.examples && data.examples.length > 0) {
    formatted += `Examples:\n`
    data.examples.forEach((ex, i) => {
      formatted += `  ${i + 1}. ${ex}\n`
    })
  }
  
  return formatted
}
