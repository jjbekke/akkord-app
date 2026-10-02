import { useState } from 'react'
import { repo } from '../../data'
import { gange, kr, laesCenti, timer as visTimer, tal } from '../../domain/tal'
import { TIMETYPE_NAVN, type MaterialeRegistrering, type Note, type TimeRegistrering, type TimeType } from '../../domain/typer'
import { datoKort, datoLang, flytDag, iDag, useBruger, useHandling } from '../faelles'
import { Fejl } from '../komponenter'
import type { FaneProps } from './ProjektSide'

const TIMETYPER = Object.keys(TIMETYPE_NAVN) as TimeType[]

/** Regnskabet for én dag ad gangen — starter altid på i dag. */
export function TimekalenderFane(props: FaneProps) {
  const { data, erLeder } = props
  const [dato, setDato] = useState(iDag())

  const timer = data.timer.filter((t) => t.dato === dato)
  const materialer = data.materialeRegistreringer.filter((r) => r.dato === dato)
  const noter = data.noter.filter((n) => n.dato === dato)
  const dageMedData = [...new Set([...data.timer, ...data.materialeRegistreringer, ...data.noter].map((x) => x.dato))].sort().reverse()
  const timerIAlt = timer.reduce((s, t) => s + t.timer, 0)

  return (
    <>
      <section className="kort">
        <div className="datonav">
          <button aria-label="Forrige dag" onClick={() => setDato(flytDag(dato, -1))}>
            ‹
          </button>
          <label className="kalender" aria-label="Vælg dato">
            <span>📅</span>
            <input type="date" value={dato} onChange={(e) => e.target.value && setDato(e.target.value)} />
          </label>
          <button aria-label="Næste dag" onClick={() => setDato(flytDag(dato, 1))}>
            ›
          </button>
        </div>
        <div className="mellem">
          <strong className="foerste-stort">{datoLang(dato)}</strong>
          {dato !== iDag() && (
            <button className="link" onClick={() => setDato(iDag())}>
              I dag
            </button>
          )}
        </div>
        {dageMedData.length > 0 && (
          <label>
            Dage med registreringer
            <select value={dageMedData.includes(dato) ? dato : ''} onChange={(e) => e.target.value && setDato(e.target.value)}>
              <option value="">Vælg dag…</option>
              {dageMedData.map((d) => (
                <option key={d} value={d}>
                  {datoKort(d)}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="kort">
        <h3 className="mellem">
          <span>Timer</span>
          <span className="daempet">{visTimer(timerIAlt)} t</span>
        </h3>
        {timer.length === 0 ? (
          <p className="daempet lille">Ingen timer denne dag.</p>
        ) : (
          <ul className="liste">
            {data.medlemmer.flatMap((m) =>
              timer.filter((t) => t.medlemId === m.id).map((t) => <TimeRaekke key={t.id} t={t} navn={m.navn} {...props} />),
            )}
          </ul>
        )}
      </section>

      {erLeder && (
        <section className="kort">
          <h3>Materialer</h3>
          {materialer.length === 0 ? (
            <p className="daempet lille">Ingen materialer denne dag.</p>
          ) : (
            <ul className="liste">
              {materialer.map((r) => (
                <MaterialeRaekke key={r.id} r={r} {...props} />
              ))}
            </ul>
          )}
        </section>
      )}

      <Noter noter={noter} dato={dato} {...props} />
    </>
  )
}

function TimeRaekke({ t, navn, data, erLeder, laast, genindlaes }: FaneProps & { t: TimeRegistrering; navn: string }) {
  const [ret, setRet] = useState(false)
  const [medlemId, setMedlemId] = useState(t.medlemId)
  const [type, setType] = useState(t.type)
  const [antal, setAntal] = useState(tal(t.timer))
  const [beskrivelse, setBeskrivelse] = useState(t.beskrivelse ?? '')
  const { koer, fejl, setFejl, travl } = useHandling(genindlaes)

  if (!ret)
    return (
      <li>
        <div>
          <strong>{navn}</strong> · {TIMETYPE_NAVN[t.type]}
          {t.beskrivelse && <div className="daempet lille">{t.beskrivelse}</div>}
        </div>
        <span className="tal">{visTimer(t.timer)} t</span>
        {!laast && (
          <button className="lille-knap" onClick={() => setRet(true)}>
            Ret
          </button>
        )}
      </li>
    )

  const gem = async () => {
    const v = laesCenti(antal)
    if (v === null || v <= 0 || v > 2400) return setFejl('Ugyldigt antal timer')
    if (await koer(() => repo.retTimer({ ...t, medlemId, type, timer: v, beskrivelse: beskrivelse.trim() || undefined }))) setRet(false)
  }

  return (
    <li className="redigerer">
      <div className="stak fuld">
        {erLeder && (
          <select aria-label="Person" value={medlemId} onChange={(e) => setMedlemId(e.target.value)}>
            {data.medlemmer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.navn}
              </option>
            ))}
          </select>
        )}
        <div className="raekke">
          <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as TimeType)}>
            {TIMETYPER.map((x) => (
              <option key={x} value={x}>
                {TIMETYPE_NAVN[x]}
              </option>
            ))}
          </select>
          <input className="antal" aria-label="Timer" inputMode="decimal" value={antal} onChange={(e) => setAntal(e.target.value)} />
        </div>
        {type === 'timeloen' && (
          <input aria-label="Arbejde" placeholder="Arbejde (valgfrit)" value={beskrivelse} onChange={(e) => setBeskrivelse(e.target.value)} />
        )}
        <Fejl tekst={fejl} />
        <div className="knaprad">
          <button className="primaer" disabled={travl} onClick={gem}>
            Gem
          </button>
          <button onClick={() => setRet(false)}>Fortryd</button>
          <button className="farlig" disabled={travl} onClick={() => confirm('Slet registreringen?') && koer(() => repo.sletTimer(t.id))}>
            Slet
          </button>
        </div>
      </div>
    </li>
  )
}

