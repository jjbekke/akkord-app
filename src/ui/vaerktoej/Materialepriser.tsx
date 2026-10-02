import { useState } from 'react'
import { repo } from '../../data'
import { kr, laesKroner } from '../../domain/tal'
import type { Materiale } from '../../domain/typer'
import { useHandling, useHent } from '../faelles'
import { Fejl, Henter, Top } from '../komponenter'

/** Værktøjskasse → Materialepriser. En pris ændres ikke — man opretter en ny. */
export function Materialepriser() {
  const { data: materialer, fejl, genindlaes } = useHent(() => repo.hentMaterialer(), [])
  const handling = useHandling(genindlaes)
  const [navn, setNavn] = useState('')
  const [pris, setPris] = useState('')
  const [visSkjulte, setVisSkjulte] = useState(false)

  const opret = async (e: React.FormEvent) => {
    e.preventDefault()
    const stykpris = laesKroner(pris)
    if (!navn.trim()) return handling.setFejl('Skriv et navn')
    if (stykpris === null || stykpris < 0) return handling.setFejl('Skriv en pris pr. stk., fx 100,00')
    if (await handling.koer(() => repo.opretMateriale(navn.trim(), stykpris))) {
      setNavn('')
      setPris('')
    }
  }

  const synlige = materialer?.filter((m) => !m.skjult) ?? []
  const skjulte = materialer?.filter((m) => m.skjult) ?? []

  const raekke = (m: Materiale) => (
    <li key={m.id}>
      <div>
        <strong>{m.navn}</strong>
      </div>
      <span className="tal">{kr(m.stykpris)}</span>
      <button className="lille-knap" onClick={() => handling.koer(() => repo.skjulMateriale(m.id, !m.skjult))}>
        {m.skjult ? 'Vis' : 'Skjul'}
      </button>
      <button
        className="slet"
        aria-label={`Slet ${m.navn}`}
        onClick={() => confirm(`Slet ${m.navn}? Projekter der bruger prisen, beholder den.`) && handling.koer(() => repo.sletMateriale(m.id))}
      >
        ×
      </button>
    </li>
  )

  return (
    <main className="side">
      <Top titel="Materialepriser" tilbage="/" tilbageTekst="AKBOG" />
      <p className="daempet lille">
        Priser kan ikke ændres. Ændrer en pris sig, så opret en ny og skjul den gamle — så passer gamle regnskaber stadig.
      </p>

      <form className="kort" onSubmit={opret}>
        <h3>Ny pris</h3>
        <div className="raekke">
          <label>
            Navn
            <input placeholder="Sålbænke" value={navn} onChange={(e) => setNavn(e.target.value)} />
          </label>
          <label className="smal">
            Pris pr. stk.
            <input inputMode="decimal" placeholder="100,00" value={pris} onChange={(e) => setPris(e.target.value)} />
          </label>
        </div>
        <Fejl tekst={handling.fejl} />
        <button className="primaer" disabled={handling.travl}>
          Opret pris
        </button>
      </form>

      {!materialer ? (
        <Henter fejl={fejl} />
      ) : (
        <section className="kort">
          {synlige.length === 0 && <p className="daempet">Ingen priser endnu.</p>}
          <ul className="liste">{synlige.map(raekke)}</ul>
          {skjulte.length > 0 && (
            <>
              <button className="link" onClick={() => setVisSkjulte(!visSkjulte)}>
                {visSkjulte ? 'Gem' : 'Vis'} skjulte priser ({skjulte.length})
              </button>
              {visSkjulte && <ul className="liste daempet">{skjulte.map(raekke)}</ul>}
            </>
          )}
        </section>
      )}
    </main>
  )
}
