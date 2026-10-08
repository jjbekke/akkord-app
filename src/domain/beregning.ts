import { afrund, fordelEfterVaegt, gange, type Centi, type Oere } from './tal.ts'
import type { Id, Medlem, ProjektData, TimeType } from './typer.ts'

// Beregningsmotoren. Ren TypeScript — ingen UI og ingen database.

export interface AkkordLinje {
  projektMaterialeId: Id
  navn: string
  antal: Centi
  stykpris: Oere
  beloeb: Oere
}

export interface AkkordPerson {
  medlemId: Id
  akkordtimer: Centi
  akkordloen: Oere
  overskud: Oere
  iAlt: Oere
  /** Afledt visningstal, afrundet til øre */
  krPrAkkordtime: Oere
}

export interface AkkordRegnskab {
  linjer: AkkordLinje[]
  akkordsum: Oere
  personer: AkkordPerson[]
  akkordtimer: Centi
  akkordloen: Oere
  overskud: Oere
  /** Akkordsum ÷ alle akkordtimer */
  krPrAkkordtime: Oere
  /** Gennemsnit af hver persons kr. pr. akkordtime */
  gnsKrPrAkkordtimePrPerson: Oere
}

export interface TimeloenPerson {
  medlemId: Id
  timer: Record<Exclude<TimeType, 'akkord'>, Centi>
  timeloen: Oere
  syg: Oere
  vejrlig: Oere
  iAlt: Oere
}

export interface TimeloenRegnskab {
  personer: TimeloenPerson[]
  timeloen: Oere
  syg: Oere
  vejrlig: Oere
  iAlt: Oere
}

export interface LoenPerson {
  medlemId: Id
  akkordloen: Oere
  overskud: Oere
  timeloen: Oere
  syg: Oere
  vejrlig: Oere
  beregnet: Oere
  justeringer: Oere
  iAlt: Oere
}

export interface LoenRegnskab {
  akkord: AkkordRegnskab
  timeloen: TimeloenRegnskab
  personer: LoenPerson[]
  total: Omit<LoenPerson, 'medlemId'>
  advarsler: string[]
}

function sumTimer(data: ProjektData, medlemId: Id, type: TimeType): Centi {
  return data.timer
    .filter((t) => t.medlemId === medlemId && t.type === type)
    .reduce((s, t) => s + t.timer, 0)
}

function sum<T>(liste: T[], f: (x: T) => number): number {
  return liste.reduce((s, x) => s + f(x), 0)
}

function prTime(beloeb: Oere, timer: Centi): Oere {
  return timer === 0 ? 0 : afrund((beloeb * 100) / timer)
}

export function beregnAkkord(data: ProjektData, advarsler: string[] = []): AkkordRegnskab {
  const linjer: AkkordLinje[] = data.materialer.map((m) => {
    const antal = sum(
      data.materialeRegistreringer.filter((r) => r.projektMaterialeId === m.id),
      (r) => r.antal,
    )
    return { projektMaterialeId: m.id, navn: m.navn, antal, stykpris: m.stykpris, beloeb: gange(antal, m.stykpris) }
  })
  const akkordsum = sum(linjer, (l) => l.beloeb)

  const deltagere = data.medlemmer
    .map((m) => ({ m, akkordtimer: sumTimer(data, m.id, 'akkord') }))
    .filter((d) => d.akkordtimer > 0)

  const akkordloen = deltagere.map((d) => gange(d.akkordtimer, d.m.akkordsats ?? d.m.timesats))
  const samletLoen = sum(akkordloen, (x) => x)
  const overskud = akkordsum - samletLoen

  // 1) Faste beløb pr. akkordtime (lærlinge)
  const harFast = (m: Medlem) => m.overskudPrTime !== undefined
  const faste = deltagere.map((d) => (harFast(d.m) ? gange(d.akkordtimer, d.m.overskudPrTime!) : 0))
  const rest = overskud - sum(faste, (x) => x)

  // 2) Resten deles efter akkordtimer blandt dem med "andel"
  const andelsVaegte = deltagere.map((d) => (harFast(d.m) ? 0 : d.akkordtimer))
  const harAndel = andelsVaegte.some((v) => v > 0)
  const andele = harAndel ? fordelEfterVaegt(rest, andelsVaegte) : andelsVaegte.map(() => 0)

  if (deltagere.length > 0 && overskud < 0) {
    advarsler.push('Akkorden giver underskud: akkordlønnen er større end akkordsummen.')
  }
  if (rest < 0 && faste.some((f) => f > 0)) {
    advarsler.push('De faste overskudsbeløb er større end overskuddet — resten bliver negativ.')
  }
  if (!harAndel && rest !== 0 && deltagere.length > 0) {
    advarsler.push('Ingen har "andel" af overskuddet, så en del af det er ikke fordelt.')
  }

  const personer: AkkordPerson[] = deltagere.map((d, i) => {
    const personOverskud = faste[i] + andele[i]
    const iAlt = akkordloen[i] + personOverskud
    return {
      medlemId: d.m.id,
      akkordtimer: d.akkordtimer,
      akkordloen: akkordloen[i],
      overskud: personOverskud,
      iAlt,
      krPrAkkordtime: prTime(iAlt, d.akkordtimer),
    }
  })

  const akkordtimer = sum(personer, (p) => p.akkordtimer)
  return {
    linjer,
    akkordsum,
    personer,
    akkordtimer,
    akkordloen: samletLoen,
    overskud,
    krPrAkkordtime: prTime(akkordsum, akkordtimer),
    gnsKrPrAkkordtimePrPerson: personer.length === 0 ? 0 : afrund(sum(personer, (p) => p.krPrAkkordtime) / personer.length),
  }
}

