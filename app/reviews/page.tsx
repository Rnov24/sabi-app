'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'

interface Review {
  mastery_event_id: string
  topic_id: string
  topic_title: string
  course_name: string
  next_review_date: string
  days_overdue: number
}

export default function ReviewsPage() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function loadReviews() {
      try {
        const res = await fetch('/api/reviews/due')
        if (!res.ok) throw new Error('Gagal memuat jadwal review')
        const json = await res.json()
        if (mounted && json.data) {
          setReviews(json.data)
        }
      } catch (err: any) {
        console.error(err)
        if (mounted) {
          setError(err.message || 'Terjadi kesalahan saat memuat review.')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadReviews()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-10 text-zinc-100 font-sans max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
          Dinding Mastery & Reviews
        </h1>
        <p className="text-sm text-zinc-500">
          Uji pemahaman Anda pada topik-topik yang sudah waktunya diulang sesuai algoritma spaced repetition.
        </p>
      </div>

      {error && (
        <div className="flex gap-3 items-start p-4 rounded-xl border border-red-950 bg-red-950/20 text-red-400 mb-6 text-sm">
          <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        /* Loading Skeletons */
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-5 space-y-3">
              <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
              <div className="h-3.5 bg-zinc-900 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        /* Empty State */
        <div className="bg-zinc-900/10 border border-zinc-900 rounded-3xl p-12 text-center space-y-6 max-w-lg mx-auto mt-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-zinc-200">Semua Terkejar!</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Hebat! Tidak ada materi yang perlu di-review hari ini. Silakan tambahkan materi baru atau istirahat sejenak.
            </p>
          </div>
        </div>
      ) : (
        /* Reviews list */
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-500 mb-2 px-1">
            <span>Menampilkan {reviews.length} materi yang harus di-review</span>
            <span>Spaced Repetition</span>
          </div>

          <div className="space-y-3">
            {reviews.map((review) => {
              const isOverdue = review.days_overdue > 0
              return (
                <div
                  key={review.mastery_event_id}
                  className="group relative bg-zinc-900/10 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-200"
                >
                  <div className="space-y-1.5 min-w-0">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
                      {review.course_name}
                    </span>
                    <h3 className="font-bold text-zinc-200 group-hover:text-zinc-100 transition-colors truncate">
                      {review.topic_title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isOverdue ? (
                      <span className="text-[10px] font-bold bg-amber-950/30 border border-amber-900/50 text-amber-500 px-2.5 py-1 rounded-full">
                        Terlambat {review.days_overdue} hari
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-violet-950/20 border border-violet-900/50 text-violet-400 px-2.5 py-1 rounded-full">
                        Jadwal Hari Ini
                      </span>
                    )}

                    <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md transition-all active:scale-[0.98]">
                      Mulai Review
                    </button>
                  </div>

                  {/* Subtle Border Glow */}
                  <div className="absolute inset-0 border border-violet-500/0 group-hover:border-violet-500/5 rounded-2xl pointer-events-none transition-all duration-200"></div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
