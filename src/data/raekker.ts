import type {
  LoenJustering,
  Materiale,
  MaterialeRegistrering,
  Medlem,
  Note,
  Person,
  Projekt,
  ProjektData,
  ProjektFil,
  ProjektMateriale,
  TimeRegistrering,
} from '../domain/typer.ts'

// Databaserækker (snake_case) ↔ domænetyper (camelCase).
// Bruges både af appen og af edge-funktionen "mit-regnskab" — derfor ingen
// afhængigheder ud over domænet og .ts-endelser på imports.

type R = Record<string, unknown>
const s = (v: unknown) => v as string
const valgfri = <T>(v: unknown) => (v === null || v === undefined ? undefined : (v as T))

export const tilPerson = (r: R): Person => ({
  id: s(r.id),
  navn: s(r.navn),
  email: valgfri(r.email),
  timesats: r.timesats as number,
  akkordsats: valgfri(r.akkordsats),
  sygsats: valgfri(r.sygsats),
  vejrligsats: valgfri(r.vejrligsats),
  brugerId: valgfri(r.bruger_id),
})

export const tilMateriale = (r: R): Materiale => ({
  id: s(r.id),
  navn: s(r.navn),
  stykpris: r.stykpris as number,
  skjult: r.skjult as boolean,
})

export const tilProjekt = (r: R): Projekt => ({
  id: s(r.id),
  navn: s(r.navn),
  oprettetAf: valgfri(r.oprettet_af),
  oprettet: s(r.oprettet),
  afsluttet: valgfri(r.afsluttet),
})

export const tilMedlem = (r: R): Medlem => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  personId: valgfri(r.person_id),
  brugerId: valgfri(r.bruger_id),
  navn: s(r.navn),
  rolle: r.rolle as Medlem['rolle'],
  timesats: r.timesats as number,
  akkordsats: valgfri(r.akkordsats),
  sygsats: valgfri(r.sygsats),
  vejrligsats: valgfri(r.vejrligsats),
  overskudPrTime: valgfri(r.overskud_pr_time),
})

export const tilTimer = (r: R): TimeRegistrering => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  medlemId: s(r.medlem_id),
  dato: s(r.dato),
  type: r.type as TimeRegistrering['type'],
  timer: r.timer as number,
  beskrivelse: valgfri(r.beskrivelse),
  oprettetAf: valgfri(r.oprettet_af),
})

export const tilProjektMateriale = (r: R): ProjektMateriale => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  materialeId: valgfri(r.materiale_id),
  navn: s(r.navn),
  stykpris: r.stykpris as number,
})

export const tilMaterialeRegistrering = (r: R): MaterialeRegistrering => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  projektMaterialeId: s(r.projekt_materiale_id),
  dato: s(r.dato),
  antal: r.antal as number,
  oprettetAf: valgfri(r.oprettet_af),
})

export const tilNote = (r: R): Note => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  dato: s(r.dato),
  tekst: s(r.tekst),
  oprettetAf: valgfri(r.oprettet_af),
  oprettet: s(r.oprettet),
})

export const tilJustering = (r: R): LoenJustering => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  medlemId: s(r.medlem_id),
  beloeb: r.beloeb as number,
  begrundelse: s(r.begrundelse),
  oprettetAf: valgfri(r.oprettet_af),
  oprettet: s(r.oprettet),
})

export const tilFil = (r: R): ProjektFil => ({
  id: s(r.id),
  projektId: s(r.projekt_id),
  type: r.type as ProjektFil['type'],
  filnavn: s(r.filnavn),
  sti: s(r.sti),
  oprettet: s(r.oprettet),
})

/** Det mindste af Supabase-klienten, som hentProjektData bruger. */
export interface Db {
  from(tabel: string): {
    select(kolonner: string): {
      eq(kolonne: string, vaerdi: string): PromiseLike<{ data: unknown; error: { message: string } | null }>
    }
  }
}

async function hent(db: Db, tabel: string, projektId: string, kolonne = 'projekt_id'): Promise<R[]> {
  const { data, error } = await db.from(tabel).select('*').eq(kolonne, projektId)
  if (error) throw new Error(error.message)
  return (data ?? []) as R[]
}

/**
 * Henter alt for ét projekt. Med brugerens klient sørger RLS for, at et
 * almindeligt medlem kun får sine egne rækker.
 */
export async function hentProjektData(db: Db, projektId: string): Promise<ProjektData> {
  const [projekter, medlemmer, timer, materialer, materialeRegistreringer, justeringer, noter, filer] = await Promise.all([
    hent(db, 'projekter', projektId, 'id'),
    hent(db, 'projekt_medlemmer', projektId),
    hent(db, 'timer', projektId),
    hent(db, 'projekt_materialer', projektId),
    hent(db, 'materiale_registreringer', projektId),
    hent(db, 'justeringer', projektId),
    hent(db, 'noter', projektId),
    hent(db, 'projekt_filer', projektId),
  ])
  if (projekter.length === 0) throw new Error('Projektet findes ikke, eller du har ikke adgang')
  const efterNavn = (a: { navn: string }, b: { navn: string }) => a.navn.localeCompare(b.navn, 'da')
  return {
    projekt: tilProjekt(projekter[0]),
    medlemmer: medlemmer.map(tilMedlem).sort(efterNavn),
    timer: timer.map(tilTimer),
    materialer: materialer.map(tilProjektMateriale).sort(efterNavn),
    materialeRegistreringer: materialeRegistreringer.map(tilMaterialeRegistrering),
    justeringer: justeringer.map(tilJustering),
    noter: noter.map(tilNote).sort((a, b) => a.oprettet.localeCompare(b.oprettet)),
    filer: filer.map(tilFil).sort((a, b) => b.oprettet.localeCompare(a.oprettet)),
  }
}
