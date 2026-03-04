import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { words } = await request.json()
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: 'No words provided' },
        { status: 400 }
      )
    }

    // Check which words already exist in the database
    const { data: existingData, error: checkError } = await supabase
      .from('vocab_library')
      .select('word')
    
    if (checkError) {
      console.error('Error checking existing words:', checkError)
    }
    
    const existingWords = new Set(
      existingData?.map(item => item.word.toLowerCase()) || []
    )

    // Filter out words that already exist
    const newWords = words.filter(word => !existingWords.has(word.toLowerCase()))
    
    console.log(`📥 Confirming PDF import: ${words.length} total, ${newWords.length} new, ${words.length - newWords.length} duplicates`)

    if (newWords.length === 0) {
      return NextResponse.json({
        message: 'All words already exist in your library',
        count: 0,
        words: []
      })
    }

    // Sanitize and prepare words for insertion
    const wordsToInsert = newWords.map(word => ({
      word: word.trim().toLowerCase(),
      lang_id: 1 // Assuming English (lang_id 1)
    }))

    // Insert words into database
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
      message: 'Words added successfully',
      count: insertedData?.length || 0,
      words: insertedData || [],
      skipped: words.length - newWords.length
    })

  } catch (error) {
    console.error('Error confirming PDF words:', error)
    return NextResponse.json(
      { 
        error: 'Failed to add words',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
