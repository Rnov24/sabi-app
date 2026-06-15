import { vi } from 'vitest'
import { NextRequest } from 'next/server'

// Custom mockable response class for Supabase queries
export class MockSupabaseQueryBuilder {
  private data: any
  private error: any

  constructor(data: any, error: any) {
    this.data = data
    this.error = error
  }

  select = vi.fn().mockReturnThis()
  insert = vi.fn().mockReturnThis()
  update = vi.fn().mockReturnThis()
  delete = vi.fn().mockReturnThis()
  eq = vi.fn().mockReturnThis()
  is = vi.fn().mockReturnThis()
  order = vi.fn().mockReturnThis()
  single = vi.fn().mockImplementation(() => Promise.resolve({ data: this.data, error: this.error }))
  maybeSingle = vi.fn().mockImplementation(() => Promise.resolve({ data: this.data, error: this.error }))
  
  // Implement a then method so this builder is awaitable directly
  then = vi.fn().mockImplementation((resolve) => resolve({ data: this.data, error: this.error }))
}

export class MockSupabaseClient {
  private tableMocks: Record<string, { data: any; error: any }> = {}

  mockTable(table: string, data: any, error: any = null) {
    this.tableMocks[table] = { data, error }
  }

  from = vi.fn().mockImplementation((table: string) => {
    const mock = this.tableMocks[table] || { data: null, error: null }
    return new MockSupabaseQueryBuilder(mock.data, mock.error)
  })

  storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'path' }, error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

// Mutable global Supabase client state for mock testing
export let mockSupabaseClient = new MockSupabaseClient()

export function resetMockSupabaseClient() {
  mockSupabaseClient = new MockSupabaseClient()
}

// Mutable global auth state for mock testing
export const mockAuthState = {
  user: null as any,
  error: null as any,
}

// Hoist vi.mock at mock module load time
vi.mock('@/lib/auth', () => {
  return {
    getAuthUser: vi.fn().mockImplementation(async () => {
      if (mockAuthState.error) {
        throw mockAuthState.error
      }
      if (!mockAuthState.user) {
        // Fallback standard error if not set
        const { UnauthorizedError } = await import('@/lib/errors')
        throw new UnauthorizedError()
      }
      return mockAuthState.user
    }),
  }
})

export function createMockRequest(path: string, options: RequestInit = {}) {
  const url = `http://localhost:3000${path}`
  return new NextRequest(url, options as any)
}
