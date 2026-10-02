import { useState } from 'react'
import { repo } from '../../data'
import { kr, laesKroner, tal } from '../../domain/tal'
import type { Medlem, Person } from '../../domain/typer'
import { gaaTil, useBruger, useHandling, useHent } from '../faelles'
import { Fejl } from '../komponenter'
import type { FaneProps } from './ProjektSide'

/** Projektindstillinger (kun projektledere): navn, medlemmer, roller og materialer. */
export function Indstillinger({ data, laast, genindlaes }: FaneProps) {
  const bruger = useBruger()
  const erOpretter = data.projekt.oprettetAf === bruger.id
  const kartotek = useHent(() => Promise.all([repo.hentPersoner(), repo.hentMaterialer()]), [])
  const handling = useHandling(genindlaes)
  const [navn, setNavn] = useState(data.projekt.navn)
  const [nyPerson, setNyPerson] = useState('')
  const [nyTillaeg, setNyTillaeg] = useState('')
  const [nytMateriale, setNytMateriale] = useState('')

  if (laast)
    return (
      <>
        <p className="daempet">Projektet er afsluttet. Genåbn det under Regnskab for at ændre indstillinger.</p>
        {erOpretter && <SletProjekt data={data} />}
      </>
    )

  const [personer, materialer] = kartotek.data ?? [[], []]
  const ledigePersoner = personer.filter((p) => !data.medlemmer.some((m) => m.personId === p.id || (p.brugerId && m.brugerId === p.brugerId)))
  const ledigeMaterialer = materialer.filter((m) => !m.skjult && !data.materialer.some((pm) => pm.materialeId === m.id))

  const tilfoejPerson = async () => {
    const p = personer.find((x) => x.id === nyPerson)
    if (!p) return handling.setFejl('Vælg en person')
    const tillaeg = nyTillaeg.trim() === '' ? undefined : laesKroner(nyTillaeg)
    if (tillaeg === null || (tillaeg !== undefined && tillaeg < 0)) return handling.setFejl('Ugyldigt lærlingetillæg')
    if (await handling.koer(() => repo.tilfoejMedlem(data.projekt.id, p, tillaeg))) {
      setNyPerson('')
      setNyTillaeg('')
    }
  }

  const tilfoejMateriale = async () => {
    const m = materialer.find((x) => x.id === nytMateriale)
    if (!m) return handling.setFejl('Vælg et materiale')
    if (await handling.koer(() => repo.tilfoejProjektMateriale(data.projekt.id, m))) setNytMateriale('')
  }

  return (
    <>
      <section className="kort">
        <h3>Projektnavn</h3>
        <div className="raekke">
          <input aria-label="Projektnavn" value={navn} onChange={(e) => setNavn(e.target.value)} />
          <button
            disabled={handling.travl || !navn.trim() || navn === data.projekt.navn}
            onClick={() => handling.koer(() => repo.omdoebProjekt(data.projekt.id, navn.trim()))}
          >
            Gem
          </button>
        </div>
      </section>

      <section className="kort">
        <h3>Personer</h3>
        <p className="daempet lille">
          {erOpretter
            ? 'Du har oprettet projektet og kan udpege flere projektledere.'
            : 'Kun den der har oprettet projektet, kan udpege projektledere.'}{' '}
          Lærlingetillæg: fast beløb pr. akkordtime fra overskuddet. Tomt felt = almindelig andel.
        </p>
        <ul className="liste">
          {data.medlemmer.map((m) => (
            <MedlemRaekke
              key={m.id}
              medlem={m}
              erOpretter={erOpretter}
              erOpretterSelv={m.brugerId === data.projekt.oprettetAf}
              harRegistreringer={data.timer.some((t) => t.medlemId === m.id) || data.justeringer.some((j) => j.medlemId === m.id)}
              ledigePersoner={ledigePersoner}
              genindlaes={genindlaes}
            />
          ))}
        </ul>
        {ledigePersoner.length > 0 ? (
          <div className="stak">
            <div className="raekke">
              <label>
                Tilføj person
                <select value={nyPerson} onChange={(e) => setNyPerson(e.target.value)}>
                  <option value="">Vælg…</option>
                  {ledigePersoner.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.navn} ({kr(p.timesats)}/t)
                    </option>
                  ))}
                </select>
              </label>
              <label className="smal">
                Lærlingetillæg
                <input inputMode="decimal" placeholder="Ingen" value={nyTillaeg} onChange={(e) => setNyTillaeg(e.target.value)} />
              </label>
            </div>
            <button disabled={handling.travl || !nyPerson} onClick={tilfoejPerson}>
              Tilføj til projektet
            </button>
          </div>
        ) : (
          <p className="daempet lille">
            Alle i dit kartotek er med. <a href="#/personer">Opret flere personer</a>.
          </p>
        )}
      </section>

      <section className="kort">
        <h3>Materialer</h3>
        <ul className="liste">
          {data.materialer.map((m) => {
            const brugt = data.materialeRegistreringer.some((r) => r.projektMaterialeId === m.id)
            return (
              <li key={m.id}>
                <div>
                  <strong>{m.navn}</strong>
                </div>
                <span className="tal">{kr(m.stykpris)}</span>
                {!brugt && (
                  <button
                    className="slet"
                    aria-label={`Fjern ${m.navn}`}
                    onClick={() => handling.koer(() => repo.fjernProjektMateriale(m.id))}
                  >
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {ledigeMaterialer.length > 0 ? (
          <div className="raekke">
            <select aria-label="Tilføj materiale" value={nytMateriale} onChange={(e) => setNytMateriale(e.target.value)}>
              <option value="">Tilføj materiale…</option>
              {ledigeMaterialer.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.navn} ({kr(m.stykpris)})
                </option>
              ))}
            </select>
            <button disabled={handling.travl || !nytMateriale} onClick={tilfoejMateriale}>
              Tilføj
            </button>
          </div>
        ) : (
          <p className="daempet lille">
            <a href="#/materialer">Opret flere materialepriser</a>.
          </p>
        )}
      </section>
      <Fejl tekst={handling.fejl || kartotek.fejl} />
      {erOpretter && <SletProjekt data={data} />}
    </>
  )
}

/** Kun opretteren kan slette projektet — det kræver, at man skriver navnet. */
function SletProjekt({ data }: { data: FaneProps['data'] }) {
  const { koer, fejl, travl } = useHandling()

  const slet = () => {
    const svar = prompt(
      `Sletning kan ikke fortrydes. Alle timer, materialer, noter og filer i projektet slettes.\n\nSkriv projektets navn for at slette det:\n${data.projekt.navn}`,
    )
    if (svar === null) return
    if (svar.trim() !== data.projekt.navn.trim()) return alert('Navnet passede ikke — projektet er ikke slettet.')
    koer(async () => {
      await repo.sletProjekt(data.projekt.id)
      gaaTil('/')
    })
  }

  return (
    <section className="kort farezone">
      <h3>Slet projekt</h3>
      <p className="daempet lille">Kun du, der har oprettet projektet, kan slette det. Det kan ikke fortrydes.</p>
      <Fejl tekst={fejl} />
      <button className="farlig" disabled={travl} onClick={slet}>
        Slet projektet
      </button>
    </section>
  )
}

function MedlemRaekke({
  medlem,
  erOpretter,
  erOpretterSelv,
  harRegistreringer,
  ledigePersoner,
  genindlaes,
}: {
  medlem: Medlem
  erOpretter: boolean
  erOpretterSelv: boolean
  harRegistreringer: boolean
  ledigePersoner: Person[]
  genindlaes: () => void
}) {
  const [aaben, setAaben] = useState(false)
  const [sats, setSats] = useState(tal(medlem.timesats))
  const [tillaeg, setTillaeg] = useState(medlem.overskudPrTime === undefined ? '' : tal(medlem.overskudPrTime))
  const [kobl, setKobl] = useState('')
  const { koer, fejl, setFejl, travl } = useHandling(genindlaes)
  const erLeder = medlem.rolle === 'projektleder'

  const gem = async () => {
    const timesats = laesKroner(sats)
    const overskud = tillaeg.trim() === '' ? undefined : laesKroner(tillaeg)
    if (timesats === null || timesats < 0) return setFejl('Ugyldig timesats')
    if (overskud === null || (overskud !== undefined && overskud < 0)) return setFejl('Ugyldigt lærlingetillæg')
    if (await koer(() => repo.gemMedlem({ ...medlem, timesats, overskudPrTime: overskud }))) setAaben(false)
  }

  const login = medlem.brugerId ? null : medlem.personId ? 'ingen konto endnu' : 'ikke koblet til en person'

  return (
    <li className={aaben ? 'redigerer' : ''}>
      <div className="stak fuld">
        <div className="mellem">
          <span>
            <strong>{medlem.navn}</strong>
            {erLeder && <span className="maerke">Projektleder</span>}
            <div className="daempet lille">
              {kr(medlem.timesats)}/t
              {medlem.overskudPrTime !== undefined && ` · lærlingetillæg ${kr(medlem.overskudPrTime)}/t`}
              {login && ` · ${login}`}
            </div>
          </span>
          {!aaben && (
            <button className="lille-knap" onClick={() => setAaben(true)}>
              Ret
            </button>
          )}
        </div>

        {erOpretter && !erOpretterSelv && (
          <label className="afkryds">
            <input
              type="checkbox"
              checked={erLeder}
              disabled={travl}
              onChange={(e) => koer(() => repo.gemMedlem({ ...medlem, rolle: e.target.checked ? 'projektleder' : 'medlem' }))}
            />
            <span>Projektleder</span>
          </label>
        )}

        {aaben && (
          <>
            <div className="raekke">
              <label>
                Timesats (kr.)
                <input inputMode="decimal" value={sats} onChange={(e) => setSats(e.target.value)} />
              </label>
              <label>
                Lærlingetillæg kr./t
                <input inputMode="decimal" placeholder="Ingen" value={tillaeg} onChange={(e) => setTillaeg(e.target.value)} />
              </label>
            </div>
            {!medlem.personId && (
              <div className="stak">
                <label>
                  Kobl til person (giver login-adgang via e-mail)
                  <select value={kobl} onChange={(e) => setKobl(e.target.value)}>
                    <option value="">Vælg person fra dit kartotek…</option>
                    {ledigePersoner.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.navn}
                        {p.email ? ` (${p.email})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={travl || !kobl} onClick={() => koer(() => repo.koblMedlem(medlem.id, kobl))}>
                  Kobl
                </button>
                {ledigePersoner.length === 0 && (
                  <p className="daempet lille">
                    <a href="#/personer">Opret personen</a> med e-mail i dit kartotek først.
                  </p>
                )}
              </div>
            )}
            <Fejl tekst={fejl} />
            <div className="knaprad">
              <button className="primaer" disabled={travl} onClick={gem}>
                Gem
              </button>
              <button onClick={() => setAaben(false)}>Fortryd</button>
              {!erOpretterSelv && !harRegistreringer && (
                <button
                  className="farlig"
                  disabled={travl}
                  onClick={() => confirm(`Fjern ${medlem.navn} fra projektet?`) && koer(() => repo.fjernMedlem(medlem.id))}
                >
                  Fjern
                </button>
              )}
            </div>
            {harRegistreringer && !erOpretterSelv && (
              <p className="daempet lille">Personen har registreringer og kan derfor ikke fjernes.</p>
            )}
          </>
        )}
        {!aaben && <Fejl tekst={fejl} />}
      </div>
    </li>
  )
}

