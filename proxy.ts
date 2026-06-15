import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public endpoints — no auth required
  if (
    pathname.startsWith('/api/cards/') ||
    pathname.startsWith('/api/cron/')
  ) {
    // Cron endpoints require CRON_SECRET
    if (pathname.startsWith('/api/cron/')) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
          { status: 401 }
        )
      }
    }
    return NextResponse.next()
  }

  // Auth callback — let it pass through
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/auth/:path*',
  ],
}
