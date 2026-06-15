'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface MasteryDetails {
  mastery_event_id: string
  public_slug: string
  next_review_date: string
  mastery_card_text: string
}

interface SessionClientProps {
  topicId: string
  topicTitle: string
  courseId: string
  courseName: string
  difficulty: string | null
}

export default function SessionClient({
  topicId,
  topicTitle,
  courseId,
  courseName,
  difficulty,
}: SessionClientProps) {
  const router = useRouter()
  const [sessionStarted, setSessionStarted] = useState(false)
  const [learningGoal, setLearningGoal] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [roundNumber, setRoundNumber] = useState(1)

  // Loading States
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingCard, setIsGeneratingCard] = useState(false)
  const [isSharingFeed, setIsSharingFeed] = useState(false)
  const [hasSharedFeed, setHasSharedFeed] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  
  // Celebration / Mastery Modal
  const [showCelebration, setShowCelebration] = useState(false)
  const [masteryDetails, setMasteryDetails] = useState<MasteryDetails | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Reset copy state after 2 seconds
  useEffect(() => {
    if (copiedLink) {
      const timer = setTimeout(() => setCopiedLink(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copiedLink])

  // Get dynamic char limit based on state
  const charLimit = sessionStarted ? 3000 : 2000

  // Start the Socratic Session (Round 0)
  async function handleStartSession() {
    if (inputValue.trim().length < 10 || inputValue.trim().length > 2000) return
    setIsLoading(true)
    setApiError(null)

    try {
      const response = await fetch('/api/llm/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          initial_explanation: inputValue.trim(),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error?.message || 'Gagal memulai sesi Socratic.')
      }

      const { learning_goal, socratic_question } = result.data
      setLearningGoal(learning_goal)
      setMessages([
        { role: 'user', content: inputValue.trim() },
        { role: 'assistant', content: socratic_question },
      ])
      setInputValue('')
      setSessionStarted(true)
    } catch (err: any) {
      setApiError(err.message || 'Terjadi kesalahan sistem. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  // Submit explanation (Round 1+)
  async function handleSubmitExplanation() {
    if (inputValue.trim().length < 10 || inputValue.trim().length > 3000) return
    setIsLoading(true)
    setApiError(null)

    const currentExplanation = inputValue.trim()
    
    // Optimistically add user message
    const updatedMessages: Message[] = [...messages, { role: 'user', content: currentExplanation }]
    setMessages(updatedMessages)
    setInputValue('')

    try {
      const response = await fetch('/api/llm/submit-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          learning_goal: learningGoal,
          explanation: currentExplanation,
          round_number: roundNumber,
          conversation_history: messages,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error?.message || 'Gagal mengirim penjelasan.')
      }

      const evalData = result.data

      if (evalData.status === 'invalid') {
        // AI rejected explanations (e.g. copying text, too short)
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: evalData.message },
        ])
        // Let the user retry this round
      } else if (evalData.status === 'continue') {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: evalData.socratic_question },
        ])
        setRoundNumber(prev => prev + 1)
      } else if (evalData.status === 'mastery') {
        // Show celebration, then generate mastery card
        setShowCelebration(true)
        await handleGenerateMasteryCard(evalData.best_explanation, updatedMessages)
      }
    } catch (err: any) {
      setApiError(err.message || 'Terjadi kesalahan sistem. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  // Generate Mastery Card
  async function handleGenerateMasteryCard(bestExplanation: string, finalHistory: Message[]) {
    setIsGeneratingCard(true)
    try {
      const response = await fetch('/api/llm/generate-mastery-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          best_explanation: bestExplanation,
          rounds_taken: roundNumber,
          conversation_history: finalHistory,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error?.message || 'Gagal membuat kartu mastery.')
      }

      setMasteryDetails(result.data)
    } catch (err: any) {
      console.error(err)
      setApiError('Gagal menyimpan kartu mastery ke database. Hubungi admin.')
    } finally {
      setIsGeneratingCard(false)
    }
  }

  // Copy shareable link to clipboard
  function handleCopyShareLink() {
    if (!masteryDetails) return
    const publicUrl = `${window.location.origin}/card/${masteryDetails.public_slug}`
    navigator.clipboard.writeText(publicUrl)
    setCopiedLink(true)
  }

  // Share to Classroom Feed
  async function handleShareToFeed() {
    if (!masteryDetails) return
    setIsSharingFeed(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mastery_event_id: masteryDetails.mastery_event_id,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error?.message || 'Gagal membagikan ke feed kelas.')
      }

      setHasSharedFeed(true)
    } catch (err: any) {
      alert(err.message || 'Gagal membagikan. Mungkin sudah dibagikan.')
    } finally {
      setIsSharingFeed(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950 font-sans min-h-[calc(100vh-64px)]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/courses/${courseId}`)}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Kembali ke course"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
              Sesi Socratic: {topicTitle}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {courseName} {difficulty && `• ${difficulty.toUpperCase()}`}
            </p>
          </div>
        </div>
        {sessionStarted && learningGoal && (
          <div className="hidden sm:block max-w-sm rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 truncate">
            Target: {learningGoal}
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {!sessionStarted ? (
          /* Landing Screen (Setup Turn) */
          <div className="flex flex-col flex-1 items-center justify-center py-8 max-w-2xl mx-auto">
            {/* Socratic Info Banner */}
            <div className="mb-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 text-zinc-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-zinc-300">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-sm">
                  ?
                </span>
                <div>
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                    Tentang Metode Socratic Sabi
                  </h3>
                  <p className="text-sm leading-relaxed">
                    Sabi menggunakan metode pembelajaran Socratic. Kami <strong>tidak memberikan jawaban langsung</strong>. 
                    Tutor AI kami akan memandu Anda melalui dialog kritis agar Anda dapat memahami konsep 
                    dengan kata-kata dan penalaran Anda sendiri.
                  </p>
                </div>
              </div>
            </div>

            {/* Initial Explanation Form */}
            <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50 mb-2">
                Tulis penjelasan awal kamu tentang topik ini
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
                Jelaskan apa yang kamu ketahui mengenai <strong>&ldquo;{topicTitle}&rdquo;</strong> saat ini. 
                Tuliskan minimal 10 karakter. Tutor akan menelaah pemahamanmu untuk memulainya.
              </p>

              {apiError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  {apiError}
                </div>
              )}

              <div className="relative">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Tulis pemahamanmu di sini..."
                  rows={6}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
                />
                <div className="absolute bottom-3 right-3 text-xs text-zinc-400 bg-white/85 dark:bg-zinc-900/85 px-1.5 py-0.5 rounded">
                  {inputValue.length} / {charLimit}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Minimal 10, maksimal 2000 karakter.
                </span>
                <button
                  onClick={handleStartSession}
                  disabled={isLoading || inputValue.length < 10 || inputValue.length > 2000}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-zinc-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Menganalisis...
                    </>
                  ) : (
                    'Mulai Sesi'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Interface */
          <div className="flex flex-col flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden min-h-[450px]">
            {/* Learning Goal Banner */}
            <div className="bg-indigo-50/40 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 dark:bg-indigo-950/10 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Target Pembelajaran
              </span>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full dark:bg-indigo-900/60 dark:text-indigo-300">
                Ronde {roundNumber}
              </span>
            </div>
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {learningGoal}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={index}
                    className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg text-sm font-bold shadow-sm ${
                        isUser
                          ? 'bg-zinc-900 text-white dark:bg-zinc-700'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {isUser ? 'M' : 'T'}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 rounded-tr-none'
                          : 'bg-indigo-50/50 border border-indigo-100 text-zinc-900 dark:bg-zinc-950/40 dark:border-indigo-950/60 dark:text-zinc-100 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                )
              })}

              {/* Thought Process Loading Bubble */}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%] mr-auto items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-bold">
                    T
                  </div>
                  <div className="rounded-2xl rounded-tl-none border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      <span>Tutor sedang merenung</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </div>
                    <p className="text-sm leading-normal">Mengkaji pemahamanmu untuk memformulasikan pertanyaan Socratic selanjutnya...</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* API Warning/Error message */}
            {apiError && (
              <div className="px-4 py-3 bg-red-50 text-xs text-red-600 border-t border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">
                {apiError}
              </div>
            )}

            {/* Chat Input Field */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900/60">
              <div className="relative">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ketik penjelasan tambahan atau jawabanmu..."
                  rows={3}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 pr-16 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-indigo-400"
                />
                <div className="absolute bottom-3 right-3 text-xs text-zinc-400 bg-white/80 dark:bg-zinc-950/80 px-1 rounded">
                  {inputValue.length} / {charLimit}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Minimal 10, maksimal 3000 karakter.
                </span>
                <button
                  onClick={handleSubmitExplanation}
                  disabled={isLoading || inputValue.length < 10 || inputValue.length > 3000}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-zinc-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    'Kirim Jawaban'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Celebratory Screen / Mastery Card Generator Modal */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          {/* Confetti floating style container */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Custom CSS for simple confetti */}
            <div className="absolute top-0 left-1/4 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-75"></div>
            <div className="absolute top-12 left-2/3 w-2.5 h-2.5 bg-yellow-400 rotate-45 animate-bounce"></div>
            <div className="absolute top-24 left-1/3 w-3 h-1.5 bg-green-400 animate-pulse"></div>
            <div className="absolute top-8 left-4/5 w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="absolute top-16 left-1/10 w-2 h-2.5 bg-purple-400 rotate-12 animate-ping"></div>
          </div>

          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-center flex flex-col items-center">
            {/* Stamp Icon / Celebrating Seal */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            </div>

            <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              Selamat! Kamu Menguasai Topik!
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Penjelasanmu telah dianalisis dan dinyatakan memenuhi target pembelajaran setelah {roundNumber} ronde.
            </p>

            {/* The Stamp/Mastery Card Container */}
            <div className="my-6 w-full relative">
              {isGeneratingCard ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-950">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-2"></div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Menerbitkan Kartu Paspor Pemahaman...</p>
                </div>
              ) : masteryDetails ? (
                /* Stamp Passport Card Design */
                <div className="relative overflow-hidden bg-amber-50/20 border-2 border-dashed border-amber-500/60 dark:border-amber-600/60 dark:bg-amber-950/10 p-5 rounded-2xl text-left shadow-sm">
                  {/* Wax Seal Seal Overlay */}
                  <div className="absolute top-2 right-2 flex rotate-12 border-2 border-emerald-600 text-emerald-600 font-serif text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-widest bg-white dark:bg-zinc-900">
                    SABI MASTERED
                  </div>

                  <div className="text-[10px] font-bold text-amber-700/80 dark:text-amber-500/80 uppercase tracking-widest mb-1.5">
                    Kartu Paspor Pemahaman
                  </div>
                  <h3 className="font-extrabold text-base text-zinc-800 dark:text-zinc-100 font-serif leading-tight">
                    {topicTitle}
                  </h3>
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                    Mata Kuliah: {courseName}
                  </div>

                  <blockquote className="border-l-2 border-amber-400/80 pl-3 italic text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed mb-4">
                    &ldquo;{masteryDetails.mastery_card_text}&rdquo;
                  </blockquote>

                  {/* SM-2 Metadata Stamp Footer */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    <div>
                      <span className="block text-zinc-400 uppercase">Interval Review</span>
                      <span className="text-zinc-700 dark:text-zinc-200 font-mono font-bold text-xs">1 Hari (SM-2)</span>
                    </div>
                    <div>
                      <span className="block text-zinc-400 uppercase">Review Berikutnya</span>
                      <span className="text-zinc-700 dark:text-zinc-200 font-mono font-bold text-xs">
                        {masteryDetails.next_review_date}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  Gagal mendapatkan data paspor mastery.
                </div>
              )}
            </div>

            {/* Call to Actions */}
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={handleCopyShareLink}
                disabled={!masteryDetails}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 hover:border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:text-zinc-900 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                {copiedLink ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-emerald-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className="text-emerald-600 font-bold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                    </svg>
                    Salin Link Share
                  </>
                )}
              </button>

              <button
                onClick={handleShareToFeed}
                disabled={!masteryDetails || isSharingFeed || hasSharedFeed}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/80 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-60"
              >
                {isSharingFeed ? (
                  <>
                    <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                    Membagikan...
                  </>
                ) : hasSharedFeed ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-indigo-600 dark:text-indigo-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Berhasil Dibagikan ke Feed!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v3m0 0v3m0-3h3m-3 0H9" />
                    </svg>
                    Bagikan ke Feed Kelas
                  </>
                )}
              </button>

              <button
                onClick={() => router.push(`/courses/${courseId}`)}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 transition-colors mt-2"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
