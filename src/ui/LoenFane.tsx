import { useState } from 'react'
import { repo } from '../data'
import { beregnLoen } from '../domain/beregning'
import { kr, laesCenti, timer } from '../domain/tal'
import type { ProjektData } from '../domain/typer'
import { Tal } from './Tal'
import { navnPaa, type Koer } from './useProjekt'

export function LoenFane({ data, koer, brugerId }: { data: ProjektData; koer: Koer; brugerId: string }) {
  const r = beregnLoen(data)
  const [person, setPerson] = useState(data.medlemmer[0]?.brugerId ?? '')
  const [beloeb, setBeloeb] = useState('')
  const [begrundelse, setBegrundelse] = useState('')
  const [fejl, setFejl] = useState('')

  const gemJustering = async (e: React.FormEvent) => {
    e.preventDefault()
    const b = laesCenti(beloeb)
    if (b === null || b === 0) return setFejl('Skriv et beløb, fx 250 eller -250')
    if (!begrundelse.trim()) return setFejl('Skriv hvorfor lønnen rettes')
    setFejl('')
    await koer(() =>
      repo.gemJustering({
        projektId: data.projekt.id,
        brugerId: person,
        beloeb: b,
        begrundelse: begrundelse.trim(),
        oprettetAf: brugerId,
        oprettet: new Date().toISOString(),
      }),
    )
    setBeloeb('')
    setBegrundelse('')
  }

  return (
    <>
      {r.advarsler.map((a) => (
        <p className="advarsel" key={a}>
          {a}
        </p>
      ))}

      {r.personer.map((p) => {
        const t = r.timeloen.personer.find((x) => x.brugerId === p.brugerId)
        return (
          <section className="kort" key={p.brugerId}>
            <h3 className="mellem">
              <span>{navnPaa(data, p.brugerId)}</span>
              <span className="tal">{kr(p.iAlt)}</span>
            </h3>
            <Tal label="Akkordløn" vaerdi={p.akkordloen} />
            <Tal label="Overskud" vaerdi={p.overskud} />
            <Tal label={`Timeløn${t ? ` (${timer(t.timer.timeloen)} t)` : ''}`} vaerdi={p.timeloen} />
            <Tal label={`Syg${t?.timer.syg ? ` (${timer(t.timer.syg)} t)` : ''}`} vaerdi={p.syg} />
            <Tal label={`Vejrlig${t?.timer.vejrlig ? ` (${timer(t.timer.vejrlig)} t)` : ''}`} vaerdi={p.vejrlig} />
            {p.justeringer !== 0 && (
              <>
                <Tal label="Beregnet" vaerdi={p.beregnet} />
                <Tal label="Rettelser" vaerdi={p.justeringer} />
              </>
            )}
            <Tal label="I alt" vaerdi={p.iAlt} fed />
          </section>
        )
      })}

      <section className="kort">
        <h3>Total</h3>
        <Tal label="Akkordløn" vaerdi={r.total.akkordloen} />
        <Tal label="Overskud" vaerdi={r.total.overskud} />
        <Tal label="Timeløn" vaerdi={r.total.timeloen} />
        <Tal label="Syg" vaerdi={r.total.syg} />
        <Tal label="Vejrlig" vaerdi={r.total.vejrlig} />
        <Tal label="Rettelser" vaerdi={r.total.justeringer} />
        <Tal label="I alt" vaerdi={r.total.iAlt} fed />
      </section>

      <form className="kort" onSubmit={gemJustering}>
        <h3>Ret i lønregnskabet</h3>
        <p className="daempet lille">Rettelser lægges oven i det beregnede, så man altid kan se begge dele.</p>
        <div className="raekke">
          <label>
            Person
            <select id="just-person" value={person} onChange={(e) => setPerson(e.target.value)}>
              {data.medlemmer.map((m) => (
                <option key={m.brugerId} value={m.brugerId}>
                  {navnPaa(data, m.brugerId)}
                </option>
              ))}
            </select>
          </label>
          <label className="smal">
            Beløb (±)
            <input id="just-beloeb" inputMode="decimal" placeholder="-250,00" value={beloeb} onChange={(e) => setBeloeb(e.target.value)} />
          </label>
        </div>
        <label>
          Begrundelse
          <input id="just-begrundelse" placeholder="Kørsel" value={begrundelse} onChange={(e) => setBegrundelse(e.target.value)} />
        </label>
        {fejl && <p className="fejl">{fejl}</p>}
        <button className="primaer">Gem rettelse</button>
        <ul className="liste">
          {data.justeringer.map((j) => (
            <li key={j.id}>
              <div>
                <strong>{navnPaa(data, j.brugerId)}</strong> · {j.begrundelse}
                <div className="daempet lille">af {navnPaa(data, j.oprettetAf)}</div>
              </div>
              <span className="tal">{kr(j.beloeb)}</span>
              <button className="slet" aria-label="Slet" onClick={() => koer(() => repo.sletJustering(j.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </form>
    </>
  )
}
