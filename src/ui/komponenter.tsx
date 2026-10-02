// Små fælles komponenter.

// Streg-ikoner (stier fra Feather, MIT-licens) — ingen ekstra afhængigheder.
const IKONER = {
  tilbage: 'M15 18l-6-6 6-6',
  frem: 'M9 18l6-6-6-6',
  registrer: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  kalender: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  regnskab: 'M4 2v20l2.67-2 2.66 2L12 20l2.67 2 2.66-2L20 22V2l-2.67 2-2.66-2L12 4 9.33 2 6.67 4zM8 9h8M8 13h8M8 17h4',
  projekter: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  personer:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  materialer:
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7 12 12l8.7-5M12 22V12',
  stjerne: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  luk: 'M18 6 6 18M6 6l12 12',
  ud: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  tandhjul:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
} as const

export type IkonNavn = keyof typeof IKONER

export function Ikon({ navn, fyldt, str = 22 }: { navn: IkonNavn; fyldt?: boolean; str?: number }) {
  return (
    <svg
      className="ikon-svg"
      width={str}
      height={str}
      viewBox="0 0 24 24"
      fill={fyldt ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={IKONER[navn]} />
    </svg>
  )
}

export function Fejl({ tekst }: { tekst: string }) {
  return tekst ? (
    <p className="fejl" role="alert">
      {tekst}
    </p>
  ) : null
}

export function Henter({ fejl }: { fejl?: string }) {
  return fejl ? <Fejl tekst={fejl} /> : <p className="daempet">Henter…</p>
}

/** Sidehoved med tilbage-link. */
export function Top({ titel, tilbage, tilbageTekst, children }: { titel: string; tilbage?: string; tilbageTekst?: string; children?: React.ReactNode }) {
  return (
    <header className="top">
      <div className="top-titel">
        {tilbage && (
          <a className="tilbage" href={`#${tilbage}`}>
            <Ikon navn="tilbage" str={18} />
            {tilbageTekst ?? 'Tilbage'}
          </a>
        )}
        <h1>{titel}</h1>
      </div>
      {children}
    </header>
  )
}
