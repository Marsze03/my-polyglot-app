import * as cheerio from 'cheerio'

export interface CambridgeData {
  word: string
  partOfSpeech?: string
  cefrLevel?: string
  definition?: string
  examples?: string[]
  pronunciation?: string
  found: boolean
}

/**
 * Scrapes vocabulary information from Cambridge Dictionary
 * @param word - The word to look up
 * @returns Scraped data from Cambridge Dictionary
 */
export async function scrapeCambridgeDictionary(word: string): Promise<CambridgeData> {
  const result: CambridgeData = {
    word,
    found: false,
  }

  try {
    // Cambridge Dictionary URLs
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.toLowerCase())}`
    
    // Fetch the page with proper headers to avoid blocks
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`Cambridge Dictionary returned status ${response.status} for word: ${word}`)
      return result
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Check if word was found
    const entryBody = $('.entry-body').first()
    if (entryBody.length === 0) {
      console.log(`No entry found for word: ${word}`)
      return result
    }

    result.found = true

    // Extract part of speech (noun, verb, adjective, etc.)
    const posHeader = $('.pos-header').first()
    const posElement = posHeader.find('.pos').first()
    if (posElement.length > 0) {
      result.partOfSpeech = posElement.text().trim()
    }

    // Extract CEFR level (A1, A2, B1, B2, C1, C2)
    const cefrElement = posHeader.find('.epp-xref, .def-info .epp-xref').first()
    if (cefrElement.length > 0) {
      const cefrText = cefrElement.text().trim()
      const cefrMatch = cefrText.match(/([ABC][12])/i)
      if (cefrMatch) {
        result.cefrLevel = cefrMatch[1].toUpperCase()
      }
    }

    // Extract the first definition
    const defBlock = $('.def-block').first()
    const definition = defBlock.find('.def').first()
    if (definition.length > 0) {
      result.definition = definition.text().trim()
    }

    // Extract example sentences
    const examples: string[] = []
    defBlock.find('.examp').each((i, elem) => {
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

    // Extract pronunciation (IPA)
    const pronunciationElem = posHeader.find('.ipa').first()
    if (pronunciationElem.length > 0) {
      result.pronunciation = pronunciationElem.text().trim()
    }

  } catch (error) {
    console.error('Error scraping Cambridge Dictionary:', error)
  }

  return result
}

/**
 * Formats the scraped data for display
 */
export function formatCambridgeData(data: CambridgeData): string {
  if (!data.found) {
    return `No entry found for "${data.word}" in Cambridge Dictionary.`
  }

  let formatted = `Word: ${data.word}\n`
  
  if (data.pronunciation) {
    formatted += `Pronunciation: /${data.pronunciation}/\n`
  }
  
  if (data.partOfSpeech) {
    formatted += `Part of Speech: ${data.partOfSpeech}\n`
  }
  
  if (data.cefrLevel) {
    formatted += `CEFR Level: ${data.cefrLevel}\n`
  }
  
  if (data.definition) {
    formatted += `\nDefinition: ${data.definition}\n`
  }
  
  if (data.examples && data.examples.length > 0) {
    formatted += `\nExamples:\n`
    data.examples.forEach((example, i) => {
      formatted += `${i + 1}. ${example}\n`
    })
  }
  
  return formatted
}
