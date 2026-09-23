import { useState } from 'react'
import { repo } from '../data'
import { kr, laesCenti, tal } from '../domain/tal'
import type { Medlem, ProjektData } from '../domain/typer'
import { navnPaa, type Koer } from './useProjekt'

export function HoldFane({ data, koer }: { data: ProjektData; koer: Koer }) {
  const [navn, setNavn] = useState('')
  const [email, setEmail] = useState('')
  const [sats, setSats] = useState('')
  const [fejl, setFejl] = useState('')

  const inviter = async (e: React.FormEvent) => {
    e.preventDefault()
    const s = laesCenti(sats)
    if (!navn.trim() || !email.includes('@') || s === null) return setFejl('Udfyld navn, e-mail og timesats')
    setFejl('')
    await koer(() => repo.inviter(data.projekt.id, navn.trim(), email.trim().toLowerCase(), s))
    setNavn('')
    setEmail('')
    setSats('')
  }

  return (
    <>
      {data.medlemmer.map((m) => (
        <MedlemKort key={m.brugerId} medlem={m} navn={navnPaa(data, m.brugerId)} koer={koer} />
      ))}

      <form className="kort" onSubmit={inviter}>
        <h3>Invitér til projektet</h3>
        <p className="daempet lille">I prototypen oprettes personen kun på denne telefon. Med Supabase sendes en invitation på e-mail.</p>
        <label>
          Navn
          <input id="inv-navn" value={navn} onChange={(e) => setNavn(e.target.value)} />
        </label>
        <div className="raekke">
          <label>
            E-mail
            <input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="smal">
            Timesats
            <input id="inv-sats" inputMode="decimal" placeholder="210,00" value={sats} onChange={(e) => setSats(e.target.value)} />
          </label>
        </div>
        {fejl && <p className="fejl">{fejl}</p>}
        <button className="primaer">Invitér</button>
      </form>
    </>
  )
}

function MedlemKort({ medlem, navn, koer }: { medlem: Medlem; navn: string; koer: Koer }) {
  const [sats, setSats] = useState(tal(medlem.timesats))
  const [fast, setFast] = useState(medlem.overskud.type === 'fastPrTime' ? tal(medlem.overskud.oerePrTime) : '')
  const [fejl, setFejl] = useState('')
  const erFast = medlem.overskud.type === 'fastPrTime'

  const gem = (aendring: Partial<Medlem>) => koer(() => repo.gemMedlem({ ...medlem, ...aendring }))

  const gemSats = () => {
    const s = laesCenti(sats)
    if (s === null) return setFejl('Ugyldig timesats')
    setFejl('')
    if (s !== medlem.timesats) gem({ timesats: s })
  }

  const gemFast = () => {
    const f = laesCenti(fast)
    if (f === null) return setFejl('Ugyldigt beløb pr. time')
    setFejl('')
    gem({ overskud: { type: 'fastPrTime', oerePrTime: f } })
  }

  return (
    <section className="kort">
      <h3 className="mellem">
        <span>{navn}</span>
        <span className="daempet lille">{medlem.rolle}</span>
      </h3>
      <label>
        Timesats (kr./t)
        <input id={`sats-${medlem.brugerId}`} inputMode="decimal" value={sats} onChange={(e) => setSats(e.target.value)} onBlur={gemSats} />
      </label>
      <div className="knapgruppe" role="radiogroup" aria-label="Overskud">
        <button type="button" aria-pressed={!erFast} onClick={() => gem({ overskud: { type: 'andel' } })}>
          Andel efter timer
        </button>
        <button type="button" aria-pressed={erFast} onClick={() => gem({ overskud: { type: 'fastPrTime', oerePrTime: laesCenti(fast) ?? 0 } })}>
          Fast kr. pr. time
        </button>
      </div>
      {erFast && (
        <label>
          Overskud pr. akkordtime ({kr(medlem.overskud.type === 'fastPrTime' ? medlem.overskud.oerePrTime : 0)})
          <input id={`fast-${medlem.brugerId}`} inputMode="decimal" value={fast} onChange={(e) => setFast(e.target.value)} onBlur={gemFast} />
        </label>
      )}
      {fejl && <p className="fejl">{fejl}</p>}
    </section>
  )
}
