import { useState } from 'react'
import { repo } from '../../data'
import { beregnLoen } from '../../domain/beregning'
import { kr, laesKroner, timer } from '../../domain/tal'
import { datoKort, useHandling, useHent } from '../faelles'
import { Fejl, Henter } from '../komponenter'
import { Tal } from '../Tal'
import type { FaneProps } from './ProjektSide'

/** Det samlede akkordregnskab. Projektledere ser alt — andre kun deres egen løn. */
export function RegnskabFane(props: FaneProps) {
  return props.erLeder ? <FuldtRegnskab {...props} /> : <MitRegnskab {...props} />
}

function FuldtRegnskab({ data, laast, genindlaes }: FaneProps) {
  const r = beregnLoen(data)
  const navn = (id: string) => data.medlemmer.find((m) => m.id === id)?.navn ?? 'Ukendt'

  return (
    <>
      <section className="kort total">
        <h3 className="mellem">
          <span>Total</span>
          <span className="tal">{kr(r.total.iAlt)}</span>
        </h3>
        <Tal label="Akkordsum (materialer)" vaerdi={r.akkord.akkordsum} />
        <Tal label={`Akkordløn (${timer(r.akkord.akkordtimer)} t)`} vaerdi={r.total.akkordloen} />
        <Tal label="Overskud" vaerdi={r.total.overskud} />
        <Tal label="Timeløn" vaerdi={r.total.timeloen} />
        <Tal label="Syg" vaerdi={r.total.syg} />
        <Tal label="Vejrlig" vaerdi={r.total.vejrlig} />
        <Tal label="Rettelser" vaerdi={r.total.justeringer} />
        <Tal label="Kr. pr. akkordtime i alt" vaerdi={r.akkord.krPrAkkordtime} />
        <Tal label="I alt" vaerdi={r.total.iAlt} fed />
      </section>

      {r.advarsler.map((a) => (
        <p className="advarsel" key={a}>
          {a}
        </p>
      ))}

      <section className="kort">
        <h3>Materialer</h3>
        {r.akkord.linjer.length === 0 && <p className="daempet lille">Projektet har ingen materialer endnu.</p>}
        <ul className="liste">
          {r.akkord.linjer.map((l) => (
            <li key={l.projektMaterialeId}>
              <div>
                <strong>{l.navn}</strong>
                <div className="daempet lille">
                  {timer(l.antal)} × {kr(l.stykpris)}
                </div>
              </div>
              <span className="tal">{kr(l.beloeb)}</span>
            </li>
          ))}
        </ul>
        <Tal label="Akkordsum" vaerdi={r.akkord.akkordsum} fed />
      </section>

      {r.personer.map((p) => {
        const a = r.akkord.personer.find((x) => x.medlemId === p.medlemId)
        const t = r.timeloen.personer.find((x) => x.medlemId === p.medlemId)
        return (
          <section className="kort" key={p.medlemId}>
            <h3 className="mellem">
              <span>{navn(p.medlemId)}</span>
              <span className="tal">{kr(p.iAlt)}</span>
            </h3>
            {a && (
              <>
                <Tal label="Kr. pr. time (akkord + overskud)" vaerdi={a.krPrAkkordtime} fed />
                <Tal label={`Akkordløn (${timer(a.akkordtimer)} t)`} vaerdi={p.akkordloen} />
                <Tal label="Overskud" vaerdi={p.overskud} />
              </>
            )}
            {t && (
              <>
                <Tal label={`Timeløn (${timer(t.timer.timeloen)} t)`} vaerdi={p.timeloen} />
                {t.timer.syg > 0 && <Tal label={`Syg (${timer(t.timer.syg)} t)`} vaerdi={p.syg} />}
                {t.timer.vejrlig > 0 && <Tal label={`Vejrlig (${timer(t.timer.vejrlig)} t)`} vaerdi={p.vejrlig} />}
              </>
            )}
            {p.justeringer !== 0 && <Tal label="Rettelser" vaerdi={p.justeringer} />}
            <Tal label="I alt" vaerdi={p.iAlt} fed />
          </section>
        )
      })}

      <Rettelser data={data} laast={laast} genindlaes={genindlaes} />
      <Afslutning data={data} laast={laast} genindlaes={genindlaes} />
    </>
  )
}

