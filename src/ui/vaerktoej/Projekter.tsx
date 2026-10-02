import { repo } from '../../data'
import { datoKort, useHandling, useHent } from '../faelles'
import { Fejl, Henter, Top } from '../komponenter'

export function Projekter() {
  const { data: projekter, fejl, genindlaes } = useHent(() => repo.hentProjekter(), [])
  const handling = useHandling(genindlaes)

  const aktive = projekter?.filter((p) => !p.afsluttet) ?? []
  const afsluttede = projekter?.filter((p) => p.afsluttet) ?? []

  const raekke = (p: NonNullable<typeof projekter>[number]) => (
    <div key={p.id} className="projektraekke">
      <button
        className="stjerne"
        aria-label={p.favorit ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
        aria-pressed={p.favorit}
        onClick={() => handling.koer(() => repo.saetFavorit(p.id, !p.favorit))}
      >
        {p.favorit ? '★' : '☆'}
      </button>
      <a className="stor projekt" href={`#/projekt/${p.id}`}>
        <strong>{p.navn}</strong>
        <span className="daempet lille">
          {p.rolle === 'projektleder' ? 'Projektleder' : 'Medlem'} · oprettet {datoKort(p.oprettet)}
          {p.afsluttet && ` · afsluttet ${datoKort(p.afsluttet)}`}
        </span>
      </a>
    </div>
  )

  return (
    <main className="side">
      <Top titel="Projekter" tilbage="/" tilbageTekst="AKBOG" />
      <a className="knap primaer" href="#/projekter/ny">
        + Opret projekt
      </a>
      <Fejl tekst={handling.fejl} />

      {!projekter ? (
        <Henter fejl={fejl} />
      ) : (
        <>
          {projekter.length === 0 && <p className="daempet">Du er ikke med i nogen projekter endnu.</p>}
          <div className="stak">{aktive.map(raekke)}</div>
          {afsluttede.length > 0 && (
            <>
              <h2>Afsluttede</h2>
              <div className="stak">{afsluttede.map(raekke)}</div>
            </>
          )}
        </>
      )}
    </main>
  )
}
