import { describe, expect, it } from 'vitest'
import { vibyEksempel } from '../data/eksempel'
import { beregnLoen } from './beregning'
import { fordelEfterVaegt, gange, laesCenti } from './tal'

const person = <T extends { brugerId: string }>(liste: T[], id: string) =>
  liste.find((p) => p.brugerId === id)!

describe('Viby-regnskabet (facit fra notesblokken)', () => {
  const r = beregnLoen(vibyEksempel())

  it('akkordarbejdet', () => {
    expect(r.akkord.linjer.map((l) => l.beloeb)).toEqual([52800, 410000, 136880, 6372000])
    expect(r.akkord.akkordsum).toBe(6971680)
  })

  it('akkordløn og overskud', () => {
    expect(r.akkord.akkordtimer).toBe(21910)
    expect(r.akkord.akkordloen).toBe(3681510)
    expect(r.akkord.overskud).toBe(3290170)

    const a = person(r.akkord.personer, 'asbjoern')
    expect(a).toMatchObject({ akkordloen: 2698500, overskud: 2837170, iAlt: 5535670, krPrAkkordtime: 43079 })

    const j = person(r.akkord.personer, 'jeppe')
    expect(j).toMatchObject({ akkordloen: 983010, overskud: 453000, iAlt: 1436010, krPrAkkordtime: 15850 })
  })

  it('kr./akkordtime i alt er 318,20 (notesblokken siger fejlagtigt 318,12)', () => {
    expect(r.akkord.krPrAkkordtime).toBe(31820)
  })

  it('timeløn', () => {
    expect(person(r.timeloen.personer, 'asbjoern')).toMatchObject({ timeloen: 997500, syg: 168000, vejrlig: 21000, iAlt: 1186500 })
    expect(person(r.timeloen.personer, 'jeppe')).toMatchObject({ timeloen: 298375, syg: 0, vejrlig: 10850, iAlt: 309225 })
    expect(person(r.timeloen.personer, 'oliver')).toMatchObject({ timeloen: 71520, iAlt: 71520 })
    expect(r.timeloen).toMatchObject({ timeloen: 1367395, syg: 168000, vejrlig: 31850, iAlt: 1567245 })
  })

  it('samlet løn pr. person', () => {
    expect(person(r.personer, 'asbjoern').iAlt).toBe(6722170)
    expect(person(r.personer, 'jeppe').iAlt).toBe(1745235)
    expect(person(r.personer, 'oliver').iAlt).toBe(71520)
    expect(r.total.iAlt).toBe(8538925)
    expect(r.advarsler).toEqual([])
  })

  it('justeringer lægges oven i det beregnede', () => {
    const data = vibyEksempel()
    data.justeringer.push({
      id: 'j1', projektId: 'viby', brugerId: 'oliver', beloeb: 10000,
      begrundelse: 'Kørsel', oprettetAf: 'asbjoern', oprettet: '2026-09-20',
    })
    const o = person(beregnLoen(data).personer, 'oliver')
    expect(o).toMatchObject({ beregnet: 71520, justeringer: 10000, iAlt: 81520 })
  })
})

describe('advarsler', () => {
  it('underskud på akkorden', () => {
    const data = vibyEksempel()
    data.akkordOpgoerelser = []
    expect(beregnLoen(data).advarsler[0]).toMatch(/underskud/)
  })
})

describe('tal', () => {
  it('læser danske tal', () => {
    expect(laesCenti('8,5')).toBe(850)
    expect(laesCenti('90.6')).toBe(9060)
    expect(laesCenti('1.368,80')).toBe(136880)
    expect(laesCenti('1.368')).toBe(136800)
    expect(laesCenti('472 kr.')).toBe(47200)
    expect(laesCenti('abc')).toBeNull()
    expect(laesCenti('1,234')).toBeNull()
  })

  it('afrunder halve øre op', () => {
    expect(gange(150, 333)).toBe(500) // 1,5 × 3,33 kr. = 4,995 kr. → 5,00
    expect(gange(333, 1001)).toBe(3333) // 3,33 × 10,01 kr. = 33,3333 kr. → 33,33
  })

  it('fordeling summer altid præcist', () => {
    const dele = fordelEfterVaegt(100, [1, 1, 1])
    expect(dele).toEqual([34, 33, 33])
    expect(dele.reduce((a, b) => a + b)).toBe(100)
  })
})
