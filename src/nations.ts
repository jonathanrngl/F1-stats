/*
 * Nationalitaet -> Laenderkuerzel und deutscher Landesname.
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
  'American-Italian': { code: 'USA', name: 'USA / Italien' },
  Argentine: { code: 'ARG', name: 'Argentinien' },
  Argentinian: { code: 'ARG', name: 'Argentinien' },
  'Argentine-Italian': { code: 'ARG', name: 'Argentinien / Italien' },
  Australian: { code: 'AUS', name: 'Australien' },
  Austrian: { code: 'AUT', name: 'Österreich' },
  Belgian: { code: 'BEL', name: 'Belgien' },
  Brazilian: { code: 'BRA', name: 'Brasilien' },
  British: { code: 'GBR', name: 'Großbritannien' },
  Bulgarian: { code: 'BUL', name: 'Bulgarien' },
  Canadian: { code: 'CAN', name: 'Kanada' },
  Chilean: { code: 'CHI', name: 'Chile' },
  Chinese: { code: 'CHN', name: 'China' },
  Colombian: { code: 'COL', name: 'Kolumbien' },
  Czech: { code: 'CZE', name: 'Tschechien' },
  Danish: { code: 'DEN', name: 'Dänemark' },
  Dutch: { code: 'NED', name: 'Niederlande' },
  'East German': { code: 'DDR', name: 'DDR' },
  Finnish: { code: 'FIN', name: 'Finnland' },
  French: { code: 'FRA', name: 'Frankreich' },
  German: { code: 'GER', name: 'Deutschland' },
  'Hong Kong': { code: 'HKG', name: 'Hongkong' },
  Hungarian: { code: 'HUN', name: 'Ungarn' },
  Indian: { code: 'IND', name: 'Indien' },
  Indonesian: { code: 'INA', name: 'Indonesien' },
  Irish: { code: 'IRL', name: 'Irland' },
  Israeli: { code: 'ISR', name: 'Israel' },
  Italian: { code: 'ITA', name: 'Italien' },
  Japanese: { code: 'JPN', name: 'Japan' },
  Liechtensteiner: { code: 'LIE', name: 'Liechtenstein' },
  Malaysian: { code: 'MAS', name: 'Malaysia' },
  Mexican: { code: 'MEX', name: 'Mexiko' },
  Monegasque: { code: 'MON', name: 'Monaco' },
  'New Zealander': { code: 'NZL', name: 'Neuseeland' },
  'New Zealand': { code: 'NZL', name: 'Neuseeland' },
  Polish: { code: 'POL', name: 'Polen' },
  Portuguese: { code: 'POR', name: 'Portugal' },
  Rhodesian: { code: 'RHO', name: 'Rhodesien' },
  Russian: { code: 'RUS', name: 'Russland' },
  'South African': { code: 'RSA', name: 'Südafrika' },
  Spanish: { code: 'ESP', name: 'Spanien' },
  Swedish: { code: 'SWE', name: 'Schweden' },
  Swiss: { code: 'SUI', name: 'Schweiz' },
  Thai: { code: 'THA', name: 'Thailand' },
  Uruguayan: { code: 'URU', name: 'Uruguay' },
  Venezuelan: { code: 'VEN', name: 'Venezuela' },
}

/**
 * Kuerzel und deutscher Name; unbekannte Nationalitaet behaelt ihren Text.
 *
 * Das Feld darf fehlen: Fuer 16 Fahrer des Verzeichnisses – Reserve- und
 * Testfahrer der juengsten Jahre – liefert die API kein Land. Sie bekommen
 * einen leeren Platzhalter statt einer geratenen Herkunft.
 */
export function nation(nationality?: string): Nation {
  if (!nationality) return { code: '—', name: 'Land nicht überliefert' }
  return (
    NATIONS[nationality] ?? {
      code: nationality.slice(0, 3).toUpperCase(),
      name: nationality,
    }
  )
}
