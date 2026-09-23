import { kr } from '../domain/tal'

/** Én linje "label ........ beløb" — mobilvenlig erstatning for brede tabeller. */
export function Tal({ label, vaerdi, tekst, fed }: { label: string; vaerdi?: number; tekst?: string; fed?: boolean }) {
  return (
    <div className={fed ? 'tallinje fed' : 'tallinje'}>
      <span>{label}</span>
      <span className="tal">{tekst ?? (vaerdi === undefined || vaerdi === 0 ? '–' : kr(vaerdi))}</span>
    </div>
  )
}
