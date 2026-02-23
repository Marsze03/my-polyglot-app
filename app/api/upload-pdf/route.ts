import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Force Node.js runtime (pdf-parse doesn't work with Edge runtime)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Import the CommonJS PDF parser
const { parsePDF } = require('@/lib/pdf-parser')

// Helper function to extract words from text
function extractVocabularyWords(text: string): string[] {
  // Remove common punctuation and split into words
  const words = text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2) // Only words with 3+ characters
    .filter(word => /^[a-z]+$/.test(word)) // Only alphabetic words
  
  // Remove duplicates
  return [...new Set(words)]
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
    
    try {
      // Parse PDF and extract text
      const result = await parsePDF(buffer)
      
      if (!result.success) {
        throw new Error(result.error || 'PDF parsing failed')
      }
      
      text = result.text
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

    // Extract vocabulary words
    const extractedWords = extractVocabularyWords(text)
    
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
