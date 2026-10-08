import { useState } from 'react'
import { repo } from '../../data'
import type { Kollega } from '../../data/repository'
import { kr } from '../../domain/tal'
import type { Person } from '../../domain/typer'
import { useBruger, useHandling, useHent } from '../faelles'
import { Fejl, Henter, Ikon, Top } from '../komponenter'
import { SatsFelter } from '../SatsFelter'
import { afvigendeSatser, laesSatser, satserEns, satsTekst } from '../satser'

/**
 * Værktøjskasse → Personer: alle man deler projekt med. Personer man selv har
 * oprettet, men som ikke er på et projekt endnu, ses kun af en selv.
 */
export function Personer() {
  const bruger = useBruger()
  const { data, fejl, genindlaes } = useHent(() => Promise.all([repo.hentKolleger(), repo.hentPersoner()]), [])
  const [redigerer, setRedigerer] = useState<string | null>(null)

  if (!data)
    return (
      <main className="side">
        <Top titel="Personer" tilbage="/" tilbageTekst="AKBOG" />
        <Henter fejl={fejl} />
      </main>
    )

  const [kolleger, kartotek] = data
  const mig = kartotek.find((p) => p.brugerId === bruger.id)

  // Samme person på tværs af projekter samles til én række
  const grupper = new Map<string, { navn: string; harLogin: boolean; personId?: string; timesats?: number; projekter: Kollega[] }>()
  for (const k of kolleger.filter((k) => !k.erMig)) {
    const g = grupper.get(k.noegle) ?? { navn: k.navn, harLogin: k.harLogin, projekter: [] }
    // Personen i eget kartotek — via koblingen, ellers via samme login
    g.personId ??= k.personId ?? (k.harLogin ? kartotek.find((p) => p.brugerId === k.noegle)?.id : undefined)
    g.timesats ??= k.timesats
    g.projekter.push(k)
    grupper.set(k.noegle, g)
  }
  const paaProjekt = new Set([...grupper.values()].map((g) => g.personId).filter(Boolean))
  if (mig && kolleger.some((k) => k.erMig)) paaProjekt.add(mig.id)
  const ikkePaaProjekt = kartotek.filter((p) => p.brugerId !== bruger.id && !paaProjekt.has(p.id))

  const faerdig = () => {
    setRedigerer(null)
    genindlaes()
  }

  const kartotekRaekke = (p: Person, ekstra?: React.ReactNode) =>
    redigerer === p.id ? (
      <li key={p.id}>
        <PersonFormular person={p} erMig={p.brugerId === bruger.id} paaProjekter={paaProjekt.has(p.id)} faerdig={faerdig} />
      </li>
    ) : (
      <li key={p.id}>
        {/* Hele rækken kan trykkes for at rette — så satserne altid står i samme kolonne */}
        <button className="raekkeknap" aria-label={`Ret ${p.navn}`} onClick={() => setRedigerer(p.id)}>
          <div>
            <strong>
              {p.navn} <Ikon navn="registrer" str={15} />
            </strong>
            <div className="daempet lille">{ekstra ?? p.email ?? 'Ingen e-mail'}</div>
          </div>
          <span className="tal satskolonne">
            {kr(p.timesats)}/t
            {afvigendeSatser(p) && <small className="daempet">{afvigendeSatser(p)}</small>}
          </span>
        </button>
      </li>
    )

  return (
    <main className="side">
      <Top titel="Personer" tilbage="/" tilbageTekst="AKBOG" />
      <p className="daempet lille">
        Her ser du alle, du er på projekt med. Nye personer, du opretter, kan kun du se, indtil de kommer med på et projekt.
      </p>

      {mig && (
        <section className="kort">
          <h3>Dig</h3>
          <ul className="liste">{kartotekRaekke(mig, 'Din timesats bruges, når du opretter et projekt')}</ul>
        </section>
      )}

      <section className="kort">
        <h3>På projekt med dig</h3>
        {grupper.size === 0 && <p className="daempet lille">Ingen endnu — personer kommer på, når de tilføjes til et projekt.</p>}
        <ul className="liste">
          {[...grupper.entries()].map(([noegle, g]) => {
            const person = g.personId ? kartotek.find((p) => p.id === g.personId) : undefined
            const projekter = g.projekter.map((k) => k.projektNavn + (k.rolle === 'projektleder' ? ' (projektleder)' : '')).join(' · ')
            if (person) return kartotekRaekke(person, projekter)
            return (
              <li key={noegle}>
                <div>
                  <strong>{g.navn}</strong>
                  {!g.harLogin && <span className="daempet lille"> · ingen login</span>}
                  <div className="daempet lille">{projekter}</div>
                </div>
                {g.timesats !== undefined && <span className="tal">{kr(g.timesats)}/t</span>}
              </li>
            )
          })}
        </ul>
      </section>

      {ikkePaaProjekt.length > 0 && (
        <section className="kort">
          <h3>Ikke på et projekt endnu</h3>
          <p className="daempet lille">Kun synlige for dig.</p>
          <ul className="liste">{ikkePaaProjekt.map((p) => kartotekRaekke(p))}</ul>
        </section>
      )}

      <section className="kort">
        <h3>Ny person</h3>
        <PersonFormular faerdig={genindlaes} />
      </section>
    </main>
  )
}

function PersonFormular({
  person,
  erMig,
  paaProjekter,
  faerdig,
}: {
  person?: Person
  erMig?: boolean
  /** Personen er med i projekter — så kan satserne kopieres derud */
  paaProjekter?: boolean
  faerdig: () => void
}) {
  const [navn, setNavn] = useState(person?.navn ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [satser, setSatser] = useState(satsTekst(person))
  const [besked, setBesked] = useState('')
  const { koer, fejl, setFejl, travl } = useHandling()

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    setBesked('')
    if (!navn.trim()) return setFejl('Skriv et navn')
    if (email.trim() && !email.includes('@')) return setFejl('Ugyldig e-mail')
    const s = laesSatser(satser)
    if (typeof s === 'string') return setFejl(s)
    const ny = { id: person?.id, navn: navn.trim(), email: email.trim() || undefined, ...s }
    const ok = await koer(() => repo.gemPerson(ny))
    if (!ok) return

    // Satserne er standard i projekterne — tilbyd at opdatere de aktive projekter
    if (person && paaProjekter && !satserEns(person, s)) {
      const svar = confirm(
        `Satserne for ${ny.navn} er ændret.\n\nOpdater også satserne i dine aktive projekter? Afsluttede projekter ændres ikke.`,
      )
      if (svar) {
        let antal = 0
        if (!(await koer(async () => (antal = await repo.opdaterSatserIProjekter({ ...person, ...ny, id: person.id }))))) return
        alert(antal === 1 ? 'Satserne er opdateret i 1 projekt.' : `Satserne er opdateret i ${antal} projekter.`)
      }
    }
    if (!person) {
      setNavn('')
      setEmail('')
      setSatser(satsTekst())
      setBesked(`${ny.navn} er tilføjet.`)
    }
    faerdig()
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
      <label>
        E-mail {erMig ? '' : '(valgfri — giver login-adgang)'}
        <input type="email" inputMode="email" value={email} disabled={erMig} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <SatsFelter vaerdi={satser} aendr={setSatser} />
      <Fejl tekst={fejl} />
      {besked && <p className="besked">{besked}</p>}
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
