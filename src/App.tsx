import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { repo } from './data'
import { supabase } from './data/supabase'
import type { Profil } from './domain/typer'
import { Adgang, NyAdgangskode } from './ui/Adgang'
import { BrugerKontekst, useRute } from './ui/faelles'
import { Henter } from './ui/komponenter'
import { Forside } from './ui/Forside'
import { ProjektSide } from './ui/projekt/ProjektSide'
import { Materialepriser } from './ui/vaerktoej/Materialepriser'
import { OpretProjekt } from './ui/vaerktoej/OpretProjekt'
import { Personer } from './ui/vaerktoej/Personer'
import { Projekter } from './ui/vaerktoej/Projekter'

export default function App() {
  // undefined = vi ved det ikke endnu; null = ikke logget ind
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [nyKode, setNyKode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((haendelse, s) => {
      setSession(s)
      if (haendelse === 'PASSWORD_RECOVERY') setNyKode(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <main className="side daempet">Henter…</main>
  if (nyKode) return <NyAdgangskode faerdig={() => setNyKode(false)} />
  if (!session) return <Adgang />
  return <IndloggetApp brugerId={session.user.id} />
}

function IndloggetApp({ brugerId }: { brugerId: string }) {
  const [profil, setProfil] = useState<Profil | null>(null)
  const [fejl, setFejl] = useState('')
  const rute = useRute()

  useEffect(() => {
    repo.hentProfil().then(setProfil, (e: Error) => setFejl(e.message))
  }, [brugerId])

  if (!profil)
    return (
      <main className="side">
        <Henter fejl={fejl} />
      </main>
    )

  const dele = rute.split('/').filter(Boolean)
  let side: React.ReactNode
  if (dele[0] === 'projekter' && dele[1] === 'ny') side = <OpretProjekt />
  else if (dele[0] === 'projekter') side = <Projekter />
  else if (dele[0] === 'personer') side = <Personer />
  else if (dele[0] === 'materialer') side = <Materialepriser />
  else if (dele[0] === 'projekt' && dele[1]) side = <ProjektSide key={dele[1]} projektId={dele[1]} fane={dele[2]} />
  else side = <Forside />

  return <BrugerKontekst.Provider value={profil}>{side}</BrugerKontekst.Provider>
}
