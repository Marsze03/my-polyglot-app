export interface FreeDictionaryData {
  word: string
  partOfSpeech?: string
  definition?: string
  examples?: string[]
  pronunciation?: string
  found: boolean
}

interface ApiDefinition {
  definition: string
  example?: string
  synonyms: string[]
  antonyms: string[]
}

interface ApiMeaning {
  partOfSpeech: string
  definitions: ApiDefinition[]
}

interface ApiPhonetic {
  text?: string
  audio?: string
}

interface ApiEntry {
  word: string
  phonetic?: string
  phonetics: ApiPhonetic[]
  meanings: ApiMeaning[]
}

export async function scrapeFreeDictionary(word: string): Promise<FreeDictionaryData> {
  const result: FreeDictionaryData = { word, found: false }

  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    const response = await fetch(url)

    if (!response.ok) {
      return result
    }

    const data: ApiEntry[] = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return result
    }

    const entry = data[0]

    // Pronunciation — prefer phonetic field, fall back to first phonetics entry with text
    result.pronunciation =
      entry.phonetic ||
      entry.phonetics.find((p) => p.text)?.text ||
      undefined

    // Meanings — pick the first meaning that has at least one definition
    const meaning = entry.meanings.find((m) => m.definitions.length > 0)
    if (!meaning) {
      return result
    }

    result.found = true
    result.partOfSpeech = meaning.partOfSpeech

    const firstDef = meaning.definitions[0]
    result.definition = firstDef.definition

    const examples: string[] = []
    for (const m of entry.meanings) {
      for (const d of m.definitions) {
        if (d.example) {
          examples.push(d.example)
          if (examples.length >= 2) break
        }
      }
      if (examples.length >= 2) break
    }
    if (examples.length > 0) {
      result.examples = examples
    }
  } catch (error) {
    console.error('Error fetching from Free Dictionary API:', error)
  }

  return result
}
