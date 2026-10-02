import { useState } from 'react'
import { repo } from '../../data'
import type { RegistreringsLinje } from '../../data/repository'
import { kr, laesCenti, timer as visTimer } from '../../domain/tal'
import { TIMETYPE_NAVN, type TimeType } from '../../domain/typer'
import { iDag, useHandling } from '../faelles'
import { Fejl } from '../komponenter'
import type { FaneProps } from './ProjektSide'

type LinjeType = TimeType | 'materiale'

interface Linje {
  noegle: number
  type: LinjeType
  vaerdi: string // timer eller antal
  materialeId: string
  beskrivelse: string
}

const TIMETYPER = Object.keys(TIMETYPE_NAVN) as TimeType[]
let naesteNoegle = 1
const nyLinje = (type: LinjeType = 'akkord', materialeId = ''): Linje => ({
  noegle: naesteNoegle++,
  type,
  vaerdi: '',
  materialeId,
  beskrivelse: '',
})

/** Registrér timer og materialer for én dag — alle linjer gemmes på én gang. */
export function RegistrerFane({ data, mig, erLeder, laast, genindlaes }: FaneProps) {
  const [dato, setDato] = useState(iDag())
  const [medlemId, setMedlemId] = useState(mig?.id ?? data.medlemmer[0]?.id ?? '')
  const [linjer, setLinjer] = useState<Linje[]>([nyLinje()])
  const [note, setNote] = useState('')
  const [gemt, setGemt] = useState('')
  const { koer, fejl, setFejl, travl } = useHandling(genindlaes)

  if (!mig && !erLeder) return <p className="daempet">Du er ikke tilknyttet projektet.</p>
  if (laast) return <p className="daempet">Der kan ikke registreres i et afsluttet projekt.</p>

  const personer = erLeder ? data.medlemmer : data.medlemmer.filter((m) => m.id === mig?.id)
  const kanMaterialer = erLeder && data.materialer.length > 0
  const foersteMateriale = data.materialer[0]?.id ?? ''

  const ret = (noegle: number, aendring: Partial<Linje>) =>
    setLinjer((ls) => ls.map((l) => (l.noegle === noegle ? { ...l, ...aendring } : l)))

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    setGemt('')
    const udfyldte = linjer.filter((l) => l.vaerdi.trim() !== '')
    if (udfyldte.length === 0 && !note.trim()) return setFejl('Udfyld mindst én linje')
    if (!dato) return setFejl('Vælg en dato')

    const ud: RegistreringsLinje[] = []
    for (const l of udfyldte) {
      const v = laesCenti(l.vaerdi)
      if (l.type === 'materiale') {
        if (!l.materialeId) return setFejl('Vælg et materiale')
        if (v === null || v === 0) return setFejl(`Ugyldigt antal: "${l.vaerdi}"`)
        ud.push({ slags: 'materiale', data: { projektId: data.projekt.id, projektMaterialeId: l.materialeId, dato, antal: v } })
      } else {
        if (!medlemId) return setFejl('Vælg en person')
        if (v === null || v <= 0 || v > 2400) return setFejl(`Ugyldigt antal timer: "${l.vaerdi}"`)
        ud.push({
          slags: 'timer',
          data: { projektId: data.projekt.id, medlemId, dato, type: l.type, timer: v, beskrivelse: l.beskrivelse.trim() || undefined },
        })
      }
    }
    const ok = await koer(() =>
      repo.gemRegistreringer(ud, note.trim() ? { projektId: data.projekt.id, dato, tekst: note.trim() } : undefined),
    )
    if (ok) {
      setLinjer([nyLinje()])
      setNote('')
      const timerIAlt = ud.reduce((s, l) => s + (l.slags === 'timer' ? l.data.timer : 0), 0)
      setGemt(`Gemt: ${ud.length} ${ud.length === 1 ? 'linje' : 'linjer'}${timerIAlt ? ` (${visTimer(timerIAlt)} timer)` : ''}${note.trim() ? ' og en note' : ''}.`)
    }
  }

  return (
    <form className="kort" onSubmit={gem}>
      <h3>Registrér</h3>
      <div className="raekke">
        <label>
          Dato
          <input id="reg-dato" type="date" value={dato} onChange={(e) => setDato(e.target.value)} />
        </label>
        <label>
          Person
          <select id="reg-person" value={medlemId} disabled={!erLeder} onChange={(e) => setMedlemId(e.target.value)}>
            {personer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.navn}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="linjer">
        {linjer.map((l) => (
          <div className="linje" key={l.noegle}>
            <div className="raekke">
              <select
                aria-label="Type"
                value={l.type}
                onChange={(e) => {
                  const type = e.target.value as LinjeType
                  ret(l.noegle, { type, materialeId: type === 'materiale' ? l.materialeId || foersteMateriale : '' })
                }}
              >
                {TIMETYPER.map((t) => (
                  <option key={t} value={t}>
                    {TIMETYPE_NAVN[t]}
                  </option>
                ))}
                {kanMaterialer && <option value="materiale">Materialer</option>}
              </select>
              {l.type === 'materiale' && (
                <select aria-label="Materiale" value={l.materialeId} onChange={(e) => ret(l.noegle, { materialeId: e.target.value })}>
                  {data.materialer.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.navn} ({kr(m.stykpris)})
                    </option>
                  ))}
                </select>
              )}
              <input
                className="antal"
                aria-label={l.type === 'materiale' ? 'Antal' : 'Timer'}
                inputMode="decimal"
                placeholder={l.type === 'materiale' ? 'stk.' : 'timer'}
                value={l.vaerdi}
                onChange={(e) => ret(l.noegle, { vaerdi: e.target.value })}
              />
              <button
                type="button"
                className="slet"
                aria-label="Fjern linje"
                onClick={() => setLinjer((ls) => (ls.length > 1 ? ls.filter((x) => x.noegle !== l.noegle) : [nyLinje()]))}
              >
                ×
              </button>
            </div>
            {l.type === 'timeloen' && (
              <input
                aria-label="Arbejde"
                placeholder="Arbejde (valgfrit) — kommer med i timeløn-filen"
                value={l.beskrivelse}
                onChange={(e) => ret(l.noegle, { beskrivelse: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setLinjer([...linjer, nyLinje(linjer.at(-1)?.type === 'materiale' ? 'materiale' : 'akkord', foersteMateriale)])}>
        + Tilføj linje
      </button>

      <label>
        Note til dagen (valgfri)
        <textarea id="reg-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <Fejl tekst={fejl} />
      {gemt && <p className="besked">{gemt}</p>}
      <button className="primaer" disabled={travl}>
        Gem
      </button>
      {!erLeder && <p className="daempet lille">Du kan kun registrere dine egne timer.</p>}
    </form>
  )
}
