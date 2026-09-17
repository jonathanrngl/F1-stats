/*
 * Nationalitaet -> Laenderkuerzel und englischer Landesname.
 *
 * Bewusst keine Flaggen-Emoji: Windows liefert keine Schrift fuer
 * Regional-Indicator-Paare, dort stuenden statt der Flagge zwei Buchstaben in
 * Kaestchen. Das dreistellige Kuerzel ist ueberall gleich lesbar – und es ist
 * die Schreibweise, die im Motorsport ohnehin benutzt wird.
 *
 * Die API liefert Demonyme in englischer Schreibweise ("Dutch", "Monegasque").
 * Fahrer und Konstrukteure benutzen dabei nicht immer dieselbe Form, deshalb
 * stehen beide Varianten in der Tabelle ("New Zealander" und "New Zealand").
 */
interface Nation {
  code: string
  name: string
}

const NATIONS: Record<string, Nation> = {
  American: { code: 'USA', name: 'USA' },
  'American-Italian': { code: 'USA', name: 'USA / Italy' },
  Argentine: { code: 'ARG', name: 'Argentina' },
  Argentinian: { code: 'ARG', name: 'Argentina' },
  'Argentine-Italian': { code: 'ARG', name: 'Argentina / Italy' },
  Australian: { code: 'AUS', name: 'Australia' },
  Austrian: { code: 'AUT', name: 'Austria' },
  Belgian: { code: 'BEL', name: 'Belgium' },
  Brazilian: { code: 'BRA', name: 'Brazil' },
  British: { code: 'GBR', name: 'Great Britain' },
  Bulgarian: { code: 'BUL', name: 'Bulgaria' },
  Canadian: { code: 'CAN', name: 'Canada' },
  Chilean: { code: 'CHI', name: 'Chile' },
  Chinese: { code: 'CHN', name: 'China' },
  Colombian: { code: 'COL', name: 'Colombia' },
  Czech: { code: 'CZE', name: 'Czech Republic' },
  Danish: { code: 'DEN', name: 'Denmark' },
  Dutch: { code: 'NED', name: 'Netherlands' },
  'East German': { code: 'DDR', name: 'East Germany' },
  Finnish: { code: 'FIN', name: 'Finland' },
  French: { code: 'FRA', name: 'France' },
  German: { code: 'GER', name: 'Germany' },
  'Hong Kong': { code: 'HKG', name: 'Hong Kong' },
  Hungarian: { code: 'HUN', name: 'Hungary' },
  Indian: { code: 'IND', name: 'India' },
  Indonesian: { code: 'INA', name: 'Indonesia' },
  Irish: { code: 'IRL', name: 'Ireland' },
  Israeli: { code: 'ISR', name: 'Israel' },
  Italian: { code: 'ITA', name: 'Italy' },
  Japanese: { code: 'JPN', name: 'Japan' },
  Liechtensteiner: { code: 'LIE', name: 'Liechtenstein' },
  Malaysian: { code: 'MAS', name: 'Malaysia' },
  Mexican: { code: 'MEX', name: 'Mexico' },
  Monegasque: { code: 'MON', name: 'Monaco' },
  'New Zealander': { code: 'NZL', name: 'New Zealand' },
  'New Zealand': { code: 'NZL', name: 'New Zealand' },
  Polish: { code: 'POL', name: 'Poland' },
  Portuguese: { code: 'POR', name: 'Portugal' },
  Rhodesian: { code: 'RHO', name: 'Rhodesia' },
  Russian: { code: 'RUS', name: 'Russia' },
  'South African': { code: 'RSA', name: 'South Africa' },
  Spanish: { code: 'ESP', name: 'Spain' },
  Swedish: { code: 'SWE', name: 'Sweden' },
  Swiss: { code: 'SUI', name: 'Switzerland' },
  Thai: { code: 'THA', name: 'Thailand' },
  Uruguayan: { code: 'URU', name: 'Uruguay' },
  Venezuelan: { code: 'VEN', name: 'Venezuela' },
}

/**
 * Kuerzel und englischer Name; unbekannte Nationalitaet behaelt ihren Text.
 *
 * Das Feld darf fehlen: Fuer 16 Fahrer des Verzeichnisses – Reserve- und
 * Testfahrer der juengsten Jahre – liefert die API kein Land. Sie bekommen
 * einen leeren Platzhalter statt einer geratenen Herkunft.
 */
export function nation(nationality?: string): Nation {
  if (!nationality) return { code: '—', name: 'Country not recorded' }
  return (
    NATIONS[nationality] ?? {
      code: nationality.slice(0, 3).toUpperCase(),
      name: nationality,
    }
  )
}
