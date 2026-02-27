/**
 * Test script for the improved definition ranking system
 * 
 * Usage: node test-definition-ranker.mjs
 * 
 * This tests the word "vetted" to ensure we get a descriptive definition
 * instead of just "past simple of vet"
 */

const API_URL = 'http://localhost:3000/api/fetch-dictionary'

async function testWord(word) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Testing: ${word}`)
  console.log('='.repeat(70))
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word }),
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      console.log('\n✅ SUCCESS!')
      console.log('Source:', data.source)
      console.log('\nStructured Data:')
      console.log('  Part of Speech:', data.data.part_of_speech)
      console.log('  CEFR Level:', data.data.cefr_level)
      console.log('  Meaning:', data.data.meaning_primary)
      console.log('  Usage Tips:', data.data.usage_tips)
      
      // Check if we got a descriptive meaning vs. just "past simple of..."
      const isDescriptive = !data.data.meaning_primary.toLowerCase().includes('past simple of')
        && !data.data.meaning_primary.toLowerCase().includes('past tense of')
      
      console.log('\n📊 Quality Check:')
      console.log('  Is descriptive (not just tense change):', isDescriptive ? '✅ YES' : '❌ NO')
      
      if (isDescriptive) {
        console.log('\n🎉 The ranking system successfully prioritized a descriptive definition!')
      } else {
        console.log('\n⚠️ Still getting tense-change definition. May need to check dictionary sources.')
      }
    } else {
      console.log('\n❌ ERROR:', data.error || 'Unknown error')
    }
    
  } catch (error) {
    console.log('\n❌ FETCH ERROR:', error.message)
    console.log('\nMake sure the development server is running (npm run dev)')
  }
}

// Test words
const testWords = [
  'vetted',  // The problematic word mentioned by the user
  'running', // Another past participle that might have the same issue
  'tested',  // Another test case
]

console.log('🧪 Definition Ranking Test Suite')
console.log('This tests the new multi-source dictionary fetching with quality ranking\n')

for (const word of testWords) {
  await testWord(word)
  // Small delay between requests
  await new Promise(resolve => setTimeout(resolve, 1000))
}

console.log('\n' + '='.repeat(70))
console.log('Testing complete!')
console.log('='.repeat(70))
