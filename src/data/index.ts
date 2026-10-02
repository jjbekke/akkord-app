import type { Repository } from './repository'
import { SupabaseRepository } from './supabaseRepository'

export const repo: Repository = new SupabaseRepository()
