'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'

interface ProfileData {
  display_name?: string
  university?: string
  created_at?: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [displayName, setDisplayName] = useState('')
  const [university, setUniversity] = useState('')
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('Gagal mengambil data profil')
        const json = await res.json()
        if (mounted && json.data) {
          setProfile(json.data)
          setDisplayName(json.data.display_name || '')
          setUniversity(json.data.university || '')
        }
      } catch (err: any) {
        console.error(err)
        if (mounted) {
          setNotification({ type: 'error', text: 'Gagal memuat profil. Silakan muat ulang halaman.' })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()
    return () => {
      mounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setNotification(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName,
          university: university,
        }),
      })

      if (!res.ok) throw new Error('Gagal memperbarui profil')
      const json = await res.json()
      
      if (json.data) {
        setProfile(json.data)
        setDisplayName(json.data.display_name || '')
        setUniversity(json.data.university || '')
        setNotification({ type: 'success', text: 'Profil Anda berhasil diperbarui.' })
      }
    } catch (err: any) {
      console.error(err)
      setNotification({ type: 'error', text: 'Gagal memperbarui profil. Silakan coba lagi.' })
    } finally {
      setIsSaving(false)
    }
  }

  const formattedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <div className="p-6 md:p-10 text-ink-primary font-sans max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-primary">
          Pengaturan Profil
        </h1>
        <p className="text-sm text-ink-muted">
          Kelola profil publik, identitas universitas, dan data akun Anda di Sabi.
        </p>
      </div>

      {notification && (
        <div
          className={`flex gap-3 items-start p-4 rounded-xl border text-sm leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 ${
            notification.type === 'success'
              ? 'bg-mint/15 border-mint/25 text-mint-deep'
              : 'bg-brand-accent-3/15 border-brand-accent-3/20 text-brand-accent-3-deep'
          }`}
        >
          {notification.type === 'success' ? (
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {isLoading ? (
        // Loading Skeleton
        <div className="space-y-8 animate-pulse">
          <div className="bg-paper-elevated border border-rule rounded-2xl p-6 space-y-6">
            <div className="space-y-2">
              <div className="h-4 bg-paper-hover rounded w-1/4"></div>
              <div className="h-10 bg-paper-hover rounded w-full"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-paper-hover rounded w-1/3"></div>
              <div className="h-10 bg-paper-hover rounded w-full"></div>
            </div>
            <div className="h-10 bg-paper-hover rounded w-28"></div>
          </div>
          
          <div className="bg-paper-elevated border border-rule rounded-2xl p-6 space-y-4">
            <div className="h-5 bg-paper-hover rounded w-1/5"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-3.5 bg-paper-hover rounded w-1/3"></div>
                <div className="h-6 bg-paper-hover rounded w-2/3"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3.5 bg-paper-hover rounded w-1/3"></div>
                <div className="h-6 bg-paper-hover rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Edit Form */}
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Display Name Input */}
                <div className="space-y-2">
                  <label htmlFor="displayName" className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Nama Lengkap / Panggilan
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    placeholder="Masukkan nama Anda"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isSaving}
                    maxLength={50}
                    className="form-input disabled:opacity-50"
                  />
                </div>

                {/* University Input */}
                <div className="space-y-2">
                  <label htmlFor="university" className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Universitas / Institusi
                  </label>
                  <input
                    id="university"
                    type="text"
                    placeholder="Contoh: Universitas Indonesia"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    disabled={isSaving}
                    maxLength={100}
                    className="form-input disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn--cyan"
                >
                  {isSaving ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Read Only Account Details */}
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-primary mb-4">Informasi Akun</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs text-ink-muted mb-1">Email Terdaftar</span>
                <span className="text-sm font-bold text-ink-primary">{user?.email || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-ink-muted mb-1">Terdaftar Sejak</span>
                <span className="text-sm font-bold text-ink-primary">{formattedDate}</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-rule flex items-start gap-3 text-xs text-ink-muted leading-relaxed">
              <svg className="h-4.5 w-4.5 text-brand-accent-2-deep shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Email Anda digunakan sebagai pengenal utama akun dan tidak dapat diubah demi alasan keamanan data pembelajaran Anda.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
