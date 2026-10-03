// Ende-til-ende mod den rigtige Supabase med to faste testbrugere:
//   leder@akbog-test.dk og medlem@akbog-test.dk
// Adgangskoden ligger i .env.test.local (VITE_AKBOG_TEST_KODE) og committes ikke.
// Kør: npm run test:e2e

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { hentProjektData, type Db } from '../src/data/raekker'
import { beregnLoen } from '../src/domain/beregning'

// Realtime bruges ikke, men supabase-js kræver en WebSocket i Node < 22
;(globalThis as { WebSocket?: unknown }).WebSocket ??= class {}

const URL = 'https://pxuwilgqlvhtwgsxomvy.supabase.co'
const NOEGLE = 'sb_publishable_oxcIbfdkvtV6dqI8QZAlEQ_aPtxwhYl'
const KODE = import.meta.env.VITE_AKBOG_TEST_KODE as string | undefined
const LEDER_ID = '11111111-1111-4111-8111-111111111111'
const MEDLEM_ID = '22222222-2222-4222-8222-222222222222'

const klient = () => createClient(URL, NOEGLE, { auth: { persistSession: false } })
const db = (k: SupabaseClient) => k as unknown as Db
function ok<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw new Error(JSON.stringify(r.error))
  return r.data as NonNullable<T>
}

async function logInd(email: string) {
  const k = klient()
  ok(await k.auth.signInWithPassword({ email, password: KODE! }))
  return k
}

