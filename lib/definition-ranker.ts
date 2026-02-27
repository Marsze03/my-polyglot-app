/**
 * Utilities for ranking and selecting the best definition from multiple sources
 */

export interface DefinitionSource {
  source: string
  definition: string
  partOfSpeech?: string
  examples?: string[]
  cefrLevel?: string
  pronunciation?: string
}

/**
 * Patterns that indicate a definition is just describing a word form/tense change
 * These are considered low-quality definitions
 */
const FORM_CHANGE_PATTERNS = [
  /^(the\s+)?(past\s+(simple|tense|participle)|present\s+participle|third\s+person|plural|comparative|superlative)\s+(of|form of)\s+/i,
  /^past\s+simple:/i,
  /^past\s+participle:/i,
  /^present\s+participle:/i,
  /^gerund\s+of\s+/i,
  /^third-person\s+singular\s+simple\s+present\s+of\s+/i,
  /^simple\s+past\s+(tense\s+)?(and|&)\s+past\s+participle\s+of\s+/i,
  /^plural\s+of\s+/i,
  /^comparative\s+form\s+of\s+/i,
  /^superlative\s+form\s+of\s+/i,
  /^\w+\s+form\s+of\s+\w+\.?$/i,
]

/**
 * Checks if a definition is just describing a grammatical form/tense change
 * @param definition - The definition to check
 * @returns true if it's a form change description, false otherwise
 */
export function isFormChangeDefinition(definition: string): boolean {
  if (!definition) return false
  
  const trimmedDef = definition.trim()
  
  // Check against all form change patterns
  return FORM_CHANGE_PATTERNS.some(pattern => pattern.test(trimmedDef))
}

/**
 * Scores a definition based on its quality and usefulness
 * Higher scores are better
 * @param definition - The definition to score
 * @returns Quality score (0-100)
 */
export function scoreDefinitionQuality(definition: string): number {
  if (!definition || definition.trim().length === 0) return 0
  
  let score = 50 // Base score
  
  // Penalty for form change definitions
  if (isFormChangeDefinition(definition)) {
    score -= 40
  }
  
  // Bonus for longer, more descriptive definitions
  const wordCount = definition.split(/\s+/).length
  if (wordCount >= 5) score += 15
  if (wordCount >= 10) score += 10
  if (wordCount >= 15) score += 5
  
  // Bonus for definitions that contain action words or descriptive phrases
  if (/to\s+\w+/.test(definition)) score += 5 // "to examine", "to check"
  if (/that|which|who/.test(definition)) score += 5 // Relative clauses add detail
  
  // Penalty for very short definitions
  if (wordCount < 3) score -= 15
  
  // Bonus for definitions with specific terminology
  if (/examination|investigation|analysis|process|method|action/.test(definition)) score += 10
  
  return Math.max(0, Math.min(100, score)) // Clamp between 0-100
}

/**
 * Selects the best definition from multiple sources
 * @param sources - Array of definition sources
 * @returns The best definition source
 */
export function selectBestDefinition(sources: DefinitionSource[]): DefinitionSource | null {
  if (!sources || sources.length === 0) return null
  
  // Filter out sources without definitions
  const validSources = sources.filter(s => s.definition && s.definition.trim().length > 0)
  if (validSources.length === 0) return null
  
  // Score each source
  const scoredSources = validSources.map(source => ({
    source,
    score: scoreDefinitionQuality(source.definition),
    isFormChange: isFormChangeDefinition(source.definition)
  }))
  
  // Sort by score (highest first)
  scoredSources.sort((a, b) => b.score - a.score)
  
  // Log the scoring for debugging
  console.log('📊 Definition Quality Scores:')
  scoredSources.forEach(({ source, score, isFormChange }) => {
    console.log(`  ${source.source}: ${score}/100 ${isFormChange ? '[Form Change]' : '[Descriptive]'}`)
    console.log(`    "${source.definition.substring(0, 100)}..."`)
  })
  
  // Return the best scoring source
  return scoredSources[0].source
}

/**
 * Merges data from multiple sources, prioritizing quality
 * @param sources - Array of definition sources
 * @returns Merged definition data
 */
export function mergeDefinitionSources(sources: DefinitionSource[]): DefinitionSource {
  const bestDef = selectBestDefinition(sources)
  
  if (!bestDef) {
    return {
      source: 'None',
      definition: '',
    }
  }
  
  // Start with the best definition as base
  const merged: DefinitionSource = { ...bestDef }
  
  // Collect data from other sources to fill gaps
  for (const source of sources) {
    // Use CEFR level from any source that has it
    if (!merged.cefrLevel && source.cefrLevel) {
      merged.cefrLevel = source.cefrLevel
    }
    
    // Use pronunciation from any source that has it
    if (!merged.pronunciation && source.pronunciation) {
      merged.pronunciation = source.pronunciation
    }
    
    // Combine examples from all sources (limit to 3)
    if (source.examples && source.examples.length > 0) {
      if (!merged.examples) {
        merged.examples = []
      }
      for (const example of source.examples) {
        if (!merged.examples.includes(example) && merged.examples.length < 3) {
          merged.examples.push(example)
        }
      }
    }
  }
  
  // Update source to indicate multiple sources were used
  const sourceNames = sources
    .filter(s => s.definition && s.definition.trim().length > 0)
    .map(s => s.source)
  
  if (sourceNames.length > 1) {
    merged.source = `${bestDef.source} (+ ${sourceNames.filter(s => s !== bestDef.source).join(', ')})`
  }
  
  return merged
}
