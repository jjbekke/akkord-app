import { repo } from '../../data'
import type { Medlem, ProjektData } from '../../domain/typer'
import { gaaTil, useBruger, useHandling, useHent } from '../faelles'
import { Henter, Ikon, Top } from '../komponenter'
import { Indstillinger } from './Indstillinger'
import { RegistrerFane } from './RegistrerFane'
import { RegnskabFane } from './RegnskabFane'
import { TimekalenderFane } from './TimekalenderFane'

const FANER = [
  { id: 'registrer', navn: 'Registrér', ikon: 'registrer' },
  { id: 'kalender', navn: 'Timekalender', ikon: 'kalender' },
  { id: 'regnskab', navn: 'Regnskab', ikon: 'regnskab' },
] as const

/** Det en fane får at arbejde med. */
export interface FaneProps {
  data: ProjektData
  /** Den indloggede brugers medlemsrække */
  mig: Medlem | undefined
  erLeder: boolean
  /** Projektet er afsluttet og derfor skrivebeskyttet */
  laast: boolean
  genindlaes: () => void
}

export function ProjektSide({ projektId, fane = 'registrer' }: { projektId: string; fane?: string }) {
  const bruger = useBruger()
  const { data, fejl, genindlaes } = useHent(() => repo.hentProjektData(projektId), [projektId])
  const favoritter = useHent(() => repo.hentProjekter(), [projektId])
  const favorit = useHandling(favoritter.genindlaes)

  if (!data)
    return (
      <main className="side">
        <Top titel="Projekt" tilbage="/" tilbageTekst="AKBOG" />
        <Henter fejl={fejl} />
      </main>
    )

  const mig = data.medlemmer.find((m) => m.brugerId === bruger.id)
  const erLeder = mig?.rolle === 'projektleder'
  const laast = !!data.projekt.afsluttet
  const props: FaneProps = { data, mig, erLeder, laast, genindlaes }
  const erFavorit = favoritter.data?.find((p) => p.id === projektId)?.favorit ?? false
  const vis = (f: string) => gaaTil(`/projekt/${projektId}/${f}`)

  return (
    <main className="side med-bundnav">
      <Top titel={data.projekt.navn} tilbage="/" tilbageTekst="AKBOG">
        <div className="ikoner">
          <button
            className={erFavorit ? 'ikonknap stjerne valgt' : 'ikonknap stjerne'}
            aria-label={erFavorit ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
            aria-pressed={erFavorit}
            onClick={() => favorit.koer(() => repo.saetFavorit(projektId, !erFavorit))}
          >
            <Ikon navn="stjerne" fyldt={erFavorit} />
          </button>
          {erLeder && (
            <button
              className="ikonknap"
              aria-label="Projektindstillinger"
              aria-pressed={fane === 'indstillinger'}
              onClick={() => vis(fane === 'indstillinger' ? 'registrer' : 'indstillinger')}
            >
              <Ikon navn="tandhjul" />
            </button>
          )}
        </div>
      </Top>

      {laast && <p className="advarsel">Projektet er afsluttet og kan ikke ændres. En projektleder kan genåbne det under Regnskab.</p>}

      <nav className="bundnav" aria-label="Projektfaner">
        {FANER.map((f) => (
          <button key={f.id} aria-current={fane === f.id ? 'page' : undefined} onClick={() => vis(f.id)}>
            <Ikon navn={f.ikon} />
            <span>{f.navn}</span>
          </button>
        ))}
      </nav>

      {fane === 'indstillinger' && erLeder && <h2>Projektindstillinger</h2>}
      {fane === 'kalender' ? (
        <TimekalenderFane {...props} />
      ) : fane === 'regnskab' ? (
        <RegnskabFane {...props} />
      ) : fane === 'indstillinger' && erLeder ? (
        <Indstillinger {...props} />
      ) : (
        <RegistrerFane {...props} />
      )}
    </main>
  )
}
