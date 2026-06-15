'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }

      setIsSuccess(true)
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMsg(err.message || 'Gagal mengirim link masuk. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100 font-sans overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] rounded-full bg-indigo-600/5 blur-[80px] pointer-events-none"></div>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1f1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.05] pointer-events-none"></div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-3 border border-violet-400/20">
            <span className="text-xl font-black text-white tracking-widest">S</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-200 to-zinc-200 bg-clip-text text-transparent">
            Masuk ke Sabi
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Asisten Belajar Mandiri Berbasis AI</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-8 shadow-2xl shadow-violet-950/5">
          {!isSuccess ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Masukkan email Anda di bawah. Kami akan mengirimkan tautan masuk (magic link) secara instan ke kotak masuk Anda.
                </p>
              </div>

              {errorMsg && (
                <div className="flex gap-2.5 items-start bg-red-950/20 border border-red-900/30 text-red-400 p-3.5 rounded-xl text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                  <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
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
                  className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl py-3.5 shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    <span>Mengirim Tautan...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Kirim Link Masuk</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="mx-auto h-16 w-16 rounded-full bg-violet-950/40 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-100">Tautan Masuk Terkirim!</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Kami telah mengirimkan tautan masuk ke <span className="font-semibold text-violet-400">{email}</span>. Silakan periksa kotak masuk dan folder spam Anda untuk melanjutkan.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setIsSuccess(false)
                    setEmail('')
                  }}
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
