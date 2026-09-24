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

/*
 * Derselbe Schlüssel wie im Explorer (explorer/src/lib/modus.js): Beide liegen
 * auf derselben Domain, und wer auf der einen Seite dunkel gewählt hat, soll
 * auf der anderen nicht wieder hell landen. Gespeichert wird nur „light" oder
 * „dark"; ohne Eintrag gilt das System. Der frühere Schlüssel wird noch
 * gelesen, damit eine alte Wahl nicht verloren geht.
 */
const KEY = 'modus'
const ALT = 'f1:theme'
const OPTIONS: { id: Theme; label: string; title: string }[] = [
  { id: 'light', label: 'Light', title: 'Light appearance' },
  { id: 'dark', label: 'Dark', title: 'Dark appearance' },
  { id: 'system', label: 'Auto', title: 'Follow the system setting' },
]

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY) ?? localStorage.getItem(ALT)
    if (value === 'light' || value === 'dark') return value
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
      if (theme === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, theme)
      localStorage.removeItem(ALT)
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
