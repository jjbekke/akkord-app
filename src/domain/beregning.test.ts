import { describe, expect, it } from 'vitest'
import { eksempelProjekt } from '../data/eksempel'
import { beregnLoen } from './beregning'
import { fordelEfterVaegt, gange, laesCenti } from './tal'

const person = <T extends { brugerId: string }>(liste: T[], id: string) =>
  liste.find((p) => p.brugerId === id)!

describe('eksempelprojektet (facit regnet uafhængigt)', () => {
  const r = beregnLoen(eksempelProjekt())

  it('akkordarbejdet', () => {
    expect(r.akkord.linjer.map((l) => l.beloeb)).toEqual([40000, 330000, 125000, 4500000])
    expect(r.akkord.akkordsum).toBe(4995000)
  })

  it('akkordløn og overskud', () => {
    expect(r.akkord.akkordtimer).toBe(18075)
    expect(r.akkord.akkordloen).toBe(3213750)
    expect(r.akkord.overskud).toBe(1781250)

    // A har "andel" og får resten efter B's faste beløb
    expect(person(r.akkord.personer, 'a')).toMatchObject({ akkordloen: 2010000, overskud: 1460250, iAlt: 3470250, krPrAkkordtime: 34530 })
    // B får fast 40 kr. pr. akkordtime: 80,25 × 40 = 3.210,00
    expect(person(r.akkord.personer, 'b')).toMatchObject({ akkordloen: 1203750, overskud: 321000, iAlt: 1524750, krPrAkkordtime: 19000 })
  })

  it('kr./akkordtime i alt', () => {
    expect(r.akkord.krPrAkkordtime).toBe(27635)
  })

  it('timeløn', () => {
    expect(person(r.timeloen.personer, 'a')).toMatchObject({ timeloen: 800000, syg: 150000, vejrlig: 40000, iAlt: 990000 })
    expect(person(r.timeloen.personer, 'b')).toMatchObject({ timeloen: 307500, syg: 0, vejrlig: 22500, iAlt: 330000 })
    expect(person(r.timeloen.personer, 'c')).toMatchObject({ timeloen: 114000, iAlt: 114000 })
    expect(r.timeloen).toMatchObject({ timeloen: 1221500, syg: 150000, vejrlig: 62500, iAlt: 1434000 })
  })

  it('samlet løn pr. person', () => {
    expect(person(r.personer, 'a').iAlt).toBe(4460250)
    expect(person(r.personer, 'b').iAlt).toBe(1854750)
    expect(person(r.personer, 'c').iAlt).toBe(114000)
    expect(r.total.iAlt).toBe(6429000)
    expect(r.advarsler).toEqual([])
  })

  it('justeringer lægges oven i det beregnede', () => {
    const data = eksempelProjekt()
    data.justeringer.push({
      id: 'j1', projektId: data.projekt.id, brugerId: 'c', beloeb: 10000,
      begrundelse: 'Kørsel', oprettetAf: 'a', oprettet: '2026-09-20',
    })
    const c = person(beregnLoen(data).personer, 'c')
    expect(c).toMatchObject({ beregnet: 114000, justeringer: 10000, iAlt: 124000 })
  })
})

describe('advarsler', () => {
  it('underskud på akkorden', () => {
    const data = eksempelProjekt()
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
