import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for long-running request

export async function POST(request: NextRequest) {
  try {
    // Get all words from the database
    const { data: allWords, error: fetchError } = await supabase
      .from('vocab_library')
      .select('id, word')
      .order('id', { ascending: true })
    
    if (fetchError) {
      throw new Error(`Failed to fetch words: ${fetchError.message}`)
    }

    if (!allWords || allWords.length === 0) {
      return NextResponse.json({
        message: 'No words found in library',
        count: 0
      })
    }

    console.log(`\n${'='.repeat(70)}`)
    console.log(`🔄 Starting refetch for ${allWords.length} words`)
    console.log('='.repeat(70))

    // Call the batch fetch endpoint
    const batchResponse = await fetch(`${request.nextUrl.origin}/api/fetch-dictionary-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        words: allWords.map(w => w.word)
      })
    })

    if (!batchResponse.ok) {
      const errorData = await batchResponse.json()
      throw new Error(errorData.error || 'Batch fetch failed')
    }

    const batchResult = await batchResponse.json()

    // Update the database with the refetched data
    if (batchResult.data && Array.isArray(batchResult.data)) {
      console.log(`\n📝 Updating ${batchResult.data.length} words in database...`)
      
      let updateCount = 0
      for (const wordData of batchResult.data) {
        const matchingWord = allWords.find(w => w.word.toLowerCase() === wordData.word.toLowerCase())
        if (!matchingWord) continue

        const { error: updateError } = await supabase
          .from('vocab_library')
          .update({
            part_of_speech: wordData.part_of_speech,
            cefr_level: wordData.cefr_level,
            meaning_primary: wordData.meaning_primary,
            usage_tips: wordData.usage_tips,
          })
          .eq('id', matchingWord.id)

        if (updateError) {
          console.error(`Error updating ${wordData.word}:`, updateError)
        } else {
          updateCount++
        }
      }

      console.log(`✅ Successfully updated ${updateCount}/${allWords.length} words`)

      return NextResponse.json({
        message: `Successfully refetched and updated ${updateCount} words`,
        total: allWords.length,
        updated: updateCount,
        failed: allWords.length - updateCount
      })
    }

    return NextResponse.json({
      message: 'Refetch completed but no data returned',
      total: allWords.length
    })

  } catch (error) {
    console.error('❌ Refetch all error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to refetch all words'
    }, { status: 500 })
  }
}
