'use client'

import { useState } from 'react'
import Link from 'next/link'

interface DueReview {
  mastery_event_id: string
  topic_id: string
  topic_title: string
  course_name: string
  next_review_date: string
  days_overdue: number
}

interface MasteryCard {
  mastery_event_id: string
  topic_id: string
  topic_title: string
  mastery_card_text: string
  public_slug: string
  rounds_taken: number
  created_at: string
  next_review_date: string
}

interface MasteredCourse {
  id: string
  name: string
  cards: MasteryCard[]
}

interface ReviewsClientProps {
  initialDueReviews: DueReview[]
  masteredCourses: MasteredCourse[]
}

export default function ReviewsClient({
  initialDueReviews,
  masteredCourses,
}: ReviewsClientProps) {
  const [activeTab, setActiveTab] = useState<'due' | 'passport'>('due')

  // Helper to format date nicely
  function formatDate(dateString: string) {
    const d = new Date(dateString)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Helper to format stamp date (uppercase, short: "15 JUN 2026")
  function formatStampDate(dateString: string) {
    const d = new Date(dateString)
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950 font-sans py-8">
      <div className="max-w-4xl w-full mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              Pusat Review &amp; Mastery
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Pantau jadwal spaced repetition dan kumpulkan paspor pemahaman Anda.
            </p>
          </div>
          
          {/* Tabs switch */}
          <div className="flex bg-zinc-200 dark:bg-zinc-900 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setActiveTab('due')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'due'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span>Perlu Review</span>
              {initialDueReviews.length > 0 && (
                <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {initialDueReviews.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('passport')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'passport'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <span>Paspor Dinding Mastery</span>
              {masteredCourses.reduce((acc, c) => acc + c.cards.length, 0) > 0 && (
                <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                  {masteredCourses.reduce((acc, c) => acc + c.cards.length, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'due' ? (
          /* TAB 1: PERLU REVIEW */
          <div>
            {initialDueReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Semua Review Selesai!</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                  Tidak ada topik yang harus direview hari ini. Spaced repetition Anda berjalan dengan baik.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Kembali ke Dashboard
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {initialDueReviews.map((review) => (
                  <div
                    key={review.mastery_event_id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          {review.course_name}
                        </span>
                        
                        {/* Overdue Badge */}
                        {review.days_overdue > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 animate-pulse">
                            Terlambat {review.days_overdue} Hari
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                            Harus Hari Ini
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
                        {review.topic_title}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Jadwal review asli: {formatDate(review.next_review_date)}
                      </p>
                    </div>

                    <Link
                      href={`/topics/${review.topic_id}/session`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      Mulai Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: PASPOR DINDING MASTERY */
          <div className="space-y-12">
            {masteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-850 dark:text-zinc-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Belum Ada Paspor Mastery</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                  Selesaikan sesi Socratic untuk menguasai topik dan dapatkan cap paspor pemahaman Anda.
                </p>
              </div>
            ) : (
              masteredCourses.map((course) => (
                <div key={course.id} className="relative bg-amber-50/10 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-xs">
                  {/* Passport Page Look Header */}
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        VISA PAGE • SABI EDUCATION
                      </span>
                      <h2 className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100 font-serif leading-tight">
                        {course.name}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100/60 text-amber-800 border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 self-start sm:self-auto">
                      {course.cards.length} Mastery Stamp{course.cards.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Stamp Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {course.cards.map((card) => (
                      <div
                        key={card.mastery_event_id}
                        className="relative overflow-hidden bg-white border border-zinc-200 hover:border-zinc-300 dark:bg-zinc-950 dark:border-zinc-800/85 p-5 rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[220px]"
                      >
                        {/* Outer Stamp Ink Effect Wrapper */}
                        <div className="absolute -top-1.5 -right-1.5 w-16 h-16 pointer-events-none opacity-15">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full fill-emerald-600">
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" strokeDasharray="10 5" fill="none" />
                          </svg>
                        </div>

                        {/* Stamp Ink Seal (Watermark inside card) */}
                        <div className="absolute top-2.5 right-2.5 pointer-events-none">
                          <div className="rotate-12 border-2 border-dashed border-emerald-600/60 dark:border-emerald-500/40 text-emerald-600/70 dark:text-emerald-500/50 font-serif text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider bg-white/70 dark:bg-zinc-950/80 backdrop-blur-xs">
                            PASSED
                          </div>
                        </div>

                        <div>
                          <div className="text-[9px] font-extrabold font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                            STAMP NO. {card.public_slug}
                          </div>
                          
                          <h3 className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100 font-serif leading-tight pr-12 mb-2">
                            {card.topic_title}
                          </h3>

                          <p className="italic text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed line-clamp-3 mb-4">
                            &ldquo;{card.mastery_card_text}&rdquo;
                          </p>
                        </div>

                        {/* Stamp Footer */}
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
                          <div>
                            <span className="block text-[8px] text-zinc-400 uppercase tracking-wider font-bold">Tanggal Penguasaan</span>
                            <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">{formatStampDate(card.created_at)}</span>
                          </div>
                          <Link
                            href={`/card/${card.public_slug}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 font-semibold transition-colors"
                          >
                            <span>Lihat Detail</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
