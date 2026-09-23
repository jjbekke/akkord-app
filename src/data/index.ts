import { LocalRepository } from './localRepository'
import type { Repository } from './repository'

// Skift til `new SupabaseRepository(...)` i fase 2 — resten af appen er uændret.
export const repo: Repository = new LocalRepository()
