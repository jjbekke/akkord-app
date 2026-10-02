import { useState } from 'react'
import { repo } from '../../data'
import { kr, laesKroner, tal } from '../../domain/tal'
import type { Person } from '../../domain/typer'
import { useBruger, useHandling, useHent } from '../faelles'
import { Fejl, Henter, Top } from '../komponenter'

/** Værktøjskasse → Personer: ens eget kartotek med navn, e-mail og timesats. */
export function Personer() {
  const bruger = useBruger()
  const { data: personer, fejl, genindlaes } = useHent(() => repo.hentPersoner(), [])
  const [redigerer, setRedigerer] = useState<string | null>(null)

  return (
    <main className="side">
      <Top titel="Personer" tilbage="/" tilbageTekst="AKBOG" />
      <p className="daempet lille">
        Personer tilføjes med e-mail. Når personen opretter en konto med samme e-mail, kan vedkommende selv logge ind og se
        sine projekter. Lærlingetillæg sættes, når personen tilføjes til et projekt.
      </p>

      {!personer ? (
        <Henter fejl={fejl} />
      ) : (
        <section className="kort">
          <ul className="liste">
            {personer.map((p) =>
              redigerer === p.id ? (
                <li key={p.id}>
                  <PersonFormular
                    person={p}
                    erMig={p.brugerId === bruger.id}
                    faerdig={() => {
                      setRedigerer(null)
                      genindlaes()
                    }}
                  />
                </li>
              ) : (
                <li key={p.id}>
                  <div>
                    <strong>{p.navn}</strong>
                    {p.brugerId === bruger.id && <span className="daempet"> (dig)</span>}
                    <div className="daempet lille">
                      {p.email ?? 'Ingen e-mail'}
                      {p.email && p.brugerId !== bruger.id && (p.brugerId ? ' · har konto' : ' · ingen konto endnu')}
                    </div>
                  </div>
                  <span className="tal">{kr(p.timesats)}/t</span>
                  <button className="lille-knap" onClick={() => setRedigerer(p.id)}>
                    Ret
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      <section className="kort">
        <h3>Ny person</h3>
        <PersonFormular faerdig={genindlaes} />
      </section>
    </main>
  )
}

function PersonFormular({ person, erMig, faerdig }: { person?: Person; erMig?: boolean; faerdig: () => void }) {
  const [navn, setNavn] = useState(person?.navn ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [sats, setSats] = useState(person ? tal(person.timesats) : '')
  const { koer, fejl, setFejl, travl } = useHandling()

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    const timesats = laesKroner(sats)
    if (!navn.trim()) return setFejl('Skriv et navn')
    if (email.trim() && !email.includes('@')) return setFejl('Ugyldig e-mail')
    if (timesats === null || timesats < 0) return setFejl('Skriv en timesats, fx 210,00')
    const ok = await koer(() =>
      repo.gemPerson({ id: person?.id, navn: navn.trim(), email: email.trim() || undefined, timesats }),
    )
    if (ok) {
      if (!person) {
        setNavn('')
        setEmail('')
        setSats('')
      }
      faerdig()
    }
  }

  const slet = async () => {
    if (!person || !confirm(`Slet ${person.navn} fra dit kartotek? Personen forbliver i eksisterende projekter.`)) return
    if (await koer(() => repo.sletPerson(person.id))) faerdig()
  }

  return (
    <form className="stak fuld" onSubmit={gem}>
      <label>
        Navn
        <input value={navn} onChange={(e) => setNavn(e.target.value)} />
      </label>
      <div className="raekke">
        <label>
          E-mail {erMig ? '' : '(valgfri)'}
          <input type="email" inputMode="email" value={email} disabled={erMig} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="smal">
          Timesats (kr.)
          <input inputMode="decimal" placeholder="210,00" value={sats} onChange={(e) => setSats(e.target.value)} />
        </label>
      </div>
      <Fejl tekst={fejl} />
      <div className="knaprad">
        <button className="primaer" disabled={travl}>
          {person ? 'Gem' : 'Tilføj person'}
        </button>
        {person && (
          <button type="button" onClick={faerdig}>
            Fortryd
          </button>
        )}
        {person && !erMig && (
          <button type="button" className="farlig" onClick={slet}>
            Slet
          </button>
        )}
      </div>
    </form>
  )
}
