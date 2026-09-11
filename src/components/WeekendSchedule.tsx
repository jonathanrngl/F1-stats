import type { Race, SessionTime } from '../api/jolpica'
import { clockTime, localZone, sessionDateTime, weekdayDate } from '../lib/format'

/*
 * Der Ablauf eines Rennwochenendes: jede Session mit Tag und Uhrzeit.
 *
 * Wichtig und leider nicht zu aendern: Ergebnisse liefert diese Datenquelle
 * nur fuer Qualifying, Sprint und Rennen. Fuer die freien Trainings gibt es in
 * der Ergast-Schnittstelle keinen Endpunkt – es existieren dort weder
 * Rundenzeiten noch eine Reihenfolge. Die Ansicht sagt das an der Session, wo
 * es auffaellt, statt eine leere Tabelle anzubieten.
 *
 * Ein Sprintwochenende hat nur ein freies Training und dafuer eine
 * Sprint-Qualifikation; die Liste richtet sich deshalb nach dem, was im
 * Kalender steht, und nicht nach einem festen Schema.
 */

type ResultTab = 'qualifying' | 'race'

interface Slot {
  key: string
  label: string
  badge: string
  at: Date
  hasTime: boolean
  /** Tab, in dem das Ergebnis dieser Session steht – falls es eines gibt. */
  results?: ResultTab
  /** Warum es kein Ergebnis gibt, wenn keines existiert. */
  missing?: string
}

const NO_PRACTICE_DATA = 'Keine Ergebnisse in der Datenquelle'

const ORDER: { key: keyof Race; label: string; badge: string; results?: ResultTab }[] = [
  { key: 'FirstPractice', label: '1. Freies Training', badge: 'FP1' },
  { key: 'SecondPractice', label: '2. Freies Training', badge: 'FP2' },
  { key: 'ThirdPractice', label: '3. Freies Training', badge: 'FP3' },
  { key: 'SprintQualifying', label: 'Sprint-Qualifikation', badge: 'SQ' },
  { key: 'Sprint', label: 'Sprint', badge: 'SR', results: 'race' },
  { key: 'Qualifying', label: 'Qualifying', badge: 'Q', results: 'qualifying' },
]

export default function WeekendSchedule({
  race,
  onOpen,
}: {
  race: Race
  onOpen: (tab: ResultTab) => void
}) {
  const slots: Slot[] = []

  for (const entry of ORDER) {
    const session = race[entry.key] as SessionTime | undefined
    if (!session?.date) continue
    slots.push({
      key: String(entry.key),
      label: entry.label,
      badge: entry.badge,
      at: sessionDateTime(session),
      hasTime: Boolean(session.time),
      results: entry.results,
      missing: entry.results ? undefined : NO_PRACTICE_DATA,
    })
  }

  slots.push({
    key: 'race',
    label: 'Rennen',
    badge: 'GP',
    at: sessionDateTime({ date: race.date, time: race.time }),
    hasTime: Boolean(race.time),
    results: 'race',
  })

  slots.sort((a, b) => a.at.getTime() - b.at.getTime())

  const zone = localZone()
  const withTimes = slots.some((s) => s.hasTime)

  // Nach Tag gruppieren, in der Zeitzone des Lesers – so steht ein Rennen in
  // Übersee unter dem Tag, an dem es hier zu sehen ist.
  const days: { day: string; slots: Slot[] }[] = []
  for (const slot of slots) {
    const day = weekdayDate(slot.at)
    const last = days.at(-1)
    if (last?.day === day) last.slots.push(slot)
    else days.push({ day, slots: [slot] })
  }

  return (
    <div className="weekend">
      <p className="section-note">
        {race.raceName} {race.season} · {race.Circuit.circuitName}
        {withTimes && zone && <> · Uhrzeiten in deiner Zeitzone ({zone})</>}
      </p>

      {days.map(({ day, slots: daySlots }, dayIndex) => (
        <section key={day} className="weekend-day" style={{ '--i': dayIndex } as React.CSSProperties}>
          <h3>{day}</h3>
          <ul>
            {daySlots.map((slot) => (
              <li key={slot.key} className={slot.results ? 'has-results' : ''}>
                <span className="slot-badge">{slot.badge}</span>
                <span className="slot-label">{slot.label}</span>
                <span className="slot-time">
                  {slot.hasTime ? clockTime(slot.at) : <span className="muted-cell">—</span>}
                </span>
                {slot.results ? (
                  <button type="button" className="slot-link" onClick={() => onOpen(slot.results!)}>
                    Ergebnis ansehen
                  </button>
                ) : (
                  <span className="slot-note">{slot.missing}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Bei alten Saisons steht im Kalender nur das Renndatum. Dann wäre der
          Hinweis auf fehlende Trainingsergebnisse irreführend – es fehlt schon
          der Termin, nicht erst das Ergebnis. */}
      {slots.length > 1 ? (
        <p className="data-note">
          <strong>Warum keine Trainingszeiten?</strong> Die Jolpica-Schnittstelle führt
          Rundenzeiten und Klassierungen nur für Qualifying, Sprint und Rennen. Für die freien
          Trainings sind dort keine Ergebnisse hinterlegt – die Termine oben stammen aus dem
          Rennkalender, die Zeiten selbst gibt es in dieser Quelle nicht.
        </p>
      ) : (
        <p className="data-note">
          <strong>Nur das Renndatum.</strong> Für diese Saison führt der Rennkalender keine
          einzelnen Session-Termine. Sie stehen in den Daten erst für die neueren Jahrgänge.
        </p>
      )}
    </div>
  )
}
