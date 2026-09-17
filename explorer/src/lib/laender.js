/*
 * Landesname und IOC-Kuerzel, beide unveraendert aus F1DB.
 *
 * Hier stand frueher eine Tabelle, die englische Demonyme in deutsche
 * Landesnamen uebersetzte ("Argentine" -> "Argentinien"). Die Oberflaeche ist
 * jetzt englisch, und F1DB fuehrt die Laendernamen ohnehin auf Englisch –
 * damit hatte die Tabelle keinen Zweck mehr und ist entfallen. Geblieben ist
 * nur noch das Zusammenstellen der beiden Felder und das Abfangen des
 * fehlenden Werts.
 *
 * Bewusst keine Flaggen-Emoji: Windows liefert keine Schrift fuer
 * Regional-Indicator-Paare, dort stuenden zwei Buchstaben im Kaestchen.
 */

/**
 * Kuerzel und Landesname zu einem Datensatz.
 *
 * Das Demonym wird seit dem Wegfall der Tabelle nicht mehr gelesen; es bleibt
 * als erster Parameter stehen, damit die Aufrufer unveraendert weiterlaufen.
 *
 * Beide Felder duerfen fehlen: Fuer 16 Fahrer des Verzeichnisses – Reserve-
 * und Testfahrer der juengsten Jahre – liefert die API kein Land. Sie
 * bekommen einen leeren Platzhalter statt einer geratenen Herkunft.
 */
export function land(demonym, englischerName, ioc) {
  return {
    code: ioc ?? '—',
    name: englischerName ?? 'Country not recorded',
  }
}
