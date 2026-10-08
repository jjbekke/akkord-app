import type { SatsTekst } from './satser'

/** Timesats + akkord-, syge- og vejrligsats. De sidste tre er "som timesats", når de er tomme. */
export function SatsFelter({ vaerdi, aendr }: { vaerdi: SatsTekst; aendr: (v: SatsTekst) => void }) {
  const felt = (noegle: keyof SatsTekst, navn: string) => (
    <label>
      {navn}
      <input
        inputMode="decimal"
        placeholder={noegle === 'timesats' ? '210,00' : vaerdi.timesats || 'Samme'}
        value={vaerdi[noegle]}
        onChange={(e) => aendr({ ...vaerdi, [noegle]: e.target.value })}
      />
    </label>
  )

  return (
    <div className="stak">
      {felt('timesats', 'Timesats (kr.)')}
      <div className="satser">
        {felt('akkordsats', 'Akkord')}
        {felt('sygsats', 'Syg')}
        {felt('vejrligsats', 'Vejrlig')}
      </div>
      <p className="daempet lille">Tomme felter er det samme som timesatsen.</p>
    </div>
  )
}
