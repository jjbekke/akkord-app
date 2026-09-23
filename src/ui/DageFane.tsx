import { useState } from 'react'
import { repo } from '../data'
import { laesCenti, timer } from '../domain/tal'
import { TIMETYPE_NAVN, type ProjektData, type TimeType } from '../domain/typer'
import { datoKort, iDag, navnPaa, type Koer } from './useProjekt'

const TYPER = Object.keys(TIMETYPE_NAVN) as TimeType[]

export function DageFane({ data, koer, brugerId }: { data: ProjektData; koer: Koer; brugerId: string }) {
  const [dato, setDato] = useState(iDag())
  const [person, setPerson] = useState(brugerId)
  const [type, setType] = useState<TimeType>('akkord')
  const [timerTekst, setTimerTekst] = useState('')
  const [beskrivelse, setBeskrivelse] = useState('')
  const [fejl, setFejl] = useState('')

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = laesCenti(timerTekst)
    if (t === null || t <= 0) return setFejl('Skriv antal timer, fx 7,5')
    setFejl('')
    await koer(async () => {
      const dag = await repo.opretDag(data.projekt.id, dato)
      await repo.gemTimer({
        projektId: data.projekt.id,
        dagId: dag.id,
        brugerId: person,
        type,
        timer: t,
        beskrivelse: beskrivelse.trim() || undefined,
      })
    })
    setTimerTekst('')
    setBeskrivelse('')
  }

  const dage = [...data.dage].sort((a, b) => b.dato.localeCompare(a.dato))

  return (
    <>
      <form className="kort" onSubmit={gem}>
        <h3>Registrér timer</h3>
        <div className="raekke">
          <label>
            Dato
            <input id="dag-dato" type="date" value={dato} onChange={(e) => setDato(e.target.value)} />
          </label>
          <label>
            Person
            <select id="dag-person" value={person} onChange={(e) => setPerson(e.target.value)}>
              {data.medlemmer.map((m) => (
                <option key={m.brugerId} value={m.brugerId}>
                  {navnPaa(data, m.brugerId)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="knapgruppe" role="radiogroup" aria-label="Type">
          {TYPER.map((t) => (
            <button type="button" key={t} aria-pressed={type === t} onClick={() => setType(t)}>
              {TIMETYPE_NAVN[t]}
            </button>
          ))}
        </div>
        <div className="raekke">
          <label className="smal">
            Timer
            <input
              id="dag-timer"
              inputMode="decimal"
              placeholder="7,5"
              value={timerTekst}
              onChange={(e) => setTimerTekst(e.target.value)}
            />
          </label>
          <label>
            Arbejde (valgfrit)
            <input
              id="dag-beskrivelse"
              placeholder="Opmuring af gavl"
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
            />
          </label>
        </div>
        {fejl && <p className="fejl">{fejl}</p>}
        <button className="primaer">Gem timer</button>
      </form>

      {dage.map((dag) => {
        const registreringer = data.timer.filter((t) => t.dagId === dag.id)
        const sum = registreringer.reduce((s, t) => s + t.timer, 0)
        return (
          <section className="kort" key={dag.id}>
            <h3 className="mellem">
              <span>{datoKort(dag.dato)}</span>
              <span className="daempet">{timer(sum)} t</span>
            </h3>
            <ul className="liste">
              {registreringer.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{navnPaa(data, r.brugerId)}</strong> · {TIMETYPE_NAVN[r.type]}
                    {r.beskrivelse && <div className="daempet lille">{r.beskrivelse}</div>}
                  </div>
                  <span className="tal">{timer(r.timer)} t</span>
                  <button className="slet" aria-label="Slet" onClick={() => koer(() => repo.sletTimer(r.id))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
