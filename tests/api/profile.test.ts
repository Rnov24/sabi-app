import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, MockSupabaseClient, mockAuthState, resetMockSupabaseClient } from '../helpers/mocks'
import { UnauthorizedError } from '@/lib/errors'

// Setup module mocks
vi.mock('@/lib/supabase/server', async () => {
  return {
    createClient: vi.fn().mockImplementation(async () => {
      const { mockSupabaseClient } = await import('../helpers/mocks')
      return mockSupabaseClient
    }),
  }
})

vi.mock('@/lib/auth', () => {
  return {
    getAuthUser: vi.fn().mockImplementation(async () => {
      const { mockAuthState } = await import('../helpers/mocks')
      if (mockAuthState.error) {
        throw mockAuthState.error
      }
      if (!mockAuthState.user) {
        const { UnauthorizedError } = await import('@/lib/errors')
        throw new UnauthorizedError()
      }
      return mockAuthState.user
    }),
  }
})

// Import route handlers AFTER vi.mocks are declared (to ensure proper mocking context)
import { GET, PATCH } from '@/app/api/profile/route'
import { createClient } from '@/lib/supabase/server'

const mockUser = { id: 'user-123', email: 'test@example.com' }

describe('Profile API Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetMockSupabaseClient()
    mockAuthState.user = null
    mockAuthState.error = null
  })

  describe('GET /api/profile', () => {
    it('should return profile successfully when user is logged in', async () => {
      // Mock authenticated user
      mockAuthState.user = mockUser

      // Mock database profile fetch
      const supabase = await createClient()
      const mockProfile = { id: 'user-123', display_name: 'Jane Doe', university: 'Test Univ' }
      ;(supabase as any).mockTable('profiles', mockProfile)

      const req = createMockRequest('/api/profile')
      const response = await GET(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.data).toEqual(mockProfile)
    })

    it('should return 401 when unauthenticated', async () => {
      mockAuthState.error = new UnauthorizedError()

      const req = createMockRequest('/api/profile')
      const response = await GET(req)
      expect(response.status).toBe(401)

      const json = await response.json()
      expect(json.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('PATCH /api/profile', () => {
    it('should update profile successfully', async () => {
      mockAuthState.user = mockUser

      const supabase = await createClient()
      const updatedProfile = { id: 'user-123', display_name: 'Jane New Name', university: 'Test Univ' }
      ;(supabase as any).mockTable('profiles', updatedProfile)

      const req = createMockRequest('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: 'Jane New Name' }),
      })
      const response = await PATCH(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.data).toEqual(updatedProfile)
    })

    it('should return 422 if input validation fails (e.g. name too long)', async () => {
      mockAuthState.user = mockUser

      const longName = 'a'.repeat(60) // max is 50
      const req = createMockRequest('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: longName }),
      })
      const response = await PATCH(req)
      expect(response.status).toBe(422)

      const json = await response.json()
      expect(json.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
