import { useCallback, useEffect, useState } from 'react'
import { repo } from '../data'
import type { ProjektData } from '../domain/typer'

export function useProjekt(projektId: string) {
  const [data, setData] = useState<ProjektData | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let aktiv = true
    repo.hentProjektData(projektId).then((d) => aktiv && setData(d))
    return () => {
      aktiv = false
    }
  }, [projektId, version])

  /** Kør en ændring og hent data igen bagefter. */
  const koer = useCallback(async (aendring: () => Promise<unknown>) => {
    await aendring()
    setVersion((v) => v + 1)
  }, [])

  return { data, koer }
}

export type Koer = ReturnType<typeof useProjekt>['koer']

export function navnPaa(data: ProjektData, brugerId: string): string {
  return data.brugere.find((b) => b.id === brugerId)?.navn ?? 'Ukendt'
}

export function iDag(): string {
  return new Date().toISOString().slice(0, 10)
}

export function datoKort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
}
