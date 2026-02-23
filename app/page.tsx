'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from 'next-themes'
import { Logo } from '@/components/logo'
import { QuizMode } from '@/components/quiz-mode'
import { useAuth } from '@/lib/auth-context'
import LandingPage from '@/components/landing-page'

// TypeScript type definition - tells the app what data structure a word has
type VocabWord = {
  id: number
  word: string
  part_of_speech?: string
  cefr_level?: string
  meaning_primary?: string
  usage_tips?: string
  lang_id?: number
}

export default function Home() {
  const { setTheme, resolvedTheme } = useTheme()
  const { user, loading: authLoading, signOut } = useAuth()

  // Show landing page if not authenticated
  if (!authLoading && !user) {
    return <LandingPage />
  }

  // State management: these are "memory slots" that store data
  const [words, setWords] = useState<VocabWord[]>([]) // Stores all words from database
  const [loading, setLoading] = useState(true) // Shows if we're still fetching data
  const [error, setError] = useState<string | null>(null) // Shows error messages
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ja'>('en') // Language toggle
  const [inputValue, setInputValue] = useState('') // Stores what user typed in the form
  const [isMounted, setIsMounted] = useState(false) // Track if component has mounted
  const [searchQuery, setSearchQuery] = useState('') // Search filter state
  const [editingWord, setEditingWord] = useState<VocabWord | null>(null) // Word being edited
  const [editFormData, setEditFormData] = useState({
    word: '',
    part_of_speech: '',
    cefr_level: '',
    meaning_primary: '',
    usage_tips: ''
  })
  const [showQuiz, setShowQuiz] = useState(false)
  const [showIncompleteList, setShowIncompleteList] = useState(false)
  const [fetchingDictionary, setFetchingDictionary] = useState(false)
  const [batchFetching, setBatchFetching] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [uploadingPDF, setUploadingPDF] = useState(false)
  const [cefrNormalized, setCefrNormalized] = useState(false)
  const [pdfUploadResult, setPdfUploadResult] = useState<{
    message: string
    total_extracted: number
    already_exists: number
    new_words: number
  } | null>(null)

  // Helper function to check if a field has actual content (not empty or whitespace)
  const hasContent = (value: string | null | undefined): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value !== 'string') return false
    return value.trim().length > 0
  }

  // This function runs ONCE when the page loads (empty dependency array [] means "only once")
  useEffect(() => {
    setIsMounted(true)
    const initializeApp = async () => {
      await fetchWords()
    }
    initializeApp()
  }, [])

  // Auto-normalize CEFR levels after words are loaded (only once)
  useEffect(() => {
    if (words.length > 0 && !cefrNormalized) {
      handleNormalizeCEFR()
      setCefrNormalized(true)
    }
  }, [words.length, cefrNormalized])

  // Auto-dismiss error message after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 10000) // 10 seconds
      return () => clearTimeout(timer) // Cleanup timer if component unmounts
    }
  }, [error])

  // Function to get all words from Supabase database
  const fetchWords = async () => {
    try {
      setLoading(true)
      // Query the database: SELECT * FROM vocab_library
      const { data, error: fetchError } = await supabase
        .from('vocab_library')
        .select('*')
        .order('id', { ascending: false }) // Show newest words first

      if (fetchError) throw fetchError // If error, stop and show it
      setWords(data || []) // Store the words in memory
      setError(null) // Clear any previous errors
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch words')
      setWords([])
    } finally {
      setLoading(false) // Stop showing "loading" spinner
    }
  }

  // Function to check if a word is already in library (including plural/variations)
  const isWordDuplicate = (newWord: string): string | null => {
    const lowerNewWord = newWord.toLowerCase().trim()
    
    for (const word of words) {
      const existingWord = word.word.toLowerCase()
      
      // Exact match
      if (existingWord === lowerNewWord) {
        return word.word
      }
      
      // Check plural variations
      // If new word ends with 's', check if removing it matches
      if (lowerNewWord.endsWith('s')) {
        const singular = lowerNewWord.slice(0, -1)
        if (existingWord === singular) {
          return word.word
        }
        // Check for words ending in 'es'
        if (lowerNewWord.endsWith('es')) {
          const singularEs = lowerNewWord.slice(0, -2)
          if (existingWord === singularEs) {
            return word.word
          }
        }
      }
      
      // If existing word + 's' matches new word
      if (existingWord + 's' === lowerNewWord) {
        return word.word
      }
      // If existing word + 'es' matches new word
      if (existingWord + 'es' === lowerNewWord) {
        return word.word
      }
    }
    
    return null
  }

  // Function to handle form submission (when user clicks "Add Word")
  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault() // Stop the page from refreshing
    setError(null) // Clear previous errors

    if (!inputValue.trim()) {
      setError('Please enter a word')
      return
    }

    // Check for duplicates and word variations
    const duplicateWord = isWordDuplicate(inputValue)
    if (duplicateWord) {
      setError(`"${inputValue}" is a variation of "${duplicateWord}" which already exists!`)
      return
    }

    try {
      setLoading(true)
      // Try to insert the word into database
      const { error: insertError } = await supabase
        .from('vocab_library')
        .insert([
          {
            word: inputValue.trim(),
            lang_id: selectedLanguage === 'en' ? 1 : 2, // 1=English, 2=Japanese
          },
        ])

      if (insertError) {
        // Check if it's a duplicate error
        if (insertError.message.includes('unique')) {
          setError(`"${inputValue}" already exists in your library!`)
        } else {
          setError(insertError.message)
        }
        return
      }

      // Success! Clear input and fetch updated list
      setInputValue('')
      await fetchWords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add word')
    } finally {
      setLoading(false)
    }
  }

  // Function to delete a word (optional)
  const handleDeleteWord = async (id: number) => {
    try {
      const { error: deleteError } = await supabase
        .from('vocab_library')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      await fetchWords() // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete word')
    }
  }

  // Function to start editing a word
  const handleEditWord = (word: VocabWord) => {
    setEditingWord(word)
    setEditFormData({
      word: word.word,
      part_of_speech: word.part_of_speech || '',
      cefr_level: word.cefr_level || '',
      meaning_primary: word.meaning_primary || '',
      usage_tips: word.usage_tips || ''
    })
    setError(null)
  }

  // Function to save edited word
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingWord) return

    try {
      setLoading(true)
      const { error: updateError } = await supabase
        .from('vocab_library')
        .update({
          word: editFormData.word.trim(),
          part_of_speech: editFormData.part_of_speech.trim() || null,
          cefr_level: editFormData.cefr_level.trim() || null,
          meaning_primary: editFormData.meaning_primary.trim() || null,
          usage_tips: editFormData.usage_tips.trim() || null
        })
        .eq('id', editingWord.id)

      if (updateError) throw updateError
      
      setEditingWord(null)
      await fetchWords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update word')
    } finally {
      setLoading(false)
    }
  }

  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingWord(null)
    setError(null)
  }

  // Function to fetch dictionary data from AI
  const handleFetchDictionary = async () => {
    if (!editFormData.word.trim()) {
      setError('Please enter a word first')
      return
    }

    try {
      setFetchingDictionary(true)
      setError(null)

      const response = await fetch('/api/fetch-dictionary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: editFormData.word.trim() }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch dictionary data')
      }

      if (result.success && result.data) {
        // Update form data with fetched information
        setEditFormData({
          ...editFormData,
          part_of_speech: result.data.part_of_speech || editFormData.part_of_speech,
          cefr_level: result.data.cefr_level || editFormData.cefr_level,
          meaning_primary: result.data.meaning_primary || editFormData.meaning_primary,
          usage_tips: result.data.usage_tips || editFormData.usage_tips,
        })
      } else {
        throw new Error('Invalid response from dictionary service')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dictionary data')
    } finally {
      setFetchingDictionary(false)
    }
  }

  // Function to fetch dictionary data for all incomplete words in batch
  const handleBatchFetch = async () => {
    const incompleteWords = words.filter(w => !hasContent(w.meaning_primary) || !hasContent(w.part_of_speech))
    
    if (incompleteWords.length === 0) {
      setError('All words already have complete information!')
      return
    }

    const CHUNK_SIZE = 100
    const totalChunks = Math.ceil(incompleteWords.length / CHUNK_SIZE)

    try {
      setBatchFetching(true)
      setBatchProgress({ current: 0, total: incompleteWords.length })
      setError(null)

      console.log(`🚀 Starting batch fetch for ${incompleteWords.length} words in ${totalChunks} chunk(s)...`)

      let totalUpdated = 0
      let totalDeleted = 0
      const allFailedWords: string[] = []

      // Process in chunks of 100
      for (let i = 0; i < incompleteWords.length; i += CHUNK_SIZE) {
        const chunk = incompleteWords.slice(i, i + CHUNK_SIZE)
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
        
        console.log(`\n📦 Processing chunk ${chunkNum}/${totalChunks} (${chunk.length} words)...`)

        const response = await fetch('/api/fetch-dictionary-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ words: chunk.map(w => w.word) }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch batch dictionary data')
        }

        if (result.success && result.data) {
          console.log(`✅ Received data for ${result.data.length} words in chunk ${chunkNum}...`)
          
          // Get list of words that failed (not found in Cambridge Dictionary)
          const failedWords = result.failed || []
          allFailedWords.push(...failedWords)
          const wordsToDelete = chunk.filter(w => 
            failedWords.includes(w.word) || 
            !result.data.find((d: any) => d.word.toLowerCase() === w.word.toLowerCase())
          )
          
          // Delete invalid words using batch delete
          if (wordsToDelete.length > 0) {
            console.log(`🗑️  Deleting ${wordsToDelete.length} invalid words from chunk ${chunkNum}...`)
            const idsToDelete = wordsToDelete.map(w => w.id)
            
            const { error: deleteError } = await supabase
              .from('vocab_library')
              .delete()
              .in('id', idsToDelete)

            if (!deleteError) {
              totalDeleted += wordsToDelete.length
              console.log(`  ✅ Deleted ${wordsToDelete.length} words`)
            } else {
              console.error(`  ❌ Failed to delete words:`, deleteError)
            }
          }
          
          // Batch update words found in Cambridge Dictionary
          if (result.data.length > 0) {
            for (const wordData of result.data) {
              const wordToUpdate = chunk.find(w => w.word.toLowerCase() === wordData.word.toLowerCase())
              if (!wordToUpdate) continue

              const { error: updateError } = await supabase
                .from('vocab_library')
                .update({
                  part_of_speech: wordData.part_of_speech || null,
                  cefr_level: wordData.cefr_level || null,
                  meaning_primary: wordData.meaning_primary || null,
                  usage_tips: wordData.usage_tips || null
                })
                .eq('id', wordToUpdate.id)

              if (!updateError) {
                totalUpdated++
              }
            }
            console.log(`  ✅ Updated ${result.data.length} words from chunk ${chunkNum}`)
          }
        }

        // Update progress
        setBatchProgress({ current: i + chunk.length, total: incompleteWords.length })
        
        // Small delay between chunks to avoid overwhelming the server
        if (chunkNum < totalChunks) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      console.log(`\n✅ Batch update complete: ${totalUpdated} words updated, ${totalDeleted} invalid words deleted`)
      
      // Refresh the word list
      await fetchWords()
      
      setError(null)
      
      let message = `✅ Successfully processed ${incompleteWords.length} words:\n\n`
      message += `• ${totalUpdated} words found and updated from Cambridge Dictionary\n`
      if (totalDeleted > 0) {
        message += `• ${totalDeleted} invalid words deleted (not found in dictionary)\n`
      }
      if (allFailedWords.length > 0 && allFailedWords.length <= 10) {
        message += `\nDeleted words: ${allFailedWords.join(', ')}`
      } else if (allFailedWords.length > 10) {
        message += `\nDeleted ${allFailedWords.length} invalid words`
      }
      
      alert(message)
    } catch (err) {
      console.error('Batch fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to batch fetch dictionary data')
    } finally {
      setBatchFetching(false)
      setBatchProgress({ current: 0, total: 0 })
    }
  }

  // Function to delete all incomplete words
  const handleDeleteIncomplete = async () => {
    const incompleteWords = words.filter(w => !hasContent(w.meaning_primary) || !hasContent(w.part_of_speech))
    
    if (incompleteWords.length === 0) {
      setError('No incomplete words to delete!')
      return
    }

    const wordsList = incompleteWords.slice(0, 20).map(w => w.word).join(', ')
    const moreText = incompleteWords.length > 20 ? `... and ${incompleteWords.length - 20} more` : ''
    
    const confirmed = confirm(
      `⚠️ WARNING: This will DELETE ${incompleteWords.length} incomplete word${incompleteWords.length > 1 ? 's' : ''} from your library:\n\n` +
      `${wordsList}${moreText}\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Continue?`
    )
    
    if (!confirmed) return

    try {
      setLoading(true)
      setError(null)

      const idsToDelete = incompleteWords.map(w => w.id)
      
      const { error: deleteError } = await supabase
        .from('vocab_library')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) throw deleteError

      await fetchWords()
      alert(`✅ Successfully deleted ${incompleteWords.length} incomplete word${incompleteWords.length > 1 ? 's' : ''}!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete incomplete words')
    } finally {
      setLoading(false)
    }
  }

  // Function to normalize CEFR levels in database
  const handleNormalizeCEFR = async () => {
    try {
      const wordsToFix = words.filter(w => {
        if (!w.cefr_level || w.cefr_level.trim() === '') return false
        const level = w.cefr_level.toUpperCase().trim()
        // Check if it needs normalization (not already in correct format)
        return w.cefr_level !== level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)
      })

      if (wordsToFix.length === 0) {
        console.log('✅ All CEFR levels are already normalized')
        return
      }

      console.log(`🔧 Normalizing ${wordsToFix.length} CEFR levels...`)

      for (const word of wordsToFix) {
        const normalizedLevel = word.cefr_level!.toUpperCase().trim()
        await supabase
          .from('vocab_library')
          .update({ cefr_level: normalizedLevel })
          .eq('id', word.id)
      }

      await fetchWords()
      console.log(`✅ Normalized ${wordsToFix.length} CEFR levels`)
    } catch (err) {
      console.error('Error normalizing CEFR levels:', err)
    }
  }

  // Function to clean up words with whitespace-only values
  const handleCleanupWhitespace = async () => {
    try {
      setLoading(true)
      setError(null)

      // Find words with whitespace-only values
      const wordsToClean = words.filter(w => 
        (w.meaning_primary && !w.meaning_primary.trim()) ||
        (w.part_of_speech && !w.part_of_speech.trim()) ||
        (w.cefr_level && !w.cefr_level.trim()) ||
        (w.usage_tips && !w.usage_tips.trim())
      )

      if (wordsToClean.length === 0) {
        setError('No words with whitespace-only values found!')
        return
      }

      const confirmed = confirm(
        `Found ${wordsToClean.length} word${wordsToClean.length > 1 ? 's' : ''} with whitespace-only values.\n\n` +
        `This will clean up empty fields by setting them to null.\n\nContinue?`
      )
      if (!confirmed) return

      // Clean up each word
      for (const word of wordsToClean) {
        await supabase
          .from('vocab_library')
          .update({
            part_of_speech: word.part_of_speech?.trim() || null,
            cefr_level: word.cefr_level?.trim() || null,
            meaning_primary: word.meaning_primary?.trim() || null,
            usage_tips: word.usage_tips?.trim() || null
          })
          .eq('id', word.id)
      }

      await fetchWords()
      alert(`✅ Successfully cleaned up ${wordsToClean.length} word${wordsToClean.length > 1 ? 's' : ''}!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup whitespace')
    } finally {
      setLoading(false)
    }
  }

  // Function to handle PDF file upload
  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Verify it's a PDF
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    try {
      setUploadingPDF(true)
      setError(null)
      setPdfUploadResult(null)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process PDF')
      }

      setPdfUploadResult(result)
      
      // Refresh the word list to show new words
      await fetchWords()

      // Clear the file input
      event.target.value = ''
      
    } catch (err) {
      console.error('PDF upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload PDF')
    } finally {
      setUploadingPDF(false)
    }
  }

  // Filter words based on search query
  const filteredWords = words.filter((word) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      word.word.toLowerCase().includes(query) ||
      word.meaning_primary?.toLowerCase().includes(query) ||
      word.part_of_speech?.toLowerCase().includes(query)
    )
  })

  // Get recent words (last 5 added from filtered results)
  const recentWords = filteredWords.slice(0, 5)

  // Sort filtered words alphabetically
  const alphabeticalWords = [...filteredWords].sort((a, b) => 
    a.word.toLowerCase().localeCompare(b.word.toLowerCase())
  )

  // Calculate statistics
  const stats = {
    total: words.length,
    withMeaning: words.filter(w => hasContent(w.meaning_primary)).length,
    byLevel: {
      A1: words.filter(w => w.cefr_level?.toUpperCase().trim() === 'A1').length,
      A2: words.filter(w => w.cefr_level?.toUpperCase().trim() === 'A2').length,
      B1: words.filter(w => w.cefr_level?.toUpperCase().trim() === 'B1').length,
      B2: words.filter(w => w.cefr_level?.toUpperCase().trim() === 'B2').length,
      C1: words.filter(w => w.cefr_level?.toUpperCase().trim() === 'C1').length,
      C2: words.filter(w => w.cefr_level?.toUpperCase().trim() === 'C2').length,
    }
  }

  // Debug: Log CEFR levels to console
  const wordsWithLevels = words.filter(w => w.cefr_level && w.cefr_level.trim() !== '' && w.cefr_level.toLowerCase() !== 'n.a.')
  if (wordsWithLevels.length > 0) {
    console.log(`📊 Words with CEFR levels: ${wordsWithLevels.length}`)
    const levelCounts: Record<string, number> = {}
    wordsWithLevels.forEach(w => {
      const level = w.cefr_level?.toUpperCase().trim() || 'unknown'
      levelCounts[level] = (levelCounts[level] || 0) + 1
    })
    console.log('Level breakdown:', levelCounts)
  }

  // Count incomplete words
  const wordsWithoutMeaning = words.filter(w => !hasContent(w.meaning_primary))
  const wordsWithoutPOS = words.filter(w => !hasContent(w.part_of_speech))

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors duration-500">
      {!isMounted ? (
        <div className="max-w-5xl mx-auto">
          <div className="p-8 text-center text-slate-400 dark:text-slate-600">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 dark:border-slate-800 dark:border-t-slate-400"></div>
          </div>
        </div>
      ) : (
      <div className="max-w-5xl mx-auto">
        {/* Top Controls */}
        <div className="flex justify-between items-center mb-4 gap-3">
          <div className="flex gap-3">
            <button
              onClick={() => setShowQuiz(true)}
              disabled={words.length === 0}
              className="px-5 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Study Mode
            </button>

            {/* Batch Fetch Button */}
            {words.filter(w => !hasContent(w.meaning_primary) || !hasContent(w.part_of_speech)).length > 0 && (
              <>
                <button
                  onClick={() => setShowIncompleteList(true)}
                  className="px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 backdrop-blur-sm border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all duration-300 font-medium text-sm flex items-center gap-2"
                  title="View list of incomplete words"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  <span>Show Incomplete ({words.filter(w => !hasContent(w.meaning_primary) || !hasContent(w.part_of_speech)).length})</span>
                </button>
                <button
                  onClick={handleBatchFetch}
                  disabled={batchFetching || words.length === 0}
                  className="px-5 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
                  title={`Fill info for ${words.filter(w => !hasContent(w.meaning_primary) || !hasContent(w.part_of_speech)).length} incomplete words`}
                >
                {batchFetching ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{batchProgress.current}/{batchProgress.total}</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"/>
                      <polyline points="8 6 2 12 8 18"/>
                    </svg>
                    <span>Fill All Info ({words.filter(w => !hasContent(w.meaning_primary) || !hasContent(w.part_of_speech)).length})</span>
                  </>
                )}
              </button>
              </>
            )}
          </div>

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-3 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-300 shadow-sm cursor-pointer"
            aria-label="Toggle Theme"
          >
            {isMounted && resolvedTheme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>

          <button
            onClick={signOut}
            className="p-3 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-red-500 transition-all duration-300 shadow-sm cursor-pointer"
            aria-label="Sign Out"
            title="Sign Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex justify-center mb-6">
            <Logo className="w-20 h-20 text-slate-900 dark:text-slate-100 transition-colors duration-300" />
          </div>
          <h1 className="text-6xl md:text-7xl font-brand italic text-slate-900 dark:text-white mb-3 tracking-tight transition-colors">
            Verba
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs tracking-[0.2em] uppercase">
            The Art of Lexicon
          </p>
        </div>

        {/* Language Selector */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full p-1.5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                selectedLanguage === 'en'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setSelectedLanguage('ja')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                selectedLanguage === 'ja'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              日本語
            </button>
          </div>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="mb-8 mx-auto max-w-2xl">
            <div className="p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Add Word Form */}
        <form onSubmit={handleAddWord} className="mb-8 mx-auto max-w-2xl">
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-2 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={selectedLanguage === 'en' ? 'Add a word...' : '単語を追加...'}
                className="flex-1 px-5 py-4 bg-transparent focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-lg hover:shadow-xl dark:shadow-slate-900/20"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </form>

        {/* PDF Upload Section */}
        <div className="mb-8 mx-auto max-w-2xl">
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Import from PDF
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a PDF document to extract vocabulary words automatically
                </p>
              </div>
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePDFUpload}
                  disabled={uploadingPDF}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-all duration-300 font-medium text-sm cursor-pointer inline-flex items-center gap-2 ${
                    uploadingPDF ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingPDF ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Choose PDF
                    </>
                  )}
                </label>
              </div>
            </div>
            
            {/* PDF Upload Result */}
            {pdfUploadResult && (
              <div className="mt-4 p-4 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ✅ {pdfUploadResult.message}
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-slate-600 dark:text-slate-400">{pdfUploadResult.total_extracted}</div>
                    <div className="text-slate-500 dark:text-slate-500">Extracted</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">{pdfUploadResult.new_words}</div>
                    <div className="text-slate-500 dark:text-slate-500">New Words</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-600 dark:text-slate-400">{pdfUploadResult.already_exists}</div>
                    <div className="text-slate-500 dark:text-slate-500">Duplicates</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {words.length > 0 && (
          <div className="mb-12 mx-auto max-w-2xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 dark:text-slate-500">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your vocabulary..."
                className="w-full pl-12 pr-5 py-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                Found {filteredWords.length} {filteredWords.length === 1 ? 'word' : 'words'}
              </p>
            )}
          </div>
        )}

        {/* Statistics Dashboard */}
        {words.length > 0 && !searchQuery && (
          <div className="mb-12 max-w-2xl mx-auto">
            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center justify-between gap-8">
                <div className="flex-1 text-center">
                  <div className="text-3xl font-brand font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {stats.total}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Words
                  </div>
                </div>
                
                <div className="h-12 w-px bg-slate-200 dark:bg-slate-700"></div>
                
                <div className="flex-1 text-center">
                  <div className="text-3xl font-brand font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {stats.withMeaning}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Defined
                  </div>
                </div>
                
                <div className="h-12 w-px bg-slate-200 dark:bg-slate-700"></div>
                
                <div className="flex-1 text-center">
                  <div className="text-3xl font-brand font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {Math.round((stats.withMeaning / stats.total) * 100) || 0}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Complete
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vocabulary Grid */}
        <div>
          {loading && words.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 dark:border-slate-800 dark:border-t-slate-400"></div>
            </div>
          ) : words.length === 0 ? (
            <div className="p-16 text-center text-slate-400 dark:text-slate-600">
              <p className="text-lg">No words yet</p>
              <p className="text-sm mt-2">Start building your vocabulary above</p>
            </div>
          ) : (
            <>
              {/* Recently Added Section */}
              {recentWords.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-sm font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                    Recently Added
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recentWords.map((word, index) => (
                      <div
                        key={word.id}
                        className="group bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg dark:hover:shadow-slate-900/40 hover:border-slate-300/50 dark:hover:border-slate-600/50 transition-all duration-300 animate-fadeIn"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 
                            className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            onClick={() => handleEditWord(word)}
                            title="Click to edit"
                          >
                            {word.word}
                            {word.part_of_speech && (
                              <span className="ml-2 text-base text-slate-400 dark:text-slate-500 font-normal">
                                ({word.part_of_speech.toLowerCase().startsWith('n') ? 'n.' : 
                                  word.part_of_speech.toLowerCase().startsWith('v') ? 'v.' :
                                  word.part_of_speech.toLowerCase().startsWith('adj') ? 'adj.' :
                                  word.part_of_speech.toLowerCase().startsWith('adv') ? 'adv.' :
                                  word.part_of_speech.toLowerCase().startsWith('prep') ? 'prep.' :
                                  word.part_of_speech.toLowerCase().startsWith('conj') ? 'conj.' :
                                  word.part_of_speech.toLowerCase().startsWith('pron') ? 'pron.' :
                                  word.part_of_speech.toLowerCase().startsWith('inter') ? 'interj.' :
                                  word.part_of_speech})
                              </span>
                            )}
                          </h3>
                          <button
                            onClick={() => handleDeleteWord(word.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all duration-300 text-sm"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                        
                        {word.meaning_primary && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {word.meaning_primary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Vocabulary - Alphabetical */}
              <div>
                <h2 className="text-sm font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                  All Vocabulary (A-Z)
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {alphabeticalWords.map((word, index) => (
                    <div
                      key={word.id}
                      className="group bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/30 hover:shadow-lg dark:hover:shadow-slate-900/40 hover:border-slate-300/50 dark:hover:border-slate-600/50 transition-all duration-300 animate-fadeIn"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 
                          className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          onClick={() => handleEditWord(word)}
                          title="Click to edit"
                        >
                          {word.word}
                          {word.part_of_speech && (
                            <span className="ml-2 text-base text-slate-400 dark:text-slate-500 font-normal">
                              ({word.part_of_speech.toLowerCase().startsWith('n') ? 'n.' : 
                                word.part_of_speech.toLowerCase().startsWith('v') ? 'v.' :
                                word.part_of_speech.toLowerCase().startsWith('adj') ? 'adj.' :
                                word.part_of_speech.toLowerCase().startsWith('adv') ? 'adv.' :
                                word.part_of_speech.toLowerCase().startsWith('prep') ? 'prep.' :
                                word.part_of_speech.toLowerCase().startsWith('conj') ? 'conj.' :
                                word.part_of_speech.toLowerCase().startsWith('pron') ? 'pron.' :
                                word.part_of_speech.toLowerCase().startsWith('inter') ? 'interj.' :
                                word.part_of_speech})
                            </span>
                          )}
                        </h3>
                        <button
                          onClick={() => handleDeleteWord(word.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all duration-300 text-sm"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {word.meaning_primary && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          {word.meaning_primary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              
              {/* Word Count */}
              <p className="mt-8 text-center text-slate-400 dark:text-slate-600 text-sm">
                {words.length} {words.length === 1 ? 'word' : 'words'} in your library
              </p>
            </>
          )}
        </div>

        {/* Incomplete Words Modal */}
        {showIncompleteList && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100">
                  Incomplete Words ({wordsWithoutMeaning.length + wordsWithoutPOS.length - words.filter(w => !hasContent(w.meaning_primary) && !hasContent(w.part_of_speech)).length})
                </h2>
                <button
                  onClick={() => setShowIncompleteList(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {wordsWithoutMeaning.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Missing Meaning ({wordsWithoutMeaning.length})
                    </h3>
                    <div className="grid gap-2 max-h-60 overflow-y-auto p-1">
                      {wordsWithoutMeaning.map((word) => (
                        <div
                          key={word.id}
                          className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors cursor-pointer group"
                          onClick={() => {
                            setShowIncompleteList(false)
                            handleEditWord(word)
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-medium text-slate-900 dark:text-slate-100">{word.word}</span>
                            {word.part_of_speech && (
                              <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                                {word.part_of_speech}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                            Click to edit →
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {wordsWithoutPOS.filter(w => hasContent(w.meaning_primary)).length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Missing Part of Speech ({wordsWithoutPOS.filter(w => hasContent(w.meaning_primary)).length})
                    </h3>
                    <div className="grid gap-2 max-h-60 overflow-y-auto p-1">
                      {wordsWithoutPOS.filter(w => hasContent(w.meaning_primary)).map((word) => (
                        <div
                          key={word.id}
                          className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors cursor-pointer group"
                          onClick={() => {
                            setShowIncompleteList(false)
                            handleEditWord(word)
                          }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-lg font-medium text-slate-900 dark:text-slate-100">{word.word}</span>
                            </div>
                            {word.meaning_primary && (
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {word.meaning_primary}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-3">
                            Click to edit →
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowIncompleteList(false)
                      handleBatchFetch()
                    }}
                    className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium"
                  >
                    Fill All with Cambridge & Oxford
                  </button>
                  <button
                    onClick={() => setShowIncompleteList(false)}
                    className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowIncompleteList(false)
                    handleDeleteIncomplete()
                  }}
                  className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Delete All Incomplete Words
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingWord && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100">
                  Edit Word
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Word *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editFormData.word}
                      onChange={(e) => setEditFormData({ ...editFormData, word: e.target.value })}
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-900 dark:text-white transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleFetchDictionary}
                      disabled={fetchingDictionary || !editFormData.word.trim()}
                      className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm whitespace-nowrap shadow-md flex items-center gap-2"
                      title="Fetch dictionary info from Cambridge Dictionary using AI"
                    >
                      {fetchingDictionary ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          <span>Fetch Info</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Click "Fetch Info" to auto-fill data from Cambridge Dictionary using AI
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Part of Speech
                  </label>
                  <input
                    type="text"
                    value={editFormData.part_of_speech}
                    onChange={(e) => setEditFormData({ ...editFormData, part_of_speech: e.target.value })}
                    placeholder="e.g., noun, verb, adjective"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    CEFR Level
                  </label>
                  <select
                    value={editFormData.cefr_level}
                    onChange={(e) => setEditFormData({ ...editFormData, cefr_level: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-900 dark:text-white transition-colors"
                  >
                    <option value="">Select level</option>
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                    <option value="C2">C2 - Proficient</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Meaning
                  </label>
                  <textarea
                    value={editFormData.meaning_primary}
                    onChange={(e) => setEditFormData({ ...editFormData, meaning_primary: e.target.value })}
                    placeholder="Primary definition or translation"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Usage Tips
                  </label>
                  <textarea
                    value={editFormData.usage_tips}
                    onChange={(e) => setEditFormData({ ...editFormData, usage_tips: e.target.value })}
                    placeholder="Example sentences or usage notes"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quiz Mode */}
        {showQuiz && (
          <QuizMode 
            words={words} 
            onClose={() => setShowQuiz(false)} 
          />
        )}
      </div>
      )}
    </main>
  )
}
