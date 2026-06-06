import { useEffect } from 'react'
import { useStore } from './store'
import { Library } from './components/Library'
import { Player } from './components/Player'
import logoUrl from './assets/logo.png'

export default function App(): JSX.Element {
  const loaded = useStore((s) => s.loaded)
  const load = useStore((s) => s.load)
  const currentVideoId = useStore((s) => s.currentVideoId)

  useEffect(() => {
    load()
    document.body.dataset.platform = window.api?.platform || ''
  }, [load])

  if (!loaded) {
    return (
      <div className="boot">
        <img className="boot-logo" src={logoUrl} alt="Video Notes" />
        <p>Loading your library…</p>
      </div>
    )
  }

  return currentVideoId ? <Player /> : <Library />
}
