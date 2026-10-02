import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Id, Materiale, MaterialeRegistrering, Medlem, Person, TimeRegistrering } from '../domain/typer'
import { hentProjektData, tilMateriale, tilPerson, tilProjekt, type Db } from './raekker'
import type { MitRegnskab, NytProjekt, ProjektOversigt, Repository } from './repository'
import { supabase } from './supabase'

interface DbFejl {
  message: string
  code?: string
}

/** Oversætter databasefejl til noget, man kan vise brugeren. */
function fejltekst(fejl: DbFejl): string {
  switch (fejl.code) {
    case '42501':
      return 'Du har ikke adgang til at gøre dette (er projektet afsluttet?)'
    case '23505':
      return 'Findes allerede'
    case '23503':
      return 'Kan ikke slettes, fordi det er brugt i et projekt'
    case 'P0001':
      return fejl.message // vores egne beskeder fra triggerne
    default:
      return fejl.message
  }
}

/** Kaster ved fejl. Uden fejl er data altid sat for forespørgsler med select. */
function tjek<T>({ data, error }: { data: T; error: DbFejl | null }): NonNullable<T> {
  if (error) throw new Error(fejltekst(error))
  return data as NonNullable<T>
}

async function brugerId(): Promise<Id> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Du er ikke logget ind')
  return id
}

const db = supabase as unknown as Db

export class SupabaseRepository implements Repository {
  async hentProfil() {
    const id = await brugerId()
    const r = tjek(await supabase.from('profiler').select('*').eq('id', id).single())
    return { id: r.id as string, navn: r.navn as string, email: r.email as string }
  }

  // --- Personer -----------------------------------------------------------

  async hentPersoner() {
    return tjek(await supabase.from('personer').select('*').order('navn')).map(tilPerson)
  }

  async gemPerson(p: Omit<Person, 'id'> & { id?: Id }) {
    const raekke = { navn: p.navn, email: p.email ?? null, timesats: p.timesats }
    if (p.id) tjek(await supabase.from('personer').update(raekke).eq('id', p.id))
    else tjek(await supabase.from('personer').insert(raekke))
  }

  async sletPerson(id: Id) {
    tjek(await supabase.from('personer').delete().eq('id', id))
  }

  // --- Materialepriser ----------------------------------------------------

  async hentMaterialer() {
    return tjek(await supabase.from('materialer').select('*').order('navn')).map(tilMateriale)
  }

  async opretMateriale(navn: string, stykpris: number) {
    tjek(await supabase.from('materialer').insert({ navn, stykpris }))
  }

  async skjulMateriale(id: Id, skjult: boolean) {
    tjek(await supabase.from('materialer').update({ skjult }).eq('id', id))
  }

  async sletMateriale(id: Id) {
    tjek(await supabase.from('materialer').delete().eq('id', id))
  }

  // --- Projekter ----------------------------------------------------------

  async hentProjekter(): Promise<ProjektOversigt[]> {
    const id = await brugerId()
    const [projekter, mine, favoritter] = await Promise.all([
      supabase.from('projekter').select('*').order('oprettet', { ascending: false }),
      supabase.from('projekt_medlemmer').select('id, projekt_id, rolle').eq('bruger_id', id),
      supabase.from('favoritter').select('projekt_id'),
    ])
    const medlemskaber = tjek(mine)
    const roller = new Map(medlemskaber.map((m) => [m.projekt_id as string, m.rolle as Medlem['rolle']]))
    const fav = new Set(tjek(favoritter).map((f) => f.projekt_id as string))

    // Egne timer i dag pr. projekt
    const iDag = new Date().toLocaleDateString('sv-SE') // ÅÅÅÅ-MM-DD i lokal tid
    const timerIDag = new Map<string, number>()
    if (medlemskaber.length) {
      const idag = tjek(
        await supabase
          .from('timer')
          .select('projekt_id, timer')
          .eq('dato', iDag)
          .in(
            'medlem_id',
            medlemskaber.map((m) => m.id as string),
          ),
      )
      for (const t of idag) timerIDag.set(t.projekt_id as string, (timerIDag.get(t.projekt_id as string) ?? 0) + (t.timer as number))
    }

    return tjek(projekter).map((r) => {
      const p = tilProjekt(r)
      return { ...p, favorit: fav.has(p.id), rolle: roller.get(p.id) ?? 'medlem', mineTimerIDag: timerIDag.get(p.id) ?? 0 }
    })
  }

