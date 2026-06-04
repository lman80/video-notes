import { useEffect, useRef, useState } from 'react'

interface Props {
  initialName: string
  onSave: (name: string) => void
  onClose: () => void
}

export function AuthorModal({ initialName, onSave, onClose }: Props): JSX.Element {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const save = (): void => {
    onSave(name.trim())
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="help-card author-card" onClick={(e) => e.stopPropagation()}>
        <h3>Your name</h3>
        <p className="hint">
          Notes you create are tagged with this name, so collaborators know who wrote them.
        </p>
        <input
          ref={inputRef}
          className="author-input"
          type="text"
          placeholder="e.g. Ashton"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            else if (e.key === 'Escape') onClose()
          }}
        />
        <div className="author-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
