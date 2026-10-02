// Små fælles komponenter.

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
            ‹ {tilbageTekst ?? 'Tilbage'}
          </a>
        )}
        <h1>{titel}</h1>
      </div>
      {children}
    </header>
  )
}
