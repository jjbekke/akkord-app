import { useState } from 'react'
import { repo } from '../data'
import { beregnAkkord } from '../domain/beregning'
import { kr, laesCenti, timer } from '../domain/tal'
import type { ProjektData } from '../domain/typer'
import { Tal } from './Tal'
import { navnPaa, type Koer } from './useProjekt'

export function AkkordFane({ data, koer }: { data: ProjektData; koer: Koer }) {
  const a = beregnAkkord(data)
  const [postId, setPostId] = useState(data.akkordPoster[0]?.id ?? '')
  const [antal, setAntal] = useState('')
  const [nyNavn, setNyNavn] = useState('')
  const [nyPris, setNyPris] = useState('')
  const [fejl, setFejl] = useState('')

  const gemAntal = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = laesCenti(antal)
    if (!postId || n === null || n === 0) return setFejl('Vælg arbejde og skriv et antal')
    setFejl('')
    await koer(() => repo.gemAkkordOpgoerelse({ projektId: data.projekt.id, postId, antal: n }))
    setAntal('')
  }

  const gemPost = async (e: React.FormEvent) => {
    e.preventDefault()
    const pris = laesCenti(nyPris)
    if (!nyNavn.trim() || pris === null) return setFejl('Skriv navn og pris på arbejdet')
    setFejl('')
    await koer(async () => {
      const post = await repo.gemAkkordPost({ projektId: data.projekt.id, navn: nyNavn.trim(), enhedspris: pris })
      setPostId(post.id)
    })
    setNyNavn('')
    setNyPris('')
  }

  return (
    <>
      <section className="kort">
        <h3>Akkordarbejdet</h3>
        <ul className="liste">
          {a.linjer.map((l) => (
            <li key={l.postId}>
              <div>
                <strong>{l.navn}</strong>
                <div className="daempet lille">
                  {timer(l.antal)} × {kr(l.enhedspris)}
                </div>
              </div>
              <span className="tal">{kr(l.beloeb)}</span>
            </li>
          ))}
        </ul>
        <Tal label="Akkordsum" vaerdi={a.akkordsum} fed />
      </section>

      <form className="kort" onSubmit={gemAntal}>
        <h3>Tilføj antal</h3>
        <div className="raekke">
          <label>
            Arbejde
            <select id="akkord-post" value={postId} onChange={(e) => setPostId(e.target.value)}>
              {data.akkordPoster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.navn} ({kr(p.enhedspris)})
                </option>
              ))}
            </select>
          </label>
          <label className="smal">
            Antal
            <input id="akkord-antal" inputMode="decimal" placeholder="12" value={antal} onChange={(e) => setAntal(e.target.value)} />
          </label>
        </div>
        <button className="primaer">Tilføj</button>
      </form>

      <form className="kort" onSubmit={gemPost}>
        <h3>Nyt arbejde i prislisten</h3>
        <div className="raekke">
          <label>
            Navn
            <input id="post-navn" placeholder="Sålbænke" value={nyNavn} onChange={(e) => setNyNavn(e.target.value)} />
          </label>
          <label className="smal">
            Pris pr. stk.
            <input id="post-pris" inputMode="decimal" placeholder="100,00" value={nyPris} onChange={(e) => setNyPris(e.target.value)} />
          </label>
        </div>
        <button>Opret arbejde</button>
      </form>
      {fejl && <p className="fejl">{fejl}</p>}

      <section className="kort">
        <h3>Akkordløn og overskud</h3>
        <Tal label="Akkordtimer" tekst={`${timer(a.akkordtimer)} t`} />
        <Tal label="Akkordløn (timer × sats)" vaerdi={a.akkordloen} />
        <Tal label="Overskud" vaerdi={a.overskud} fed />
        <Tal label="Kr. pr. akkordtime" vaerdi={a.krPrAkkordtime} />
      </section>

      {a.personer.map((p) => (
        <section className="kort" key={p.brugerId}>
          <h3 className="mellem">
            <span>{navnPaa(data, p.brugerId)}</span>
            <span className="daempet">{timer(p.akkordtimer)} t</span>
          </h3>
          <Tal label="Akkordløn" vaerdi={p.akkordloen} />
          <Tal label="Overskud" vaerdi={p.overskud} />
          <Tal label="Akkord i alt" vaerdi={p.iAlt} fed />
          <Tal label="Kr. pr. akkordtime" vaerdi={p.krPrAkkordtime} />
        </section>
      ))}
    </>
  )
}
