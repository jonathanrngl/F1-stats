/*
 * Ergast beschreibt den Ausgang eines Rennens auf Englisch und sehr genau
 * ('Gearbox', 'Water pressure', '+2 Laps'). Diese Liste deckt die haeufigen
 * Faelle auf Deutsch ab; alles Uebrige bleibt im Original stehen, statt zu
 * raten. Die Rundenrueckstaende kommen als Muster, nicht als Einzelwerte.
 */

const STATUS: Record<string, string> = {
  Finished: 'Zielankunft',
  Lapped: 'Überrundet',
  Accident: 'Unfall',
  Collision: 'Kollision',
  'Collision damage': 'Unfallschaden',
  Engine: 'Motor',
  'Power Unit': 'Antriebseinheit',
  'Engine fire': 'Motorbrand',
  Gearbox: 'Getriebe',
  Transmission: 'Antrieb',
  Clutch: 'Kupplung',
  Hydraulics: 'Hydraulik',
  Electrical: 'Elektrik',
  Battery: 'Batterie',
  Brakes: 'Bremsen',
  Suspension: 'Radaufhängung',
  Steering: 'Lenkung',
  Wheel: 'Rad',
  Puncture: 'Reifenschaden',
  Tyre: 'Reifen',
  'Spun off': 'Abflug',
  Retired: 'Aufgegeben',
  Withdrew: 'Zurückgezogen',
  Disqualified: 'Disqualifiziert',
  'Did not qualify': 'Nicht qualifiziert',
  'Did not prequalify': 'Nicht vorqualifiziert',
  'Not classified': 'Nicht gewertet',
  Injury: 'Verletzung',
  Illness: 'Krankheit',
  Fatal: 'Tödlicher Unfall',
  'Fuel system': 'Kraftstoffsystem',
  'Fuel pressure': 'Kraftstoffdruck',
  'Fuel pump': 'Benzinpumpe',
  'Out of fuel': 'Kein Kraftstoff',
  Overheating: 'Überhitzung',
  'Water leak': 'Wasserverlust',
  'Water pressure': 'Wasserdruck',
  'Oil leak': 'Ölverlust',
  'Oil pressure': 'Öldruck',
  Radiator: 'Kühler',
  Turbo: 'Turbolader',
  Exhaust: 'Auspuff',
  Throttle: 'Gasgestänge',
  Driveshaft: 'Antriebswelle',
  Differential: 'Differential',
  Halfshaft: 'Antriebswelle',
  'Rear wing': 'Heckflügel',
  'Front wing': 'Frontflügel',
  Vibrations: 'Vibrationen',
  'Handling': 'Fahrverhalten',
  'Mechanical': 'Technik',
  'Driver Seat': 'Fahrersitz',
  'Damage': 'Schaden',
  'Debris': 'Trümmerteile',
  'Excluded': 'Ausgeschlossen',
  'Safety concerns': 'Sicherheitsbedenken',
  'Eligibility': 'Nicht startberechtigt',
  '107% Rule': '107-Prozent-Regel',
}

export function statusLabel(raw: string): string {
  const mapped = STATUS[raw]
  if (mapped) return mapped
  const laps = /^\+(\d+) Laps?$/.exec(raw)
  if (laps) return `+${laps[1]} ${laps[1] === '1' ? 'Runde' : 'Runden'}`
  return raw
}
