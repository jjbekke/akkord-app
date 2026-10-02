import { useState } from 'react'
import { supabase } from '../data/supabase'
import { Fejl } from './komponenter'

type Tilstand = 'logind' | 'opret' | 'glemt'

/** Adressen brugeren sendes tilbage til fra e-mails (bekræftelse og nyt password). */
const tilbageUrl = () => location.origin + location.pathname

function oversaet(besked: string): string {
  if (/invalid login credentials/i.test(besked)) return 'Forkert e-mail eller adgangskode.'
  if (/email not confirmed/i.test(besked)) return 'Du skal bekræfte din e-mail først — tjek din indbakke.'
  if (/already registered/i.test(besked)) return 'Der findes allerede en konto med den e-mail.'
  if (/password should be at least/i.test(besked)) return 'Adgangskoden skal være på mindst 8 tegn.'
  if (/rate limit|too many/i.test(besked)) return 'For mange forsøg. Vent lidt og prøv igen.'
  return besked
}

export function Adgang() {
  const [tilstand, setTilstand] = useState<Tilstand>('logind')
  const [navn, setNavn] = useState('')
  const [email, setEmail] = useState('')
  const [kode, setKode] = useState('')
  const [fejl, setFejl] = useState('')
  const [besked, setBesked] = useState('')
  const [travl, setTravl] = useState(false)

  const skift = (t: Tilstand) => {
    setTilstand(t)
    setFejl('')
    setBesked('')
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setFejl('')
    setBesked('')
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) return setFejl('Skriv din e-mail.')
    if (tilstand === 'opret' && !navn.trim()) return setFejl('Skriv dit navn.')
    if (tilstand !== 'glemt' && kode.length < 8) return setFejl('Adgangskoden skal være på mindst 8 tegn.')

    setTravl(true)
    try {
      if (tilstand === 'logind') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: kode })
        if (error) throw error
      } else if (tilstand === 'opret') {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password: kode,
          options: { data: { navn: navn.trim() }, emailRedirectTo: tilbageUrl() },
        })
        if (error) throw error
        if (!data.session) {
          setBesked('Vi har sendt dig en e-mail. Klik på linket i den for at bekræfte din konto, og log så ind.')
          setTilstand('logind')
          setKode('')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: tilbageUrl() })
        if (error) throw error
        setBesked('Hvis der findes en konto med den e-mail, har vi sendt et link til at vælge en ny adgangskode.')
      }
    } catch (e) {
      setFejl(oversaet(e instanceof Error ? e.message : String(e)))
    } finally {
      setTravl(false)
    }
  }

  return (
    <main className="side">
      <header className="logo">
        <h1>AKBOG</h1>
        <p className="daempet">Registrér dagens timer på få sekunder — akkordregnskabet regner sig selv.</p>
      </header>

      <form className="kort" onSubmit={send} noValidate>
        <h3>{tilstand === 'logind' ? 'Log ind' : tilstand === 'opret' ? 'Opret konto' : 'Glemt adgangskode'}</h3>
        {tilstand === 'opret' && (
          <label>
            Navn
            <input id="navn" autoComplete="name" value={navn} onChange={(e) => setNavn(e.target.value)} />
          </label>
        )}
        <label>
          E-mail
          <input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {tilstand !== 'glemt' && (
          <label>
            Adgangskode
            <input
              id="kode"
              type="password"
              autoComplete={tilstand === 'opret' ? 'new-password' : 'current-password'}
              value={kode}
              onChange={(e) => setKode(e.target.value)}
            />
          </label>
        )}
        <Fejl tekst={fejl} />
        {besked && <p className="besked">{besked}</p>}
        <button className="primaer" disabled={travl}>
          {tilstand === 'logind' ? 'Log ind' : tilstand === 'opret' ? 'Opret konto' : 'Send link'}
        </button>
      </form>

      <div className="stak midt">
        {tilstand !== 'logind' && (
          <button className="link" onClick={() => skift('logind')}>
            Jeg har en konto — log ind
          </button>
        )}
        {tilstand !== 'opret' && (
          <button className="link" onClick={() => skift('opret')}>
            Opret en ny konto
          </button>
        )}
        {tilstand !== 'glemt' && (
          <button className="link" onClick={() => skift('glemt')}>
            Glemt adgangskode?
          </button>
        )}
      </div>
    </main>
  )
}

/** Vises når brugeren kommer fra linket i "nulstil adgangskode"-mailen. */
export function NyAdgangskode({ faerdig }: { faerdig: () => void }) {
  const [kode, setKode] = useState('')
  const [igen, setIgen] = useState('')
  const [fejl, setFejl] = useState('')
  const [travl, setTravl] = useState(false)

  const gem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (kode.length < 8) return setFejl('Adgangskoden skal være på mindst 8 tegn.')
    if (kode !== igen) return setFejl('De to adgangskoder er ikke ens.')
    setTravl(true)
    const { error } = await supabase.auth.updateUser({ password: kode })
    setTravl(false)
    if (error) return setFejl(oversaet(error.message))
    faerdig()
  }

  return (
    <main className="side">
      <header className="logo">
        <h1>AKBOG</h1>
      </header>
      <form className="kort" onSubmit={gem}>
        <h3>Vælg ny adgangskode</h3>
        <label>
          Ny adgangskode
          <input id="ny-kode" type="password" autoComplete="new-password" value={kode} onChange={(e) => setKode(e.target.value)} />
        </label>
        <label>
          Gentag adgangskode
          <input id="ny-kode-igen" type="password" autoComplete="new-password" value={igen} onChange={(e) => setIgen(e.target.value)} />
        </label>
        <Fejl tekst={fejl} />
        <button className="primaer" disabled={travl}>
          Gem adgangskode
        </button>
      </form>
    </main>
  )
}
