'use client'

import { useState } from 'react'
import { useSettings } from '@/lib/settings-context'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth-context'
import { getOfflineVocabs } from '@/lib/offline-storage'

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings()
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const [activeSection, setActiveSection] = useState('appearance')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false)
  const [importSuccess, setImportSuccess] = useState<boolean | null>(null)
  const [refetching, setRefetching] = useState(false)
  const [refetchSuccess, setRefetchSuccess] = useState<string | null>(null)

  const sections = [
    { 
      id: 'appearance', 
      name: 'Appearance', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    },
    { 
      id: 'dictionary', 
      name: 'Dictionary', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    },
    { 
      id: 'quiz', 
      name: 'Quiz & Learning', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    },
    { 
      id: 'offline', 
      name: 'Offline & Storage', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    },
    { 
      id: 'notifications', 
      name: 'Notifications', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    },
    { 
      id: 'accessibility', 
      name: 'Accessibility', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
    },
    { 
      id: 'account', 
      name: 'Account', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    },
    { 
      id: 'about', 
      name: 'About', 
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    },
  ]

  const handleExportSettings = () => {
    const json = exportSettings()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verba-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportSettings = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          const success = importSettings(content)
          setImportSuccess(success)
          setTimeout(() => setImportSuccess(null), 3000)
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleClearOfflineData = () => {
    localStorage.removeItem('verba_offline_vocabs')
    setShowClearDataConfirm(false)
  }

  const getStorageSize = () => {
    const vocabs = getOfflineVocabs()
    const sizeBytes = new Blob([JSON.stringify(vocabs)]).size
    const sizeKB = (sizeBytes / 1024).toFixed(2)
    return `${sizeKB} KB`
  }

  const handleRefetchAll = async () => {
    const confirmed = confirm(
      '🔄 This will refetch all words from the dictionary to update their definitions.\n\n' +
      'This might take a few minutes. Continue?'
    )

    if (!confirmed) return

    try {
      setRefetching(true)
      setRefetchSuccess(null)

      const response = await fetch('/api/refetch-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to refetch all words')
      }

      setRefetchSuccess(`✅ Successfully refetched and updated ${result.updated} words!`)
      setTimeout(() => setRefetchSuccess(null), 5000)
    } catch (err) {
      setRefetchSuccess(`❌ ${err instanceof Error ? err.message : 'Failed to refetch all words'}`)
      setTimeout(() => setRefetchSuccess(null), 5000)
    } finally {
      setRefetching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <a 
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to App
          </a>
          <h1 className="text-4xl font-brand font-bold text-slate-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Customize your Verba experience
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-lg border border-slate-200 dark:border-slate-800">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl mb-1 transition-all flex items-center gap-2 ${
                    activeSection === section.id
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {section.icon}
                  {section.name}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-800">
              {/* Appearance Settings */}
              {activeSection === 'appearance' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Appearance
                  </h2>
                  
                  {/* Theme */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {['light', 'dark', 'system'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`px-4 py-3 rounded-xl border-2 transition-all ${
                            theme === t
                              ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Font Size
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => updateSettings({ fontSize: size })}
                          className={`px-4 py-3 rounded-xl border-2 transition-all ${
                            settings.fontSize === size
                              ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {size === 'xlarge' ? 'XL' : size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compact View */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Compact View</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Show more content in less space</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ compactView: !settings.compactView })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.compactView ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.compactView ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show Word Count */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mt-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Show Word Count</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Display vocabulary statistics</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ showWordCount: !settings.showWordCount })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.showWordCount ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.showWordCount ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Dictionary Settings */}
              {activeSection === 'dictionary' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Dictionary Preferences
                  </h2>

                  {/* Default Dictionary */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Default Dictionary Source
                    </label>
                    <select
                      value={settings.defaultDictionary}
                      onChange={(e) => updateSettings({ defaultDictionary: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="auto">Auto (Best Match)</option>
                      <option value="cambridge">Cambridge Dictionary</option>
                      <option value="oxford">Oxford Dictionary</option>
                      <option value="google">Google Translate</option>
                      <option value="urban">Urban Dictionary</option>
                    </select>
                  </div>

                  {/* Max Definitions */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Maximum Definitions to Show
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={settings.maxDefinitions}
                      onChange={(e) => updateSettings({ maxDefinitions: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-center text-lg font-semibold text-slate-900 dark:text-white mt-2">
                      {settings.maxDefinitions}
                    </div>
                  </div>

                  {/* Show Examples */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Show Example Sentences</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Display usage examples</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ showExamples: !settings.showExamples })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.showExamples ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.showExamples ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto Play Pronunciation */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Auto-Play Pronunciation</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Play audio automatically</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ autoPlayPronunciation: !settings.autoPlayPronunciation })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.autoPlayPronunciation ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.autoPlayPronunciation ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Quiz & Learning Settings */}
              {activeSection === 'quiz' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Quiz & Learning
                  </h2>

                  {/* Default Quiz Mode */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Default Quiz Mode
                    </label>
                    <select
                      value={settings.defaultQuizMode}
                      onChange={(e) => updateSettings({ defaultQuizMode: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="flashcard">Flashcard</option>
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="typing">Typing Test</option>
                      <option value="meaning-test">Meaning Test</option>
                    </select>
                  </div>

                  {/* Questions Per Session */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Questions Per Session
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={settings.questionsPerSession}
                      onChange={(e) => updateSettings({ questionsPerSession: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-center text-lg font-semibold text-slate-900 dark:text-white mt-2">
                      {settings.questionsPerSession}
                    </div>
                  </div>

                  {/* Difficulty Level */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {(['beginner', 'intermediate', 'advanced', 'auto'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => updateSettings({ difficultyLevel: level })}
                          className={`px-4 py-3 rounded-xl border-2 transition-all ${
                            settings.difficultyLevel === level
                              ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Show Answers Immediately */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Show Answers Immediately</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Reveal correct answers after each question</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ showAnswersImmediately: !settings.showAnswersImmediately })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.showAnswersImmediately ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.showAnswersImmediately ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Enable Timed Quiz */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Enable Timed Quiz</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Add time pressure to quizzes</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ enableTimedQuiz: !settings.enableTimedQuiz })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.enableTimedQuiz ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.enableTimedQuiz ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Quiz Time Limit */}
                  {settings.enableTimedQuiz && (
                    <div className="mb-6 ml-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        Time Limit (Minutes)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={settings.quizTimeLimitMinutes}
                        onChange={(e) => updateSettings({ quizTimeLimitMinutes: parseInt(e.target.value) })}
                        className="w-full"
                      />
                      <div className="text-center text-lg font-semibold text-slate-900 dark:text-white mt-2">
                        {settings.quizTimeLimitMinutes} minutes
                      </div>
                    </div>
                  )}

                  {/* Review Interval */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Review Interval (Days)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={settings.reviewIntervalDays}
                      onChange={(e) => updateSettings({ reviewIntervalDays: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="text-center text-lg font-semibold text-slate-900 dark:text-white mt-2">
                      {settings.reviewIntervalDays} days
                    </div>
                  </div>
                </div>
              )}

              {/* Offline & Storage Settings */}
              {activeSection === 'offline' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Offline & Storage
                  </h2>

                  {/* Offline Mode */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Offline Mode</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Save data locally for offline access</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ offlineMode: !settings.offlineMode })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.offlineMode ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.offlineMode ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto Download */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-6">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Auto-Download Content</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Automatically cache definitions offline</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ autoDownload: !settings.autoDownload })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.autoDownload ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.autoDownload ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Storage Usage */}
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">Storage Used</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Offline vocabulary data</div>
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white">
                        {getStorageSize()}
                      </div>
                    </div>
                  </div>

                  {/* Export/Import Buttons */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={handleExportSettings}
                      className="px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      📤 Export Settings
                    </button>
                    <button
                      onClick={handleImportSettings}
                      className="px-4 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      📥 Import Settings
                    </button>
                  </div>

                  {importSuccess !== null && (
                    <div className={`p-3 rounded-xl mb-4 ${
                      importSuccess
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      {importSuccess ? '✅ Settings imported successfully!' : '❌ Failed to import settings'}
                    </div>
                  )}

                  {/* Refetch All Data */}
                  <button
                    onClick={handleRefetchAll}
                    disabled={refetching}
                    className="w-full px-4 py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-xl font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                  >
                    {refetching ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refetching All Words...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        🔄 Refetch All Words
                      </>
                    )}
                  </button>

                  {refetchSuccess && (
                    <div className={`p-3 rounded-xl mb-4 ${
                      refetchSuccess.startsWith('✅')
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      {refetchSuccess}
                    </div>
                  )}

                  {/* Clear Data */}
                  {!showClearDataConfirm ? (
                    <button
                      onClick={() => setShowClearDataConfirm(true)}
                      className="w-full px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      🗑️ Clear Offline Data
                    </button>
                  ) : (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-800">
                      <p className="text-red-700 dark:text-red-400 mb-3 font-medium">
                        Are you sure? This will delete all offline vocabulary data.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleClearOfflineData}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setShowClearDataConfirm(false)}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notifications Settings */}
              {activeSection === 'notifications' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Notifications
                  </h2>

                  {/* Daily Reminders */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Daily Study Reminders</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Get reminded to practice daily</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ dailyReminders: !settings.dailyReminders })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.dailyReminders ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.dailyReminders ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Reminder Time */}
                  {settings.dailyReminders && (
                    <div className="mb-6 ml-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        Reminder Time
                      </label>
                      <input
                        type="time"
                        value={settings.reminderTime}
                        onChange={(e) => updateSettings({ reminderTime: e.target.value })}
                        className="px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Achievement Notifications */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Achievement Notifications</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Get notified of milestones</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ achievementNotifications: !settings.achievementNotifications })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.achievementNotifications ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.achievementNotifications ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Accessibility Settings */}
              {activeSection === 'accessibility' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Accessibility
                  </h2>

                  {/* High Contrast */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">High Contrast Mode</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Increase contrast for better readability</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ highContrast: !settings.highContrast })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.highContrast ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.highContrast ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Reduce Animations */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Reduce Animations</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Minimize motion effects</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ reduceAnimations: !settings.reduceAnimations })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.reduceAnimations ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.reduceAnimations ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Account Settings */}
              {activeSection === 'account' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    Account
                  </h2>

                  {user ? (
                    <>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-6">
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Email</div>
                        <div className="font-medium text-slate-900 dark:text-white">{user.email}</div>
                      </div>

                      <button
                        onClick={signOut}
                        className="w-full px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                      Not signed in
                    </div>
                  )}
                </div>
              )}

              {/* About Settings */}
              {activeSection === 'about' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                    About Verba
                  </h2>

                  <div className="text-center mb-8">
                    <div className="text-6xl font-brand font-bold text-slate-900 dark:text-white mb-2">
                      Verba
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">Version 1.0.0</div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="font-medium text-slate-900 dark:text-white mb-1">📄 Privacy Policy</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Learn how we protect your data</div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="font-medium text-slate-900 dark:text-white mb-1">📋 Terms of Service</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Read our terms and conditions</div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="font-medium text-slate-900 dark:text-white mb-1">💬 Contact Support</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Get help or report issues</div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="font-medium text-slate-900 dark:text-white mb-1">⭐ Rate Our App</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Share your feedback</div>
                    </div>
                  </div>

                  {/* Reset Settings */}
                  <div className="mt-8">
                    {!showResetConfirm ? (
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full px-4 py-3 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-xl font-medium hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                      >
                        ⚙️ Reset All Settings
                      </button>
                    ) : (
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-800">
                        <p className="text-orange-700 dark:text-orange-400 mb-3 font-medium">
                          Reset all settings to default values?
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => {
                              resetSettings()
                              setShowResetConfirm(false)
                            }}
                            className="px-4 py-2 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
                          >
                            Yes, Reset
                          </button>
                          <button
                            onClick={() => setShowResetConfirm(false)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
