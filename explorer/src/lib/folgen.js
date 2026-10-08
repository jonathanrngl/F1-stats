/**
 * Wem der Besucher folgt – Fahrer und Teams, nur in seinem Browser.
 *
 * Kein Konto und kein Server: Die Liste liegt in localStorage und verlässt
 * den Rechner nie. Der Zugriff kann scheitern (privates Fenster, gesperrte
 * Website-Daten); dann folgt man eben niemandem, und nichts bricht.
 *
 *   { f: ['max-verstappen', …], t: ['ferrari', …] }
 */
const SCHLUESSEL = 'f1-folgen'
const LEER = { f: [], t: [] }
/** Mehr zeigt die Startseite nicht; jede weitere Kachel wäre eine Anfrage mehr. */
export const HOECHSTENS = 12

export function lies() {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null')
    if (!roh || typeof roh !== 'object') return { ...LEER }
    // Nur Kennungen, wie sie in Adressen stehen – was sonst darin steht, kam nicht von hier.
    const sauber = (l) => (Array.isArray(l) ? l.filter((x) => typeof x === 'string' && /^[a-z0-9-]+$/.test(x)) : [])
    return { f: sauber(roh.f), t: sauber(roh.t) }
  } catch {
    return { ...LEER }
  }
}

function schreibe(liste) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(liste))
    return true
  } catch {
    return false
  }
}

/** `art` ist 'f' (Fahrer) oder 't' (Team). */
export const folgt = (art, id) => lies()[art].includes(id)

/** Folgen oder nicht mehr folgen. Gibt den neuen Zustand zurück, oder null, wenn nicht gespeichert werden konnte. */
export function umschalten(art, id) {
  const liste = lies()
  const jetzt = !liste[art].includes(id)
  liste[art] = jetzt ? [...liste[art], id].slice(-HOECHSTENS) : liste[art].filter((x) => x !== id)
  return schreibe(liste) ? jetzt : null
}
