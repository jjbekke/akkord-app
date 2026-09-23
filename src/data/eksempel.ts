import type { ProjektData } from '../domain/typer'

// Opdigtet eksempelprojekt indtastet som rå data: timer, antal og satser.
// Navne, satser og mængder er fiktive. Bruges både som eksempeldata i appen
// og som facit i testene (facit er regnet uafhængigt af beregningsmotoren).

export const PROJEKT_ID = 'eksempel'

export function eksempelProjekt(): ProjektData {
  const p = PROJEKT_ID
  return {
    projekt: {
      id: p,
      navn: 'Eksempelprojekt',
      sted: 'Eksempelby',
      periodeStart: '2026-08-17',
      periodeSlut: '2026-09-18',
    },
    brugere: [
      { id: 'a', navn: 'Murer A', email: 'murer.a@eksempel.dk' },
      { id: 'b', navn: 'Murer B', email: 'murer.b@eksempel.dk' },
      { id: 'c', navn: 'Lærling C', email: 'laerling.c@eksempel.dk' },
    ],
    medlemmer: [
      { projektId: p, brugerId: 'a', rolle: 'ejer', timesats: 20000, overskud: { type: 'andel' } },
      { projektId: p, brugerId: 'b', rolle: 'medlem', timesats: 15000, overskud: { type: 'fastPrTime', oerePrTime: 4000 } },
      { projektId: p, brugerId: 'c', rolle: 'medlem', timesats: 9500, overskud: { type: 'andel' } },
    ],
    dage: [{ id: 'd1', projektId: p, dato: '2026-09-18' }],
    timer: [
      { id: 't1', projektId: p, dagId: 'd1', brugerId: 'a', type: 'akkord', timer: 10050 },
      { id: 't2', projektId: p, dagId: 'd1', brugerId: 'b', type: 'akkord', timer: 8025 },
      { id: 't3', projektId: p, dagId: 'd1', brugerId: 'a', type: 'timeloen', timer: 4000, beskrivelse: 'Opstart og stillads' },
      { id: 't4', projektId: p, dagId: 'd1', brugerId: 'b', type: 'timeloen', timer: 2050, beskrivelse: 'Nedrivning af gammel mur' },
      { id: 't5', projektId: p, dagId: 'd1', brugerId: 'c', type: 'timeloen', timer: 1200, beskrivelse: 'Oprydning' },
      { id: 't6', projektId: p, dagId: 'd1', brugerId: 'a', type: 'syg', timer: 750 },
      { id: 't7', projektId: p, dagId: 'd1', brugerId: 'a', type: 'vejrlig', timer: 200 },
      { id: 't8', projektId: p, dagId: 'd1', brugerId: 'b', type: 'vejrlig', timer: 150 },
    ],
    akkordPoster: [
      { id: 'bindere', projektId: p, navn: 'Bindere', enhedspris: 800 },
      { id: 'saalbaenke', projektId: p, navn: 'Sålbænke', enhedspris: 11000 },
      { id: 'overlaegger', projektId: p, navn: 'Overlæggersten', enhedspris: 625 },
      { id: 'stenhoveder', projektId: p, navn: 'Stenhoveder', enhedspris: 45000 },
    ],
    akkordOpgoerelser: [
      { id: 'o1', projektId: p, postId: 'bindere', antal: 5000 },
      { id: 'o2', projektId: p, postId: 'saalbaenke', antal: 3000 },
      { id: 'o3', projektId: p, postId: 'overlaegger', antal: 20000 },
      { id: 'o4', projektId: p, postId: 'stenhoveder', antal: 10000 },
    ],
    justeringer: [],
    noter: [
      {
        id: 'n1',
        projektId: p,
        brugerId: 'a',
        tekst: 'Eksempel: timeløn er opstart, stillads og nedrivning. Husk at registrere én linje pr. person.',
        oprettet: '2026-09-18T16:00:00.000Z',
      },
    ],
  }
}
