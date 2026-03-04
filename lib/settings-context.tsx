'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type DictionarySource = 'cambridge' | 'oxford' | 'google' | 'urban' | 'auto'
export type QuizMode = 'flashcard' | 'multiple-choice' | 'typing' | 'meaning-test'
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge'

export interface AppSettings {
  // Appearance
  fontSize: FontSize
  compactView: boolean
  showWordCount: boolean
  
  // Dictionary Preferences
  defaultDictionary: DictionarySource
  maxDefinitions: number
  showExamples: boolean
  autoPlayPronunciation: boolean
  
  // Quiz Settings
  defaultQuizMode: QuizMode
  questionsPerSession: number
  showAnswersImmediately: boolean
  enableTimedQuiz: boolean
  quizTimeLimitMinutes: number
  
  // Offline & Storage
  offlineMode: boolean
  autoDownload: boolean
  
  // Notifications
  dailyReminders: boolean
  achievementNotifications: boolean
  reminderTime: string // HH:MM format
  
  // Learning
  reviewIntervalDays: number
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'auto'
  
  // Accessibility
  highContrast: boolean
  reduceAnimations: boolean
}

const defaultSettings: AppSettings = {
  // Appearance
  fontSize: 'medium',
  compactView: false,
  showWordCount: true,
  
  // Dictionary
  defaultDictionary: 'auto',
  maxDefinitions: 3,
  showExamples: true,
  autoPlayPronunciation: false,
  
  // Quiz
  defaultQuizMode: 'flashcard',
  questionsPerSession: 10,
  showAnswersImmediately: true,
  enableTimedQuiz: false,
  quizTimeLimitMinutes: 5,
  
  // Offline
  offlineMode: true,
  autoDownload: false,
  
  // Notifications
  dailyReminders: false,
  achievementNotifications: true,
  reminderTime: '09:00',
  
  // Learning
  reviewIntervalDays: 7,
  difficultyLevel: 'auto',
  
  // Accessibility
  highContrast: false,
  reduceAnimations: false,
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  resetSettings: () => void
  exportSettings: () => string
  importSettings: (jsonString: string) => boolean
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
  exportSettings: () => '',
  importSettings: () => false,
})

export const useSettings = () => useContext(SettingsContext)

const SETTINGS_STORAGE_KEY = 'verba_user_settings'

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSettings({ ...defaultSettings, ...parsed })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoaded(true)
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    }
  }, [settings, loaded])

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  const exportSettings = () => {
    return JSON.stringify(settings, null, 2)
  }

  const importSettings = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString)
      setSettings({ ...defaultSettings, ...parsed })
      return true
    } catch (error) {
      console.error('Failed to import settings:', error)
      return false
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        exportSettings,
        importSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
