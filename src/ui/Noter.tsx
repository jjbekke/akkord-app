import { useState } from 'react'
import { repo } from '../data'
import type { ProjektData } from '../domain/typer'
import { navnPaa, type Koer } from './useProjekt'

export function Noter({ data, koer, brugerId }: { data: ProjektData; koer: Koer; brugerId: string }) {
  const [tekst, setTekst] = useState('')

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tekst.trim()) return
    await koer(() =>
      repo.gemNote({ projektId: data.projekt.id, brugerId, tekst: tekst.trim(), oprettet: new Date().toISOString() }),
    )
    setTekst('')
  }

  return (
    <section className="kort noter">
      <h3>Noter</h3>
      <ul className="liste">
        {data.noter.map((n) => (
          <li key={n.id}>
            <div>
              {n.tekst}
              <div className="daempet lille">
                {navnPaa(data, n.brugerId)} · {new Date(n.oprettet).toLocaleDateString('da-DK')}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={gem}>
        <textarea id="note-tekst" rows={3} placeholder="Skriv en note…" value={tekst} onChange={(e) => setTekst(e.target.value)} />
        <button className="primaer">Tilføj note</button>
      </form>
    </section>
  )
}
