// Edge function: et almindeligt projektmedlems egen løn.
//
// Ens andel af overskuddet afhænger af alle andres timer og satser, som medlemmet
// ikke må se. Derfor regnes der her på serveren med den samme beregningsmotor som
// i appen, og kun medlemmets egen række sendes tilbage.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { hentProjektData } from '../../../src/data/raekker.ts'
import { beregnLoen } from '../../../src/domain/beregning.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const svar = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })

/** Ny nøgle (JSON-ordbog) hvis den findes, ellers den gamle. */
function noegle(navn: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS', gammel: string): string {
  try {
    const k = JSON.parse(Deno.env.get(navn) ?? '{}').default
    if (k) return k
  } catch {
    // brug den gamle nøgle
  }
  return Deno.env.get(gammel)!
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return svar({ fejl: 'Kun POST' }, 405)

  try {
    const { projektId } = await req.json().catch(() => ({}))
    if (typeof projektId !== 'string') return svar({ fejl: 'projektId mangler' }, 400)

    const url = Deno.env.get('SUPABASE_URL')!
    const auth = req.headers.get('Authorization') ?? ''
    const token = auth.replace(/^Bearer\s+/i, '')

    // Klient med brugerens egne rettigheder (RLS)
    const bruger = createClient(url, noegle('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: claims, error: authFejl } = await bruger.auth.getClaims(token)
    const uid = claims?.claims.sub
    if (authFejl || !uid) return svar({ fejl: 'Du er ikke logget ind' }, 401)

    const { data: mig, error } = await bruger
      .from('projekt_medlemmer')
      .select('id')
      .eq('projekt_id', projektId)
      .eq('bruger_id', uid)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!mig) return svar({ fejl: 'Du er ikke med i projektet' }, 403)

    // Hele projektet hentes med servernøglen — kun til beregningen
    const admin = createClient(url, noegle('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const data = await hentProjektData(admin, projektId)
    const r = beregnLoen(data)
    const id = mig.id as string

    return svar({
      loen: r.personer.find((p) => p.medlemId === id) ?? null,
      akkord: r.akkord.personer.find((p) => p.medlemId === id) ?? null,
      timeloen: r.timeloen.personer.find((p) => p.medlemId === id) ?? null,
      justeringer: data.justeringer
        .filter((j) => j.medlemId === id)
        .map(({ beloeb, begrundelse, oprettet }) => ({ beloeb, begrundelse, oprettet })),
    })
  } catch (e) {
    console.error(e)
    return svar({ fejl: 'Regnskabet kunne ikke beregnes' }, 500)
  }
})
