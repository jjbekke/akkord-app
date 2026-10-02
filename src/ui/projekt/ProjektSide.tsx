import { repo } from '../../data'
import type { Medlem, ProjektData } from '../../domain/typer'
import { gaaTil, useBruger, useHandling, useHent } from '../faelles'
import { Henter, Top } from '../komponenter'
import { Indstillinger } from './Indstillinger'
import { RegistrerFane } from './RegistrerFane'
import { RegnskabFane } from './RegnskabFane'
import { TimekalenderFane } from './TimekalenderFane'

const FANER = [
  { id: 'registrer', navn: 'Registrér' },
  { id: 'kalender', navn: 'Timekalender' },
  { id: 'regnskab', navn: 'Regnskab' },
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
    <main className="side">
      <Top titel={data.projekt.navn} tilbage="/" tilbageTekst="AKBOG">
        <div className="ikoner">
          <button
            className="stjerne"
            aria-label={erFavorit ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
            aria-pressed={erFavorit}
            onClick={() => favorit.koer(() => repo.saetFavorit(projektId, !erFavorit))}
          >
            {erFavorit ? '★' : '☆'}
          </button>
          {erLeder && (
            <button
              className="ikon"
              aria-label="Projektindstillinger"
              aria-pressed={fane === 'indstillinger'}
              onClick={() => vis(fane === 'indstillinger' ? 'registrer' : 'indstillinger')}
            >
              ⚙
            </button>
          )}
        </div>
      </Top>

      {laast && <p className="advarsel">Projektet er afsluttet og kan ikke ændres. En projektleder kan genåbne det under Regnskab.</p>}

      <nav className="faner">
        {FANER.map((f) => (
          <button key={f.id} aria-pressed={fane === f.id} onClick={() => vis(f.id)}>
            {f.navn}
          </button>
        ))}
      </nav>

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
