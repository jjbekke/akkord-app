import { useEffect, useState } from 'react'
import { repo } from '../../data'
import type { RegistreringsLinje } from '../../data/repository'
import { gange, kr, laesCenti, timer as visTimer } from '../../domain/tal'
import { TIMETYPE_NAVN, type TimeType } from '../../domain/typer'
import { datoKort, datoLang, iDag, useHandling } from '../faelles'
import { Fejl, Ikon } from '../komponenter'
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
  const [visNote, setVisNote] = useState(false)
  const [note, setNote] = useState('')
  const [gemt, setGemt] = useState('')
  const { koer, fejl, setFejl, travl } = useHandling(genindlaes)

  // Bekræftelsen forsvinder af sig selv
  useEffect(() => {
    if (!gemt) return
    const t = setTimeout(() => setGemt(''), 4000)
    return () => clearTimeout(t)
  }, [gemt])

  if (!mig && !erLeder) return <p className="daempet">Du er ikke tilknyttet projektet.</p>
  if (laast) return <p className="daempet">Der kan ikke registreres i et afsluttet projekt.</p>

  const personer = erLeder ? data.medlemmer : data.medlemmer.filter((m) => m.id === mig?.id)
  const kanMaterialer = erLeder && data.materialer.length > 0
  const foersteMateriale = data.materialer[0]?.id ?? ''

  const ret = (noegle: number, aendring: Partial<Linje>) =>
    setLinjer((ls) => ls.map((l) => (l.noegle === noegle ? { ...l, ...aendring } : l)))

  // Opsummering til Gem-knappen
  const timerIAlt = linjer.reduce((s, l) => s + (l.type !== 'materiale' ? Math.max(laesCenti(l.vaerdi) ?? 0, 0) : 0), 0)
  const materialeLinjer = linjer.filter((l) => l.type === 'materiale' && l.vaerdi.trim()).length
  const opsummering = [timerIAlt ? `${visTimer(timerIAlt)} t` : '', materialeLinjer ? `${materialeLinjer} mat.` : '']
    .filter(Boolean)
    .join(' + ')

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    setGemt('')
    const udfyldte = linjer.filter((l) => l.vaerdi.trim() !== '')
    if (udfyldte.length === 0 && !note.trim()) return setFejl('Skriv antal timer')
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
      setVisNote(false)
      setGemt(`Gemt${opsummering ? `: ${opsummering}` : ''}${note.trim() ? ' og note' : ''}`)
    }
  }

  // Det der allerede er registreret den valgte dag — så man ikke registrerer dobbelt
  const navn = data.medlemmer.find((m) => m.id === medlemId)?.navn ?? ''
  const dagensTimer = data.timer.filter((t) => t.dato === dato && t.medlemId === medlemId)
  const dagensMaterialer = erLeder ? data.materialeRegistreringer.filter((r) => r.dato === dato) : []

  return (
    <>
      <form className="registrer" onSubmit={gem}>
        <section className="kort">
          <div className="dagvaelger">
            <div>
              <span className="feltnavn">Dag</span>
              <strong className="foerste-stort">{dato === iDag() ? `I dag, ${datoKort(dato)}` : datoLang(dato)}</strong>
            </div>
            <label className="ikonknap kalenderknap" aria-label="Vælg en anden dag" title="Vælg en anden dag">
              <Ikon navn="kalender" />
              <input
                type="date"
                value={dato}
                onClick={(e) => e.currentTarget.showPicker?.()}
                onChange={(e) => setDato(e.target.value || iDag())}
              />
            </label>
          </div>

          {erLeder && (
            <label>
              Person
              <select id="reg-person" value={medlemId} onChange={(e) => setMedlemId(e.target.value)}>
                {personer.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === mig?.id ? `${m.navn} (dig)` : m.navn}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        <section className="kort">
          {linjer.map((l, i) => (
            <div className="linje" key={l.noegle}>
              <div className="linje-top">
                <select
                  aria-label="Hvad"
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
                <div className="antal-felt">
                  <input
                    className="antal"
                    aria-label={l.type === 'materiale' ? 'Antal' : 'Timer'}
                    inputMode="decimal"
                    autoFocus={i > 0}
                    placeholder="0"
                    value={l.vaerdi}
                    onChange={(e) => ret(l.noegle, { vaerdi: e.target.value })}
                  />
                  <span className="enhed">{l.type === 'materiale' ? 'stk.' : 'timer'}</span>
                </div>
                {linjer.length > 1 && (
                  <button
                    type="button"
                    className="ikonknap lille"
                    aria-label="Fjern linje"
                    onClick={() => setLinjer((ls) => ls.filter((x) => x.noegle !== l.noegle))}
                  >
                    <Ikon navn="luk" str={18} />
                  </button>
                )}
              </div>

              {l.type === 'materiale' && (
                <select aria-label="Materiale" value={l.materialeId} onChange={(e) => ret(l.noegle, { materialeId: e.target.value })}>
                  {data.materialer.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.navn} · {kr(m.stykpris)}
                    </option>
                  ))}
                </select>
              )}

              {l.type === 'timeloen' && (
                <input
                  aria-label="Hvilket arbejde"
                  placeholder="Hvilket arbejde? (kommer med til mester)"
                  value={l.beskrivelse}
                  onChange={(e) => ret(l.noegle, { beskrivelse: e.target.value })}
                />
              )}
            </div>
          ))}

          <button
            type="button"
            className="tilfoej"
            onClick={() => setLinjer([...linjer, nyLinje(linjer.at(-1)?.type === 'akkord' ? 'timeloen' : 'akkord', foersteMateriale)])}
          >
            <Ikon navn="plus" str={18} /> Tilføj {kanMaterialer ? 'timer eller materialer' : 'flere timer'}
          </button>

          {visNote ? (
            <label>
              Note til dagen
              <textarea id="reg-note" rows={2} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          ) : (
            <button type="button" className="link" onClick={() => setVisNote(true)}>
              + Skriv en note til dagen
            </button>
          )}
        </section>

        <div className="gem-bar">
          <Fejl tekst={fejl} />
          {gemt && (
            <p className="besked toast" role="status">
              <Ikon navn="check" str={18} /> {gemt}
            </p>
          )}
          <button className="primaer stor-knap" disabled={travl}>
            {travl ? 'Gemmer…' : opsummering ? `Gem ${opsummering}` : 'Gem'}
          </button>
        </div>
      </form>

      {(dagensTimer.length > 0 || dagensMaterialer.length > 0) && (
        <section className="kort dagsoversigt">
          <h3 className="mellem">
            <span>
              Allerede registreret {dato === iDag() ? 'i dag' : datoKort(dato)}
              {erLeder && navn ? ` · ${navn}` : ''}
            </span>
            <span className="tal">{visTimer(dagensTimer.reduce((s, t) => s + t.timer, 0))} t</span>
          </h3>
          <ul className="liste kompakt">
            {dagensTimer.map((t) => (
              <li key={t.id}>
                <div>
                  {TIMETYPE_NAVN[t.type]}
                  {t.beskrivelse && <span className="daempet"> · {t.beskrivelse}</span>}
                </div>
                <span className="tal">{visTimer(t.timer)} t</span>
              </li>
            ))}
            {dagensMaterialer.map((r) => {
              const m = data.materialer.find((x) => x.id === r.projektMaterialeId)
              return (
                <li key={r.id}>
                  <div>{m?.navn ?? 'Materiale'}</div>
                  <span className="tal">
                    {visTimer(r.antal)} stk. · {kr(gange(r.antal, m?.stykpris ?? 0))}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="daempet lille">Ret eller slet under Timekalender.</p>
        </section>
      )}
    </>
  )
}
