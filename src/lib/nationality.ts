/*
 * Ergast liefert Nationalitaeten als englische Demonyme ('Dutch', 'German').
 * In einer deutschen Tabelle liest sich das falsch, deshalb diese Zuordnung
 * auf deutsche Bezeichnung und Laendercode.
 *
 * Kein Flaggen-Emoji: unter Windows zeigen die gaengigen Browser dafuer nur das
 * Buchstabenpaar, das Ergebnis waere also je nach Geraet ein anderes. Der Code
 * als Kuerzel sieht ueberall gleich aus.
 *
 * Unbekanntes faellt auf den englischen Originalwert zurueck – die Liste deckt
 * die Nationalitaeten der Fahrer und Teams ab, nicht jeden Staat der Welt.
 */

interface Nation {
  de: string
  code: string
}

const NATIONS: Record<string, Nation> = {
  American: { de: 'USA', code: 'USA' },
  'American-Italian': { de: 'USA/Italien', code: 'USA' },
  Argentine: { de: 'Argentinien', code: 'ARG' },
  'Argentine-Italian': { de: 'Argentinien/Italien', code: 'ARG' },
  Australian: { de: 'Australien', code: 'AUS' },
  Austrian: { de: 'Österreich', code: 'AUT' },
  Belgian: { de: 'Belgien', code: 'BEL' },
  Brazilian: { de: 'Brasilien', code: 'BRA' },
  British: { de: 'Großbritannien', code: 'GBR' },
  Canadian: { de: 'Kanada', code: 'CAN' },
  Chilean: { de: 'Chile', code: 'CHI' },
  Chinese: { de: 'China', code: 'CHN' },
  Colombian: { de: 'Kolumbien', code: 'COL' },
  Czech: { de: 'Tschechien', code: 'CZE' },
  Danish: { de: 'Dänemark', code: 'DEN' },
  Dutch: { de: 'Niederlande', code: 'NED' },
  'East German': { de: 'DDR', code: 'DDR' },
  Finnish: { de: 'Finnland', code: 'FIN' },
  French: { de: 'Frankreich', code: 'FRA' },
  German: { de: 'Deutschland', code: 'GER' },
  Hungarian: { de: 'Ungarn', code: 'HUN' },
  Indian: { de: 'Indien', code: 'IND' },
  Indonesian: { de: 'Indonesien', code: 'INA' },
  Irish: { de: 'Irland', code: 'IRL' },
  Israeli: { de: 'Israel', code: 'ISR' },
  Italian: { de: 'Italien', code: 'ITA' },
  Japanese: { de: 'Japan', code: 'JPN' },
  Liechtensteiner: { de: 'Liechtenstein', code: 'LIE' },
  Malaysian: { de: 'Malaysia', code: 'MAS' },
  Mexican: { de: 'Mexiko', code: 'MEX' },
  Monegasque: { de: 'Monaco', code: 'MON' },
  'New Zealander': { de: 'Neuseeland', code: 'NZL' },
  Polish: { de: 'Polen', code: 'POL' },
  Portuguese: { de: 'Portugal', code: 'POR' },
  Rhodesian: { de: 'Rhodesien', code: 'RHO' },
  Russian: { de: 'Russland', code: 'RUS' },
  Spanish: { de: 'Spanien', code: 'ESP' },
  'South African': { de: 'Südafrika', code: 'RSA' },
  Swedish: { de: 'Schweden', code: 'SWE' },
  Swiss: { de: 'Schweiz', code: 'SUI' },
  Thai: { de: 'Thailand', code: 'THA' },
  Uruguayan: { de: 'Uruguay', code: 'URU' },
  Venezuelan: { de: 'Venezuela', code: 'VEN' },
}

export const nationName = (raw: string) => NATIONS[raw]?.de ?? raw

export const nationCode = (raw: string) => NATIONS[raw]?.code ?? ''
