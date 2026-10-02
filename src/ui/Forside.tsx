import { repo } from '../data'
import { supabase } from '../data/supabase'
import { useBruger, useHent } from './faelles'
import { Henter } from './komponenter'

/** AKBOG — forsiden med favoritprojekter og Værktøjskassen. */
export function Forside() {
  const bruger = useBruger()
  const { data: projekter, fejl } = useHent(() => repo.hentProjekter(), [])
  const favoritter = projekter?.filter((p) => p.favorit) ?? []

  return (
    <main className="side">
      <header className="top">
        <div className="top-titel">
          <h1>AKBOG</h1>
          <span className="daempet lille">Hej {bruger.navn}</span>
        </div>
        <button className="link" onClick={() => supabase.auth.signOut()}>
          Log ud
        </button>
      </header>

      <section className="stak">
        <h2>Favoritter</h2>
        {!projekter ? (
          <Henter fejl={fejl} />
        ) : favoritter.length === 0 ? (
          <p className="daempet lille">Tryk på ☆ ved et projekt under Projekter for at få det herop.</p>
        ) : (
          favoritter.map((p) => (
            <a key={p.id} className="stor projekt" href={`#/projekt/${p.id}`}>
              <strong>★ {p.navn}</strong>
              {p.afsluttet && <span className="daempet lille">Afsluttet</span>}
            </a>
          ))
        )}
      </section>

      <section className="stak">
        <h2>Værktøjskasse</h2>
        <a className="stor menu" href="#/projekter">
          <strong>Projekter</strong>
          <span className="daempet lille">Opret og åbn projekter</span>
        </a>
        <a className="stor menu" href="#/personer">
          <strong>Personer</strong>
          <span className="daempet lille">Navn, e-mail og timesats</span>
        </a>
        <a className="stor menu" href="#/materialer">
          <strong>Materialepriser</strong>
          <span className="daempet lille">Pris pr. stk.</span>
        </a>
      </section>
    </main>
  )
}
