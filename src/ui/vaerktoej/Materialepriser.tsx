import { useState } from 'react'
import { repo } from '../../data'
import type { ProjektMaterialeOversigt } from '../../data/repository'
import { kr, laesKroner } from '../../domain/tal'
import type { Materiale } from '../../domain/typer'
import { useHandling, useHent } from '../faelles'
import { Fejl, Henter, Top } from '../komponenter'

/**
 * Værktøjskasse → Materialer: priserne i de projekter, hvor man er projektleder.
 * Nye priser ses kun af en selv, indtil de bruges i et projekt.
 * En pris ændres ikke — man opretter en ny.
 */
export function Materialepriser() {
  const { data, fejl, genindlaes } = useHent(() => Promise.all([repo.hentProjektMaterialer(), repo.hentMaterialer()]), [])
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

  const [projektMaterialer, kartotek] = data ?? [[], []]

  // Samme navn og pris på tværs af projekter samles til én række
  const grupper = new Map<string, { navn: string; stykpris: number; projekter: string[]; materiale?: Materiale }>()
  for (const pm of projektMaterialer as ProjektMaterialeOversigt[]) {
    const noegle = `${pm.navn}|${pm.stykpris}`
    const g = grupper.get(noegle) ?? { navn: pm.navn, stykpris: pm.stykpris, projekter: [] }
    if (!g.projekter.includes(pm.projektNavn)) g.projekter.push(pm.projektNavn)
    // Samme pris i eget kartotek — via koblingen, ellers samme navn og beløb
    g.materiale ??=
      kartotek.find((m) => m.id === pm.materialeId) ?? kartotek.find((m) => m.navn === pm.navn && m.stykpris === pm.stykpris)
    grupper.set(noegle, g)
  }
  const brugt = new Set([...grupper.values()].map((g) => g.materiale?.id).filter(Boolean))
  const ikkeBrugt = kartotek.filter((m) => !m.skjult && !brugt.has(m.id))
  const skjulte = kartotek.filter((m) => m.skjult)

  const knapper = (m: Materiale, kanSlettes: boolean) => (
    <>
      <button className="lille-knap" onClick={() => handling.koer(() => repo.skjulMateriale(m.id, !m.skjult))}>
        {m.skjult ? 'Vis' : 'Skjul'}
      </button>
      {kanSlettes && (
        <button
          className="slet"
          aria-label={`Slet ${m.navn}`}
          onClick={() => confirm(`Slet ${m.navn}?`) && handling.koer(() => repo.sletMateriale(m.id))}
        >
          ×
        </button>
      )}
    </>
  )

  return (
    <main className="side">
      <Top titel="Materialer" tilbage="/" tilbageTekst="AKBOG" />
      <p className="daempet lille">
        Her ser du priserne i de projekter, hvor du er projektleder. Priser kan ikke ændres — ændrer en pris sig, så opret en
        ny og skjul den gamle. Skjulte priser kan ikke vælges til nye projekter.
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

      {!data ? (
        <Henter fejl={fejl} />
      ) : (
        <>
          <section className="kort">
            <h3>I dine projekter</h3>
            {grupper.size === 0 && <p className="daempet lille">Ingen endnu. Materialer vises for projekter, hvor du er projektleder.</p>}
            <ul className="liste">
              {[...grupper.entries()].map(([noegle, g]) => (
                <li key={noegle}>
                  <div>
                    <strong>{g.navn}</strong>
                    <div className="daempet lille">{g.projekter.join(' · ')}</div>
                  </div>
                  <span className="tal">{kr(g.stykpris)}</span>
                  {g.materiale && !g.materiale.skjult && knapper(g.materiale, false)}
                </li>
              ))}
            </ul>
          </section>

          {ikkeBrugt.length > 0 && (
            <section className="kort">
              <h3>Ikke på et projekt endnu</h3>
              <p className="daempet lille">Kun synlige for dig.</p>
              <ul className="liste">
                {ikkeBrugt.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>{m.navn}</strong>
                    </div>
                    <span className="tal">{kr(m.stykpris)}</span>
                    {knapper(m, true)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {skjulte.length > 0 && (
            <button className="link" onClick={() => setVisSkjulte(!visSkjulte)}>
              {visSkjulte ? 'Gem' : 'Vis'} skjulte priser ({skjulte.length})
            </button>
          )}
          {visSkjulte && (
            <section className="kort">
              <ul className="liste daempet">
                {skjulte.map((m) => (
                  <li key={m.id}>
                    <div>{m.navn}</div>
                    <span className="tal">{kr(m.stykpris)}</span>
                    {knapper(m, !brugt.has(m.id))}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
