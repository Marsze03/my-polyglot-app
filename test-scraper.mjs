// Test script for Cambridge Dictionary scraper
import * as cheerio from 'cheerio'

async function scrapeCambridgeDictionary(word) {
  const result = {
    word,
    found: false,
  }

  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.toLowerCase())}`
    
    console.log(`  📡 Fetching: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`  ⚠️  Status ${response.status}`)
      return result
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const entryBody = $('.entry-body').first()
    if (entryBody.length === 0) {
      console.log(`  ❌ No entry found`)
      return result
    }

    result.found = true

    const posHeader = $('.pos-header').first()
    const posElement = posHeader.find('.pos').first()
    if (posElement.length > 0) {
      result.partOfSpeech = posElement.text().trim()
    }

    const cefrElement = posHeader.find('.epp-xref, .def-info .epp-xref').first()
    if (cefrElement.length > 0) {
      const cefrText = cefrElement.text().trim()
      const cefrMatch = cefrText.match(/([ABC][12])/i)
      if (cefrMatch) {
        result.cefrLevel = cefrMatch[1].toUpperCase()
      }
    }

    const defBlock = $('.def-block').first()
    const definition = defBlock.find('.def').first()
    if (definition.length > 0) {
      result.definition = definition.text().trim()
    }

    const examples = []
    defBlock.find('.examp').each((i, elem) => {
      if (i < 2) {
        const exampleText = $(elem).text().trim()
        if (exampleText) {
          examples.push(exampleText)
        }
      }
    })
    if (examples.length > 0) {
      result.examples = examples
    }

  } catch (error) {
    console.error('  ❌ Error:', error.message)
  }

  return result
}

async function testScraper() {
  console.log('🧪 Testing Cambridge Dictionary Scraper\n')
  
  const testWords = ['hello', 'ephemeral', 'serendipity']
  
  for (const word of testWords) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing word: "${word}"`)
    console.log('='.repeat(60))
    
    const result = await scrapeCambridgeDictionary(word)
    
    if (result.found) {
      console.log('  ✅ Word found!\n')
      console.log(`  Word: ${result.word}`)
      if (result.partOfSpeech) console.log(`  Part of Speech: ${result.partOfSpeech}`)
      if (result.cefrLevel) console.log(`  CEFR Level: ${result.cefrLevel}`)
      if (result.definition) console.log(`  Definition: ${result.definition}`)
      if (result.examples) {
        console.log(`  Examples:`)
        result.examples.forEach((ex, i) => console.log(`    ${i + 1}. ${ex}`))
      }
    } else {
      console.log('  ❌ Word not found')
    }
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
  
  console.log('\n✅ Scraper test complete!')
}

testScraper().catch(console.error)
