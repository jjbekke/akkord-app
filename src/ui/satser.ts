import { kr, laesKroner, tal } from '../domain/tal'
import type { Satser } from '../domain/typer'

// Satser som tekst i formularer. Tomme felter betyder "samme som timesatsen".

export interface SatsTekst {
  timesats: string
  akkordsats: string
  sygsats: string
  vejrligsats: string
}

const tekst = (v: number | undefined) => (v === undefined ? '' : tal(v))

export function satsTekst(s?: Satser): SatsTekst {
  return {
    timesats: s ? tal(s.timesats) : '',
    akkordsats: tekst(s?.akkordsats),
    sygsats: tekst(s?.sygsats),
    vejrligsats: tekst(s?.vejrligsats),
  }
}

/** Satserne, eller en fejltekst. En sats lig timesatsen gemmes som tom, så den følger med. */
export function laesSatser(t: SatsTekst): Satser | string {
  const timesats = laesKroner(t.timesats)
  if (timesats === null || timesats < 0) return 'Skriv en timesats, fx 210,00'
  const valgfri = (felt: string, navn: string): number | undefined | string => {
    if (felt.trim() === '') return undefined
    const v = laesKroner(felt)
    if (v === null || v < 0) return `Ugyldig ${navn}`
    return v === timesats ? undefined : v
  }
  const akkordsats = valgfri(t.akkordsats, 'akkordsats')
  const sygsats = valgfri(t.sygsats, 'sygesats')
  const vejrligsats = valgfri(t.vejrligsats, 'vejrligsats')
  for (const v of [akkordsats, sygsats, vejrligsats]) if (typeof v === 'string') return v
  return { timesats, akkordsats: akkordsats as number | undefined, sygsats: sygsats as number | undefined, vejrligsats: vejrligsats as number | undefined }
}

export function satserEns(a: Satser, b: Satser): boolean {
  return a.timesats === b.timesats && a.akkordsats === b.akkordsats && a.sygsats === b.sygsats && a.vejrligsats === b.vejrligsats
}

/** Kort tekst med de satser, der afviger fra timesatsen, fx "akkord 220,00 kr. · syg 150,00 kr." */
export function afvigendeSatser(s: Satser): string {
  return [
    s.akkordsats !== undefined ? `akkord ${kr(s.akkordsats)}` : '',
    s.sygsats !== undefined ? `syg ${kr(s.sygsats)}` : '',
    s.vejrligsats !== undefined ? `vejrlig ${kr(s.vejrligsats)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
