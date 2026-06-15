export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input') {
    super('VALIDATION_ERROR', message, 422)
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends AppError {
  constructor(public resetAt: string) {
    super('RATE_LIMITED', 'Rate limit exceeded', 429)
    this.name = 'RateLimitError'
  }
}

export class LLMError extends AppError {
  constructor(message = 'AI service temporarily unavailable') {
    super('LLM_ERROR', message, 503)
    this.name = 'LLMError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}
