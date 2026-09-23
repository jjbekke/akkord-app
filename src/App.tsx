import { useEffect, useState } from 'react'
import { repo } from './data'
import type { Bruger, Projekt } from './domain/typer'
import { AkkordFane } from './ui/AkkordFane'
import { DageFane } from './ui/DageFane'
import { HoldFane } from './ui/HoldFane'
import { LoenFane } from './ui/LoenFane'
import { Noter } from './ui/Noter'
import { datoKort, iDag, useProjekt } from './ui/useProjekt'

const LOGIN_NOEGLE = 'akkord-app.bruger'

// Huskes kun som en bekvemmelighed — virker appen også uden (fx i private vinduer).
function husketBruger(): string | null {
  try {
    return localStorage.getItem(LOGIN_NOEGLE)
  } catch {
    return null
  }
}

function huskBruger(id: string | null) {
  try {
    if (id) localStorage.setItem(LOGIN_NOEGLE, id)
    else localStorage.removeItem(LOGIN_NOEGLE)
  } catch {
    // ignorer
  }
}

export default function App() {
  const [brugerId, setBrugerId] = useState<string | null>(husketBruger)
  const [projektId, setProjektId] = useState<string | null>(null)

  const logInd = (id: string | null) => {
    huskBruger(id)
    setBrugerId(id)
    setProjektId(null)
  }

  if (!brugerId) return <Login onLogin={logInd} />
  if (projektId) return <ProjektSide projektId={projektId} brugerId={brugerId} tilbage={() => setProjektId(null)} />
  return <Projekter brugerId={brugerId} aabn={setProjektId} logUd={() => logInd(null)} />
}

/** Prototype-login: vælg en bruger. Erstattes af Supabase Auth (magic link) i fase 2. */
function Login({ onLogin }: { onLogin: (id: string) => void }) {
  const [brugere, setBrugere] = useState<Bruger[]>([])
  useEffect(() => {
    repo.hentBrugere().then(setBrugere)
  }, [])
  return (
    <main className="side">
      <h1>Log ind</h1>
      <p className="daempet">Prototype — vælg hvem du er.</p>
      <div className="stak">
        {brugere.map((b) => (
          <button key={b.id} className="stor" onClick={() => onLogin(b.id)}>
            {b.navn}
          </button>
        ))}
      </div>
    </main>
  )
}

function Projekter({ brugerId, aabn, logUd }: { brugerId: string; aabn: (id: string) => void; logUd: () => void }) {
  const [projekter, setProjekter] = useState<Projekt[]>([])
  const [navn, setNavn] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    repo.hentProjekter(brugerId).then(setProjekter)
  }, [brugerId, version])

  const opret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!navn.trim()) return
    const p = await repo.opretProjekt(
      { navn: navn.trim(), sted: navn.trim(), periodeStart: iDag(), periodeSlut: iDag() },
      brugerId,
    )
    setNavn('')
    setVersion((v) => v + 1)
    aabn(p.id)
  }

  return (
    <main className="side">
      <header className="top">
        <h1>Projekter</h1>
        <button className="link" onClick={logUd}>
          Log ud
        </button>
      </header>
      <div className="stak">
        {projekter.map((p) => (
          <button key={p.id} className="stor projekt" onClick={() => aabn(p.id)}>
            <strong>{p.navn}</strong>
            <span className="daempet lille">
              {datoKort(p.periodeStart)} – {datoKort(p.periodeSlut)}
            </span>
          </button>
        ))}
      </div>
      <form className="kort" onSubmit={opret}>
        <label>
          Nyt projekt
          <input id="nyt-projekt" placeholder="Sted / navn" value={navn} onChange={(e) => setNavn(e.target.value)} />
        </label>
        <button className="primaer">Opret projekt</button>
      </form>
    </main>
  )
}

const FANER = ['Dage', 'Akkord', 'Løn', 'Hold'] as const
type Fane = (typeof FANER)[number]

function ProjektSide({ projektId, brugerId, tilbage }: { projektId: string; brugerId: string; tilbage: () => void }) {
  const { data, koer } = useProjekt(projektId)
  const [fane, setFane] = useState<Fane>('Dage')

  if (!data) return <main className="side daempet">Henter…</main>

  return (
    <main className="side">
      <header className="top">
        <button className="link" onClick={tilbage}>
          ‹ Projekter
        </button>
        <h1>{data.projekt.navn}</h1>
      </header>
      <nav className="faner">
        {FANER.map((f) => (
          <button key={f} aria-pressed={fane === f} onClick={() => setFane(f)}>
            {f}
          </button>
        ))}
      </nav>

      {fane === 'Dage' && <DageFane data={data} koer={koer} brugerId={brugerId} />}
      {fane === 'Akkord' && <AkkordFane data={data} koer={koer} />}
      {fane === 'Løn' && <LoenFane data={data} koer={koer} brugerId={brugerId} />}
      {fane === 'Hold' && <HoldFane data={data} koer={koer} />}

      <Noter data={data} koer={koer} brugerId={brugerId} />
    </main>
  )
}
