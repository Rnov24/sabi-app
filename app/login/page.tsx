'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      
      if (isSignUp) {
        // Sign up mode
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        // If auto-logged in (Confirm email is disabled)
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setIsSuccess(true) // Show verify email screen
        }
      } else {
        // Sign in mode
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        // Redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      setErrorMsg(err.message || 'Gagal memproses autentikasi. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12 text-ink-primary font-sans overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] rounded-full bg-brand-accent-2/5 blur-[80px] pointer-events-none"></div>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--rule)_1px,transparent_1px),linear-gradient(to_bottom,var(--rule)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.4] pointer-events-none"></div>

      <div className="relative w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Logo Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-brand-accent flex items-center justify-center shadow-lg shadow-brand-accent/20 mb-3 border border-rule-active">
            <span className="text-xl font-black text-ink-primary tracking-widest">S</span>
          </div>
          <h1 className="text-2xl font-extrabold text-ink-primary">
            {isSignUp ? 'Daftar Akun Sabi' : 'Masuk ke Sabi'}
          </h1>
          <p className="text-sm text-ink-muted mt-1">Asisten Belajar Mandiri Berbasis AI</p>
        </div>

        {/* Card */}
        <div className="card bg-paper-elevated border border-rule rounded-2xl p-8 shadow-xl shadow-ink-primary/2">
          {!isSuccess ? (
            <form onSubmit={handleAuth} className="space-y-6">
              {errorMsg && (
                <div className="flex gap-2.5 items-start bg-red-500/5 border border-red-500/20 text-red-500 p-3.5 rounded-xl text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                  <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
                  Alamat Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="form-input"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn--cyan w-full py-3.5 text-xs tracking-wider uppercase"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>{isSignUp ? 'Daftar' : 'Masuk'}</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setErrorMsg(null)
                  }}
                  className="text-xs font-bold text-brand-accent-2 hover:underline transition-all"
                >
                  {isSignUp ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar di sini'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.15)]">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-ink-primary">Verifikasi Email Anda</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Kami telah mengirimkan email verifikasi ke <span className="font-semibold text-brand-accent-2">{email}</span>. Silakan periksa kotak masuk dan konfirmasi akun Anda untuk masuk ke Sabi.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setIsSuccess(false)
                    setEmail('')
                    setPassword('')
                  }}
                  className="text-xs font-bold text-ink-muted hover:text-ink-primary transition-colors inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-brand-accent-2"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Gunakan email lain
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
