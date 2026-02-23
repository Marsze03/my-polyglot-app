const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabase = createClient(
  'https://hwpzbtdrpanrriayyvqy.supabase.co',
  'sb_publishable_5zraFALnUCkUv0j-ZSjBiQ_489-gIO-'
);

async function importWords() {
  try {
    // Read the extracted PDF text
    const text = fs.readFileSync('pdf-text.txt', 'utf8');
    
    // Extract vocabulary words (simple approach - extract words that look like English vocab)
    const words = text
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .split(/\s+/)
      .filter(word => {
        // Filter for English words (alphabetic characters only, length >= 3)
        return word.length >= 3 && /^[a-zA-Z]+$/.test(word);
      })
      .map(word => word.toLowerCase())
      .filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates
    
    console.log(`Found ${words.length} unique words`);
    
    // Get existing words from database
    const { data: existingData } = await supabase
      .from('vocab_library')
      .select('word');
    
    const existingWords = new Set(
      (existingData || []).map(item => item.word.toLowerCase())
    );
    
    // Filter out words that already exist
    const newWords = words.filter(word => !existingWords.has(word));
    
    console.log(`${newWords.length} new words to import`);
    console.log(`${words.length - newWords.length} words already exist`);
    
    if (newWords.length === 0) {
      console.log('No new words to import!');
      return;
    }
    
    // Prepare words for insertion
    const wordsToInsert = newWords.map(word => ({
      word: word,
      lang_id: 1 // English
    }));
    
    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < wordsToInsert.length; i += batchSize) {
      const batch = wordsToInsert.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('vocab_library')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
      } else {
        inserted += data.length;
        console.log(`Inserted batch ${i / batchSize + 1}: ${data.length} words`);
      }
    }
    
    console.log(`\n✅ SUCCESS: Imported ${inserted} new words from PDF!`);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  }
}

importWords();
