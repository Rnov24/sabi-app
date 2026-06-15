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
import { POST } from '@/app/api/courses/join/route'
import { createClient } from '@/lib/supabase/server'

const mockUser = { id: 'student-uuid', email: 'student@example.com' }

describe('Course Join API Endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetMockSupabaseClient()
    mockAuthState.user = null
    mockAuthState.error = null
  })

  it('should join course successfully with a valid code', async () => {
    mockAuthState.user = mockUser

    const supabase = await createClient()
    const targetCourse = { id: 'course-123', name: 'Biology 101', user_id: 'teacher-uuid' }
    
    // Mock database responses:
    // 1. Course lookup: returns targetCourse
    // 2. Existing membership: returns null (not a member yet)
    // 3. Member count check: count is 10
    // 4. Membership insertion: successful
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: targetCourse, error: null }),
        } as any
      }
      if (table === 'course_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // not a member
          insert: vi.fn().mockResolvedValue({ error: null }), // successful insert
          then: vi.fn().mockImplementation((resolve) => resolve({ count: 10, error: null })), // member count = 10
        } as any
      }
      return new MockSupabaseClient().from(table)
    })

    const req = createMockRequest('/api/courses/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: 'BIO101' }),
    })
    const response = await POST(req)
    expect(response.status).toBe(201)

    const json = await response.json()
    expect(json.data.course_id).toBe('course-123')
    expect(json.data.course_name).toBe('Biology 101')
  })

  it('should prevent user from joining their own course', async () => {
    mockAuthState.user = mockUser // student-uuid

    const supabase = await createClient()
    const targetCourse = { id: 'course-123', name: 'My Own Biology', user_id: 'student-uuid' } // owned by student-uuid
    
    ;(supabase as any).mockTable('courses', targetCourse)

    const req = createMockRequest('/api/courses/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: 'BIO102' }),
    })
    const response = await POST(req)
    expect(response.status).toBe(403)

    const json = await response.json()
    expect(json.error.message).toContain('You cannot join your own course')
  })

  it('should prevent duplicate membership', async () => {
    mockAuthState.user = mockUser

    const supabase = await createClient()
    const targetCourse = { id: 'course-123', name: 'Biology 101', user_id: 'teacher-uuid' }
    
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: targetCourse, error: null }),
        } as any
      }
      if (table === 'course_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'student' }, error: null }), // ALREADY a member
        } as any
      }
      return new MockSupabaseClient().from(table)
    })

    const req = createMockRequest('/api/courses/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: 'BIO101' }),
    })
    const response = await POST(req)
    expect(response.status).toBe(422)

    const json = await response.json()
    expect(json.error.message).toContain('You are already a member of this course')
  })

  it('should prevent joining if class is full (limit 50)', async () => {
    mockAuthState.user = mockUser

    const supabase = await createClient()
    const targetCourse = { id: 'course-123', name: 'Biology 101', user_id: 'teacher-uuid' }
    
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: targetCourse, error: null }),
        } as any
      }
      if (table === 'course_members') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // not a member yet
          then: vi.fn().mockImplementation((resolve) => resolve({ count: 50, error: null })), // class size = 50
        } as any
      }
      return new MockSupabaseClient().from(table)
    })

    const req = createMockRequest('/api/courses/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: 'BIO101' }),
    })
    const response = await POST(req)
    expect(response.status).toBe(422)

    const json = await response.json()
    expect(json.error.message).toContain('Course member limit reached')
  })
})
