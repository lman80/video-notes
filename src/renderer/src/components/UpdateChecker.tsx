import { useCallback, useEffect, useState } from 'react'

interface CheckResult {
  ok: boolean
  current: string
  latest?: string
  newer?: boolean
  url?: string
  error?: string
}

type Status = 'idle' | 'checking' | 'uptodate' | 'available' | 'error'

export function UpdateChecker(): JSX.Element {
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<CheckResult | null>(null)

  const runCheck = useCallback(async (silent: boolean) => {
    if (!silent) setStatus('checking')
    try {
      const r = await window.api.checkForUpdates()
      setResult(r)
      if (r.current) setVersion(r.current)
      if (!r.ok) setStatus(silent ? 'idle' : 'error')
      else if (r.newer) setStatus('available')
      else setStatus(silent ? 'idle' : 'uptodate')
    } catch {
      setStatus(silent ? 'idle' : 'error')
    }
  }, [])

  useEffect(() => {
    window.api.appVersion().then(setVersion).catch(() => undefined)
    // Quiet check on launch — only surfaces if there's actually an update.
    runCheck(true)
  }, [runCheck])

  return (
    <div className="update-checker">
      <span className="version-label">Video Notes v{version || '…'}</span>
      {status === 'available' && result?.url ? (
        <button className="update-pill" onClick={() => window.api.openExternal(result.url as string)}>
          ⬆ Update available: v{result.latest} — Download
        </button>
      ) : (
        <button
          className="update-link"
          onClick={() => runCheck(false)}
          disabled={status === 'checking'}
        >
          {status === 'checking'
            ? 'Checking…'
            : status === 'uptodate'
              ? "You're up to date ✓"
              : status === 'error'
                ? `${result?.error || 'Check failed'} — retry`
                : 'Check for updates'}
        </button>
      )}
    </div>
  )
}
