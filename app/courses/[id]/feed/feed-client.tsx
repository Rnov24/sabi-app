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
  'bg-brand-accent text-ink-primary border border-brand-accent-deep/30',
  'bg-brand-accent-2 text-white border border-brand-accent-2-deep/30',
  'bg-brand-accent-3 text-white border border-brand-accent-3-deep/30',
  'bg-mint text-ink-primary border border-mint-deep/30',
  'bg-lavender text-ink-primary border border-lavender-deep/30',
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
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12 flex-1 flex flex-col text-ink-primary font-sans animate-fade-in">
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-brand-accent-3/15 text-brand-accent-3-deep border-brand-accent-3/20'
                : 'bg-mint/15 text-mint-deep border-mint/20'
            }`}
          >
            {toast.type === 'error' ? (
              <svg
                className="w-5 h-5 flex-shrink-0 text-brand-accent-3-deep"
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
                className="w-5 h-5 flex-shrink-0 text-mint-deep"
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
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-muted hover:text-ink-primary transition-colors focus-visible:outline-2 focus-visible:outline-brand-accent"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-primary">
            Feed Kelas
          </h1>
          <p className="text-ink-muted mt-1 text-sm font-medium">
            {courseName} • Kolaborasi & Diskusi Pemahaman
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn--soft btn--ink py-2 px-4"
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
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-paper-elevated/40 rounded-3xl border border-rule flex-1 my-auto card">
          <div className="p-4 bg-paper-elevated rounded-full mb-4 text-ink-muted border border-rule shadow-sm">
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
          <h3 className="text-lg font-bold text-ink-primary">Belum Ada Postingan Feed</h3>
          <p className="text-ink-muted mt-2 max-w-sm text-sm leading-relaxed">
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
                className="group relative bg-paper-elevated border border-rule rounded-2xl p-6 shadow-xs transition-all duration-300 hover:shadow-md hover:border-rule-active flex flex-col card"
              >
                {/* Visual left-side border indicator for extra polish */}
                <div className="absolute top-0 left-0 bottom-0 w-1.5 rounded-l-2xl bg-rule group-hover:bg-brand-accent-2 transition-colors duration-200" />

                {/* Card Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0 ${getAvatarColorClass(
                        post.author_display_name
                      )}`}
                    >
                      {getInitials(post.author_display_name)}
                    </div>
                    <div className="ml-3">
                      <h4 className="font-bold text-ink-primary text-sm leading-tight">
                        {post.author_display_name}
                      </h4>
                      <time
                        dateTime={post.created_at}
                        className="text-xs text-ink-muted mt-0.5 block font-medium"
                      >
                        {formatRelativeTime(post.created_at)}
                      </time>
                    </div>
                  </div>
                  {/* Topic Pill */}
                  <span className="px-2.5 py-1 bg-brand-accent-2/10 text-brand-accent-2-deep border border-brand-accent-2/20 rounded-lg text-xs font-bold uppercase tracking-wider max-w-[200px] truncate">
                    {post.topic_title}
                  </span>
                </div>

                {/* Card Body */}
                <div className="mt-4 flex-1">
                  <div className="whitespace-pre-wrap text-ink-primary text-base leading-relaxed bg-paper border border-rule p-4 rounded-xl font-sans font-normal">
                    {post.mastery_card_text}
                  </div>
                </div>

                {/* Card Footer (Reaction Buttons) */}
                <div className="mt-5 pt-4 border-t border-rule flex items-center gap-3">
                  {/* Helpful Button */}
                  <button
                    onClick={() => handleReact(post.id, 'helpful')}
                    disabled={isPending}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 select-none cursor-pointer ${
                      isHelpfulActive
                        ? 'bg-mint text-ink-primary border-mint-deep shadow-xs scale-95'
                        : 'bg-mint/15 text-ink-primary/80 border-mint/20 hover:bg-mint/25 hover:text-ink-primary hover:border-mint/30'
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform group-active:scale-95 ${
                        isHelpfulActive ? 'fill-ink-primary text-ink-primary' : ''
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
                          ? 'bg-mint-deep/40 text-ink-primary'
                          : 'bg-mint/30 text-ink-primary/70'
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
                        ? 'bg-brand-accent-3 text-white border-brand-accent-3-deep shadow-xs scale-95'
                        : 'bg-brand-accent-3/15 text-brand-accent-3-deep border-brand-accent-3/20 hover:bg-brand-accent-3/25 hover:text-brand-accent-3-deep hover:border-brand-accent-3/30'
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform group-active:scale-95 ${
                        isUnclearActive ? 'fill-white text-white' : ''
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
                          ? 'bg-brand-accent-3-deep/40 text-white'
                          : 'bg-brand-accent-3/30 text-brand-accent-3-deep'
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
