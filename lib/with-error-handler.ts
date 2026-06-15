import { NextRequest, NextResponse } from 'next/server'
import { AppError, RateLimitError } from './errors'
import { err } from './api-response'
import { ZodError } from 'zod'

type RouteHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse | Response>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message, reset_at: error.resetAt } },
          { status: error.status }
        )
      }

      if (error instanceof AppError) {
        return err(error.code, error.message, error.status)
      }

      if (error instanceof ZodError) {
        const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        return err('VALIDATION_ERROR', message, 422)
      }

      console.error('Unhandled error:', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const details = (error as any)?.details || null
      const hint = (error as any)?.hint || null
      
      return err(
        'INTERNAL_ERROR',
        errorMessage || 'An unexpected error occurred',
        500,
        details || hint ? { details, hint } : undefined
      )
    }
  }
}
