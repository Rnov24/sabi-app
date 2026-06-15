'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './auth-provider'

interface ProfileData {
  display_name?: string
  university?: string
}

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Fetch user profile data to display in the profile card
  useEffect(() => {
    let mounted = true
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('Failed to fetch profile')
        const json = await res.json()
        if (mounted && json.data) {
          setProfile(json.data)
        }
      } catch (err) {
        console.error('Error loading profile in sidebar:', err)
      } finally {
        if (mounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    loadProfile()
    return () => {
      mounted = false
    }
  }, [pathname]) // Refresh if user updates profile and returns to other pages

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      name: 'Reviews',
      href: '/reviews',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      name: 'Profil Saya',
      href: '/profile',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  const userInitial = profile?.display_name
    ? profile.display_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'S'

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User'
  const universityText = profile?.university || 'Belum diatur'

  const renderNavLinks = (onClickItem?: () => void) => {
    return (
      <nav className="flex-1 space-y-1.5 px-3 py-6">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                if (onClickItem) onClickItem()
              }}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-140 ${
                isActive
                  ? 'text-brand-accent-2 bg-brand-accent-2/10 border-l-4 border-brand-accent-2 shadow-sm'
                  : 'text-ink-muted hover:text-ink-primary hover:bg-paper-hover'
              }`}
            >
              <span className={`transition-colors duration-140 ${isActive ? 'text-brand-accent-2' : 'text-ink-muted group-hover:text-ink-primary'}`}>
                {item.icon}
              </span>
              {item.name}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink-primary font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-rule bg-paper-elevated">
        {/* Brand */}
        <div className="flex h-16 items-center px-6 border-b border-rule/60">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-xl font-bold text-ink-primary tracking-tight font-sans">
              Sabi
            </span>
            <span className="h-2 w-2 rounded-full bg-brand-accent shadow-[0_0_10px_var(--brand-accent)] group-hover:scale-125 transition-transform duration-200"></span>
          </Link>
        </div>

        {/* Navigation */}
        {renderNavLinks()}

        {/* User profile card & Logout */}
        <div className="p-4 border-t border-rule/60 bg-paper-elevated">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-brand-accent text-ink-primary font-bold text-sm shadow-[0_2px_8px_rgba(213,224,78,0.3)]">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              {isLoadingProfile ? (
                <div className="space-y-2">
                  <div className="h-3.5 bg-paper rounded animate-pulse w-3/4"></div>
                  <div className="h-3 bg-paper rounded animate-pulse w-1/2"></div>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-bold text-ink-primary truncate">{displayName}</h4>
                  <p className="text-xs text-ink-muted truncate">{universityText}</p>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="btn btn--soft btn--ink w-full py-2.5 text-xs tracking-wider uppercase"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <div className="flex-1 flex flex-col md:pl-64">
        <header className="md:hidden flex h-16 items-center justify-between px-4 bg-paper-elevated border-b border-rule sticky top-0 z-40">
          <Link href="/dashboard" className="flex items-center gap-1.5 group">
            <span className="text-lg font-bold text-ink-primary">
              Sabi
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent group-hover:scale-125 transition-transform duration-200"></span>
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-ink-muted hover:text-ink-primary focus:outline-none"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>

        {/* Slide-over Mobile Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-ink-primary/20 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer Content */}
            <div className="fixed inset-y-0 left-0 w-64 max-w-xs bg-paper border-r border-rule flex flex-col shadow-2xl animate-in slide-in-from-left duration-250">
              <div className="flex h-16 items-center px-6 border-b border-rule/60 justify-between bg-paper-elevated">
                <Link href="/dashboard" className="flex items-center gap-1.5 group" onClick={() => setIsMobileMenuOpen(false)}>
                  <span className="text-lg font-bold text-ink-primary">
                    Sabi
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-accent group-hover:scale-125 transition-transform duration-200"></span>
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-ink-muted hover:text-ink-primary"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation */}
              {renderNavLinks(() => setIsMobileMenuOpen(false))}

              {/* User profile info & Logout */}
              <div className="p-4 border-t border-rule bg-paper-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-brand-accent text-ink-primary font-bold text-sm shadow-[0_2px_8px_rgba(213,224,78,0.3)]">
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isLoadingProfile ? (
                      <div className="space-y-2">
                        <div className="h-3.5 bg-paper rounded animate-pulse w-3/4"></div>
                        <div className="h-3 bg-paper rounded animate-pulse w-1/2"></div>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-sm font-bold text-ink-primary truncate">{displayName}</h4>
                        <p className="text-xs text-ink-muted truncate">{universityText}</p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    signOut()
                  }}
                  className="btn btn--soft btn--ink w-full py-2.5 text-xs tracking-wider uppercase"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Keluar Aplikasi</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] md:min-h-screen bg-paper text-ink-primary">
          {children}
        </main>
      </div>
    </div>
  )
}
