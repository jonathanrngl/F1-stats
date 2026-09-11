import { useEffect, useRef, useState } from 'react'

/*
 * Laden fuer die Ansichten, die erst beim Oeffnen ihres Tabs Daten brauchen.
 *
 * `key` beschreibt, *was* geladen werden soll ('2024/5'); ein leerer Key heisst
 * "jetzt nicht". Der Ladezustand wird daraus abgeleitet statt gesetzt – damit
 * bleibt ein einziges setState im aufgeloesten Promise uebrig, und der
 * Renderlauf startet nicht zweimal.
 *
 * Ein Refetch kostet nichts: die API-Schicht merkt sich jeden Pfad, ein
 * erneuter Tabwechsel greift also auf den Cache zu.
 */
export function useAsync<T>(key: string, load: () => Promise<T>, initial: T) {
  const [state, setState] = useState({ key: '', data: initial, error: '' })
  // Die Ladefunktion wird bei jedem Render neu gebaut; als Ref laeuft der
  // Effekt trotzdem nur, wenn sich der Key aendert.
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!key) return
    let cancelled = false
    loadRef.current()
      .then((data) => !cancelled && setState({ key, data, error: '' }))
      .catch((e: Error) => !cancelled && setState({ key, data: initial, error: e.message }))
    return () => {
      cancelled = true
    }
    // `initial` ist ein Literal aus der Aufrufstelle und darf den Effekt nicht treiben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    data: state.key === key ? state.data : initial,
    error: state.key === key ? state.error : '',
    loading: Boolean(key) && state.key !== key,
  }
}
