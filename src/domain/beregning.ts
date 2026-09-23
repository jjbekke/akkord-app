import { afrund, fordelEfterVaegt, gange, type Centi, type Oere } from './tal'
import type { Id, Medlem, ProjektData, TimeType } from './typer'

// Beregningsmotoren. Ren TypeScript — ingen UI og ingen database.

export interface AkkordLinje {
  postId: Id
  navn: string
  antal: Centi
  enhedspris: Oere
  beloeb: Oere
}

export interface AkkordPerson {
  brugerId: Id
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
  krPrAkkordtime: Oere
}

export interface TimeloenPerson {
  brugerId: Id
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
  brugerId: Id
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
  total: Omit<LoenPerson, 'brugerId'>
  advarsler: string[]
}

function sumTimer(data: ProjektData, brugerId: Id, type: TimeType): Centi {
  return data.timer
    .filter((t) => t.brugerId === brugerId && t.type === type)
    .reduce((s, t) => s + t.timer, 0)
}

function sum<T>(liste: T[], f: (x: T) => number): number {
  return liste.reduce((s, x) => s + f(x), 0)
}

function prTime(beloeb: Oere, timer: Centi): Oere {
  return timer === 0 ? 0 : afrund((beloeb * 100) / timer)
}

export function beregnAkkord(data: ProjektData, advarsler: string[] = []): AkkordRegnskab {
  const linjer: AkkordLinje[] = data.akkordPoster.map((post) => {
    const antal = sum(
      data.akkordOpgoerelser.filter((o) => o.postId === post.id),
      (o) => o.antal,
    )
    return { postId: post.id, navn: post.navn, antal, enhedspris: post.enhedspris, beloeb: gange(antal, post.enhedspris) }
  })
  const akkordsum = sum(linjer, (l) => l.beloeb)

  const deltagere = data.medlemmer
    .map((m) => ({ m, akkordtimer: sumTimer(data, m.brugerId, 'akkord') }))
    .filter((d) => d.akkordtimer > 0)

  const akkordloen = deltagere.map((d) => gange(d.akkordtimer, d.m.timesats))
  const samletLoen = sum(akkordloen, (x) => x)
  const overskud = akkordsum - samletLoen

  // 1) Faste beløb pr. akkordtime
  const faste = deltagere.map((d) =>
    d.m.overskud.type === 'fastPrTime' ? gange(d.akkordtimer, d.m.overskud.oerePrTime) : 0,
  )
  const rest = overskud - sum(faste, (x) => x)

  // 2) Resten deles efter akkordtimer blandt dem med "andel"
  const andelsVaegte = deltagere.map((d) => (d.m.overskud.type === 'andel' ? d.akkordtimer : 0))
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
      brugerId: d.m.brugerId,
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
  }
}

export function beregnTimeloen(data: ProjektData): TimeloenRegnskab {
  const personer: TimeloenPerson[] = data.medlemmer
    .map((m: Medlem) => {
      const t = {
        timeloen: sumTimer(data, m.brugerId, 'timeloen'),
        syg: sumTimer(data, m.brugerId, 'syg'),
        vejrlig: sumTimer(data, m.brugerId, 'vejrlig'),
      }
      const timeloen = gange(t.timeloen, m.timesats)
      const syg = gange(t.syg, m.sygSats ?? m.timesats)
      const vejrlig = gange(t.vejrlig, m.vejrligSats ?? m.timesats)
      return { brugerId: m.brugerId, timer: t, timeloen, syg, vejrlig, iAlt: timeloen + syg + vejrlig }
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
      const a = akkord.personer.find((p) => p.brugerId === m.brugerId)
      const t = timeloen.personer.find((p) => p.brugerId === m.brugerId)
      const justeringer = sum(
        data.justeringer.filter((j) => j.brugerId === m.brugerId),
        (j) => j.beloeb,
      )
      const rad = {
        brugerId: m.brugerId,
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
