'use client'

import { useState, useEffect } from 'react'

type VocabWord = {
  id: number
  word: string
  part_of_speech?: string
  cefr_level?: string
  meaning_primary?: string
  usage_tips?: string
  lang_id?: number
}

type QuizModeProps = {
  words: VocabWord[]
  onClose: () => void
}

type StudyMode = 'flashcard' | 'multiple-choice' | 'typing' | 'meaning-test'
type QuizSettings = {
  mode: StudyMode
  filter: 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  count: number
}

export function QuizMode({ words, onClose }: QuizModeProps) {
  const [showSettings, setShowSettings] = useState(true)
  const [settings, setSettings] = useState<QuizSettings>({
    mode: 'flashcard',
    filter: 'all',
    count: 10
  })
  const [quizWords, setQuizWords] = useState<VocabWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0, maxStreak: 0 })
  const [quizComplete, setQuizComplete] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [multipleChoices, setMultipleChoices] = useState<string[]>([])
  const [mistakeWords, setMistakeWords] = useState<VocabWord[]>([])
  const [startTime, setStartTime] = useState<number>(0)
  const [studyTimeSeconds, setStudyTimeSeconds] = useState(0)

  // Start quiz with selected settings
  const startQuiz = () => {
    let filtered = words.filter(w => w.meaning_primary && w.meaning_primary.trim())
    
    if (settings.filter !== 'all') {
      filtered = filtered.filter(w => w.cefr_level === settings.filter)
    }
    
    const shuffled = [...filtered].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(settings.count, shuffled.length))
    
    setQuizWords(selected)
    setShowSettings(false)
    setStartTime(Date.now())
  }

  // Generate multiple choice options
  useEffect(() => {
    if (settings.mode === 'multiple-choice' && quizWords.length > 0 && currentIndex < quizWords.length) {
      const currentWord = quizWords[currentIndex]
      const correctAnswer = currentWord.meaning_primary!
      
      // Get 3 random wrong answers
      const wrongAnswers = quizWords
        .filter(w => w.id !== currentWord.id && w.meaning_primary)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.meaning_primary!)
      
      // Shuffle all answers
      const allChoices = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5)
      setMultipleChoices(allChoices)
    }
  }, [currentIndex, quizWords, settings.mode])

  const currentWord = quizWords[currentIndex]

  const handleNext = () => {
    setShowAnswer(false)
    setUserAnswer('')
    setSelectedChoice(null)
    if (currentIndex + 1 >= quizWords.length) {
      setQuizComplete(true)
      setStudyTimeSeconds(Math.floor((Date.now() - startTime) / 1000))
    } else {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleKnow = () => {
    const newStreak = score.streak + 1
    setScore({ 
      ...score, 
      correct: score.correct + 1, 
      total: score.total + 1,
      streak: newStreak,
      maxStreak: Math.max(score.maxStreak, newStreak)
    })
    handleNext()
  }

  const handleDontKnow = () => {
    setScore({ ...score, total: score.total + 1, streak: 0 })
    setMistakeWords([...mistakeWords, currentWord])
    setShowAnswer(true)
  }

  const handleMultipleChoice = (choice: string) => {
    setSelectedChoice(choice)
    const isCorrect = choice === currentWord.meaning_primary
    const newStreak = isCorrect ? score.streak + 1 : 0
    
    setScore({
      ...score,
      correct: isCorrect ? score.correct + 1 : score.correct,
      total: score.total + 1,
      streak: newStreak,
      maxStreak: Math.max(score.maxStreak, newStreak)
    })
    
    if (!isCorrect) {
      setMistakeWords([...mistakeWords, currentWord])
    }
    
    setTimeout(handleNext, 1500)
  }

  const handleTypingSubmit = () => {
    if (!userAnswer.trim()) return
    
    const isCorrect = userAnswer.toLowerCase().trim() === currentWord.word.toLowerCase().trim()
    const newStreak = isCorrect ? score.streak + 1 : 0
    
    setScore({
      ...score,
      correct: isCorrect ? score.correct + 1 : score.correct,
      total: score.total + 1,
      streak: newStreak,
      maxStreak: Math.max(score.maxStreak, newStreak)
    })
    
    if (!isCorrect) {
      setMistakeWords([...mistakeWords, currentWord])
    }
    
    setShowAnswer(true)
  }

  const handleMeaningTestSubmit = () => {
    if (!userAnswer.trim()) return
    
    // Check if the user's answer is similar to the correct meaning
    const userAns = userAnswer.toLowerCase().trim()
    const correctMeaning = currentWord.meaning_primary?.toLowerCase().trim() || ''
    
    // Simple similarity check: correct if answer contains main keywords or is very similar
    const isCorrect = userAns === correctMeaning || 
                     correctMeaning.includes(userAns) || 
                     userAns.includes(correctMeaning)
    
    const newStreak = isCorrect ? score.streak + 1 : 0
    
    setScore({
      ...score,
      correct: isCorrect ? score.correct + 1 : score.correct,
      total: score.total + 1,
      streak: newStreak,
      maxStreak: Math.max(score.maxStreak, newStreak)
    })
    
    if (!isCorrect) {
      setMistakeWords([...mistakeWords, currentWord])
    }
    
    setShowAnswer(true)
  }

  const handleRestart = () => {
    const shuffled = [...quizWords].sort(() => Math.random() - 0.5)
    setQuizWords(shuffled)
    setCurrentIndex(0)
    setShowAnswer(false)
    setScore({ correct: 0, total: 0, streak: 0, maxStreak: 0 })
    setQuizComplete(false)
    setUserAnswer('')
    setSelectedChoice(null)
    setMistakeWords([])
    setStartTime(Date.now())
  }

  const handleRetryMistakes = () => {
    if (mistakeWords.length === 0) return
    setQuizWords([...mistakeWords].sort(() => Math.random() - 0.5))
    setCurrentIndex(0)
    setShowAnswer(false)
    setScore({ correct: 0, total: 0, streak: 0, maxStreak: 0 })
    setQuizComplete(false)
    setUserAnswer('')
    setSelectedChoice(null)
    setMistakeWords([])
    setStartTime(Date.now())
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (quizWords.length === 0 && !showSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100 mb-4">
            No Words Available
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Add some words with meanings to start studying!
          </p>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (quizComplete) {
    const percentage = Math.round((score.correct / score.total) * 100)
    const emoji = percentage >= 90 ? '🏆' : percentage >= 70 ? '🎉' : percentage >= 50 ? '👍' : '📚'
    const message = percentage >= 90 ? 'Outstanding!' : percentage >= 70 ? 'Great Job!' : percentage >= 50 ? 'Good Effort!' : 'Keep Practicing!'
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          <div className="text-center">
            <div className="text-6xl mb-4">{emoji}</div>
            <h2 className="text-3xl font-brand font-medium text-slate-900 dark:text-slate-100 mb-2">
              {message}
            </h2>
            
            <div className="grid grid-cols-2 gap-4 my-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30">
                <div className="text-3xl font-brand font-semibold text-blue-600 dark:text-blue-400">
                  {percentage}%
                </div>
                <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                  Accuracy
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30">
                <div className="text-3xl font-brand font-semibold text-emerald-600 dark:text-emerald-400">
                  {score.correct}/{score.total}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                  Correct
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-2xl p-4 border border-violet-100 dark:border-violet-900/30">
                <div className="text-3xl font-brand font-semibold text-violet-600 dark:text-violet-400">
                  {score.maxStreak}
                </div>
                <div className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-1">
                  Best Streak
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-amber-950/30 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30">
                <div className="text-3xl font-brand font-semibold text-amber-600 dark:text-amber-400">
                  {formatTime(studyTimeSeconds)}
                </div>
                <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                  Time
                </div>
              </div>
            </div>

            {mistakeWords.length > 0 && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-left">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Words to Review ({mistakeWords.length})
                </h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {mistakeWords.map((word, idx) => (
                    <div key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <span className="text-red-500">•</span>
                      <span className="font-medium">{word.word}</span>
                      <span className="text-xs">→ {word.meaning_primary}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {mistakeWords.length > 0 && (
                <button
                  onClick={handleRetryMistakes}
                  className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium"
                >
                  Review Mistakes ({mistakeWords.length})
                </button>
              )}
              <button
                onClick={handleRestart}
                className="w-full px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
              >
                Back to Library
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100">
              Study Settings
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Study Mode
              </label>
              <div className="space-y-2">
                {[
                  { value: 'flashcard' as StudyMode, label: 'Flashcards', icon: '📇', desc: 'Click to reveal answers' },
                  { value: 'multiple-choice' as StudyMode, label: 'Multiple Choice', icon: '✓', desc: 'Choose the correct meaning' },
                  { value: 'typing' as StudyMode, label: 'Typing Test', icon: '⌨️', desc: 'Type the word from meaning' },
                  { value: 'meaning-test' as StudyMode, label: 'Meaning Test', icon: '✍️', desc: 'Type the meaning of the word' }
                ].map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => setSettings({ ...settings, mode: mode.value })}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      settings.mode === mode.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{mode.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{mode.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{mode.desc}</div>
                      </div>
                      {settings.mode === mode.value && (
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Filter by Level
              </label>
              <select
                value={settings.filter}
                onChange={(e) => setSettings({ ...settings, filter: e.target.value as any })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              >
                <option value="all">All Levels</option>
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper Intermediate</option>
                <option value="C1">C1 - Advanced</option>
                <option value="C2">C2 - Proficient</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Number of Words: {settings.count}
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={settings.count}
                onChange={(e) => setSettings({ ...settings, count: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            <button
              onClick={startQuiz}
              disabled={quizWords.length === 0 && words.filter(w => w.meaning_primary && w.meaning_primary.trim()).length === 0}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg text-lg"
            >
              Start Studying
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-brand font-medium text-slate-900 dark:text-slate-100">
              Study Mode
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {currentIndex + 1} of {quizWords.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {currentIndex + 1} of {quizWords.length}
            </div>
            {score.streak > 0 && (
              <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-900/30 rounded-full">
                <span className="text-sm">🔥</span>
                <span className="text-sm font-medium text-orange-600 dark:text-orange-400">{score.streak} streak</span>
              </div>
            )}
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / quizWords.length) * 100}%` }}
            />
          </div>
          {score.total > 0 && (
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">
              Score: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)
            </div>
          )}
        </div>

        <div className="mb-8">
          {settings.mode === 'flashcard' && (
            <div 
              className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl p-12 min-h-[300px] flex flex-col items-center justify-center text-center border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setShowAnswer(!showAnswer)}
            >
              <div className="mb-4">
                <div className="text-5xl font-brand font-medium text-slate-900 dark:text-slate-100 mb-4">
                  {currentWord.word}
                  {currentWord.part_of_speech && (
                    <span className="ml-3 text-2xl text-slate-400 dark:text-slate-500 font-normal">
                      ({currentWord.part_of_speech.toLowerCase().startsWith('n') ? 'n.' : 
                        currentWord.part_of_speech.toLowerCase().startsWith('v') ? 'v.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adj') ? 'adj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adv') ? 'adv.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('prep') ? 'prep.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('conj') ? 'conj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('pron') ? 'pron.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('inter') ? 'interj.' :
                        currentWord.part_of_speech})
                    </span>
                  )}
                </div>
              </div>

              {showAnswer ? (
                <div className="mt-6 space-y-4 animate-fadeIn">
                  <div className="text-xl text-slate-700 dark:text-slate-300">
                    {currentWord.meaning_primary}
                  </div>
                  {currentWord.cefr_level && (
                    <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
                      Level: {currentWord.cefr_level}
                    </div>
                  )}
                  {currentWord.usage_tips && (
                    <div className="mt-4 p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                      💡 {currentWord.usage_tips}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 text-slate-400 dark:text-slate-500 text-sm">
                  Click to reveal answer
                </div>
              )}
            </div>
          )}

          {settings.mode === 'multiple-choice' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                <div className="text-3xl font-brand font-medium text-slate-900 dark:text-slate-100 mb-2">
                  {currentWord.word}
                  {currentWord.part_of_speech && (
                    <span className="ml-2 text-lg text-slate-400 dark:text-slate-500 font-normal">
                      ({currentWord.part_of_speech.toLowerCase().startsWith('n') ? 'n.' : 
                        currentWord.part_of_speech.toLowerCase().startsWith('v') ? 'v.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adj') ? 'adj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adv') ? 'adv.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('prep') ? 'prep.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('conj') ? 'conj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('pron') ? 'pron.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('inter') ? 'interj.' :
                        currentWord.part_of_speech})
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-4 text-sm">Select the correct meaning:</p>
              </div>
              
              <div className="grid gap-3">
                {multipleChoices.map((choice, idx) => {
                  const isCorrect = choice === currentWord.meaning_primary
                  const isSelected = selectedChoice === choice
                  const showResult = selectedChoice !== null
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleMultipleChoice(choice)}
                      disabled={showResult}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        showResult
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                            : isSelected
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                            : 'border-slate-200 dark:border-slate-700 opacity-50'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-900 dark:text-slate-100">{choice}</span>
                        {showResult && isCorrect && <span className="text-emerald-500">✓</span>}
                        {showResult && isSelected && !isCorrect && <span className="text-red-500">✗</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {settings.mode === 'typing' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                <div className="text-lg text-slate-600 dark:text-slate-400 mb-4">Type the word for:</div>
                <div className="text-3xl font-brand font-medium text-slate-900 dark:text-slate-100 mb-2">
                  {currentWord.meaning_primary}
                  {currentWord.part_of_speech && (
                    <span className="ml-2 text-lg text-slate-400 dark:text-slate-500 font-normal">
                      ({currentWord.part_of_speech.toLowerCase().startsWith('n') ? 'n.' : 
                        currentWord.part_of_speech.toLowerCase().startsWith('v') ? 'v.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adj') ? 'adj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adv') ? 'adv.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('prep') ? 'prep.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('conj') ? 'conj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('pron') ? 'pron.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('inter') ? 'interj.' :
                        currentWord.part_of_speech})
                    </span>
                  )}
                </div>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); handleTypingSubmit(); }} className="space-y-3">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  disabled={showAnswer}
                  className="w-full px-6 py-4 text-center text-2xl bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-50"
                  autoFocus
                />
                
                {showAnswer && (
                  <div className={`p-4 rounded-xl ${
                    userAnswer.toLowerCase().trim() === currentWord.word.toLowerCase().trim()
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500'
                      : 'bg-red-50 dark:bg-red-950/30 border-2 border-red-500'
                  }`}>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      {userAnswer.toLowerCase().trim() === currentWord.word.toLowerCase().trim() ? '✓ Correct!' : '✗ Incorrect'}
                    </div>
                    {userAnswer.toLowerCase().trim() !== currentWord.word.toLowerCase().trim() && (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Correct answer: <span className="font-medium">{currentWord.word}</span>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          )}

          {settings.mode === 'meaning-test' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 rounded-2xl p-8 text-center border border-purple-200 dark:border-purple-800">
                <div className="text-lg text-purple-600 dark:text-purple-400 mb-4">What does this word mean?</div>
                <div className="text-5xl font-brand font-medium text-slate-900 dark:text-slate-100 mb-2">
                  {currentWord.word}
                  {currentWord.part_of_speech && (
                    <span className="ml-3 text-2xl text-slate-400 dark:text-slate-500 font-normal">
                      ({currentWord.part_of_speech.toLowerCase().startsWith('n') ? 'n.' : 
                        currentWord.part_of_speech.toLowerCase().startsWith('v') ? 'v.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adj') ? 'adj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('adv') ? 'adv.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('prep') ? 'prep.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('conj') ? 'conj.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('pron') ? 'pron.' :
                        currentWord.part_of_speech.toLowerCase().startsWith('inter') ? 'interj.' :
                        currentWord.part_of_speech})
                    </span>
                  )}
                </div>
                {currentWord.cefr_level && (
                  <div className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm mt-2">
                    Level: {currentWord.cefr_level}
                  </div>
                )}
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); handleMeaningTestSubmit(); }} className="space-y-3">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type the meaning..."
                  disabled={showAnswer}
                  rows={3}
                  className="w-full px-6 py-4 text-lg bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:outline-none focus:border-purple-500 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-50 resize-none"
                  autoFocus
                />
                
                {showAnswer && (
                  <div className={`p-4 rounded-xl ${
                    userAnswer.toLowerCase().trim() === currentWord.meaning_primary?.toLowerCase().trim() ||
                    currentWord.meaning_primary?.toLowerCase().includes(userAnswer.toLowerCase().trim()) ||
                    userAnswer.toLowerCase().trim().includes(currentWord.meaning_primary?.toLowerCase().trim() || '')
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500'
                  }`}>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                      {userAnswer.toLowerCase().trim() === currentWord.meaning_primary?.toLowerCase().trim() ||
                       currentWord.meaning_primary?.toLowerCase().includes(userAnswer.toLowerCase().trim()) ||
                       userAnswer.toLowerCase().trim().includes(currentWord.meaning_primary?.toLowerCase().trim() || '')
                        ? '✓ Correct!' : '⚠ Check the correct meaning:'}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                      <strong>Correct meaning:</strong> {currentWord.meaning_primary}
                    </div>
                    {userAnswer.trim() && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        <strong>Your answer:</strong> {userAnswer}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {settings.mode === 'flashcard' && !showAnswer && (
            <>
              <button
                onClick={handleKnow}
                className="w-full px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-medium shadow-lg"
              >
                ✓ I Know This
              </button>
              <button
                onClick={handleDontKnow}
                className="w-full px-6 py-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-colors font-medium"
              >
                Show Answer
              </button>
            </>
          )}
          
          {settings.mode === 'flashcard' && showAnswer && (
            <button
              onClick={handleNext}
              className="w-full px-6 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors font-medium shadow-lg"
            >
              {currentIndex + 1 >= quizWords.length ? 'Finish' : 'Next Word'} →
            </button>
          )}

          {settings.mode === 'typing' && !showAnswer && (
            <button
              onClick={handleTypingSubmit}
              disabled={!userAnswer.trim()}
              className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Answer
            </button>
          )}

          {settings.mode === 'typing' && showAnswer && (
            <button
              onClick={handleNext}
              className="w-full px-6 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors font-medium shadow-lg"
            >
              {currentIndex + 1 >= quizWords.length ? 'Finish' : 'Next Word'} →
            </button>
          )}

          {settings.mode === 'meaning-test' && !showAnswer && (
            <button
              onClick={handleMeaningTestSubmit}
              disabled={!userAnswer.trim()}
              className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Answer
            </button>
          )}

          {settings.mode === 'meaning-test' && showAnswer && (
            <button
              onClick={handleNext}
              className="w-full px-6 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors font-medium shadow-lg"
            >
              {currentIndex + 1 >= quizWords.length ? 'Finish' : 'Next Word'} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
