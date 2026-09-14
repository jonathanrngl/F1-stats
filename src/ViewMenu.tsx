import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

/*
 * Auswahl der Ansicht als ausklappbares Menü.
 *
 * Vorher lagen sechs Reiter nebeneinander. Mit Namen wie
 * „Konstrukteurswertung" reichte das am Telefon nur in Kurzform, und selbst
 * am Rechner stand nirgends, was eine Ansicht eigentlich zeigt. Als Menü ist
 * Platz für Gruppen und je eine Zeile Erklärung – und die Schaltfläche nennt
 * immer die Ansicht, in der man gerade steht.
 */

export interface MenuEintrag<T extends string> {
  id: T
  label: string
  hint: string
}

export interface MenuGruppe<T extends string> {
  titel: string
  eintraege: MenuEintrag<T>[]
}

export default function ViewMenu<T extends string>({
  gruppen,
  aktiv,
  onSelect,
}: {
  gruppen: MenuGruppe<T>[]
  aktiv: T
  onSelect: (id: T) => void
}) {
  const [offen, setOffen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const knopf = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const alle = gruppen.flatMap((g) => g.eintraege)
  const aktuell = alle.find((e) => e.id === aktiv)

  // Klick daneben schließt.
  useEffect(() => {
    if (!offen) return
    const zu = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener('pointerdown', zu)
    return () => document.removeEventListener('pointerdown', zu)
  }, [offen])

  // Beim Öffnen auf den aktiven Eintrag springen, damit die Tastatur dort
  // weitermacht, wo der Leser steht.
  useEffect(() => {
    if (!offen) return
    box.current?.querySelector<HTMLButtonElement>('[data-aktiv="true"]')?.focus()
  }, [offen])

  const schliessen = (zurueckZumKnopf = true) => {
    setOffen(false)
    if (zurueckZumKnopf) knopf.current?.focus()
  }

  const waehle = (id: T) => {
    onSelect(id)
    schliessen()
  }

  /** Pfeiltasten wandern durch alle Einträge, über Gruppengrenzen hinweg. */
  const imPanel = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      schliessen()
      e.preventDefault()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const knoepfe = [...(box.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])]
    const i = knoepfe.indexOf(document.activeElement as HTMLButtonElement)
    const naechster = e.key === 'ArrowDown' ? i + 1 : i - 1
    knoepfe[(naechster + knoepfe.length) % knoepfe.length]?.focus()
    e.preventDefault()
  }

  return (
    <div className="viewmenu" ref={box}>
      <button
        type="button"
        ref={knopf}
        className={`menu-knopf${offen ? ' offen' : ''}`}
        aria-expanded={offen}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOffen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !offen) {
            setOffen(true)
            e.preventDefault()
          }
        }}
      >
        <span className="menu-balken" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="menu-text">
          <small>Statistik</small>
          {aktuell?.label ?? 'Auswählen'}
        </span>
        <span className="menu-pfeil" aria-hidden>
          ›
        </span>
      </button>

      {offen && (
        <div className="menu-panel" id={panelId} role="menu" onKeyDown={imPanel}>
          {gruppen.map((g) => (
            <section key={g.titel}>
              <h3>{g.titel}</h3>
              {g.eintraege.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={e.id === aktiv}
                  data-aktiv={e.id === aktiv}
                  className={`menu-item${e.id === aktiv ? ' on' : ''}`}
                  onClick={() => waehle(e.id)}
                >
                  <b>{e.label}</b>
                  <span>{e.hint}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
