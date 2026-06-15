'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface FeedPost {
  id: string
  mastery_event_id: string
  course_id: string
  is_visible: boolean
  helpful_count: number
  unclear_count: number
  created_at: string
  author_display_name: string
  topic_title: string
  mastery_card_text: string
}

interface FeedPageClientProps {
  courseId: string
  courseName: string
  initialPosts: FeedPost[]
  initialUserReactions: Record<string, 'helpful' | 'unclear'>
}

// Initials and color generator for student avatars
const colors = [
  'bg-blue-500 text-white',
  'bg-emerald-500 text-white',
  'bg-indigo-500 text-white',
  'bg-violet-500 text-white',
  'bg-purple-500 text-white',
  'bg-pink-500 text-white',
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
]

const getAvatarColorClass = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const getInitials = (name: string) => {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Relative time formatter in Indonesian
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) {
    return 'Baru saja'
  } else if (diffMin < 60) {
    return `${diffMin} menit yang lalu`
  } else if (diffHr < 24) {
    return `${diffHr} jam yang lalu`
  } else if (diffDay === 1) {
    return 'Kemarin'
  } else if (diffDay < 7) {
    return `${diffDay} hari yang lalu`
  } else {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
}

export default function FeedPageClient({
  courseId,
  courseName,
  initialPosts,
  initialUserReactions,
}: FeedPageClientProps) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts)
  const [userReactions, setUserReactions] = useState<Record<string, 'helpful' | 'unclear'>>(
    initialUserReactions
  )
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)
  const [activeRequestPostId, setActiveRequestPostId] = useState<string | null>(null)

  // Clear toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/feed`)
      if (!response.ok) {
        throw new Error('Gagal memperbarui feed kelas.')
      }
      const resJson = await response.json()
      setPosts(resJson.data || [])
      showToast('Feed berhasil diperbarui.', 'success')
    } catch (e: any) {
      showToast(e.message || 'Gagal memperbarui feed.', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleReact = async (postId: string, reaction: 'helpful' | 'unclear') => {
    const prevReaction = userReactions[postId]

    // If clicking same reaction, ignore (as backend only handles upsert, no delete)
    if (prevReaction === reaction) {
      return
    }

    // Capture state snapshot for rollback on error
    const previousPosts = [...posts]
    const previousUserReactions = { ...userReactions }

    // Calculate optimistic updates
    let helpfulDiff = 0
    let unclearDiff = 0

    if (prevReaction) {
      // Changed reaction type
      if (prevReaction === 'helpful') {
        helpfulDiff = -1
        unclearDiff = 1
      } else {
        helpfulDiff = 1
        unclearDiff = -1
      }
    } else {
      // New reaction
      if (reaction === 'helpful') {
        helpfulDiff = 1
      } else {
        unclearDiff = 1
      }
    }

    // Optimistically update states
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            helpful_count: Math.max(0, p.helpful_count + helpfulDiff),
            unclear_count: Math.max(0, p.unclear_count + unclearDiff),
          }
        }
        return p
      })
    )

    setUserReactions(prev => ({
      ...prev,
      [postId]: reaction,
    }))

    setActiveRequestPostId(postId)

    try {
      const response = await fetch(`/api/feed/${postId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reaction }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          showToast('Anda tidak dapat memberikan reaksi pada postingan Anda sendiri.', 'error')
        } else {
          const errData = await response.json().catch(() => ({}))
          const errMsg = errData?.error?.message || 'Gagal menyimpan reaksi.'
          showToast(errMsg, 'error')
        }
        // Rollback on failure
        setPosts(previousPosts)
        setUserReactions(previousUserReactions)
        return
      }

      const resJson = await response.json()
      const data = resJson.data

      if (data && typeof data.helpful_count === 'number' && typeof data.unclear_count === 'number') {
        // Sync state with exact database values
        setPosts(prev =>
          prev.map(p => {
            if (p.id === postId) {
              return {
                ...p,
                helpful_count: data.helpful_count,
                unclear_count: data.unclear_count,
              }
            }
            return p
          })
        )
      }
    } catch (err) {
      showToast('Koneksi internet bermasalah. Gagal menyimpan reaksi.', 'error')
      setPosts(previousPosts)
      setUserReactions(previousUserReactions)
    } finally {
      setActiveRequestPostId(null)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col">
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-900/50'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-900/50'
            }`}
          >
            {toast.type === 'error' ? (
              <svg
                className="w-5 h-5 flex-shrink-0 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 flex-shrink-0 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top back navigation */}
      <div className="mb-6">
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Kelas
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/60 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
            Feed Kelas
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm font-medium">
            {courseName} • Kolaborasi & Diskusi Pemahaman
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all cursor-pointer"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 21v-5h-.581m0 0a8.003 8.003 0 01-15.357-2"
            />
          </svg>
          {refreshing ? 'Memperbarui...' : 'Perbarui'}
        </button>
      </div>

      {/* Main Content Area */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-zinc-50 dark:bg-zinc-900/40 rounded-3xl border border-zinc-100 dark:border-zinc-900/60 flex-1 my-auto">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-4 text-zinc-400 dark:text-zinc-500">
            <svg
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Belum Ada Postingan Feed</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm text-sm leading-relaxed">
            Belum ada kartu penjelasan konsep yang dibagikan ke kelas ini. Selesaikan sesi belajar mandiri Anda untuk dapat membagikan Mastery Card Anda ke sini!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map(post => {
            const userReaction = userReactions[post.id]
            const isHelpfulActive = userReaction === 'helpful'
            const isUnclearActive = userReaction === 'unclear'
            const isPending = activeRequestPostId === post.id

            return (
              <article
                key={post.id}
                className="group relative bg-white dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs transition-all duration-300 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700/80 flex flex-col"
              >
                {/* Visual left-side border indicator for extra polish */}
                <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl bg-zinc-200 dark:bg-zinc-800 group-hover:bg-indigo-500 dark:group-hover:bg-indigo-600 transition-colors" />

                {/* Card Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0 ${getAvatarColorClass(
                        post.author_display_name
                      )}`}
                    >
                      {getInitials(post.author_display_name)}
                    </div>
                    <div className="ml-3">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
                        {post.author_display_name}
                      </h4>
                      <time
                        dateTime={post.created_at}
                        className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 block font-medium"
                      >
                        {formatRelativeTime(post.created_at)}
                      </time>
                    </div>
                  </div>
                  {/* Topic Pill */}
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg text-xs font-bold uppercase tracking-wider max-w-[200px] truncate">
                    {post.topic_title}
                  </span>
                </div>

                {/* Card Body */}
                <div className="mt-4 flex-1">
                  <div className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 text-base leading-relaxed bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900/80 p-4 rounded-xl font-sans font-normal">
                    {post.mastery_card_text}
                  </div>
                </div>

                {/* Card Footer (Reaction Buttons) */}
                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-900/80 flex items-center gap-3">
                  {/* Helpful Button */}
                  <button
                    onClick={() => handleReact(post.id, 'helpful')}
                    disabled={isPending}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 select-none cursor-pointer ${
                      isHelpfulActive
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60'
                        : 'bg-zinc-50 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/70 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400 dark:hover:border-emerald-900/40'
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform group-active:scale-95 ${
                        isHelpfulActive ? 'fill-emerald-600 dark:fill-emerald-400 text-emerald-600 dark:text-emerald-400' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2m0 10V10"
                      />
                    </svg>
                    <span>Bermanfaat</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isHelpfulActive
                          ? 'bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
                          : 'bg-zinc-200/60 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300'
                      }`}
                    >
                      {post.helpful_count}
                    </span>
                  </button>

                  {/* Unclear Button */}
                  <button
                    onClick={() => handleReact(post.id, 'unclear')}
                    disabled={isPending}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 select-none cursor-pointer ${
                      isUnclearActive
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60'
                        : 'bg-zinc-50 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/70 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 dark:hover:bg-amber-950/20 dark:hover:text-amber-400 dark:hover:border-amber-900/40'
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform group-active:scale-95 ${
                        isUnclearActive ? 'fill-amber-600 dark:fill-amber-400 text-amber-600 dark:text-amber-400' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Kurang Jelas</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isUnclearActive
                          ? 'bg-amber-200/60 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                          : 'bg-zinc-200/60 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300'
                      }`}
                    >
                      {post.unclear_count}
                    </span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
