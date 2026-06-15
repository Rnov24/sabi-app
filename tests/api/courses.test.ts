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
import { GET, POST } from '@/app/api/courses/route'
import { createClient } from '@/lib/supabase/server'

const mockUser = { id: 'user-123', email: 'test@example.com' }

describe('Courses API Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetMockSupabaseClient()
    mockAuthState.user = null
    mockAuthState.error = null
  })

  describe('GET /api/courses', () => {
    it('should list enrolled courses successfully', async () => {
      mockAuthState.user = mockUser

      const supabase = await createClient()
      const mockDbCourses = [
        {
          id: 'course-1',
          name: 'Calculus',
          source_type: 'syllabus',
          exam_date: '2026-06-20',
          level: 'intro',
          join_code: 'CAL123',
          created_at: '2026-06-01T00:00:00Z',
          topics: [
            { id: 't-1', mastery_events: [{ id: 'me-1' }, { id: 'me-2' }] },
            { id: 't-2', mastery_events: [] },
            { id: 't-3', mastery_events: [] },
            { id: 't-4', mastery_events: [] },
          ],
        },
      ]
      ;(supabase as any).mockTable('courses', mockDbCourses)

      const req = createMockRequest('/api/courses')
      const response = await GET(req)
      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.data).toEqual([
        {
          id: 'course-1',
          name: 'Calculus',
          source_type: 'syllabus',
          exam_date: '2026-06-20',
          level: 'intro',
          join_code: 'CAL123',
          created_at: '2026-06-01T00:00:00Z',
          topic_count: 4,
          mastery_count: 2,
        },
      ])
    })

    it('should return 401 when unauthenticated', async () => {
      mockAuthState.error = new UnauthorizedError()

      const req = createMockRequest('/api/courses')
      const response = await GET(req)
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/courses', () => {
    it('should create a new course successfully', async () => {
      mockAuthState.user = mockUser

      const supabase = await createClient()
      const newCourseData = {
        id: 'new-course-uuid',
        user_id: mockUser.id,
        name: 'Physics I',
        source_type: 'free',
        level: 'intermediate',
        join_code: null,
      }
      
      // Mock active course count to be 2
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: newCourseData, error: null }),
            then: vi.fn().mockImplementation((resolve) => resolve({ count: 2, error: null })),
          } as any
        }
        return new MockSupabaseClient().from(table)
      })

      const req = createMockRequest('/api/courses', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Physics I',
          source_type: 'free',
          level: 'intermediate',
        }),
      })
      const response = await POST(req)
      expect(response.status).toBe(201)

      const json = await response.json()
      expect(json.data).toEqual(newCourseData)
    })

    it('should throw validation error if user exceeds 5 active courses limit', async () => {
      mockAuthState.user = mockUser

      const supabase = await createClient()
      
      // Mock active course count to be 5
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve) => resolve({ count: 5, error: null })),
          } as any
        }
        return new MockSupabaseClient().from(table)
      })

      const req = createMockRequest('/api/courses', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Chemistry I',
          source_type: 'free',
        }),
      })
      const response = await POST(req)
      expect(response.status).toBe(422)

      const json = await response.json()
      expect(json.error.message).toContain('Maximum 5 active courses allowed')
    })
  })
})
