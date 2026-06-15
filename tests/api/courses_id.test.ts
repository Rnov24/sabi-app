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

// Import route handlers AFTER vi.mocks are declared
import { GET, PATCH, DELETE } from '@/app/api/courses/[id]/route'
import { createClient } from '@/lib/supabase/server'

const mockOwnerUser = { id: 'owner-uuid', email: 'owner@example.com' }
const mockMemberUser = { id: 'member-uuid', email: 'member@example.com' }
const mockStrangerUser = { id: 'stranger-uuid', email: 'stranger@example.com' }

describe('Course ID API Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetMockSupabaseClient()
    mockAuthState.user = null
    mockAuthState.error = null
  })

  describe('GET /api/courses/[id]', () => {
    const courseData = {
      id: 'course-123',
      user_id: 'owner-uuid',
      name: 'Linear Algebra',
      source_type: 'free',
    }

    it('should return course details successfully if user is the owner', async () => {
      mockAuthState.user = mockOwnerUser

      const supabase = await createClient()
      ;(supabase as any).mockTable('courses', courseData)

      const req = createMockRequest('/api/courses/course-123')
      const response = await GET(req, { params: Promise.resolve({ id: 'course-123' }) })
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.data.name).toBe('Linear Algebra')
    })

    it('should return course details successfully if user is a joined course member', async () => {
      mockAuthState.user = mockMemberUser

      const supabase = await createClient()
      ;(supabase as any).mockTable('courses', courseData)
      ;(supabase as any).mockTable('course_members', { user_id: 'member-uuid', course_id: 'course-123', role: 'student' })

      const req = createMockRequest('/api/courses/course-123')
      const response = await GET(req, { params: Promise.resolve({ id: 'course-123' }) })
      expect(response.status).toBe(200)
    })

    it('should return 403 Forbidden if user is neither owner nor course member', async () => {
      mockAuthState.user = mockStrangerUser

      const supabase = await createClient()
      ;(supabase as any).mockTable('courses', courseData)
      ;(supabase as any).mockTable('course_members', null) // not a member

      const req = createMockRequest('/api/courses/course-123')
      const response = await GET(req, { params: Promise.resolve({ id: 'course-123' }) })
      expect(response.status).toBe(403)

      const json = await response.json()
      expect(json.error.code).toBe('FORBIDDEN')
    })

    it('should return 404 Not Found if course does not exist', async () => {
      mockAuthState.user = mockOwnerUser

      const supabase = await createClient()
      ;(supabase as any).mockTable('courses', null) // course missing

      const req = createMockRequest('/api/courses/course-missing')
      const response = await GET(req, { params: Promise.resolve({ id: 'course-missing' }) })
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/courses/[id]', () => {
    it('should update course if user is owner', async () => {
      mockAuthState.user = mockOwnerUser

      const supabase = await createClient()
      const updatedData = { id: 'course-123', user_id: 'owner-uuid', name: 'New Course Name' }
      ;(supabase as any).mockTable('courses', updatedData)

      const req = createMockRequest('/api/courses/course-123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Course Name' }),
      })
      const response = await PATCH(req, { params: Promise.resolve({ id: 'course-123' }) })
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.data.name).toBe('New Course Name')
    })
  })

  describe('DELETE /api/courses/[id]', () => {
    it('should soft delete course and return 200', async () => {
      mockAuthState.user = mockOwnerUser

      const req = createMockRequest('/api/courses/course-123', { method: 'DELETE' })
      const response = await DELETE(req, { params: Promise.resolve({ id: 'course-123' }) })
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.data.deleted).toBe(true)
    })
  })
})
