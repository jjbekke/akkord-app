import type { Centi, Oere } from './tal.ts'

// Datamodellen. Navne og felter svarer til Postgres-tabellerne i supabase/migrations.
// Importer med .ts-endelse, så filerne også kan bruges af edge-funktionen (Deno).

export type Id = string

export interface Profil {
  id: Id
  navn: string
  email: string
}

/** Satserne for én person. Tomme satser er lig timesatsen. */
export type Satser = Pick<Medlem, 'timesats' | 'akkordsats' | 'sygsats' | 'vejrligsats'>

/** En person i ens eget kartotek (Værktøjskasse → Personer). */
export interface Person {
  id: Id
  navn: string
  email?: string
  timesats: Oere
  /** Tom = samme som timesatsen */
  akkordsats?: Oere
  sygsats?: Oere
  vejrligsats?: Oere
  /** Sat når personen har en bekræftet konto med samme e-mail */
  brugerId?: Id
}

/** En pris i ens eget kartotek (Værktøjskasse → Materialepriser). Kan ikke ændres — kun skjules. */
export interface Materiale {
  id: Id
  navn: string
  stykpris: Oere
  skjult: boolean
}

export interface Projekt {
  id: Id
  navn: string
  oprettetAf?: Id
  oprettet: string
  /** Tidspunkt for afslutning — et afsluttet projekt er skrivebeskyttet */
  afsluttet?: string
}

export type Rolle = 'projektleder' | 'medlem'

export interface Medlem {
  id: Id
  projektId: Id
  personId?: Id
  brugerId?: Id
  navn: string
  rolle: Rolle
  timesats: Oere // øre pr. time — timeløn, og standard for de andre satser
  /** Akkordløn pr. akkordtime. Tom = timesatsen */
  akkordsats?: Oere
  /** Tom = timesatsen */
  sygsats?: Oere
  /** Tom = timesatsen */
  vejrligsats?: Oere
  /** Fast overskud pr. akkordtime (lærling). Tom = andel af resten efter akkordtimer. */
  overskudPrTime?: Oere
}

export type TimeType = 'akkord' | 'timeloen' | 'syg' | 'vejrlig'

export const TIMETYPE_NAVN: Record<TimeType, string> = {
  akkord: 'Akkord',
  timeloen: 'Timeløn',
  syg: 'Syg',
  vejrlig: 'Vejrlig',
}

/** Én række = én person, én type, én dag. */
export interface TimeRegistrering {
  id: Id
  projektId: Id
  medlemId: Id
  dato: string // ISO-dato, fx "2026-10-02"
  type: TimeType
  timer: Centi
  beskrivelse?: string
  oprettetAf?: Id
}

/** Et materiale valgt til projektet — navn og pris er kopieret ind. */
export interface ProjektMateriale {
  id: Id
  projektId: Id
  materialeId?: Id
  navn: string
  stykpris: Oere
}

export interface MaterialeRegistrering {
  id: Id
  projektId: Id
  projektMaterialeId: Id
  dato: string
  antal: Centi
  oprettetAf?: Id
}

export interface Note {
  id: Id
  projektId: Id
  dato: string
  tekst: string
  oprettetAf?: Id
  oprettet: string
}

/** Manuel rettelse i lønregnskabet. Lægges oven på det beregnede. */
export interface LoenJustering {
  id: Id
  projektId: Id
  medlemId: Id
  beloeb: Oere // + eller −
  begrundelse: string
  oprettetAf?: Id
  oprettet: string
}

export type FilType = 'kvittering' | 'timeloen'

export interface ProjektFil {
  id: Id
  projektId: Id
  type: FilType
  filnavn: string
  sti: string
  oprettet: string
}

/**
 * Alt der hører til ét projekt — det beregningsmotoren skal bruge.
 * For et almindeligt medlem indeholder det kun de rækker, medlemmet må se.
 */
export interface ProjektData {
  projekt: Projekt
  medlemmer: Medlem[]
  timer: TimeRegistrering[]
  materialer: ProjektMateriale[]
  materialeRegistreringer: MaterialeRegistrering[]
  justeringer: LoenJustering[]
  noter: Note[]
  filer: ProjektFil[]
}