function Rettelser({ data, laast, genindlaes }: Pick<FaneProps, 'data' | 'laast' | 'genindlaes'>) {
  const [medlemId, setMedlemId] = useState(data.medlemmer[0]?.id ?? '')
  const [beloeb, setBeloeb] = useState('')
  const [begrundelse, setBegrundelse] = useState('')
  const { koer, fejl, setFejl, travl } = useHandling(genindlaes)
  const navn = (id: string) => data.medlemmer.find((m) => m.id === id)?.navn ?? 'Ukendt'

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    const b = laesKroner(beloeb)
    if (b === null || b === 0) return setFejl('Skriv et beløb, fx 250 eller -250')
    if (!begrundelse.trim()) return setFejl('Skriv hvorfor lønnen rettes')
    const ok = await koer(() => repo.gemJustering({ projektId: data.projekt.id, medlemId, beloeb: b, begrundelse: begrundelse.trim() }))
    if (ok) {
      setBeloeb('')
      setBegrundelse('')
    }
  }

  if (laast && data.justeringer.length === 0) return null

  return (
    <section className="kort">
      <h3>Rettelser</h3>
      <p className="daempet lille">Rettelser lægges oven i det beregnede, så man altid kan se begge dele.</p>
      <ul className="liste">
        {data.justeringer.map((j) => (
          <li key={j.id}>
            <div>
              <strong>{navn(j.medlemId)}</strong> · {j.begrundelse}
            </div>
            <span className="tal">{kr(j.beloeb)}</span>
            {!laast && (
              <button className="slet" aria-label="Slet rettelse" onClick={() => koer(() => repo.sletJustering(j.id))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {!laast && (
        <form className="stak" onSubmit={gem}>
          <div className="raekke">
            <label>
              Person
              <select value={medlemId} onChange={(e) => setMedlemId(e.target.value)}>
                {data.medlemmer.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.navn}
                  </option>
                ))}
              </select>
            </label>
            <label className="smal">
              Beløb (±)
              <input inputMode="decimal" placeholder="-250,00" value={beloeb} onChange={(e) => setBeloeb(e.target.value)} />
            </label>
          </div>
          <label>
            Begrundelse
            <input placeholder="Kørsel" value={begrundelse} onChange={(e) => setBegrundelse(e.target.value)} />
          </label>
          <Fejl tekst={fejl} />
          <button disabled={travl}>Gem rettelse</button>
        </form>
      )}
    </section>
  )
}

/** Filer i bunden og knappen "Afslut projekt" / "Genåbn projekt". */
function Afslutning({ data, laast, genindlaes }: Pick<FaneProps, 'data' | 'laast' | 'genindlaes'>) {
  const { koer, fejl, travl } = useHandling(genindlaes)
  const [status, setStatus] = useState('')

  const lavFiler = async () => {
    setStatus('Laver kvittering og Excel-fil…')
    const { lavKvittering, lavTimeloenExcel, filnavn } = await import('./afslut')
    const [pdf, xlsx] = await Promise.all([lavKvittering(data), lavTimeloenExcel(data)])
    await repo.gemFil(data.projekt.id, 'kvittering', filnavn(data, 'Akkordregnskab', 'pdf'), pdf)
    await repo.gemFil(data.projekt.id, 'timeloen', filnavn(data, 'Timeloen', 'xlsx'), xlsx)
  }

  const afslut = () => {
    if (!confirm('Afslut projektet? Det bliver skrivebeskyttet, og der laves en kvittering (PDF) og en timeløn-fil (Excel).')) return
    koer(async () => {
      await repo.afslutProjekt(data.projekt.id, true)
      await lavFiler()
    }).finally(() => setStatus(''))
  }

  const genaabn = () => {
    if (!confirm('Genåbn projektet, så der kan rettes i det? De gamle filer bliver liggende.')) return
    koer(() => repo.afslutProjekt(data.projekt.id, false))
  }

  const hent = (sti: string) =>
    koer(async () => {
      location.href = await repo.hentFilUrl(sti)
    })

  return (
    <>
      {data.filer.length > 0 && (
        <section className="kort">
          <h3>Filer</h3>
          <ul className="liste">
            {data.filer.map((f) => (
              <li key={f.id}>
                <div>
                  <strong>{f.type === 'kvittering' ? 'Kvittering (PDF)' : 'Timeløn (Excel)'}</strong>
                  <div className="daempet lille">
                    {f.filnavn} · {datoKort(f.oprettet)}
                  </div>
                </div>
                <button className="lille-knap" onClick={() => hent(f.sti)}>
                  Hent
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Fejl tekst={fejl} />
      {status && <p className="besked">{status}</p>}
      {laast ? (
        <div className="knaprad">
          <button disabled={travl} onClick={genaabn}>
            Genåbn projekt
          </button>
          <button disabled={travl} onClick={() => koer(lavFiler).finally(() => setStatus(''))}>
            Lav filerne igen
          </button>
        </div>
      ) : (
        <button className="primaer afslut" disabled={travl} onClick={afslut}>
          Afslut projekt
        </button>
      )}
    </>
  )
}

/** Et almindeligt medlems egen løn — beregnet på serveren. */
function MitRegnskab({ data }: FaneProps) {
  const { data: r, fejl } = useHent(() => repo.hentMitRegnskab(data.projekt.id), [data])
  if (!r) return <Henter fejl={fejl} />
  if (!r.loen) return <p className="daempet">Du har ingen løn i projektet endnu.</p>

  const { loen: p, akkord: a, timeloen: t } = r
  return (
    <>
      <section className="kort total">
        <h3 className="mellem">
          <span>Din løn</span>
          <span className="tal">{kr(p.iAlt)}</span>
        </h3>
        {a && (
          <>
            <Tal label="Kr. pr. time (akkord + overskud)" vaerdi={a.krPrAkkordtime} fed />
            <Tal label={`Akkordløn (${timer(a.akkordtimer)} t)`} vaerdi={p.akkordloen} />
            <Tal label="Overskud" vaerdi={p.overskud} />
          </>
        )}
        {t && (
          <>
            <Tal label={`Timeløn (${timer(t.timer.timeloen)} t)`} vaerdi={p.timeloen} />
            {t.timer.syg > 0 && <Tal label={`Syg (${timer(t.timer.syg)} t)`} vaerdi={p.syg} />}
            {t.timer.vejrlig > 0 && <Tal label={`Vejrlig (${timer(t.timer.vejrlig)} t)`} vaerdi={p.vejrlig} />}
          </>
        )}
        {p.justeringer !== 0 && <Tal label="Rettelser" vaerdi={p.justeringer} />}
        <Tal label="I alt" vaerdi={p.iAlt} fed />
      </section>
      {r.justeringer.length > 0 && (
        <section className="kort">
          <h3>Rettelser</h3>
          <ul className="liste">
            {r.justeringer.map((j, i) => (
              <li key={i}>
                <div>{j.begrundelse}</div>
                <span className="tal">{kr(j.beloeb)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="daempet lille">Du kan kun se dit eget regnskab. Projektlederen kan se det samlede regnskab.</p>
    </>
  )
}