  async opretProjekt(p: NytProjekt) {
    const id = tjek(
      await supabase.rpc('opret_projekt', {
        p_navn: p.navn,
        p_medlemmer: p.medlemmer.map((m) => ({ person_id: m.personId, overskud_pr_time: m.overskudPrTime ?? null })),
        p_materialer: p.materialeIder,
      }),
    )
    return id as Id
  }

  async saetFavorit(projektId: Id, favorit: boolean) {
    if (favorit) tjek(await supabase.from('favoritter').insert({ projekt_id: projektId }))
    else tjek(await supabase.from('favoritter').delete().eq('projekt_id', projektId))
  }

  async hentProjektData(projektId: Id) {
    return hentProjektData(db, projektId)
  }

  async hentMitRegnskab(projektId: Id): Promise<MitRegnskab> {
    const { data, error } = await supabase.functions.invoke('mit-regnskab', { body: { projektId } })
    if (error) {
      const besked = error instanceof FunctionsHttpError ? (await error.context.json().catch(() => null))?.fejl : null
      throw new Error(besked ?? 'Kunne ikke hente dit regnskab')
    }
    return data as MitRegnskab
  }

  async omdoebProjekt(projektId: Id, navn: string) {
    tjek(await supabase.from('projekter').update({ navn }).eq('id', projektId))
  }

  async afslutProjekt(projektId: Id, afsluttet: boolean) {
    const r = tjek(
      await supabase
        .from('projekter')
        .update({ afsluttet: afsluttet ? new Date().toISOString() : null })
        .eq('id', projektId)
        .select('id'),
    )
    if (r.length === 0) throw new Error('Kun projektledere kan afslutte eller genåbne projektet')
  }

  async sletProjekt(projektId: Id) {
    // Filerne først — de slettes ikke af databasen
    const { data: filer } = await supabase.storage.from('projektfiler').list(projektId)
    if (filer?.length) {
      const { error } = await supabase.storage.from('projektfiler').remove(filer.map((f) => `${projektId}/${f.name}`))
      if (error) throw new Error(`Filerne kunne ikke slettes: ${error.message}`)
    }
    const r = tjek(await supabase.from('projekter').delete().eq('id', projektId).select('id'))
    if (r.length === 0) throw new Error('Kun den der har oprettet projektet, kan slette det')
  }

  // --- Medlemmer og projektmaterialer -------------------------------------

  async tilfoejMedlem(projektId: Id, person: Person, overskudPrTime?: number) {
    tjek(
      await supabase.from('projekt_medlemmer').insert({
        projekt_id: projektId,
        person_id: person.id,
        navn: person.navn,
        timesats: person.timesats,
        overskud_pr_time: overskudPrTime ?? null,
      }),
    )
  }

  async gemMedlem(m: Medlem) {
    const r = tjek(
      await supabase
        .from('projekt_medlemmer')
        .update({ navn: m.navn, rolle: m.rolle, timesats: m.timesats, overskud_pr_time: m.overskudPrTime ?? null })
        .eq('id', m.id)
        .select('id'),
    )
    if (r.length === 0) throw new Error('Ændringen blev ikke gemt — kun projektledere kan rette medlemmer')
  }

  async koblMedlem(medlemId: Id, personId: Id) {
    const r = tjek(await supabase.from('projekt_medlemmer').update({ person_id: personId }).eq('id', medlemId).select('id'))
    if (r.length === 0) throw new Error('Medlemmet blev ikke koblet')
  }

  async fjernMedlem(id: Id) {
    tjek(await supabase.from('projekt_medlemmer').delete().eq('id', id))
  }

  async tilfoejProjektMateriale(projektId: Id, m: Materiale) {
    tjek(
      await supabase
        .from('projekt_materialer')
        .insert({ projekt_id: projektId, materiale_id: m.id, navn: m.navn, stykpris: m.stykpris }),
    )
  }

