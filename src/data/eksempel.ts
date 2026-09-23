import type { ProjektData } from '../domain/typer'

// Akkordregnskabet fra Viby (17/8–18/9) indtastet som rå data: timer, antal og satser.
// Timerne er samlet på én dag, fordi den oprindelige opgørelse kun har totaler.
// Bruges både som eksempeldata i appen og som facit i testene.

export const PROJEKT_ID = 'viby'

export function vibyEksempel(): ProjektData {
  const p = PROJEKT_ID
  return {
    projekt: {
      id: p,
      navn: 'Viby',
      sted: 'Viby',
      periodeStart: '2026-08-17',
      periodeSlut: '2026-09-18',
    },
    brugere: [
      { id: 'asbjoern', navn: 'Asbjørn', email: 'asbjoern@eksempel.dk' },
      { id: 'jeppe', navn: 'Jeppe', email: 'jeppe@eksempel.dk' },
      { id: 'oliver', navn: 'Oliver', email: 'oliver@eksempel.dk' },
    ],
    medlemmer: [
      { projektId: p, brugerId: 'asbjoern', rolle: 'ejer', timesats: 21000, overskud: { type: 'andel' } },
      {
        projektId: p,
        brugerId: 'jeppe',
        rolle: 'medlem',
        timesats: 10850,
        overskud: { type: 'fastPrTime', oerePrTime: 5000 },
      },
      { projektId: p, brugerId: 'oliver', rolle: 'medlem', timesats: 8940, overskud: { type: 'andel' } },
    ],
    dage: [{ id: 'd1', projektId: p, dato: '2026-09-18' }],
    timer: [
      { id: 't1', projektId: p, dagId: 'd1', brugerId: 'asbjoern', type: 'akkord', timer: 12850 },
      { id: 't2', projektId: p, dagId: 'd1', brugerId: 'jeppe', type: 'akkord', timer: 9060 },
      { id: 't3', projektId: p, dagId: 'd1', brugerId: 'asbjoern', type: 'timeloen', timer: 4750, beskrivelse: 'Mur væg op ved Dennis, opstart, platform, rens, pap' },
      { id: 't4', projektId: p, dagId: 'd1', brugerId: 'jeppe', type: 'timeloen', timer: 2750, beskrivelse: 'Mur væg op ved Dennis m.m.' },
      { id: 't5', projektId: p, dagId: 'd1', brugerId: 'oliver', type: 'timeloen', timer: 800 },
      { id: 't6', projektId: p, dagId: 'd1', brugerId: 'asbjoern', type: 'syg', timer: 800 },
      { id: 't7', projektId: p, dagId: 'd1', brugerId: 'asbjoern', type: 'vejrlig', timer: 100 },
      { id: 't8', projektId: p, dagId: 'd1', brugerId: 'jeppe', type: 'vejrlig', timer: 100 },
    ],
    akkordPoster: [
      { id: 'bindere', projektId: p, navn: 'Bindere', enhedspris: 800 },
      { id: 'saalbaenke', projektId: p, navn: 'Sålbænke', enhedspris: 10000 },
      { id: 'overlaegger', projektId: p, navn: 'Overlæggersten', enhedspris: 590 },
      { id: 'stenhoveder', projektId: p, navn: 'Stenhoveder', enhedspris: 47200 },
    ],
    akkordOpgoerelser: [
      { id: 'a1', projektId: p, postId: 'bindere', antal: 6600 },
      { id: 'a2', projektId: p, postId: 'saalbaenke', antal: 4100 },
      { id: 'a3', projektId: p, postId: 'overlaegger', antal: 23200 },
      { id: 'a4', projektId: p, postId: 'stenhoveder', antal: 13500 },
    ],
    justeringer: [],
    noter: [
      {
        id: 'n1',
        projektId: p,
        brugerId: 'asbjoern',
        tekst: 'Timeløn: Mur væg op ved Dennis 26 timer (Asbjørn og Jeppe). Resten er opstart, flytning af platform, rens murværk ned, pap.',
        oprettet: '2026-09-18T16:00:00.000Z',
      },
    ],
  }
}
