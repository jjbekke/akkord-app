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
}

export interface NytProjekt {
  navn: string
  medlemmer: { personId: Id; overskudPrTime?: number }[]
  materialeIder: Id[]
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
  gemPerson(person: Ny<Person> & { id?: Id }): Promise<void>
  sletPerson(id: Id): Promise<void>

  hentMaterialer(): Promise<Materiale[]>
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
  /** Kobl et medlem uden person (fx fra Viby-eksemplet) til en person i eget kartotek. */
  koblMedlem(medlemId: Id, personId: Id): Promise<void>
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
