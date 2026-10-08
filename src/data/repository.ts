import type { AkkordPerson, LoenPerson, TimeloenPerson } from '../domain/beregning'
import type {
  FilType,
  Id,
  LoenJustering,
  Materiale,
  MaterialeRegistrering,
  Medlem,
  Note,
  Person,
  Profil,
  Projekt,
  ProjektData,
  TimeRegistrering,
} from '../domain/typer'

type Ny<T> = Omit<T, 'id'>

export interface ProjektOversigt extends Projekt {
  favorit: boolean
  /** Den indloggede brugers rolle i projektet */
  rolle: Medlem['rolle']
  /** Brugerens egne timer i dag (hundrededele) — til "I dag: 7,5 t" på forsiden */
  mineTimerIDag: number
}

export interface NytProjekt {
  navn: string
  medlemmer: { personId: Id; overskudPrTime?: number }[]
  materialeIder: Id[]
}

/** Én person i ét fælles projekt — fra funktionen projektkolleger(). */
export interface Kollega {
  medlemId: Id
  projektId: Id
  projektNavn: string
  projektAfsluttet: boolean
  navn: string
  rolle: Medlem['rolle']
  /** Samme person på tværs af projekter (login-id, ellers medlems-id) */
  noegle: Id
  /** Sat hvis personen ligger i ens eget kartotek */
  personId?: Id
  /** Kun i projekter hvor man selv er projektleder */
  timesats?: number
  harLogin: boolean
  erMig: boolean
}

/** Et materiale i et projekt, hvor man er projektleder. */
export interface ProjektMaterialeOversigt {
  id: Id
  projektId: Id
  projektNavn: string
  materialeId?: Id
  navn: string
  stykpris: number
}

/** Svar fra edge-funktionen "mit-regnskab": kun den indloggede persons egne tal. */
export interface MitRegnskab {
  loen: LoenPerson | null
  akkord: AkkordPerson | null
  timeloen: TimeloenPerson | null
  justeringer: Pick<LoenJustering, 'beloeb' | 'begrundelse' | 'oprettet'>[]
}

/** Én linje fra "Registrér" — gemmes samlet. */
export type RegistreringsLinje =
  | { slags: 'timer'; data: Ny<TimeRegistrering> }
  | { slags: 'materiale'; data: Ny<MaterialeRegistrering> }

/**
 * Al adgang til data går gennem dette interface — UI'et taler aldrig direkte med Supabase.
 * Adgangskontrol håndhæves i databasen (RLS), ikke her.
 */
export interface Repository {
  hentProfil(): Promise<Profil>

  hentPersoner(): Promise<Person[]>
  /** Alle man deler projekt med (også tilføjet af andre). */
  hentKolleger(): Promise<Kollega[]>
  gemPerson(person: Ny<Person> & { id?: Id }): Promise<void>
  /**
   * Kopiér personens satser til personen i de aktive projekter, hvor man er projektleder.
   * Afsluttede projekter ændres aldrig. Returnerer antal opdaterede projekter.
   */
  opdaterSatserIProjekter(person: Person): Promise<number>
  sletPerson(id: Id): Promise<void>

  hentMaterialer(): Promise<Materiale[]>
  /** Materialerne i de projekter, hvor man er projektleder. */
  hentProjektMaterialer(): Promise<ProjektMaterialeOversigt[]>
  opretMateriale(navn: string, stykpris: number): Promise<void>
  skjulMateriale(id: Id, skjult: boolean): Promise<void>
  sletMateriale(id: Id): Promise<void>

  hentProjekter(): Promise<ProjektOversigt[]>
  opretProjekt(projekt: NytProjekt): Promise<Id>
  saetFavorit(projektId: Id, favorit: boolean): Promise<void>

  hentProjektData(projektId: Id): Promise<ProjektData>
  hentMitRegnskab(projektId: Id): Promise<MitRegnskab>
  omdoebProjekt(projektId: Id, navn: string): Promise<void>
  afslutProjekt(projektId: Id, afsluttet: boolean): Promise<void>
  /** Kun opretteren. Sletter også projektets filer. */
  sletProjekt(projektId: Id): Promise<void>

  tilfoejMedlem(projektId: Id, person: Person, overskudPrTime?: number): Promise<void>
  gemMedlem(medlem: Medlem): Promise<void>
  /**
   * Kobl et medlem uden person (fx fra Viby-eksemplet) til en e-mail. Personen findes
   * eller oprettes i eget kartotek og får adgang, når der logges ind med e-mailen.
   */
  koblMedlemEmail(medlemId: Id, email: string): Promise<void>
  fjernMedlem(id: Id): Promise<void>
  tilfoejProjektMateriale(projektId: Id, materiale: Materiale): Promise<void>
  fjernProjektMateriale(id: Id): Promise<void>

  gemRegistreringer(linjer: RegistreringsLinje[], note?: Pick<Note, 'projektId' | 'dato' | 'tekst'>): Promise<void>
  retTimer(registrering: TimeRegistrering): Promise<void>
  sletTimer(id: Id): Promise<void>
  retMaterialeRegistrering(registrering: MaterialeRegistrering): Promise<void>
  sletMaterialeRegistrering(id: Id): Promise<void>

  gemNote(note: Pick<Note, 'projektId' | 'dato' | 'tekst'>): Promise<void>
  retNote(id: Id, tekst: string): Promise<void>
  sletNote(id: Id): Promise<void>

  gemJustering(justering: Pick<LoenJustering, 'projektId' | 'medlemId' | 'beloeb' | 'begrundelse'>): Promise<void>
  sletJustering(id: Id): Promise<void>

  gemFil(projektId: Id, type: FilType, filnavn: string, indhold: Blob): Promise<void>
  hentFilUrl(sti: string): Promise<string>
}
