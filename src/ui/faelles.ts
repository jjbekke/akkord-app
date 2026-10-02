import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Profil } from '../domain/typer'

// Små fælles byggesten: navigation, datoer, hentning og fejlvisning.

// --- Navigation (hash-ruter, så appen virker på GitHub Pages) ---------------

/** Den aktuelle rute, fx "/projekt/123/regnskab". Alt andet i adresselinjen (fx login-tokens) giver "/". */
export function useRute(): string {
  const laes = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : '/')
  const [rute, setRute] = useState(laes)
  useEffect(() => {
    const opdater = () => {
      setRute(laes())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', opdater)
    return () => window.removeEventListener('hashchange', opdater)
  }, [])
  return rute
}

export function gaaTil(rute: string) {
  location.hash = rute
}

// --- Den indloggede bruger ---------------------------------------------------

export const BrugerKontekst = createContext<Profil | null>(null)

export function useBruger(): Profil {
  const b = useContext(BrugerKontekst)
  if (!b) throw new Error('useBruger kræver en indlogget bruger')
  return b
}

// --- Datoer ------------------------------------------------------------------

/** Dagens dato i lokal tid som "2026-10-02". */
export function iDag(): string {
  return isoDato(new Date())
}

export function isoDato(d: Date): string {
  const to = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${to(d.getMonth() + 1)}-${to(d.getDate())}`
}

export function flytDag(iso: string, dage: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dage)
  return isoDato(d)
}

export function datoKort(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function datoLang(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// --- Hentning og handlinger --------------------------------------------------

/** Henter data og kan hente igen. Henter på ny, når en af afhængighederne ændrer sig. */
export function useHent<T>(hent: () => Promise<T>, afhaengigheder: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [fejl, setFejl] = useState('')
  const [version, setVersion] = useState(0)
  const hentRef = useRef(hent)
  useEffect(() => {
    hentRef.current = hent
  })
  const noegle = JSON.stringify(afhaengigheder)

  useEffect(() => {
    let aktiv = true
    hentRef
      .current()
      .then((d) => aktiv && (setData(d), setFejl('')))
      .catch((e: Error) => aktiv && setFejl(e.message))
    return () => {
      aktiv = false
    }
  }, [noegle, version])

  const genindlaes = useCallback(() => setVersion((v) => v + 1), [])
  return { data, fejl, genindlaes }
}

/**
 * Kør en ændring, vis fejl og hent data igen bagefter.
 * Returnerer true hvis det lykkedes.
 */
export function useHandling(efter?: () => void) {
  const [fejl, setFejl] = useState('')
  const [travl, setTravl] = useState(false)

  const koer = useCallback(
    async (handling: () => Promise<unknown>): Promise<boolean> => {
      setTravl(true)
      setFejl('')
      try {
        await handling()
        efter?.()
        return true
      } catch (e) {
        setFejl(e instanceof Error ? e.message : String(e))
        return false
      } finally {
        setTravl(false)
      }
    },
    [efter],
  )
  return { koer, fejl, setFejl, travl }
}