describe.skipIf(!KODE)('AKBOG mod Supabase', () => {
  it('kartotek → projekt → registrering → adgang → løn → afslut', async () => {
    const leder = await logInd('leder@akbog-test.dk')
    const medlem = await logInd('medlem@akbog-test.dk')

    // Ryd testlederens kartotek fra sidste kørsel (egen person kan ikke slettes)
    ok(await leder.from('personer').delete().neq('bruger_id', LEDER_ID))
    ok(await leder.from('personer').delete().is('bruger_id', null))
    ok(await leder.from('materialer').delete().not('id', 'is', null))

    // Kartotek: e-mail normaliseres og kobles til den bekræftede bruger
    ok(await leder.from('personer').update({ timesats: 21000 }).eq('bruger_id', LEDER_ID))
    ok(await leder.from('personer').insert({ navn: 'Test Medlem', email: ' Medlem@akbog-test.dk ', timesats: 10850 }))
    const pMedlem = ok(await leder.from('personer').select('*').eq('email', 'medlem@akbog-test.dk').single())
    expect(pMedlem.bruger_id).toBe(MEDLEM_ID)
    ok(await leder.from('materialer').insert([{ navn: 'Sålbænke', stykpris: 10000 }, { navn: 'Stenhoveder', stykpris: 47200 }]))
    const materialer = ok(await leder.from('materialer').select('*'))
    const prisAendring = await leder.from('materialer').update({ stykpris: 1 }).eq('id', materialer[0].id)
    expect(prisAendring.error?.code).toBe('42501') // priser kan ikke ændres

    // Opret projekt med medlem (lærlingetillæg 50 kr./t) og materialer
    const projektId = ok(
      await leder.rpc('opret_projekt', {
        p_navn: `E2E ${new Date().toISOString()}`,
        p_medlemmer: [{ person_id: pMedlem.id, overskud_pr_time: 5000 }],
        p_materialer: materialer.map((m: { id: string }) => m.id),
      }),
    ) as string
    const start = await hentProjektData(db(leder), projektId)
    const mig = start.medlemmer.find((m) => m.brugerId === LEDER_ID)!
    const ham = start.medlemmer.find((m) => m.brugerId === MEDLEM_ID)!
    expect(mig).toMatchObject({ rolle: 'projektleder', timesats: 21000 })
    expect(ham).toMatchObject({ rolle: 'medlem', timesats: 10850, overskudPrTime: 5000 })
    expect(start.materialer.map((m) => m.stykpris).sort()).toEqual([10000, 47200])

    // Projektleder registrerer for begge, materialer og note
    ok(
      await leder.from('timer').insert([
        { projekt_id: projektId, medlem_id: mig.id, dato: '2026-10-01', type: 'akkord', timer: 3000 },
        { projekt_id: projektId, medlem_id: ham.id, dato: '2026-10-01', type: 'akkord', timer: 2000 },
        { projekt_id: projektId, medlem_id: ham.id, dato: '2026-10-01', type: 'timeloen', timer: 300, beskrivelse: 'Oprydning' },
      ]),
    )
    const sten = start.materialer.find((m) => m.navn === 'Stenhoveder')!
    ok(await leder.from('materiale_registreringer').insert({ projekt_id: projektId, projekt_materiale_id: sten.id, dato: '2026-10-01', antal: 5000 }))
    ok(await leder.from('noter').insert({ projekt_id: projektId, dato: '2026-10-01', tekst: 'Ledernote' }))

    // Medlem ser kun egne rækker og kan kun registrere egne timer
    const set = await hentProjektData(db(medlem), projektId)
    expect(set.medlemmer.map((m) => m.id)).toEqual([ham.id])
    expect(set.timer.every((t) => t.medlemId === ham.id)).toBe(true)
    expect(set.materialer).toHaveLength(0)
    expect(set.materialeRegistreringer).toHaveLength(0)
    expect(set.noter).toHaveLength(0)
    const forAndre = await medlem.from('timer').insert({ projekt_id: projektId, medlem_id: mig.id, dato: '2026-10-02', type: 'akkord', timer: 100 })
    expect(forAndre.error?.code).toBe('42501')
    ok(await medlem.from('timer').insert({ projekt_id: projektId, medlem_id: ham.id, dato: '2026-10-02', type: 'akkord', timer: 500 }))

    // Edge function: medlemmets egen løn = samme tal som lederens fulde beregning
    const fuld = beregnLoen(await hentProjektData(db(leder), projektId))
    const svar = await medlem.functions.invoke('mit-regnskab', { body: { projektId } })
    expect(svar.error).toBeNull()
    expect(svar.data.loen).toEqual(fuld.personer.find((p) => p.medlemId === ham.id))
    expect(svar.data.akkord).toEqual(fuld.akkord.personer.find((p) => p.medlemId === ham.id))
    const fremmed = await leder.functions.invoke('mit-regnskab', { body: { projektId: crypto.randomUUID() } })
    expect(fremmed.error).toBeTruthy()

    // Afslut: skrivebeskyttet, filer kun for projektledere, kan genåbnes
    ok(await leder.from('projekter').update({ afsluttet: new Date().toISOString() }).eq('id', projektId))
    const laast = await leder.from('timer').insert({ projekt_id: projektId, medlem_id: mig.id, dato: '2026-10-03', type: 'akkord', timer: 100 })
    expect(laast.error?.code).toBe('42501')
    const sti = `${projektId}/test.pdf`
    ok(await leder.storage.from('projektfiler').upload(sti, new Blob(['%PDF-test'], { type: 'application/pdf' })))
    ok(await leder.from('projekt_filer').insert({ projekt_id: projektId, type: 'kvittering', filnavn: 'test.pdf', sti }))
    const url = ok(await leder.storage.from('projektfiler').createSignedUrl(sti, 60))
    expect((await fetch(url.signedUrl)).status).toBe(200)
    expect((await medlem.storage.from('projektfiler').createSignedUrl(sti, 60)).error).toBeTruthy()
    expect(ok(await medlem.from('projekt_filer').select('*').eq('projekt_id', projektId))).toHaveLength(0)

    ok(await leder.from('projekter').update({ afsluttet: null }).eq('id', projektId))
    ok(await leder.from('timer').insert({ projekt_id: projektId, medlem_id: mig.id, dato: '2026-10-03', type: 'akkord', timer: 100 }))
    ok(await leder.storage.from('projektfiler').remove([sti]))

    // Ryd op: opretteren sletter projektet — alt følger med
    ok(await leder.from('projekter').delete().eq('id', projektId))
    expect(ok(await leder.from('timer').select('id').eq('projekt_id', projektId))).toHaveLength(0)
  }, 60_000)

  it('medlem uden login kan blive projektleder, kobles til en person, og projektet kan slettes', async () => {
    const leder = await logInd('leder@akbog-test.dk')
    const medlem = await logInd('medlem@akbog-test.dk')
    const pMedlem = ok(await leder.from('personer').select('*').eq('email', 'medlem@akbog-test.dk').single())

    const projektId = ok(await leder.rpc('opret_projekt', { p_navn: 'E2E kobling', p_medlemmer: [], p_materialer: [] })) as string
    const uden = ok(
      await leder.from('projekt_medlemmer').insert({ projekt_id: projektId, navn: 'Uden login', timesats: 9000 }).select('id').single(),
    )

    // Projektlederrollen kan gives, selvom personen ikke har login
    ok(await leder.from('projekt_medlemmer').update({ rolle: 'projektleder' }).eq('id', uden.id))
    expect(ok(await leder.from('projekt_medlemmer').select('rolle').eq('id', uden.id).single()).rolle).toBe('projektleder')

    // Medlemmet ser ikke projektet, før det kobles til personen med medlemmets e-mail
    expect(ok(await medlem.from('projekter').select('id').eq('id', projektId))).toHaveLength(0)
    const ugyldig = await leder.rpc('kobl_medlem_email', { p_medlem: uden.id, p_email: 'ikke-en-mail' })
    expect(ugyldig.error?.message).toMatch(/gyldig e-mail/)
    ok(await leder.rpc('kobl_medlem_email', { p_medlem: uden.id, p_email: ' Medlem@akbog-test.dk ' }))
    expect(ok(await leder.from('projekt_medlemmer').select('person_id').eq('id', uden.id).single()).person_id).toBe(pMedlem.id)
    expect(ok(await medlem.from('projekter').select('id').eq('id', projektId))).toHaveLength(1)

    // Ny e-mail uden konto: personen oprettes i kartoteket med medlemmets navn og sats
    const ny = ok(
      await leder.from('projekt_medlemmer').insert({ projekt_id: projektId, navn: 'Ny via mail', timesats: 9500 }).select('id').single(),
    )
    ok(await leder.rpc('kobl_medlem_email', { p_medlem: ny.id, p_email: 'ny-person@akbog-test.dk' }))
    const nyPerson = ok(await leder.from('personer').select('*').eq('email', 'ny-person@akbog-test.dk').single())
    expect(nyPerson).toMatchObject({ navn: 'Ny via mail', timesats: 9500, bruger_id: null })
    const dobbelt = ok(
      await leder.from('projekt_medlemmer').insert({ projekt_id: projektId, navn: 'Dobbelt', timesats: 9000 }).select('id').single(),
    )
    const dobbeltSvar = await leder.rpc('kobl_medlem_email', { p_medlem: dobbelt.id, p_email: 'medlem@akbog-test.dk' })
    expect(dobbeltSvar.error?.message).toMatch(/allerede med i projektet/)
    const mig = ok(await leder.from('personer').select('id').eq('bruger_id', LEDER_ID).single())
    const igen = await leder.from('projekt_medlemmer').update({ person_id: mig.id }).eq('id', uden.id)
    expect(igen.error?.message).toMatch(/allerede koblet/) // en kobling kan ikke laves om

    // Materialer med registreringer og en fil — sletning skal stadig gå igennem
    const pm = ok(await leder.from('projekt_materialer').insert({ projekt_id: projektId, navn: 'Sten', stykpris: 100 }).select('id').single())
    ok(await leder.from('materiale_registreringer').insert({ projekt_id: projektId, projekt_materiale_id: pm.id, dato: '2026-10-01', antal: 100 }))
    const fjernBrugt = await leder.from('projekt_materialer').delete().eq('id', pm.id)
    expect(fjernBrugt.error?.code).toBe('23503') // et brugt materiale kan ikke fjernes alene
    ok(await leder.storage.from('projektfiler').upload(`${projektId}/fil.pdf`, new Blob(['x'], { type: 'application/pdf' })))

    // Medlemmet (nu projektleder, men ikke opretter) kan ikke slette
    const forsoeg = ok(await medlem.from('projekter').delete().eq('id', projektId).select('id'))
    expect(forsoeg).toHaveLength(0)

    // Opretteren sletter: filer først (som appen gør), så projektet
    const filer = ok(await leder.storage.from('projektfiler').list(projektId))
    ok(await leder.storage.from('projektfiler').remove(filer.map((f) => `${projektId}/${f.name}`)))
    expect(ok(await leder.from('projekter').delete().eq('id', projektId).select('id'))).toHaveLength(1)
    expect(ok(await leder.from('projekt_medlemmer').select('id').eq('projekt_id', projektId))).toHaveLength(0)
    expect(ok(await leder.storage.from('projektfiler').list(projektId))).toHaveLength(0)
  }, 60_000)
})
