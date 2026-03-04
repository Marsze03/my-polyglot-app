/**
 * Urban Dictionary scraper for slang, jargon, and colloquial terms
 * Useful for words like "cramming" that have specialized contextual meanings
 */

export interface UrbanDictionaryData {
  word: string
  definition?: string
  examples?: string[]
  upvotes?: number
  found: boolean
}

/**
 * Fetches definition from Urban Dictionary API
 * @param word - The word to look up
 * @returns Scraped data from Urban Dictionary
 */
export async function scrapeUrbanDictionary(word: string): Promise<UrbanDictionaryData> {
  const result: UrbanDictionaryData = {
    word,
    found: false,
  }

  try {
    // Urban Dictionary API endpoint
    const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word.toLowerCase())}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.log(`Urban Dictionary API returned status ${response.status} for word: ${word}`)
      return result
    }

    const data = await response.json()
    
    if (data.list && Array.isArray(data.list) && data.list.length > 0) {
      // Sort by thumbs_up (upvotes) to get the most popular definition
      const sortedDefs = data.list.sort((a: any, b: any) => b.thumbs_up - a.thumbs_up)
      const topDef = sortedDefs[0]
      
      result.found = true
      result.definition = cleanUrbanDictionaryText(topDef.definition)
      result.upvotes = topDef.thumbs_up || 0
      
      // Get example if available
      if (topDef.example) {
        result.examples = [cleanUrbanDictionaryText(topDef.example)]
      }
      
      console.log(`✅ Urban Dictionary: Found definition with ${result.upvotes} upvotes`)
    }

  } catch (error) {
    console.error('Error fetching from Urban Dictionary:', error)
  }

  return result
}

/**
 * Cleans Urban Dictionary text by removing brackets and unnecessary formatting
 * @param text - Raw text from Urban Dictionary
 * @returns Cleaned text
 */
function cleanUrbanDictionaryText(text: string): string {
  if (!text) return ''
  
  // Remove [brackets] used for internal links
  return text
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Formats Urban Dictionary data for display
 * @param data - The scraped Urban Dictionary data
 * @returns Formatted string
 */
export function formatUrbanDictionaryData(data: UrbanDictionaryData): string {
  if (!data.found) {
    return `No entry found for "${data.word}" in Urban Dictionary.`
  }

  let formatted = `Word: ${data.word}\n`
  formatted += `Source: Urban Dictionary\n`
  
  if (data.definition) {
    formatted += `Definition: ${data.definition}\n`
  }
  
  if (data.upvotes) {
    formatted += `Community Rating: ${data.upvotes} upvotes\n`
  }
  
  if (data.examples && data.examples.length > 0) {
    formatted += `Example: ${data.examples[0]}\n`
  }
  
  return formatted
}

/**
 * Checks if Urban Dictionary should be prioritized for this word
 * Useful for slang, jargon, and colloquial terms
 * @param word - The word to check
 * @returns true if Urban Dictionary might be more relevant
 */
export function shouldPrioritizeUrbanDictionary(word: string): boolean {
  // Check if it's a gerund (often has specialized meanings like "cramming")
  if (word.endsWith('ing')) return true
  
  // Check if it contains slang indicators
  const slangPatterns = [
    /\d/, // Contains numbers (like "l33t", "420")
    /^(lol|omg|btw|fyi|tbh|imho|rofl|smh)/i, // Common internet slang
  ]
  
  return slangPatterns.some(pattern => pattern.test(word))
}
