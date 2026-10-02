import { repo } from '../data'
import type { ProjektOversigt } from '../data/repository'
import { supabase } from '../data/supabase'
import { timer } from '../domain/tal'
import { useBruger, useHent } from './faelles'
import { Henter, Ikon } from './komponenter'

/** AKBOG — forsiden: dine projekter øverst, Værktøjskassen nedenunder. */
export function Forside() {
  const bruger = useBruger()
  const { data: projekter, fejl } = useHent(() => repo.hentProjekter(), [])

  const aktive = projekter?.filter((p) => !p.afsluttet) ?? []
  const favoritter = projekter?.filter((p) => p.favorit) ?? []
  // Har man ingen favoritter, vises de nyeste aktive projekter i stedet
  const vist = favoritter.length > 0 ? favoritter : aktive.slice(0, 4)

  return (
    <main className="side">
      <header className="top forside-top">
        <div className="top-titel">
          <span className="brand">AKBOG</span>
          <span className="daempet">Hej {bruger.navn.split(' ')[0]}</span>
        </div>
        <button className="ikonknap" aria-label="Log ud" title="Log ud" onClick={() => supabase.auth.signOut()}>
          <Ikon navn="ud" />
        </button>
      </header>

      {!projekter ? (
        <Henter fejl={fejl} />
      ) : projekter.length === 0 ? (
        <KomIGang />
      ) : (
        <section className="stak">
          <div className="sektionstitel">
            <h2>{favoritter.length > 0 ? 'Favoritter' : 'Dine projekter'}</h2>
            <a href="#/projekter">Alle projekter</a>
          </div>
          {vist.length === 0 && <p className="daempet">Ingen aktive projekter.</p>}
          {vist.map((p) => (
            <ProjektKort key={p.id} p={p} />
          ))}
          {favoritter.length === 0 && aktive.length > 0 && (
            <p className="daempet lille">Tip: tryk på stjernen i et projekt for at holde det her på forsiden.</p>
          )}
        </section>
      )}

      <section className="stak">
        <h2>Værktøjskasse</h2>
        <nav className="fliser">
          <a className="flise" href="#/projekter">
            <Ikon navn="projekter" str={26} />
            Projekter
          </a>
          <a className="flise" href="#/personer">
            <Ikon navn="personer" str={26} />
            Personer
          </a>
          <a className="flise" href="#/materialer">
            <Ikon navn="materialer" str={26} />
            Materialer
          </a>
        </nav>
      </section>
    </main>
  )
}

/**
 * Stort, trykvenligt projektkort, der viser om man har registreret i dag.
 * Hele kortet er et link; en evt. knap (fx stjernen) ligger ovenpå, lige før pilen.
 */
export function ProjektKort({ p, knap }: { p: ProjektOversigt; knap?: React.ReactNode }) {
  return (
    <div className="projektkort">
      <a className="projektkort-tekst" href={`#/projekt/${p.id}`}>
        <strong>{p.navn}</strong>
        {p.afsluttet ? (
          <span className="pille">Afsluttet</span>
        ) : p.mineTimerIDag > 0 ? (
          <span className="pille ok">
            <Ikon navn="check" str={14} /> I dag: {timer(p.mineTimerIDag)} t
          </span>
        ) : null}
      </a>
      {knap}
      <Ikon navn="frem" />
    </div>
  )
}

/** For nye brugere uden projekter: tre trin, der viser vejen. */
function KomIGang() {
  const { data } = useHent(() => Promise.all([repo.hentPersoner(), repo.hentMaterialer()]), [])
  const bruger = useBruger()
  const [personer, materialer] = data ?? [[], []]
  const satsSat = personer.some((p) => p.brugerId === bruger.id && p.timesats > 0)

  const trin = [
    { klar: satsSat, titel: 'Sæt din timesats', tekst: 'Under Personer — og tilføj dem, du arbejder med.', href: '#/personer' },
    { klar: materialer.length > 0, titel: 'Opret materialepriser', tekst: 'Fx sålbænke eller stenhoveder med pris pr. stk.', href: '#/materialer' },
    { klar: false, titel: 'Opret dit første projekt', tekst: 'Vælg personer og materialer — så kan I registrere.', href: '#/projekter/ny' },
  ]

  return (
    <section className="kort komigang">
      <h3>Kom godt i gang</h3>
      <p className="daempet lille">
        Er du med på en andens projekt, dukker det op her, så snart projektlederen har tilføjet din e-mail.
      </p>
      <ol className="trinliste">
        {trin.map((t, i) => (
          <li key={t.titel}>
            <a href={t.href} className={t.klar ? 'klar' : ''}>
              <span className="trinnummer">{t.klar ? <Ikon navn="check" str={16} /> : i + 1}</span>
              <span>
                <strong>{t.titel}</strong>
                <span className="daempet lille">{t.tekst}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
