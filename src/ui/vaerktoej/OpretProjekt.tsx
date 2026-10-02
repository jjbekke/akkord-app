import { useState } from 'react'
import { repo } from '../../data'
import { kr, laesKroner } from '../../domain/tal'
import { gaaTil, useBruger, useHandling, useHent } from '../faelles'
import { Fejl, Henter, Top } from '../komponenter'

const TRIN = ['Navn', 'Personer', 'Materialer'] as const

/** Opret projekt: navn → hvilke personer → hvilke materialer. */
export function OpretProjekt() {
  const bruger = useBruger()
  const { data, fejl: hentFejl } = useHent(() => Promise.all([repo.hentPersoner(), repo.hentMaterialer()]), [])
  const [trin, setTrin] = useState(0)
  const [navn, setNavn] = useState('')
  const [valgtePersoner, setValgtePersoner] = useState<Record<string, string>>({}) // personId → lærlingetillæg (tekst)
  const [valgteMaterialer, setValgteMaterialer] = useState<Set<string>>(new Set())
  const { koer, fejl, setFejl, travl } = useHandling()

  if (!data)
    return (
      <main className="side">
        <Top titel="Opret projekt" tilbage="/projekter" tilbageTekst="Projekter" />
        <Henter fejl={hentFejl} />
      </main>
    )

  const [allePersoner, alleMaterialer] = data
  const personer = allePersoner.filter((p) => p.brugerId !== bruger.id)
  const materialer = alleMaterialer.filter((m) => !m.skjult)
  const mig = allePersoner.find((p) => p.brugerId === bruger.id)

  const naeste = () => {
    if (trin === 0 && !navn.trim()) return setFejl('Giv projektet et navn')
    if (trin === 1) {
      for (const [id, tekst] of Object.entries(valgtePersoner)) {
        const v = tekst.trim() === '' ? 0 : laesKroner(tekst)
        if (v === null || v < 0) return setFejl(`Ugyldigt lærlingetillæg for ${personer.find((p) => p.id === id)?.navn}`)
      }
    }
    setFejl('')
    setTrin(trin + 1)
  }

  const opret = () =>
    koer(async () => {
      const id = await repo.opretProjekt({
        navn: navn.trim(),
        medlemmer: Object.entries(valgtePersoner).map(([personId, tekst]) => ({
          personId,
          overskudPrTime: tekst.trim() === '' ? undefined : laesKroner(tekst)!,
        })),
        materialeIder: [...valgteMaterialer],
      })
      gaaTil(`/projekt/${id}`)
    })

  const vaelgPerson = (id: string, valgt: boolean) =>
    setValgtePersoner((v) => {
      const ny = { ...v }
      if (valgt) ny[id] = ''
      else delete ny[id]
      return ny
    })

  const vaelgMateriale = (id: string, valgt: boolean) =>
    setValgteMaterialer((v) => {
      const ny = new Set(v)
      if (valgt) ny.add(id)
      else ny.delete(id)
      return ny
    })

  return (
    <main className="side">
      <Top titel="Opret projekt" tilbage="/projekter" tilbageTekst="Projekter" />
      <ol className="trin">
        {TRIN.map((t, i) => (
          <li key={t} aria-current={i === trin ? 'step' : undefined} className={i < trin ? 'klaret' : ''}>
            {i + 1}. {t}
          </li>
        ))}
      </ol>

      {trin === 0 && (
        <section className="kort">
          <label>
            Hvad hedder projektet?
            <input autoFocus placeholder="Fx Viby, Søndergade 12" value={navn} onChange={(e) => setNavn(e.target.value)} />
          </label>
        </section>
      )}

      {trin === 1 && (
        <section className="kort">
          <h3>Hvilke personer er med?</h3>
          <p className="daempet lille">
            Du er automatisk med som projektleder{mig ? ` (${kr(mig.timesats)}/t)` : ''}. Lærlingetillæg er et fast beløb pr.
            akkordtime, som trækkes fra overskuddet, før resten deles efter timer. Lad feltet stå tomt for en almindelig andel.
          </p>
          {personer.length === 0 && (
            <p className="daempet">
              Du har ingen personer i dit kartotek. <a href="#/personer">Opret personer</a> først, eller fortsæt og tilføj
              dem senere under projektets indstillinger.
            </p>
          )}
          <ul className="liste">
            {personer.map((p) => {
              const valgt = p.id in valgtePersoner
              return (
                <li key={p.id} className="valg">
                  <label className="afkryds">
                    <input type="checkbox" checked={valgt} onChange={(e) => vaelgPerson(p.id, e.target.checked)} />
                    <span>
                      <strong>{p.navn}</strong>
                      <span className="daempet lille"> · {kr(p.timesats)}/t</span>
                    </span>
                  </label>
                  {valgt && (
                    <label className="smal">
                      Lærlingetillæg kr./t
                      <input
                        inputMode="decimal"
                        placeholder="Ingen"
                        value={valgtePersoner[p.id]}
                        onChange={(e) => setValgtePersoner({ ...valgtePersoner, [p.id]: e.target.value })}
                      />
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {trin === 2 && (
        <section className="kort">
          <h3>Hvilke materialer skal bruges?</h3>
          <p className="daempet lille">Priserne kopieres ind i projektet. Flere kan tilføjes senere.</p>
          {materialer.length === 0 && (
            <p className="daempet">
              Du har ingen materialepriser. <a href="#/materialer">Opret priser</a> først, eller tilføj dem senere.
            </p>
          )}
          <ul className="liste">
            {materialer.map((m) => (
              <li key={m.id}>
                <label className="afkryds">
                  <input type="checkbox" checked={valgteMaterialer.has(m.id)} onChange={(e) => vaelgMateriale(m.id, e.target.checked)} />
                  <span>
                    <strong>{m.navn}</strong>
                    <span className="daempet lille"> · {kr(m.stykpris)} pr. stk.</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Fejl tekst={fejl} />
      <div className="knaprad">
        {trin > 0 && (
          <button type="button" onClick={() => setTrin(trin - 1)}>
            Tilbage
          </button>
        )}
        {trin < TRIN.length - 1 ? (
          <button className="primaer" onClick={naeste}>
            Næste
          </button>
        ) : (
          <button className="primaer" disabled={travl} onClick={opret}>
            Opret projekt
          </button>
        )}
      </div>
    </main>
  )
}
