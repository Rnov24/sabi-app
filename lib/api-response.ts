import { NextResponse } from 'next/server'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function err(code: string, message: string, status = 500) {
  return NextResponse.json(
    { error: { code, message } },
    { status }
  )
}

export function created<T>(data: T) {
  return ok(data, 201)
}
