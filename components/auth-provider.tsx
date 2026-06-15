'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { SidebarShell } from './sidebar-shell'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROTECTED_ROUTES = ['/dashboard', '/courses', '/reviews', '/profile', '/topics']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        if (mounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)
        }
      } catch (err) {
        console.error('Error fetching initial session:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (mounted) {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      router.replace('/login')
    } catch (err) {
      console.error('Error signing out:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Routing and protection
  useEffect(() => {
    if (isLoading) return

    const isProtected = PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )

    if (!user && (isProtected || pathname === '/')) {
      router.replace('/login')
    } else if (user && (pathname === '/login' || pathname === '/')) {
      router.replace('/dashboard')
    }
  }, [user, isLoading, pathname, router])

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
  
  const showSidebar = !!user && isProtected

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
        <div className="relative flex flex-col items-center gap-4">
          <div className="absolute -inset-4 rounded-full bg-violet-600/20 blur-xl animate-pulse"></div>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-800 border-t-violet-500"></div>
          <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase animate-pulse">Sabi</p>
        </div>
      </div>
    )
  }

  // If redirecting, show a simple spinner to prevent layout shifting/flickers
  if (!user && isProtected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-violet-500"></div>
      </div>
    )
  }

  if (user && pathname === '/login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-violet-500"></div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {showSidebar ? (
        <SidebarShell>{children}</SidebarShell>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
