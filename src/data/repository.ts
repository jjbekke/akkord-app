import type {
  AkkordOpgoerelse,
  AkkordPost,
  Bruger,
  Dag,
  Id,
  LoenJustering,
  Medlem,
  Note,
  Projekt,
  ProjektData,
  TimeRegistrering,
} from '../domain/typer'

type Ny<T> = Omit<T, 'id'>

/**
 * Al adgang til data går gennem dette interface.
 * Fase 1: LocalRepository (IndexedDB i telefonen).
 * Fase 2: SupabaseRepository — samme metoder, UI'et ændres ikke.
 */
export interface Repository {
  hentBrugere(): Promise<Bruger[]>
  hentProjekter(brugerId: Id): Promise<Projekt[]>
  hentProjektData(projektId: Id): Promise<ProjektData>

  opretProjekt(projekt: Ny<Projekt>, ejerId: Id): Promise<Projekt>
  /** Prototype: opretter brugeren lokalt. Supabase: sender invitation på e-mail. */
  inviter(projektId: Id, navn: string, email: string, timesats: number): Promise<void>
  gemMedlem(medlem: Medlem): Promise<void>

  opretDag(projektId: Id, dato: string): Promise<Dag>
  gemTimer(registrering: Ny<TimeRegistrering>): Promise<void>
  sletTimer(id: Id): Promise<void>

  gemAkkordPost(post: Ny<AkkordPost> & { id?: Id }): Promise<AkkordPost>
  gemAkkordOpgoerelse(opgoerelse: Ny<AkkordOpgoerelse>): Promise<void>
  sletAkkordOpgoerelse(id: Id): Promise<void>

  gemJustering(justering: Ny<LoenJustering>): Promise<void>
  sletJustering(id: Id): Promise<void>

  gemNote(note: Ny<Note>): Promise<void>
}
