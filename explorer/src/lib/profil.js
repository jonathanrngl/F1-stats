import { db, alle, eine } from './db.js'
import { land } from './laender.js'
import {
  calculateChampionships, calculateStreaks, calculateTeamMateComparison, driverRaces,
} from '../engine/driver.js'

/**
 * Das Fahrerprofil als reine Daten – Grundlage für die JSON-API und damit für
 * den Vergleich im Browser.
 *
 * Der Zuschnitt folgt einer Überlegung: Ein Vergleich beliebiger Fahrerpaare
 * lässt sich nicht vorrendern (881 Fahrer sind 387.640 Paarungen), und er soll
 * sich nach Zeitraum einschränken lassen. Deshalb liefert die API nicht die
 * fertigen Karrierezahlen, sondern die Summen **je Saison**. Der Client bildet
 * daraus jeden gewünschten Ausschnitt selbst – ohne weitere Anfrage und mit
 * derselben Rechnung wie der Server.
 *
 * Summen statt Mittelwerte: Aus `gridSumme` und `gridRennen` lässt sich der
 * Durchschnitt über jeden Zeitraum bilden, aus fertigen Durchschnitten nicht.
 */
export function fahrerProfil(id) {
  const f = eine(
    `SELECT d.*, c.ioc, c.name AS landName, c.demonym
       FROM driver d LEFT JOIN country c ON c.id = d.nationality_id WHERE d.id = ?`,
    id,
  )
  if (!f) return null

  const rennen = driverRaces(db(), id)
  const titel = calculateChampionships(db(), id)
  const serien = calculateStreaks(rennen)
  const heimat = land(f.demonym, f.landName, f.ioc)

  const wmProJahr = new Map(titel.seasons.map((s) => [s.year, s]))
  const teamNamen = new Map(alle('SELECT id, name FROM constructor').map((t) => [t.id, t.name]))

  const proJahr = new Map()
  for (const r of rennen) {
    const s = proJahr.get(r.year) ?? {
      jahr: r.year,
      nennungen: 0, starts: 0, gewertet: 0, ausfaelle: 0,
      siege: 0, podien: 0, poles: 0, polesGewonnen: 0, vonPlatz1: 0, schnellsteRunden: 0,
      punkte: 0,
      gridSumme: 0, gridRennen: 0,
      zielSumme: 0, zielRennen: 0,
      teams: [],
    }
    s.nennungen++
    s.punkte += r.points ?? 0
    if (r.started) s.starts++
    if (r.qualifying === 1) {
      s.poles++
      // Exakt, nicht geschätzt: Ob aus dieser Pole ein Sieg wurde, steht nur
      // im einzelnen Rennen. Aus Saisonsummen ließe es sich nicht ableiten.
      if (r.position === 1) s.polesGewonnen++
    }
    if (r.grid === 1) s.vonPlatz1++
    if (r.fastestLap) s.schnellsteRunden++
    if (r.started && r.grid !== null) {
      s.gridSumme += r.grid
      s.gridRennen++
    }
    if (r.classified && r.position !== null) {
      s.gewertet++
      s.zielSumme += r.position
      s.zielRennen++
      if (r.position === 1) s.siege++
      if (r.position <= 3) s.podien++
    } else if (r.started) s.ausfaelle++

    const team = teamNamen.get(r.constructorId)
    if (team && !s.teams.includes(team)) s.teams.push(team)
    proJahr.set(r.year, s)
  }

  const saisons = [...proJahr.values()]
    .sort((a, b) => a.jahr - b.jahr)
    .map((s) => {
      const wm = wmProJahr.get(s.jahr)
      return {
        ...s,
        wmPlatz: wm?.position ?? null,
        wmPunkte: wm?.points ?? null,
        meister: wm?.won === 1,
      }
    })

  return {
    id: f.id,
    name: f.display_name,
    kurzname: `${f.first_name} ${f.last_name}`,
    kuerzel: f.abbreviation,
    land: heimat,
    geboren: f.date_of_birth,
    gestorben: f.date_of_death,
    von: rennen.length ? rennen[0].year : null,
    bis: rennen.length ? rennen.at(-1).year : null,
    titel: titel.titles.value ?? 0,
    besterWMPlatz: titel.best.value,
    serien: {
      siege: serien.wins.length,
      podien: serien.podiums.length,
      punkte: serien.points.length,
    },
    saisons,
  }
}

/** Schlanke Liste für die Auswahl im Browser – nur, was die Suche braucht. */
export function fahrerIndex() {
  return alle(`
    SELECT d.id, d.display_name AS name, d.abbreviation AS kuerzel,
           c.ioc AS land, d.date_of_birth AS geboren,
           d.f1db_race_starts AS starts, d.f1db_race_wins AS siege,
           MIN(r.year) AS von, MAX(r.year) AS bis
      FROM driver d
      LEFT JOIN country c ON c.id = d.nationality_id
      LEFT JOIN race_result rr ON rr.driver_id = d.id
      LEFT JOIN race r ON r.id = rr.race_id
     GROUP BY d.id HAVING von IS NOT NULL
     ORDER BY d.f1db_race_wins DESC, d.f1db_race_starts DESC`)
}

/**
 * Teamkollegen-Bilanz eines Fahrers, für den Vergleich zweier Fahrer, die
 * zusammen fuhren. Nur dort ist ein direkter Vergleich wirklich fair.
 */
export function teamkollegen(id) {
  return calculateTeamMateComparison(db(), id).map((d) => ({
    driverId: d.driverId,
    jahre: d.years,
    rennDuelle: d.raceDuels,
    rennSiege: d.raceWins,
    qualiDuelle: d.qualiDuels,
    qualiSiege: d.qualiWins,
    punkteSelbst: d.pointsSelf,
    punkteAndere: d.pointsOther,
  }))
}
