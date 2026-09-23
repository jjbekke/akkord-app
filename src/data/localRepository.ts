import Dexie, { type EntityTable } from 'dexie'
import type {
  AkkordOpgoerelse,
  AkkordPost,
  Bruger,
  Dag,
  LoenJustering,
  Medlem,
  Note,
  Projekt,
  TimeRegistrering,
} from '../domain/typer'
import { vibyEksempel } from './eksempel'
import type { Repository } from './repository'

class Database extends Dexie {
  brugere!: EntityTable<Bruger, 'id'>
  projekter!: EntityTable<Projekt, 'id'>
  medlemmer!: Dexie.Table<Medlem, [string, string]>
  dage!: EntityTable<Dag, 'id'>
  timer!: EntityTable<TimeRegistrering, 'id'>
  akkordPoster!: EntityTable<AkkordPost, 'id'>
  akkordOpgoerelser!: EntityTable<AkkordOpgoerelse, 'id'>
  justeringer!: EntityTable<LoenJustering, 'id'>
  noter!: EntityTable<Note, 'id'>

  constructor() {
    super('akkord-app')
    this.version(1).stores({
      brugere: 'id, email',
      projekter: 'id',
      medlemmer: '[projektId+brugerId], projektId, brugerId',
      dage: 'id, projektId',
      timer: 'id, projektId, dagId',
      akkordPoster: 'id, projektId',
      akkordOpgoerelser: 'id, projektId',
      justeringer: 'id, projektId',
      noter: 'id, projektId',
    })
  }
}

const nyId = () => crypto.randomUUID()

export class LocalRepository implements Repository {
  private db = new Database()
  private klar: Promise<void>

  constructor() {
    this.klar = this.indlaesEksempelFoersteGang()
  }

  private async indlaesEksempelFoersteGang() {
    if ((await this.db.projekter.count()) > 0) return
    const d = vibyEksempel()
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.brugere.bulkAdd(d.brugere)
      await this.db.projekter.add(d.projekt)
      await this.db.medlemmer.bulkAdd(d.medlemmer)
      await this.db.dage.bulkAdd(d.dage)
      await this.db.timer.bulkAdd(d.timer)
      await this.db.akkordPoster.bulkAdd(d.akkordPoster)
      await this.db.akkordOpgoerelser.bulkAdd(d.akkordOpgoerelser)
      await this.db.noter.bulkAdd(d.noter)
    })
  }

  async hentBrugere() {
    await this.klar
    return this.db.brugere.toArray()
  }

  async hentProjekter(brugerId: string) {
    await this.klar
    const ids = (await this.db.medlemmer.where('brugerId').equals(brugerId).toArray()).map((m) => m.projektId)
    return this.db.projekter.where('id').anyOf(ids).toArray()
  }

  async hentProjektData(projektId: string) {
    await this.klar
    const db = this.db
    const medlemmer = await db.medlemmer.where('projektId').equals(projektId).toArray()
    const [projekt, brugere, dage, timer, akkordPoster, akkordOpgoerelser, justeringer, noter] = await Promise.all([
      db.projekter.get(projektId),
      db.brugere.where('id').anyOf(medlemmer.map((m) => m.brugerId)).toArray(),
      db.dage.where('projektId').equals(projektId).sortBy('dato'),
      db.timer.where('projektId').equals(projektId).toArray(),
      db.akkordPoster.where('projektId').equals(projektId).toArray(),
      db.akkordOpgoerelser.where('projektId').equals(projektId).toArray(),
      db.justeringer.where('projektId').equals(projektId).toArray(),
      db.noter.where('projektId').equals(projektId).sortBy('oprettet'),
    ])
    if (!projekt) throw new Error(`Projektet ${projektId} findes ikke`)
    return { projekt, brugere, medlemmer, dage, timer, akkordPoster, akkordOpgoerelser, justeringer, noter }
  }

  async opretProjekt(projekt: Omit<Projekt, 'id'>, ejerId: string) {
    const ny = { ...projekt, id: nyId() }
    const ejer = await this.db.medlemmer.where('brugerId').equals(ejerId).first()
    await this.db.projekter.add(ny)
    await this.db.medlemmer.add({
      projektId: ny.id,
      brugerId: ejerId,
      rolle: 'ejer',
      timesats: ejer?.timesats ?? 0,
      overskud: { type: 'andel' },
    })
    return ny
  }

  async inviter(projektId: string, navn: string, email: string, timesats: number) {
    let bruger = await this.db.brugere.where('email').equals(email).first()
    if (!bruger) {
      bruger = { id: nyId(), navn, email }
      await this.db.brugere.add(bruger)
    }
    await this.db.medlemmer.put({ projektId, brugerId: bruger.id, rolle: 'medlem', timesats, overskud: { type: 'andel' } })
  }

  async gemMedlem(medlem: Medlem) {
    await this.db.medlemmer.put(medlem)
  }

  async opretDag(projektId: string, dato: string) {
    const eksisterende = await this.db.dage.where('projektId').equals(projektId).filter((d) => d.dato === dato).first()
    if (eksisterende) return eksisterende
    const dag = { id: nyId(), projektId, dato }
    await this.db.dage.add(dag)
    return dag
  }

  async gemTimer(r: Omit<TimeRegistrering, 'id'>) {
    await this.db.timer.add({ ...r, id: nyId() })
  }

  async sletTimer(id: string) {
    await this.db.timer.delete(id)
  }

  async gemAkkordPost(post: Omit<AkkordPost, 'id'> & { id?: string }) {
    const gemt = { ...post, id: post.id ?? nyId() }
    await this.db.akkordPoster.put(gemt)
    return gemt
  }

  async gemAkkordOpgoerelse(o: Omit<AkkordOpgoerelse, 'id'>) {
    await this.db.akkordOpgoerelser.add({ ...o, id: nyId() })
  }

  async sletAkkordOpgoerelse(id: string) {
    await this.db.akkordOpgoerelser.delete(id)
  }

  async gemJustering(j: Omit<LoenJustering, 'id'>) {
    await this.db.justeringer.add({ ...j, id: nyId() })
  }

  async sletJustering(id: string) {
    await this.db.justeringer.delete(id)
  }

  async gemNote(n: Omit<Note, 'id'>) {
    await this.db.noter.add({ ...n, id: nyId() })
  }
}
