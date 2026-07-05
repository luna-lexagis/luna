import { useState } from 'react'
import { useSession } from './lib/useSession'
import { Login } from './screens/Login'
import { Library } from './screens/Library'
import { CaseView } from './screens/CaseView'

export default function App() {
  const session = useSession()
  const [openId, setOpenId] = useState<string | null>(null)

  if (session === undefined) return <div style={{ padding: 24 }}>Cargando…</div>
  if (session === null) return <Login />
  return openId
    ? <CaseView id={openId} onBack={() => setOpenId(null)} />
    : <Library onOpen={setOpenId} />
}
