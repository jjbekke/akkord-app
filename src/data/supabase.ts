import { createClient } from '@supabase/supabase-js'

// Projektets adresse og den offentlige (publishable) nøgle. Nøglen må gerne ligge i
// klientkoden — al adgangskontrol sker med RLS i databasen. Hemmelige nøgler må aldrig herind.
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://pxuwilgqlvhtwgsxomvy.supabase.co'
const NOEGLE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_oxcIbfdkvtV6dqI8QZAlEQ_aPtxwhYl'

export const supabase = createClient(URL, NOEGLE)
