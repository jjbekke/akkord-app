import { repo } from '../../data'
import { useHandling, useHent } from '../faelles'
import { ProjektKort } from '../Forside'
import { Fejl, Henter, Ikon, Top } from '../komponenter'

export function Projekter() {
  const { data: projekter, fejl, genindlaes } = useHent(() => repo.hentProjekter(), [])
  const handling = useHandling(genindlaes)

  const aktive = projekter?.filter((p) => !p.afsluttet) ?? []
  const afsluttede = projekter?.filter((p) => p.afsluttet) ?? []

  const raekke = (p: NonNullable<typeof projekter>[number]) => (
    <ProjektKort
      key={p.id}
      p={p}
      knap={
        <button
          className={p.favorit ? 'ikonknap stjerne valgt' : 'ikonknap stjerne'}
          aria-label={p.favorit ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
          aria-pressed={p.favorit}
          onClick={() => handling.koer(() => repo.saetFavorit(p.id, !p.favorit))}
        >
          <Ikon navn="stjerne" fyldt={p.favorit} />
        </button>
      }
    />
  )

  return (
    <main className="side">
      <Top titel="Projekter" tilbage="/" tilbageTekst="AKBOG" />
      <a className="knap primaer" href="#/projekter/ny">
        <Ikon navn="plus" /> Opret projekt
      </a>
      <Fejl tekst={handling.fejl} />

      {!projekter ? (
        <Henter fejl={fejl} />
      ) : (
        <>
          {projekter.length === 0 && <p className="daempet">Du er ikke med i nogen projekter endnu. Opret et, eller bed projektlederen tilføje din e-mail.</p>}
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
