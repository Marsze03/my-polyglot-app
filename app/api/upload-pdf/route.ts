import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Force Node.js runtime (pdf-parse doesn't work with Edge runtime)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Import the CommonJS PDF parser
const { parsePDF } = require('@/lib/pdf-parser')

// Helper function to extract words from text
function extractVocabularyWords(text: string): string[] {
  console.log(`📖 Processing text of ${text.length} characters...`)
  
  // Split into words, handling various separators
  const allWords = text
    .replace(/[.,\/#!$%\^&\*;:{}=_`~()"\[\]<>?]/g, ' ') // Remove punctuation but keep hyphens and apostrophes
    .replace(/\s{2,}/g, ' ') // Normalize whitespace
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0)
  
  console.log(`   Found ${allWords.length} total words`)
  
  // Common English stop words to exclude (very basic list)
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
    'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'into', 'year', 'your', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'also',
    'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'most', 'us',
    'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having'
  ])
  
  const validWords = allWords
    .filter(word => {
      // Remove empty strings
      if (!word) return false
      
      // Remove pure numbers
      if (/^\d+$/.test(word)) return false
      
      // Remove single letters (except "a" and "i" which we handle with stopwords)
      if (word.length === 1) return false
      
      // Must contain at least one letter
      if (!/[a-z]/.test(word)) return false
      
      // Allow words with letters, numbers, hyphens, and apostrophes
      // This is more permissive than before
      if (!/^[a-z0-9'-]+$/.test(word)) return false
      
      // Remove stop words
      if (stopWords.has(word)) return false
      
      return true
    })
    .map(word => {
      // Clean up edge cases
      // Remove leading/trailing hyphens, apostrophes, and numbers
      return word.replace(/^['-\d]+|['-\d]+$/g, '')
    })
    .filter(word => {
      // Re-filter after cleanup
      return word.length >= 2 && /^[a-z][a-z'-]*$/.test(word)
    })
  
  console.log(`   After filtering: ${validWords.length} valid vocabulary words`)
  
  // Remove duplicates
  const uniqueWords = [...new Set(validWords)]
  console.log(`   Unique words: ${uniqueWords.length}`)
  
  return uniqueWords
}

// Helper function to check if word already exists in database
async function checkExistingWords(words: string[]): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('vocab_library')
    .select('word')
  
  if (error) {
    console.error('Error fetching existing words:', error)
    return new Set()
  }
  
  // Create a set of existing words (lowercase for comparison)
  const existingWords = new Set(
    data?.map(item => item.word.toLowerCase()) || []
  )
  
  return existingWords
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const previewMode = formData.get('preview') === 'true'
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Verify it's a PDF file
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let text = ''
    let pdfPages = 0
    
    try {
      // Parse PDF and extract text
      const result = await parsePDF(buffer)
      
      if (!result.success) {
        throw new Error(result.error || 'PDF parsing failed')
      }
      
      text = result.text
      pdfPages = result.pages
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError)
      return NextResponse.json(
        { 
          error: 'Failed to parse PDF file',
          details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF parsing error'
        },
        { status: 500 }
      )
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text found in PDF' },
        { status: 400 }
      )
    }

    console.log(`📄 PDF parsed: ${pdfPages} pages, ${text.length} characters`)

    // Extract vocabulary words
    const extractedWords = extractVocabularyWords(text)
    
    console.log(`📝 Extracted ${extractedWords.length} unique words from PDF`)
    
    if (extractedWords.length === 0) {
      return NextResponse.json(
        { error: 'No valid vocabulary words found in PDF' },
        { status: 400 }
      )
    }

    // Check for existing words
    const existingWords = await checkExistingWords(extractedWords)
    
    // Filter out words that already exist
    const newWords = extractedWords.filter(
      word => !existingWords.has(word.toLowerCase())
    )
    
    const existingWordsList = extractedWords.filter(
      word => existingWords.has(word.toLowerCase())
    )

    console.log(`   ${newWords.length} new words, ${existingWordsList.length} already in library`)

    // If preview mode, return ALL extracted words (not just new ones)
    // Let the user decide what to keep
    if (previewMode) {
      return NextResponse.json({
        preview: true,
        message: 'Words extracted for preview',
        total_extracted: extractedWords.length,
        already_exists: existingWordsList.length,
        new_words: newWords.length,
        words: extractedWords, // Show all words, not just new ones
        existing_words: existingWordsList
      })
    }

    if (newWords.length === 0) {
      return NextResponse.json({
        message: 'All words from PDF already exist in your library',
        total_extracted: extractedWords.length,
        already_exists: extractedWords.length,
        new_words: 0,
        words: []
      })
    }

    // Insert new words into database
    const wordsToInsert = newWords.map(word => ({
      word: word,
      lang_id: 1 // Assuming English (lang_id 1)
    }))

    const { data: insertedData, error: insertError } = await supabase
      .from('vocab_library')
      .insert(wordsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting words:', insertError)
      return NextResponse.json(
        { error: 'Failed to insert words into database', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'PDF processed successfully',
      total_extracted: extractedWords.length,
      already_exists: extractedWords.length - newWords.length,
      new_words: newWords.length,
      words: insertedData || []
    })

  } catch (error) {
    console.error('Error processing PDF:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
