import type { Centi, Oere } from './tal'

// Datamodellen. Navne og felter svarer 1:1 til de kommende Postgres-tabeller.

export type Id = string

export interface Bruger {
  id: Id
  navn: string
  email: string
}

export interface Projekt {
  id: Id
  navn: string
  sted: string
  periodeStart: string // ISO-dato, fx "2026-08-17"
  periodeSlut: string
}

export type Rolle = 'ejer' | 'admin' | 'medlem'

/** Hvordan en person får sin del af akkordoverskuddet. */
export type OverskudsRegel =
  /** Deler det, der er tilbage efter faste beløb, efter akkordtimer */
  | { type: 'andel' }
  /** Fast beløb pr. akkordtime (fx 40 kr./t) */
  | { type: 'fastPrTime'; oerePrTime: Oere }

export interface Medlem {
  projektId: Id
  brugerId: Id
  rolle: Rolle
  timesats: Oere // øre pr. time, bruges til akkordløn og timeløn
  sygSats?: Oere // standard = timesats
  vejrligSats?: Oere // standard = timesats
  overskud: OverskudsRegel
}

export interface Dag {
  id: Id
  projektId: Id
  dato: string
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
  dagId: Id
  brugerId: Id
  type: TimeType
  timer: Centi
  beskrivelse?: string
}

export interface AkkordPost {
  id: Id
  projektId: Id
  navn: string // fx "Stenhoveder"
  enhedspris: Oere
}

export interface AkkordOpgoerelse {
  id: Id
  projektId: Id
  postId: Id
  dagId?: Id
  antal: Centi
}

/** Manuel rettelse i lønregnskabet. Lægges oven på det beregnede. */
export interface LoenJustering {
  id: Id
  projektId: Id
  brugerId: Id
  beloeb: Oere // + eller −
  begrundelse: string
  oprettetAf: Id
  oprettet: string
}

export interface Note {
  id: Id
  projektId: Id
  brugerId: Id
  tekst: string
  oprettet: string
}

/** Alt der hører til ét projekt — det beregningsmotoren skal bruge. */
export interface ProjektData {
  projekt: Projekt
  brugere: Bruger[]
  medlemmer: Medlem[]
  dage: Dag[]
  timer: TimeRegistrering[]
  akkordPoster: AkkordPost[]
  akkordOpgoerelser: AkkordOpgoerelse[]
  justeringer: LoenJustering[]
  noter: Note[]
}
