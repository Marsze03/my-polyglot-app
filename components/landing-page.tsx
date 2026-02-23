'use client'

import { useState } from 'react'
import AuthModal from './auth-modal'

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-brand font-bold text-slate-900 dark:text-white">
            Polyglot
          </div>
          <button
            onClick={() => setShowAuth(true)}
            className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-brand font-bold text-slate-900 dark:text-white mb-6 leading-tight">
            Master Languages
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              One Word at a Time
            </span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Build your vocabulary effortlessly with AI-powered definitions, smart quizzes, and offline access. Your personal language learning companion.
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl"
          >
            Get Started Free
          </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className="text-xl font-brand font-semibold text-slate-900 dark:text-white mb-3">
              AI-Powered Learning
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Automatically fetch definitions from Oxford and Cambridge dictionaries with intelligent AI processing.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
                <path d="M12 2v20M2 12h20"/>
              </svg>
            </div>
            <h3 className="text-xl font-brand font-semibold text-slate-900 dark:text-white mb-3">
              Works Offline
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              View and add vocabulary anytime, anywhere. Your words sync automatically when you're back online.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl p-8 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-14 h-14 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
            </div>
            <h3 className="text-xl font-brand font-semibold text-slate-900 dark:text-white mb-3">
              Smart Quizzes
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Test your knowledge with flashcards, multiple choice, typing tests, and meaning challenges.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 rounded-3xl p-12 shadow-2xl">
          <h2 className="text-4xl font-brand font-bold text-white mb-4">
            Ready to expand your vocabulary?
          </h2>
          <p className="text-slate-300 text-lg mb-8">
            Join thousands of language learners building their word mastery.
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-semibold text-lg hover:bg-slate-100 transition-all shadow-lg"
          >
            Start Learning Now
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 dark:text-slate-400 text-sm">
          © 2026 Polyglot. Built for language learners, by language learners.
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
