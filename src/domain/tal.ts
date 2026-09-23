// Alle beløb regnes i øre (heltal) og alle timer/antal i hundrededele (heltal).
// Der bruges aldrig kommatal (float) til penge.

/** Beløb i øre. 69.716,80 kr. = 6971680 */
export type Oere = number
/** Timer eller antal i hundrededele. 90,6 t = 9060 */
export type Centi = number

/** Afrunder halve op væk fra nul (0,5 øre → 1 øre). */
export function afrund(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x)
}

/** timer (centi) × sats (øre pr. time) → øre */
export function gange(centi: Centi, oerePrEnhed: Oere): Oere {
  return afrund((centi * oerePrEnhed) / 100)
}

/**
 * Læser et tal skrevet på dansk: "8,5", "1.368,80", "90.6" (punktum som decimal
 * accepteres kun hvis der ikke også er komma). Returnerer hundrededele.
 */
export function laesCenti(input: string): Centi | null {
  let s = input.trim().replace(/\s|kr\.?/gi, '')
  if (s === '') return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.368" uden komma = tusindtalsseparator
    s = s.replace(/\./g, '')
  }
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null
  const [heltal, decimaler = ''] = s.replace('-', '').split('.')
  const vaerdi = Number(heltal) * 100 + Number(decimaler.padEnd(2, '0'))
  return s.startsWith('-') ? -vaerdi : vaerdi
}

/** Samme som laesCenti — et kronebeløb i hundrededele er netop øre. */
export const laesKroner = laesCenti

const krFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function kr(oere: Oere): string {
  return `${krFormat.format(oere / 100)} kr.`
}

export function tal(oere: Oere): string {
  return krFormat.format(oere / 100)
}

const timerFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function timer(centi: Centi): string {
  return timerFormat.format(centi / 100)
}

/**
 * Fordeler et beløb efter vægte, så summen altid passer præcist
 * (største-rest-metoden). Bruges til overskud fordelt efter timer.
 */
export function fordelEfterVaegt(beloeb: Oere, vaegte: number[]): Oere[] {
  const sumVaegt = vaegte.reduce((a, b) => a + b, 0)
  if (sumVaegt === 0) return vaegte.map(() => 0)
  const raa = vaegte.map((v) => (beloeb * v) / sumVaegt)
  const dele = raa.map((r) => Math.floor(r))
  let rest = beloeb - dele.reduce((a, b) => a + b, 0)
  const efterRest = raa
    .map((r, i) => ({ i, brok: r - Math.floor(r) }))
    .sort((a, b) => b.brok - a.brok)
  for (let k = 0; rest > 0; k = (k + 1) % efterRest.length, rest--) {
    dele[efterRest[k].i] += 1
  }
  return dele
}
