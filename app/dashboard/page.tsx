'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'

interface Course {
  id: string
  name: string
  source_type: 'syllabus' | 'free'
  exam_date: string | null
  level: 'intro' | 'intermediate' | 'advanced' | null
  join_code: string | null
  created_at: string
  topic_count: number
  mastery_count: number
}

interface DueReview {
  mastery_event_id: string
  topic_id: string
  topic_title: string
  course_name: string
  next_review_date: string
  days_overdue: number
}

type TabType = 'syllabus' | 'exploration' | 'join'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  
  // Dashboard state
  const [courses, setCourses] = useState<Course[]>([])
  const [dueReviews, setDueReviews] = useState<DueReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('syllabus')

  // Tab 1: Syllabus states
  const [syllabusName, setSyllabusName] = useState('')
  const [syllabusLevel, setSyllabusLevel] = useState<'intro' | 'intermediate' | 'advanced'>('intro')
  const [syllabusExamDate, setSyllabusExamDate] = useState('')
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null)
  const [syllabusError, setSyllabusError] = useState<string | null>(null)
  const [syllabusSubmitting, setSyllabusSubmitting] = useState(false)
  const [syllabusStage, setSyllabusStage] = useState('')
  const [syllabusProgress, setSyllabusProgress] = useState(0)

  // Tab 2: Exploration states
  const [explorationTopic, setExplorationTopic] = useState('')
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [explorationError, setExplorationError] = useState<string | null>(null)
  const [subtopics, setSubtopics] = useState<{ title: string; difficulty: 'basic' | 'intermediate' | 'advanced'; isEditing?: boolean }[]>([])
  const [newSubtopicTitle, setNewSubtopicTitle] = useState('')
  const [newSubtopicDifficulty, setNewSubtopicDifficulty] = useState<'basic' | 'intermediate' | 'advanced'>('basic')
  const [explorationSaving, setExplorationSaving] = useState(false)

  // Tab 3: Join class states
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSubmitting, setJoinSubmitting] = useState(false)

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setDashboardError(null)
      const [coursesRes, reviewsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/reviews/due')
      ])

      if (!coursesRes.ok) throw new Error('Gagal mengambil daftar mata kuliah')
      if (!reviewsRes.ok) throw new Error('Gagal mengambil jadwal review')

      const coursesJson = await coursesRes.json()
      const reviewsJson = await reviewsRes.json()

      setCourses(coursesJson.data || [])
      setDueReviews(reviewsJson.data || [])
    } catch (err: any) {
      console.error(err)
      setDashboardError(err.message || 'Terjadi kesalahan saat memuat dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Calculate stats
  const totalMasteries = courses.reduce((sum, c) => sum + c.mastery_count, 0)
  const totalDueReviews = dueReviews.length

  // Find nearest exam date countdown
  const getExamCountdown = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const futureExams = courses
      .filter(c => c.exam_date)
      .map(c => new Date(c.exam_date!))
      .filter(d => d >= today)
      .sort((a, b) => a.getTime() - b.getTime())

    if (futureExams.length === 0) return null

    const diffTime = futureExams[0].getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const examDaysRemaining = getExamCountdown()

  // Reset Modal States
  const closeModal = () => {
    setIsModalOpen(false)
    // Syllabus reset
    setSyllabusName('')
    setSyllabusLevel('intro')
    setSyllabusExamDate('')
    setSyllabusFile(null)
    setSyllabusError(null)
    setSyllabusSubmitting(false)
    setSyllabusStage('')
    setSyllabusProgress(0)
    // Exploration reset
    setExplorationTopic('')
    setIsDecomposing(false)
    setExplorationError(null)
    setSubtopics([])
    setNewSubtopicTitle('')
    setNewSubtopicDifficulty('basic')
    setExplorationSaving(false)
    // Join reset
    setJoinCode('')
    setJoinError(null)
    setJoinSubmitting(false)
  }

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type !== 'application/pdf') {
        setSyllabusError('Hanya file PDF yang diterima')
        setSyllabusFile(null)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setSyllabusError('Ukuran file maksimal 10MB')
        setSyllabusFile(null)
        return
      }
      setSyllabusFile(file)
      setSyllabusError(null)
    }
  }

  // Handle Tab 1: Syllabus onboarding
  const handleSyllabusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!syllabusName) {
      setSyllabusError('Nama mata kuliah harus diisi')
      return
    }
    if (!syllabusFile) {
      setSyllabusError('Silakan pilih file silabus PDF')
      return
    }

    setSyllabusSubmitting(true)
    setSyllabusError(null)
    setSyllabusProgress(5)
    setSyllabusStage('Memulai pembuatan kelas...')

    let createdCourseId = ''

    try {
      // Step 1: Create Course
      setSyllabusProgress(15)
      setSyllabusStage('Membuat entri mata kuliah...')
      const courseRes = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: syllabusName,
          source_type: 'syllabus',
          level: syllabusLevel,
          exam_date: syllabusExamDate || null,
        }),
      })

      if (!courseRes.ok) {
        const errorJson = await courseRes.json()
        throw new Error(errorJson.message || 'Gagal membuat mata kuliah')
      }
      const courseData = await courseRes.json()
      createdCourseId = courseData.data.id

      // Step 2: Upload PDF File
      setSyllabusProgress(35)
      setSyllabusStage('Mengunggah file silabus ke penyimpanan...')
      const formData = new FormData()
      formData.append('file', syllabusFile)

      const syllabusRes = await fetch(`/api/courses/${createdCourseId}/syllabus`, {
        method: 'POST',
        body: formData,
      })

      if (!syllabusRes.ok) {
        const errorJson = await syllabusRes.json()
        throw new Error(errorJson.message || 'Gagal mengunggah file silabus')
      }

      // Step 3: LLM Parse Syllabus
      setSyllabusProgress(55)
      setSyllabusStage('AI sedang membaca dan mengekstrak topik belajar...')
      
      // Simulate parser progress steps
      const progressInterval = setInterval(() => {
        setSyllabusProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval)
            return 95
          }
          if (prev > 80) {
            setSyllabusStage('Menyusun topik pembelajaran dan tingkat kesulitan...')
            return prev + 2
          }
          if (prev > 65) {
            setSyllabusStage('Menganalisis jadwal ujian dan level silabus...')
            return prev + 3
          }
          return prev + 5
        })
      }, 800)

      const parseRes = await fetch('/api/llm/parse-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: createdCourseId }),
      })

      clearInterval(progressInterval)

      if (!parseRes.ok) {
        const errorJson = await parseRes.json()
        throw new Error(errorJson.message || 'Gagal mengekstrak silabus AI')
      }

      setSyllabusProgress(100)
      setSyllabusStage('Kelas berhasil dibuat!')

      // Redirect to course page
      setTimeout(() => {
        closeModal()
        router.push(`/courses/${createdCourseId}`)
      }, 500)

    } catch (err: any) {
      console.error(err)
      setSyllabusError(err.message || 'Gagal memproses silabus. Silakan coba lagi.')
      setSyllabusSubmitting(false)
      setSyllabusProgress(0)
      setSyllabusStage('')
      // Try to clean up course if created
      if (createdCourseId) {
        fetch(`/api/courses/${createdCourseId}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }

  // Handle Tab 2: Exploration Decompose
  const handleExplorationDecompose = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!explorationTopic.trim()) {
      setExplorationError('Topik eksplorasi harus diisi')
      return
    }

    setIsDecomposing(true)
    setExplorationError(null)
    setSubtopics([])

    try {
      const res = await fetch('/api/llm/decompose-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_string: explorationTopic }),
      })

      if (!res.ok) {
        const errorJson = await res.json()
        throw new Error(errorJson.message || 'Gagal melakukan dekomposisi topik')
      }

      const json = await res.json()
      setSubtopics(json.data?.subtopics || [])
    } catch (err: any) {
      console.error(err)
      setExplorationError(err.message || 'Gagal menganalisis topik. Silakan coba lagi.')
    } finally {
      setIsDecomposing(false)
    }
  }

  // Save Tab 2 Exploration Course
  const handleExplorationSave = async () => {
    if (subtopics.length === 0) {
      setExplorationError('Tidak ada subtopik untuk disimpan. Harap decompose topik terlebih dahulu.')
      return
    }

    setExplorationSaving(true)
    setExplorationError(null)

    let createdCourseId = ''

    try {
      // Step 1: Create Course with source_type = 'free'
      const courseRes = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: explorationTopic,
          source_type: 'free',
        }),
      })

      if (!courseRes.ok) {
        const errorJson = await courseRes.json()
        throw new Error(errorJson.message || 'Gagal membuat topik eksplorasi')
      }
      const courseData = await courseRes.json()
      createdCourseId = courseData.data.id

      // Step 2: Bulk create topics
      await Promise.all(
        subtopics.map((sub, idx) =>
          fetch(`/api/courses/${createdCourseId}/topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: sub.title,
              difficulty: sub.difficulty,
              display_order: idx,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const errJson = await res.json()
              throw new Error(errJson.message || `Gagal menyimpan subtopik: ${sub.title}`)
            }
          })
        )
      )

      closeModal()
      router.push(`/courses/${createdCourseId}`)
    } catch (err: any) {
      console.error(err)
      setExplorationError(err.message || 'Gagal menyimpan subtopik. Silakan coba lagi.')
      setExplorationSaving(false)
      // Cleanup course if created
      if (createdCourseId) {
        fetch(`/api/courses/${createdCourseId}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }

  // Subtopic manipulation (edit/delete/add)
  const deleteSubtopic = (index: number) => {
    setSubtopics((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleEditSubtopic = (index: number, isEditing: boolean) => {
    setSubtopics((prev) =>
      prev.map((sub, i) => (i === index ? { ...sub, isEditing } : sub))
    )
  }

  const updateSubtopicTitle = (index: number, newTitle: string) => {
    setSubtopics((prev) =>
      prev.map((sub, i) => (i === index ? { ...sub, title: newTitle } : sub))
    )
  }

  const cycleDifficulty = (index: number) => {
    const difficulties: ('basic' | 'intermediate' | 'advanced')[] = ['basic', 'intermediate', 'advanced']
    setSubtopics((prev) =>
      prev.map((sub, i) => {
        if (i === index) {
          const currentIdx = difficulties.indexOf(sub.difficulty)
          const nextIdx = (currentIdx + 1) % difficulties.length
          return { ...sub, difficulty: difficulties[nextIdx] }
        }
        return sub
      })
    )
  }

  const addCustomSubtopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtopicTitle.trim()) return

    setSubtopics((prev) => [
      ...prev,
      {
        title: newSubtopicTitle.trim(),
        difficulty: newSubtopicDifficulty,
      },
    ])
    setNewSubtopicTitle('')
    setNewSubtopicDifficulty('basic')
  }

  // Handle Tab 3: Join Class
  const handleJoinClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) {
      setJoinError('Kode kelas harus diisi')
      return
    }

    setJoinSubmitting(true)
    setJoinError(null)

    try {
      const res = await fetch('/api/courses/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_code: joinCode.trim().toUpperCase() }),
      })

      if (!res.ok) {
        const errorJson = await res.json()
        throw new Error(errorJson.message || 'Gagal bergabung dengan kelas')
      }

      const json = await res.json()
      closeModal()
      router.push(`/courses/${json.data.course_id}`)
    } catch (err: any) {
      console.error(err)
      setJoinError(err.message || 'Gagal bergabung dengan kelas. Periksa kembali kode Anda.')
    } finally {
      setJoinSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-10 text-zinc-100 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Dasbor Belajar
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Selamat datang kembali. Siap melatih pemahaman Anda hari ini?
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl px-5 py-3 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] transition-all duration-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Baru
        </button>
      </div>

      {dashboardError && (
        <div className="flex gap-3 items-start p-4 rounded-xl border border-red-950/60 bg-red-950/20 text-red-400 text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-bold">Gagal memuat dasbor</p>
            <p className="opacity-90">{dashboardError}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Mastery Count */}
        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-800 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Materi Dikuasai</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-center text-emerald-400">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight">{isLoading ? '—' : totalMasteries}</span>
            <span className="text-xs text-zinc-500">topik</span>
          </div>
        </div>

        {/* Due Reviews Count */}
        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-800 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Perlu Review</span>
            <div className="h-8 w-8 rounded-lg bg-amber-950/30 border border-amber-900/50 flex items-center justify-center text-amber-400">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-amber-400">
              {isLoading ? '—' : totalDueReviews}
            </span>
            <span className="text-xs text-zinc-500">materi</span>
          </div>
        </div>

        {/* Countdown UTS/UAS */}
        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-900 rounded-2xl p-6 relative overflow-hidden group hover:border-zinc-800 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-violet-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Ujian Terdekat</span>
            <div className="h-8 w-8 rounded-lg bg-violet-950/30 border border-violet-900/50 flex items-center justify-center text-violet-400">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold tracking-tight ${examDaysRemaining !== null && examDaysRemaining <= 7 ? 'text-rose-500' : ''}`}>
              {isLoading ? '—' : (examDaysRemaining ?? '—')}
            </span>
            <span className="text-xs text-zinc-500">
              {examDaysRemaining !== null ? 'hari lagi' : 'belum dijadwalkan'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        // Loading Skeleton Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-zinc-900/10 border border-zinc-900 rounded-2xl h-56 p-6 space-y-6">
              <div className="space-y-3">
                <div className="h-6 bg-zinc-800 rounded w-3/4"></div>
                <div className="h-4 bg-zinc-900 rounded w-1/4"></div>
              </div>
              <div className="space-y-2 pt-4">
                <div className="h-3 bg-zinc-900 rounded w-full"></div>
                <div className="h-2 bg-zinc-800 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        // Onboarding Empty State
        <div className="bg-zinc-900/10 border border-zinc-900/80 rounded-3xl p-12 text-center max-w-2xl mx-auto flex flex-col items-center gap-6 mt-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/15 border border-violet-500/20">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-xl font-bold">Mulai Perjalanan Belajarmu</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Sabi membantu kamu memahami konsep kompleks mata kuliah menggunakan pendekatan Feynman Technique — didampingi tutor AI yang menggunakan dialog Socratic.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab('syllabus')
                setIsModalOpen(true)
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Silabus PDF
            </button>
            <button
              onClick={() => {
                setActiveTab('exploration')
                setIsModalOpen(true)
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 rounded-xl transition-all"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Eksplorasi Topik Bebas
            </button>
          </div>
        </div>
      ) : (
        // Course Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const progress = course.topic_count > 0 
              ? Math.round((course.mastery_count / course.topic_count) * 100)
              : 0

            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-6 flex flex-col justify-between h-60 shadow-lg shadow-zinc-950/2 bg-gradient-to-b from-transparent to-zinc-950/30 group transition-all duration-300 active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {course.source_type === 'syllabus' ? (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/25">
                        Mode Silabus
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        Eksplorasi
                      </span>
                    )}

                    {course.level && (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                        {course.level === 'intro' ? 'Intro' : course.level === 'intermediate' ? 'Menengah' : 'Lanjut'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-zinc-100 group-hover:text-violet-400 transition-colors line-clamp-2">
                    {course.name}
                  </h3>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-900/60">
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-400">
                      <span>Progres Pemahaman</span>
                      <span className="text-zinc-200">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/40">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <div className="flex gap-3">
                      <span><strong>{course.topic_count}</strong> Topik</span>
                      <span>•</span>
                      <span><strong>{course.mastery_count}</strong> Dikuasai</span>
                    </div>
                    
                    {course.exam_date && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(course.exam_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Onboarding Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-250 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
              <h2 className="text-lg font-bold bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
                Tambah Pembelajaran Baru
              </h2>
              <button
                onClick={closeModal}
                disabled={syllabusSubmitting || explorationSaving || joinSubmitting}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/40">
              {(['syllabus', 'exploration', 'join'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  disabled={syllabusSubmitting || explorationSaving || joinSubmitting}
                  className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    activeTab === tab
                      ? 'text-violet-400 border-violet-500 bg-zinc-900/10'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/5'
                  } disabled:opacity-50`}
                >
                  {tab === 'syllabus' ? 'Mode Silabus' : tab === 'exploration' ? 'Mode Eksplorasi' : 'Join Kelas'}
                </button>
              ))}
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* Tab 1: Mode Silabus Form */}
              {activeTab === 'syllabus' && (
                <form onSubmit={handleSyllabusSubmit} className="space-y-6">
                  {syllabusError && (
                    <div className="flex gap-2.5 items-start bg-red-950/20 border border-red-950 text-red-400 p-3.5 rounded-xl text-xs leading-relaxed animate-in fade-in duration-200">
                      <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{syllabusError}</span>
                    </div>
                  )}

                  {!syllabusSubmitting ? (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Nama Mata Kuliah *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Algoritma & Struktur Data"
                          value={syllabusName}
                          onChange={(e) => setSyllabusName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Level Kuliah
                          </label>
                          <select
                            value={syllabusLevel}
                            onChange={(e: any) => setSyllabusLevel(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                          >
                            <option value="intro">Pengenalan (Intro)</option>
                            <option value="intermediate">Menengah (Intermediate)</option>
                            <option value="advanced">Lanjut (Advanced)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Tanggal Ujian Terdekat
                          </label>
                          <input
                            type="date"
                            value={syllabusExamDate}
                            onChange={(e) => setSyllabusExamDate(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Dokumen Silabus (PDF) *
                        </label>
                        <div className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all relative">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-zinc-300">
                              {syllabusFile ? syllabusFile.name : 'Pilih file PDF silabus'}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {syllabusFile 
                                ? `${(syllabusFile.size / (1024 * 1024)).toFixed(2)} MB` 
                                : 'PDF saja, ukuran maksimal 10MB'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl px-6 py-3 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all"
                        >
                          Mulai Analisis
                        </button>
                      </div>
                    </div>
                  ) : (
                    // AI Parsing Loading State
                    <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in duration-300">
                      <div className="relative h-20 w-20 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-zinc-800 border-t-violet-500 animate-spin"></div>
                        <div className="h-10 w-10 rounded-full bg-violet-950/20 border border-violet-500/30 animate-pulse flex items-center justify-center text-violet-400">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                      </div>

                      <div className="space-y-2 max-w-md">
                        <h4 className="text-base font-bold text-zinc-200">AI Sedang Bekerja...</h4>
                        <p className="text-sm text-zinc-500 leading-relaxed min-h-[40px] animate-pulse">
                          {syllabusStage}
                        </p>
                      </div>

                      {/* Detailed Progress Bar */}
                      <div className="w-full max-w-sm space-y-1.5">
                        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${syllabusProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-zinc-500">{syllabusProgress}%</span>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Tab 2: Mode Eksplorasi Form */}
              {activeTab === 'exploration' && (
                <div className="space-y-6">
                  {explorationError && (
                    <div className="flex gap-2.5 items-start bg-red-950/20 border border-red-950 text-red-400 p-3.5 rounded-xl text-xs leading-relaxed animate-in fade-in duration-200">
                      <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{explorationError}</span>
                    </div>
                  )}

                  {subtopics.length === 0 ? (
                    // Topic string request input
                    <form onSubmit={handleExplorationDecompose} className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Topik apa yang ingin kamu kuasai?
                        </label>
                        <input
                          type="text"
                          required
                          disabled={isDecomposing}
                          placeholder="Contoh: Cara Kerja DNS, Stoikisme, Teori Relativitas Khusus"
                          value={explorationTopic}
                          onChange={(e) => setExplorationTopic(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={isDecomposing}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl px-6 py-3 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all disabled:opacity-50"
                        >
                          {isDecomposing ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                              <span>Menganalisis & Decompose...</span>
                            </>
                          ) : (
                            <span>Lakukan Dekomposisi AI</span>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    // Generated chips editor
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-zinc-300">Hasil Dekomposisi AI</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          AI membagi topik menjadi subtopik di bawah. Klik chip untuk mengubah judul, klik badge kesulitan untuk siklus kesulitan (Basic/Intermediate/Advanced), klik &quot;x&quot; untuk menghapus, atau tambah subtopik kustom Anda sendiri.
                        </p>
                      </div>

                      {/* Chips list */}
                      <div className="flex flex-wrap gap-2.5 p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl min-h-[100px]">
                        {subtopics.map((sub, idx) => {
                          const diffColors = {
                            basic: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15',
                            intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15',
                            advanced: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15',
                          }[sub.difficulty]

                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-zinc-900 border-zinc-800 text-xs font-medium transition-all group"
                            >
                              {sub.isEditing ? (
                                <input
                                  type="text"
                                  value={sub.title}
                                  onChange={(e) => updateSubtopicTitle(idx, e.target.value)}
                                  onBlur={() => toggleEditSubtopic(idx, false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') toggleEditSubtopic(idx, false)
                                  }}
                                  autoFocus
                                  className="bg-zinc-800 border border-zinc-700 text-zinc-100 px-2 py-0.5 rounded text-xs focus:outline-none w-36"
                                />
                              ) : (
                                <span
                                  onClick={() => toggleEditSubtopic(idx, true)}
                                  className="cursor-text text-zinc-300 hover:text-zinc-100 transition-colors"
                                >
                                  {sub.title}
                                </span>
                              )}

                              {/* Difficulty Cycler Badge */}
                              <button
                                type="button"
                                onClick={() => cycleDifficulty(idx)}
                                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors ${diffColors}`}
                              >
                                {sub.difficulty}
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => deleteSubtopic(idx)}
                                className="text-zinc-500 hover:text-rose-400 transition-colors"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>

                      {/* Add Custom Subtopic Form */}
                      <form onSubmit={addCustomSubtopic} className="flex flex-col sm:flex-row items-end sm:items-center gap-3 bg-zinc-900/50 p-4 border border-zinc-900 rounded-xl">
                        <div className="flex-1 w-full space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Tambah Subtopik Baru
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Protokol DNS over HTTPS"
                            value={newSubtopicTitle}
                            onChange={(e) => setNewSubtopicTitle(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                          />
                        </div>

                        <div className="w-full sm:w-auto space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Kesulitan
                          </label>
                          <select
                            value={newSubtopicDifficulty}
                            onChange={(e: any) => setNewSubtopicDifficulty(e.target.value)}
                            className="w-full sm:w-32 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="basic">Basic</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.98]"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Tambah
                        </button>
                      </form>

                      {/* Modal Footer Controls */}
                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSubtopics([])
                            setExplorationTopic('')
                          }}
                          className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          Ulangi Topik Induk
                        </button>

                        <button
                          type="button"
                          onClick={handleExplorationSave}
                          disabled={explorationSaving || subtopics.length === 0}
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl px-6 py-3 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all disabled:opacity-50"
                        >
                          {explorationSaving ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                              <span>Menyimpan Kelas...</span>
                            </>
                          ) : (
                            <span>Simpan Kelas & Mulai</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Join Kelas Form */}
              {activeTab === 'join' && (
                <form onSubmit={handleJoinClassSubmit} className="space-y-6">
                  {joinError && (
                    <div className="flex gap-2.5 items-start bg-red-950/20 border border-red-950 text-red-400 p-3.5 rounded-xl text-xs leading-relaxed animate-in fade-in duration-200">
                      <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{joinError}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Kode Gabung Kelas (Join Code)
                      </label>
                      <input
                        type="text"
                        required
                        disabled={joinSubmitting}
                        placeholder="Contoh: A4F9CD"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={15}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 tracking-widest text-center uppercase font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                      />
                      <p className="text-[11px] text-zinc-500 text-center leading-relaxed mt-1">
                        Dapatkan kode kelas 6-karakter dari teman sekelas Anda yang membuat kelas menggunakan Mode Silabus untuk belajar bersama.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={joinSubmitting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl px-6 py-3 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all disabled:opacity-50"
                      >
                        {joinSubmitting ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                            <span>Menghubungkan...</span>
                          </>
                        ) : (
                          <span>Gabung Kelas</span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
