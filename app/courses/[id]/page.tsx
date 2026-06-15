'use client'

/* Hallmark · macrostructure: Index-First Hybrid · theme: Dark Midnight Violet · nav: N5 Floating pill · footer: Ft5 Statement
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 * contrast: pass (APCA/WCAG 2.1 4.5:1 target)
 */

import React, { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

interface Topic {
  id: string
  title: string
  parent_topic: string | null
  difficulty: 'basic' | 'intermediate' | 'advanced'
  display_order: number
  created_at: string
  mastered: boolean
  last_mastered_at: string | null
  next_review_date: string | null
  public_slug: string | null
}

interface CourseDetails {
  id: string
  user_id: string
  name: string
  source_type: 'syllabus' | 'free'
  syllabus_url: string | null
  exam_date: string | null
  level: 'intro' | 'intermediate' | 'advanced' | null
  join_code: string | null
  created_at: string
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  // State
  const [course, setCourse] = useState<CourseDetails | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch course and topics data
  const fetchData = async () => {
    try {
      setErrorMsg(null)
      const [courseRes, topicsRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`),
        fetch(`/api/courses/${courseId}/topics`)
      ])

      if (courseRes.status === 404) {
        throw new Error('Mata kuliah tidak ditemukan')
      }
      if (!courseRes.ok) throw new Error('Gagal mengambil detail mata kuliah')
      if (!topicsRes.ok) throw new Error('Gagal mengambil daftar topik')

      const courseJson = await courseRes.json()
      const topicsJson = await topicsRes.json()

      setCourse(courseJson.data)
      setTopics(topicsJson.data || [])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Terjadi kesalahan saat memuat data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [courseId])

  // Click to copy handler
  const handleCopyCode = async () => {
    if (!course?.join_code) return
    try {
      await navigator.clipboard.writeText(course.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  // Soft delete course
  const handleDeleteCourse = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus kelas ini beserta semua progresnya?')) {
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Gagal menghapus mata kuliah')

      router.push('/dashboard')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Gagal menghapus kelas')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-pulse text-ink-muted">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <div className="h-4 bg-paper-elevated rounded w-24"></div>
          <div className="h-10 bg-paper-elevated rounded w-1/2"></div>
          <div className="flex gap-4">
            <div className="h-6 bg-paper-elevated rounded w-32"></div>
            <div className="h-6 bg-paper-elevated rounded w-32"></div>
          </div>
        </div>
        
        {/* Topics List Skeleton */}
        <div className="space-y-6 pt-10">
          <div className="h-6 bg-paper-elevated rounded w-48"></div>
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-paper-elevated/40 border border-rule rounded-2xl h-24 p-6 flex justify-between items-center">
                <div className="space-y-2 w-2/3">
                  <div className="h-5 bg-paper-elevated rounded w-3/4"></div>
                  <div className="h-4 bg-paper-elevated rounded w-1/4"></div>
                </div>
                <div className="h-10 bg-paper-elevated rounded w-28"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (errorMsg || !course) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Kembali ke Dasbor
        </Link>
        <div className="flex gap-3 items-start p-6 rounded-2xl border border-red-950/60 bg-red-950/20 text-red-400 text-sm leading-relaxed">
          <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-bold text-base">Kesalahan memuat halaman</h3>
            <p className="opacity-90 mt-1">{errorMsg || 'Mata kuliah tidak ditemukan.'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Group topics by parent_topic and preserve sorting
  const groupOrder: string[] = []
  const groupedTopics: { [key: string]: Topic[] } = {}

  topics.forEach((topic) => {
    const groupName = topic.parent_topic?.trim() || ''
    if (!groupedTopics[groupName]) {
      groupedTopics[groupName] = []
      groupOrder.push(groupName)
    }
    groupedTopics[groupName].push(topic)
  })

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 text-ink-primary font-sans">
      
      {/* Back to Dashboard Link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary transition-colors focus-visible:outline-2 focus-visible:outline-brand-accent"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Kembali ke Dasbor
        </Link>
      </div>

      {/* Course Info Header (Borderless, pure typography-led) */}
      <div className="border-b border-rule pb-8 pt-2">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            {/* Meta Tags */}
            <div className="flex flex-wrap gap-2 items-center text-xs">
              {course.source_type === 'syllabus' ? (
                <span className="inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                  Mode Silabus
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Eksplorasi
                </span>
              )}

              {course.level && (
                <span className="inline-flex items-center text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-sm bg-paper-elevated text-ink-muted border border-rule">
                  Level: {course.level === 'intro' ? 'Introductory' : course.level === 'intermediate' ? 'Intermediate' : 'Advanced'}
                </span>
              )}

              {course.exam_date && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-sm bg-paper-elevated text-ink-muted border border-rule">
                  <svg className="h-3.5 w-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Ujian: {new Date(course.exam_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-ink-primary">
              {course.name}
            </h1>

            {/* Stats Summary */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono text-ink-muted">
              <span><strong>{topics.length}</strong> Total Topik</span>
              <span>•</span>
              <span className="text-emerald-400"><strong>{topics.filter(t => t.mastered).length}</strong> Dikuasai</span>
              {topics.filter(t => t.mastered && t.next_review_date && t.next_review_date <= todayStr).length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-500 font-medium">
                    <strong>{topics.filter(t => t.mastered && t.next_review_date && t.next_review_date <= todayStr).length}</strong> Perlu Review
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Header Side: Join Code, Feed & Delete */}
          <div className="flex flex-col gap-3 min-w-[200px] w-full md:w-auto items-stretch md:items-end">
            {course.join_code && (
              <div className="flex flex-col gap-1 items-start md:items-end text-left md:text-right py-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">
                  Kode Gabung Kelas
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-ink-primary tracking-wider">
                    {course.join_code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 rounded hover:bg-paper-hover text-ink-muted hover:text-ink-primary transition-all focus-visible:outline-2 focus-visible:outline-brand-accent cursor-pointer"
                    title="Copy Join Code"
                  >
                    {copied ? (
                      <svg className="h-4.5 w-4.5 text-emerald-400 animate-in zoom-in-95 duration-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                  {copied && <span className="text-[10px] text-emerald-400 animate-pulse font-semibold">Tersalin!</span>}
                </div>
              </div>
            )}

            {/* Class Feed Link (Peer Explanation Mode) */}
            <Link
              href={`/courses/${courseId}/feed`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-brand-accent hover:bg-brand-accent-hover rounded-xl shadow-[0_2px_10px_rgba(139,92,246,0.15)] transition-all hover:translate-y-[-1px] focus-visible:outline-2 focus-visible:outline-brand-accent cursor-pointer"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6m-6 4h3" />
              </svg>
              <span>Feed Kelas</span>
            </Link>

            {/* Delete button only for course creator */}
            {course.user_id === user?.id && (
              <button
                onClick={handleDeleteCourse}
                disabled={isDeleting}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-muted hover:text-red-400 bg-transparent hover:bg-red-950/20 border border-rule hover:border-red-900/30 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-ink-muted border-t-ink-primary"></div>
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Hapus Kelas</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Topics Sections */}
      <div className="space-y-12 pt-4">
        {topics.length === 0 ? (
          <div className="text-center py-16 bg-paper-elevated/20 border border-rule rounded-3xl p-6">
            <p className="text-sm text-ink-muted">Mata kuliah ini belum memiliki topik belajar.</p>
          </div>
        ) : (
          groupOrder.map((groupName) => {
            const groupTopics = groupedTopics[groupName]

            return (
              <section key={groupName} className="space-y-4">
                {/* Section Title */}
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted border-b border-rule pb-2">
                  {groupName ? groupName : 'Topik Pembelajaran'}
                </h2>

                {/* Topics Grid/List with Structural Variety */}
                <div className="grid grid-cols-1 gap-4">
                  {groupTopics.map((topic) => {
                    // Spaced Repetition Due status
                    const isReviewDue = topic.mastered && topic.next_review_date && topic.next_review_date <= todayStr

                    // Compact/Subdued styling for Mastered topics
                    if (topic.mastered && !isReviewDue) {
                      return (
                        <div
                          key={topic.id}
                          className="group bg-paper-elevated/40 border border-rule/50 hover:border-rule-active rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            {/* Simple checkmark icon */}
                            <div className="h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                              <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="space-y-0.5">
                              <h3 className="text-sm font-semibold text-ink-muted group-hover:text-ink-primary transition-colors">
                                {topic.title}
                              </h3>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400/80">
                                Dikuasai
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {topic.public_slug && (
                              <Link
                                href={`/card/${topic.public_slug}`}
                                className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted hover:text-brand-accent transition-colors flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-brand-accent"
                              >
                                Lihat Mastery
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </Link>
                            )}
                            <Link
                              href={`/topics/${topic.id}/session`}
                              className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted hover:text-brand-accent transition-colors border border-rule hover:border-brand-accent/30 rounded px-2.5 py-1 bg-paper-elevated/20 hover:bg-paper-hover focus-visible:outline-2 focus-visible:outline-brand-accent"
                            >
                              Pelajari Lagi
                            </Link>
                          </div>
                        </div>
                      )
                    }

                    // Highlighted styling for Review Due topics
                    if (isReviewDue) {
                      return (
                        <div
                          key={topic.id}
                          className="bg-amber-500/5 border border-amber-500/40 hover:border-amber-500/80 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Review Jatuh Tempo
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            </div>
                            <h3 className="text-base font-bold text-ink-primary leading-relaxed">
                              {topic.title}
                            </h3>
                            {topic.next_review_date && (
                              <p className="text-xs text-amber-400/90 font-mono">
                                Jadwal review: <span className="font-bold underline decoration-dotted">Sekarang</span>
                              </p>
                            )}
                          </div>
                          <div className="flex md:self-center w-full md:w-auto">
                            <Link
                              href={`/topics/${topic.id}/session`}
                              className="w-full md:w-auto text-center px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl transition-all shadow-[0_2px_8px_rgba(245,158,11,0.15)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-amber-500 cursor-pointer"
                            >
                              Mulai Review
                            </Link>
                          </div>
                        </div>
                      )
                    }

                    // Standard styling for Unlearned/In-progress topics
                    const difficultyBadgeColor = {
                      basic: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                      advanced: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }[topic.difficulty]

                    const difficultyText = {
                      basic: 'Basic',
                      intermediate: 'Medium',
                      advanced: 'Hard'
                    }[topic.difficulty]

                    return (
                      <div
                        key={topic.id}
                        className="bg-paper-elevated border border-rule hover:border-rule-active rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${difficultyBadgeColor}`}>
                              {difficultyText}
                            </span>
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-paper text-ink-muted border border-rule">
                              Belum Dipelajari
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-ink-primary leading-relaxed">
                            {topic.title}
                          </h3>
                        </div>
                        <div className="flex md:self-center w-full md:w-auto">
                          <Link
                            href={`/topics/${topic.id}/session`}
                            className="w-full md:w-auto text-center px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-brand-accent hover:bg-brand-accent-hover text-white rounded-xl transition-all shadow-[0_2px_8px_rgba(139,92,246,0.15)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand-accent cursor-pointer"
                          >
                            Mulai Belajar
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

