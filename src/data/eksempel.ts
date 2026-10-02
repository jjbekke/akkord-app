import type { ProjektData } from '../domain/typer.ts'

// Akkordregnskabet fra Viby (17/8–18/9) indtastet som rå data: timer, antal og satser.
// Timerne er samlet på én dag, fordi den oprindelige opgørelse kun har totaler.
// Bruges som facit i testene.

export const PROJEKT_ID = 'viby'

export function vibyEksempel(): ProjektData {
  const p = PROJEKT_ID
  const dato = '2026-09-18'
  return {
    projekt: { id: p, navn: 'Viby', oprettet: '2026-08-17T07:00:00.000Z' },
    medlemmer: [
      { id: 'asbjoern', projektId: p, navn: 'Asbjørn', rolle: 'projektleder', timesats: 21000 },
      { id: 'jeppe', projektId: p, navn: 'Jeppe', rolle: 'medlem', timesats: 10850, overskudPrTime: 5000 },
      { id: 'oliver', projektId: p, navn: 'Oliver', rolle: 'medlem', timesats: 8940 },
    ],
    timer: [
      { id: 't1', projektId: p, medlemId: 'asbjoern', dato, type: 'akkord', timer: 12850 },
      { id: 't2', projektId: p, medlemId: 'jeppe', dato, type: 'akkord', timer: 9060 },
      { id: 't3', projektId: p, medlemId: 'asbjoern', dato, type: 'timeloen', timer: 4750, beskrivelse: 'Mur væg op ved Dennis, opstart, platform, rens, pap' },
      { id: 't4', projektId: p, medlemId: 'jeppe', dato, type: 'timeloen', timer: 2750, beskrivelse: 'Mur væg op ved Dennis m.m.' },
      { id: 't5', projektId: p, medlemId: 'oliver', dato, type: 'timeloen', timer: 800 },
      { id: 't6', projektId: p, medlemId: 'asbjoern', dato, type: 'syg', timer: 800 },
      { id: 't7', projektId: p, medlemId: 'asbjoern', dato, type: 'vejrlig', timer: 100 },
      { id: 't8', projektId: p, medlemId: 'jeppe', dato, type: 'vejrlig', timer: 100 },
    ],
    materialer: [
      { id: 'bindere', projektId: p, navn: 'Bindere', stykpris: 800 },
      { id: 'saalbaenke', projektId: p, navn: 'Sålbænke', stykpris: 10000 },
      { id: 'overlaegger', projektId: p, navn: 'Overlæggersten', stykpris: 590 },
      { id: 'stenhoveder', projektId: p, navn: 'Stenhoveder', stykpris: 47200 },
    ],
    materialeRegistreringer: [
      { id: 'a1', projektId: p, projektMaterialeId: 'bindere', dato, antal: 6600 },
      { id: 'a2', projektId: p, projektMaterialeId: 'saalbaenke', dato, antal: 4100 },
      { id: 'a3', projektId: p, projektMaterialeId: 'overlaegger', dato, antal: 23200 },
      { id: 'a4', projektId: p, projektMaterialeId: 'stenhoveder', dato, antal: 13500 },
    ],
    justeringer: [],
    noter: [
      {
        id: 'n1',
        projektId: p,
        dato,
        tekst: 'Timeløn: Mur væg op ved Dennis 26 timer (Asbjørn og Jeppe). Resten er opstart, flytning af platform, rens murværk ned, pap.',
        oprettet: '2026-09-18T16:00:00.000Z',
      },
    ],
    filer: [],
  }
}
