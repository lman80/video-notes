import { useEffect } from 'react'
import { useStore } from './store'
import { Library } from './components/Library'
import { Player } from './components/Player'

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
        <div className="boot-logo">●</div>
        <p>Loading your library…</p>
      </div>
    )
  }

  return currentVideoId ? <Player /> : <Library />
}