function MaterialeRaekke({ r, data, laast, genindlaes }: FaneProps & { r: MaterialeRegistrering }) {
  const [ret, setRet] = useState(false)
  const [materialeId, setMaterialeId] = useState(r.projektMaterialeId)
  const [antal, setAntal] = useState(tal(r.antal))
  const { koer, fejl, setFejl, travl } = useHandling(genindlaes)
  const m = data.materialer.find((x) => x.id === r.projektMaterialeId)

  if (!ret)
    return (
      <li>
        <div>
          <strong>{m?.navn ?? 'Ukendt'}</strong>
          <div className="daempet lille">
            {visTimer(r.antal)} × {kr(m?.stykpris ?? 0)}
          </div>
        </div>
        <span className="tal">{kr(gange(r.antal, m?.stykpris ?? 0))}</span>
        {!laast && (
          <button className="lille-knap" onClick={() => setRet(true)}>
            Ret
          </button>
        )}
      </li>
    )

  const gem = async () => {
    const v = laesCenti(antal)
    if (v === null || v === 0) return setFejl('Ugyldigt antal')
    if (await koer(() => repo.retMaterialeRegistrering({ ...r, projektMaterialeId: materialeId, antal: v }))) setRet(false)
  }

  return (
    <li className="redigerer">
      <div className="stak fuld">
        <div className="raekke">
          <select aria-label="Materiale" value={materialeId} onChange={(e) => setMaterialeId(e.target.value)}>
            {data.materialer.map((x) => (
              <option key={x.id} value={x.id}>
                {x.navn}
              </option>
            ))}
          </select>
          <input className="antal" aria-label="Antal" inputMode="decimal" value={antal} onChange={(e) => setAntal(e.target.value)} />
        </div>
        <Fejl tekst={fejl} />
        <div className="knaprad">
          <button className="primaer" disabled={travl} onClick={gem}>
            Gem
          </button>
          <button onClick={() => setRet(false)}>Fortryd</button>
          <button
            className="farlig"
            disabled={travl}
            onClick={() => confirm('Slet registreringen?') && koer(() => repo.sletMaterialeRegistrering(r.id))}
          >
            Slet
          </button>
        </div>
      </div>
    </li>
  )
}

function Noter({ noter, dato, data, erLeder, laast, genindlaes }: FaneProps & { noter: Note[]; dato: string }) {
  const bruger = useBruger()
  const [tekst, setTekst] = useState('')
  const { koer, fejl, travl } = useHandling(genindlaes)
  const forfatter = (id?: string) => data.medlemmer.find((m) => m.brugerId === id)?.navn ?? (id === bruger.id ? bruger.navn : 'Ukendt')

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tekst.trim()) return
    if (await koer(() => repo.gemNote({ projektId: data.projekt.id, dato, tekst: tekst.trim() }))) setTekst('')
  }

  return (
    <section className="kort">
      <h3>Noter</h3>
      {noter.length === 0 && <p className="daempet lille">Ingen noter denne dag.</p>}
      <ul className="liste">
        {noter.map((n) => (
          <li key={n.id}>
            <div>
              <div className="notetekst">{n.tekst}</div>
              <div className="daempet lille">{forfatter(n.oprettetAf)}</div>
            </div>
            {!laast && (erLeder || n.oprettetAf === bruger.id) && (
              <button className="slet" aria-label="Slet note" onClick={() => confirm('Slet noten?') && koer(() => repo.sletNote(n.id))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {!laast && (
        <form className="stak" onSubmit={gem}>
          <textarea rows={2} placeholder="Skriv en note til dagen…" value={tekst} onChange={(e) => setTekst(e.target.value)} />
          <Fejl tekst={fejl} />
          <button disabled={travl}>Tilføj note</button>
        </form>
      )}
    </section>
  )
}
