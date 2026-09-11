/*
 * Auswahl im URL-Fragment, damit ein Link genau das zeigt, was der Absender
 * gesehen hat: '#2024/5/race' oder '#2024/5/driver/max_verstappen'. Das
 * Fragment statt eines Pfades, weil die Seite statisch ausgeliefert wird und
 * ein Server dafür nichts umschreiben muss – jeder Unterpfad und jeder Hoster
 * funktionieren unverändert.
 */

export interface UrlState {
  season: string
  round: string
  tab: string
  driver: string
}

export function readHash(): Partial<UrlState> {
  const [season, round, tab, driver] = location.hash.replace(/^#\/?/, '').split('/')
  const state: Partial<UrlState> = {}
  if (/^\d{4}$/.test(season ?? '')) state.season = season
  if (/^\d{1,2}$/.test(round ?? '')) state.round = round
  if (/^[a-z]+$/.test(tab ?? '')) state.tab = tab
  // Ergast-Fahrerkennungen sind klein geschrieben und enthalten höchstens
  // Unterstriche: 'hamilton', 'max_verstappen', 'kevin_magnussen'.
  if (/^[a-z0-9_]+$/.test(driver ?? '')) state.driver = driver
  return state
}

export function writeHash({ season, round, tab, driver }: UrlState) {
  if (!season || !round) return
  const next = `#${season}/${round}/${tab}` + (driver ? `/${driver}` : '')
  if (location.hash === next) return
  // replaceState statt location.hash: sonst wächst die History bei jedem
  // Klick, und der Zurück-Knopf führt nur noch durch Zwischenzustände.
  history.replaceState(null, '', next)
}