export function beregnTimeloen(data: ProjektData): TimeloenRegnskab {
  const personer: TimeloenPerson[] = data.medlemmer
    .map((m: Medlem) => {
      const t = {
        timeloen: sumTimer(data, m.id, 'timeloen'),
        syg: sumTimer(data, m.id, 'syg'),
        vejrlig: sumTimer(data, m.id, 'vejrlig'),
      }
      const timeloen = gange(t.timeloen, m.timesats)
      const syg = gange(t.syg, m.sygsats ?? m.timesats)
      const vejrlig = gange(t.vejrlig, m.vejrligsats ?? m.timesats)
      return { medlemId: m.id, timer: t, timeloen, syg, vejrlig, iAlt: timeloen + syg + vejrlig }
    })
    .filter((p) => p.timer.timeloen + p.timer.syg + p.timer.vejrlig > 0)

  return {
    personer,
    timeloen: sum(personer, (p) => p.timeloen),
    syg: sum(personer, (p) => p.syg),
    vejrlig: sum(personer, (p) => p.vejrlig),
    iAlt: sum(personer, (p) => p.iAlt),
  }
}

export function beregnLoen(data: ProjektData): LoenRegnskab {
  const advarsler: string[] = []
  const akkord = beregnAkkord(data, advarsler)
  const timeloen = beregnTimeloen(data)

  const personer: LoenPerson[] = data.medlemmer
    .map((m) => {
      const a = akkord.personer.find((p) => p.medlemId === m.id)
      const t = timeloen.personer.find((p) => p.medlemId === m.id)
      const justeringer = sum(
        data.justeringer.filter((j) => j.medlemId === m.id),
        (j) => j.beloeb,
      )
      const rad = {
        medlemId: m.id,
        akkordloen: a?.akkordloen ?? 0,
        overskud: a?.overskud ?? 0,
        timeloen: t?.timeloen ?? 0,
        syg: t?.syg ?? 0,
        vejrlig: t?.vejrlig ?? 0,
      }
      const beregnet = rad.akkordloen + rad.overskud + rad.timeloen + rad.syg + rad.vejrlig
      return { ...rad, beregnet, justeringer, iAlt: beregnet + justeringer }
    })
    .filter((p) => p.beregnet !== 0 || p.justeringer !== 0)

  const total = {
    akkordloen: sum(personer, (p) => p.akkordloen),
    overskud: sum(personer, (p) => p.overskud),
    timeloen: sum(personer, (p) => p.timeloen),
    syg: sum(personer, (p) => p.syg),
    vejrlig: sum(personer, (p) => p.vejrlig),
    beregnet: sum(personer, (p) => p.beregnet),
    justeringer: sum(personer, (p) => p.justeringer),
    iAlt: sum(personer, (p) => p.iAlt),
  }

  return { akkord, timeloen, personer, total, advarsler }
}