  async fjernProjektMateriale(id: Id) {
    tjek(await supabase.from('projekt_materialer').delete().eq('id', id))
  }

  // --- Registreringer -----------------------------------------------------

  async gemRegistreringer(
    linjer: Parameters<Repository['gemRegistreringer']>[0],
    note?: Parameters<Repository['gemRegistreringer']>[1],
  ) {
    const timer = linjer.flatMap((l) =>
      l.slags === 'timer'
        ? [
            {
              projekt_id: l.data.projektId,
              medlem_id: l.data.medlemId,
              dato: l.data.dato,
              type: l.data.type,
              timer: l.data.timer,
              beskrivelse: l.data.beskrivelse ?? null,
            },
          ]
        : [],
    )
    const materialer = linjer.flatMap((l) =>
      l.slags === 'materiale'
        ? [
            {
              projekt_id: l.data.projektId,
              projekt_materiale_id: l.data.projektMaterialeId,
              dato: l.data.dato,
              antal: l.data.antal,
            },
          ]
        : [],
    )
    if (timer.length) tjek(await supabase.from('timer').insert(timer))
    if (materialer.length) tjek(await supabase.from('materiale_registreringer').insert(materialer))
    if (note) tjek(await supabase.from('noter').insert({ projekt_id: note.projektId, dato: note.dato, tekst: note.tekst }))
  }

  async retTimer(t: TimeRegistrering) {
    tjek(
      await supabase
        .from('timer')
        .update({ medlem_id: t.medlemId, dato: t.dato, type: t.type, timer: t.timer, beskrivelse: t.beskrivelse ?? null })
        .eq('id', t.id),
    )
  }

  async sletTimer(id: Id) {
    tjek(await supabase.from('timer').delete().eq('id', id))
  }

  async retMaterialeRegistrering(r: MaterialeRegistrering) {
    tjek(
      await supabase
        .from('materiale_registreringer')
        .update({ projekt_materiale_id: r.projektMaterialeId, dato: r.dato, antal: r.antal })
        .eq('id', r.id),
    )
  }

  async sletMaterialeRegistrering(id: Id) {
    tjek(await supabase.from('materiale_registreringer').delete().eq('id', id))
  }

  // --- Noter og rettelser -------------------------------------------------

  async gemNote(n: { projektId: Id; dato: string; tekst: string }) {
    tjek(await supabase.from('noter').insert({ projekt_id: n.projektId, dato: n.dato, tekst: n.tekst }))
  }

  async retNote(id: Id, tekst: string) {
    tjek(await supabase.from('noter').update({ tekst }).eq('id', id))
  }

  async sletNote(id: Id) {
    tjek(await supabase.from('noter').delete().eq('id', id))
  }

  async gemJustering(j: { projektId: Id; medlemId: Id; beloeb: number; begrundelse: string }) {
    tjek(
      await supabase
        .from('justeringer')
        .insert({ projekt_id: j.projektId, medlem_id: j.medlemId, beloeb: j.beloeb, begrundelse: j.begrundelse }),
    )
  }

  async sletJustering(id: Id) {
    tjek(await supabase.from('justeringer').delete().eq('id', id))
  }

  // --- Filer (kvittering og Excel) ----------------------------------------

  async gemFil(projektId: Id, type: 'kvittering' | 'timeloen', filnavn: string, indhold: Blob) {
    const sti = `${projektId}/${Date.now()}-${filnavn}`
    const { error } = await supabase.storage.from('projektfiler').upload(sti, indhold, { contentType: indhold.type })
    if (error) throw new Error(`Filen kunne ikke gemmes: ${error.message}`)
    tjek(await supabase.from('projekt_filer').insert({ projekt_id: projektId, type, filnavn, sti }))
  }

  async hentFilUrl(sti: string) {
    const { data, error } = await supabase.storage.from('projektfiler').createSignedUrl(sti, 60, { download: true })
    if (error) throw new Error(`Filen kunne ikke hentes: ${error.message}`)
    return data.signedUrl
  }
}
