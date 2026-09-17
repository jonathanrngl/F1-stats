import { useEffect, useState } from 'react'

/*
 * Hell, dunkel oder das, was das System vorgibt.
 *
 * Ohne eigene Wahl bleibt es bei `prefers-color-scheme` – das ist der richtige
 * Anfangszustand, aber nicht immer der gewünschte: am Telefon steht das System
 * abends auf dunkel, und wer die Seite bei Tageslicht liest, will sie hell.
 * Die Wahl steht als `data-theme` am Wurzelelement; die Tokens in index.css
 * hören auf beides, Attribut wie Medienabfrage.
 */
type Theme = 'system' | 'light' | 'dark'

const KEY = 'f1:theme'
const OPTIONS: { id: Theme; label: string; title: string }[] = [
  { id: 'light', label: 'Light', title: 'Light appearance' },
  { id: 'dark', label: 'Dark', title: 'Dark appearance' },
  { id: 'system', label: 'Auto', title: 'Follow the system setting' },
]

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* Privater Modus oder gesperrter Speicher: dann eben die Vorgabe. */
  }
  return 'system'
}

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(stored)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = theme
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* Die Wahl gilt dann nur für diesen Besuch. */
    }
  }, [theme])

  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={theme === o.id}
          title={o.title}
          className={theme === o.id ? 'on' : ''}
          onClick={() => setTheme(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
