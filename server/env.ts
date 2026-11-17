import type { D1Database } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
}

export interface PetitionContext {
  waitUntil(promise: Promise<unknown>): void
}
