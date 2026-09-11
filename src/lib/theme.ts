/*
 * Drei Zustände: dem System folgen, hell erzwingen, dunkel erzwingen.
 *
 * Das CSS kennt nur `:root[data-theme='dark']` – deshalb löst JS "System"
 * immer zu einem konkreten Wert auf und setzt das Attribut. So steht die
 * dunkle Palette genau einmal im Stylesheet und muss nicht für Media Query
 * und Umschalter doppelt gepflegt werden. Ein kurzes Inline-Skript in
 * index.html macht dasselbe vor dem ersten Bild, damit nichts hell aufblitzt.
 */
import { useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_KEY = 'f1theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* Privater Modus: dann eben Systemthema. */
  }
  return 'system'
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia(DARK_QUERY).matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  // Die Browserleiste zieht mit, sonst steht ein heller Balken über der
  // dunklen Seite. Denselben Griff macht das Inline-Skript in index.html.
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', dark ? '#0a0a0a' : '#f2f2f0')
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)

  useEffect(() => {
    apply(choice)
    try {
      localStorage.setItem(THEME_KEY, choice)
    } catch {
      /* Nicht speichern zu können darf die Umschaltung nicht verhindern. */
    }
    if (choice !== 'system') return
    // Nur im Systemmodus mitziehen, wenn der Nutzer sein OS umstellt.
    const media = matchMedia(DARK_QUERY)
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [choice])

  return [choice, setChoice] as const
}
