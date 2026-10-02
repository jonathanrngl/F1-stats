/**
 * Das Glossar hinter den Info-Knöpfen.
 *
 * Wer die Formel 1 nicht kennt, liest „Pole positions 104“ und weiß nicht,
 * was gezählt wurde. Jede Kennzahl, jeder Spaltenkopf und jede Rekordliste
 * bekommt deshalb ein kleines „i“ (lib/info.js), das diese Erklärung öffnet.
 *
 * Gefunden wird über die Beschriftung, wie sie auf der Seite steht – nicht
 * über eine Kennung im Markup. So erklärt sich eine neue Spalte „Wins“ von
 * selbst, und keine der 25 Seitenarten muss etwas davon wissen. Ein Begriff,
 * der fehlt, bekommt einfach kein „i“.
 *
 * Die Texte richten sich an Einsteiger: kurz, ohne Fachwörter, die selbst
 * eine Erklärung bräuchten. Wo die Seite anders zählt als üblich, steht es
 * dabei.
 */

/** @typedef {{ begriffe: string[], titel: string, text: string }} Eintrag */

/** @type {Eintrag[]} */
export const GLOSSAR = [
  // ------------------------------------------------------------ Grundzählungen
  {
    begriffe: ['starts', 'start'],
    titel: 'Starts',
    text: 'Races a driver actually started. Being entered is not enough: a driver who failed to qualify or withdrew before the start is not counted.',
  },
  {
    begriffe: ['starts here'],
    titel: 'Starts here',
    text: 'How many World Championship races the driver started at this circuit.',
  },
  {
    begriffe: ['races'],
    titel: 'Races',
    text: 'World Championship rounds, also called Grands Prix. Each one awards points towards the season’s titles. Non-championship races are not counted.',
  },
  {
    begriffe: ['seasons'],
    titel: 'Seasons',
    text: 'Calendar years in which the driver started at least one World Championship race.',
  },
  {
    begriffe: ['wins', 'win'],
    titel: 'Wins',
    text: 'Races finished in first place. Sprint wins are not included – they are counted separately.',
  },
  {
    begriffe: ['podiums', 'podium'],
    titel: 'Podiums',
    text: 'Finishes in the top three. After the race the first three drivers stand on the podium to receive their trophies – hence the name.',
  },
  {
    begriffe: ['races with a podium'],
    titel: 'Races with a podium',
    text: 'Races in which at least one of the team’s cars finished in the top three.',
  },
  {
    begriffe: ['pole positions', 'pole position', 'poles', 'pole'],
    titel: 'Pole position',
    text: 'The driver who sets the fastest time in qualifying starts the race from first place on the grid – the “pole”. A grid penalty can push the pole-sitter back, so taking pole and starting first are not always the same.',
  },
  {
    begriffe: ['pole-sitters'],
    titel: 'Pole-sitters',
    text: 'How many different drivers took at least one pole position – the fastest time in qualifying – during the season.',
  },
  {
    begriffe: ['pole to win', 'pole-to-win conversion'],
    titel: 'Pole to win',
    text: 'How often a pole position – starting from first place – was turned into a win. A high share means the driver rarely lost the lead once at the front.',
  },
  {
    begriffe: ['fastest laps', 'fastest lap'],
    titel: 'Fastest lap',
    text: 'The quickest single lap anyone set during the race. It earned an extra championship point in the 1950s and again from 2019 to 2024, then only for a driver who finished in the top ten.',
  },
  {
    begriffe: ['sprint wins', 'sprint'],
    titel: 'Sprint',
    text: 'A short race of about 100 km on the Saturday of some race weekends, held since 2021. It awards fewer points than the Grand Prix on Sunday, and a sprint win does not count as a race win.',
  },
  {
    begriffe: ['titles', 'world championships', 'world champion'],
    titel: 'World Championship',
    text: 'The drivers’ title. Every race awards points by finishing position, and whoever has the most points at the end of the season is World Champion.',
  },
  {
    begriffe: ['constructors’ titles', "constructors' titles", 'constructors’ champion', "constructors' champion"],
    titel: 'Constructors’ Championship',
    text: 'The title for teams, awarded since 1958. The points of all the team’s cars are added together. The team that builds the car is called a constructor.',
  },
  {
    begriffe: ['championship', 'best championship finish'],
    titel: 'Championship position',
    text: 'Where the driver finished in the drivers’ championship at the end of the season. P1 means World Champion.',
  },
  {
    begriffe: ['driver of the day'],
    titel: 'Driver of the Day',
    text: 'A fan vote held during each race since 2016. It has no effect on points or results – it shows whose race the audience liked best.',
  },
  {
    begriffe: ['grand slams', 'grand slam'],
    titel: 'Grand Slam',
    text: 'The perfect weekend: pole position, the win, the fastest lap, and leading every single lap of the race – all in the same Grand Prix.',
  },
  {
    begriffe: ['one-twos', 'one-two'],
    titel: 'One-two',
    text: 'Races in which the team’s cars finished first and second.',
  },
  {
    begriffe: ['different winners'],
    titel: 'Different winners',
    text: 'How many different drivers won at least one race that season. A high number usually means a close, open season.',
  },

  // ------------------------------------------------------------------ Punkte
  {
    begriffe: ['points', 'pts', 'points scored'],
    titel: 'Points',
    text: 'Championship points, awarded by finishing position. The scale has changed several times; since 2010 the top ten score 25, 18, 15, 12, 10, 8, 6, 4, 2 and 1.',
  },
  {
    begriffe: ['points scored in races'],
    titel: 'Points scored in races',
    text: 'All points from race results added up. Until 1990 only a driver’s best results counted towards the title, so this sum can be higher than the official championship total.',
  },
  {
    begriffe: ['official points'],
    titel: 'Official points',
    text: 'The championship total as it was officially counted. Until 1990 only a driver’s best results counted, so some points scored on track were dropped.',
  },
  {
    begriffe: ['official position'],
    titel: 'Official position',
    text: 'The final championship position as officially decided, under the rules of that year.',
  },
  {
    begriffe: ['dropped'],
    titel: 'Dropped points',
    text: 'Until 1990 only a driver’s best results counted towards the title – for example the best 11 of 16 races. Points from the remaining races were dropped.',
  },
  {
    begriffe: ['share of possible points'],
    titel: 'Share of possible points',
    text: 'Points scored compared with the most each start could have brought under the rules of its own year. It is the one points figure that can be compared across eras: a win was worth 9 points in 1955 and 26 in 2024.',
  },
  {
    begriffe: ['points per start'],
    titel: 'Points per start',
    text: 'Average points per race started. Not comparable across eras, because the points system has changed many times.',
  },
  {
    begriffe: ['points system'],
    titel: 'Points system',
    text: 'The scale that turns finishing positions into championship points. Choose another one to see how the season would have ended under different rules.',
  },

  // ---------------------------------------------------------- Raten, Mittel
  {
    begriffe: ['win rate'],
    titel: 'Win rate',
    text: 'Wins divided by starts: the share of races the driver won.',
  },
  {
    begriffe: ['podium rate'],
    titel: 'Podium rate',
    text: 'Podiums divided by starts: the share of races the driver finished in the top three.',
  },
  {
    begriffe: ['avg grid position'],
    titel: 'Average grid position',
    text: 'The average starting position. The grid – the starting order – is set by qualifying, so this shows how fast the driver usually was over one lap.',
  },
  {
    begriffe: ['avg finish'],
    titel: 'Average finish',
    text: 'The average finishing position. Only races in which the driver was classified count; retirements are left out.',
  },
  {
    begriffe: ['avg finish here', 'here'],
    titel: 'Average finish here',
    text: 'The driver’s average finishing position at this circuit.',
  },
  {
    begriffe: ['avg finish elsewhere', 'elsewhere'],
    titel: 'Average finish elsewhere',
    text: 'The same driver’s average finishing position at all other circuits, for comparison.',
  },
  {
    begriffe: ['better by'],
    titel: 'Better by',
    text: 'How many places better the driver finished here than elsewhere, on average. A high number marks a circuit specialist.',
  },
  {
    begriffe: ['retirement rate', 'not classified'],
    titel: 'Not classified',
    text: 'Starts that did not end in the results – usually because the car broke down or crashed. Today a driver must cover 90% of the winner’s distance to be classified – even a car that stopped near the end can still count.',
  },
  {
    begriffe: ['cars finishing'],
    titel: 'Cars finishing',
    text: 'The share of the team’s starts in which the car was classified at the finish – a rough measure of reliability.',
  },
  {
    begriffe: ['positions gained'],
    titel: 'Positions gained',
    text: 'Places gained from the starting grid to the finish, added up over the career. Overtaking, strategy and other drivers’ retirements all count.',
  },

  // ---------------------------------------------------------------- Serien
  {
    begriffe: ['longest winning streak'],
    titel: 'Winning streak',
    text: 'The most races won in a row, without a race in between that the driver started and did not win.',
  },
  {
    begriffe: ['longest podium streak'],
    titel: 'Podium streak',
    text: 'The most consecutive starts finished in the top three.',
  },
  {
    begriffe: ['longest points-scoring streak'],
    titel: 'Points streak',
    text: 'The most consecutive starts in which the driver scored championship points.',
  },
  {
    begriffe: ['longest finishing streak'],
    titel: 'Finishing streak',
    text: 'The most consecutive starts in which the driver was classified at the finish, without a retirement.',
  },
  {
    begriffe: ['streak'],
    titel: 'Streak',
    text: 'A run of consecutive races with the same result – for example a win or a points finish in every race.',
  },

  // ------------------------------------------------------------- Rekordlisten
  {
    begriffe: ['biggest winning margins'],
    titel: 'Winning margin',
    text: 'How far ahead of second place the winner crossed the line. In the early years a lap could take several minutes, so margins were far larger than today.',
  },
  {
    begriffe: ['closest finishes'],
    titel: 'Closest finishes',
    text: 'The smallest gaps between winner and second place at the finish line, measured in seconds.',
  },
  {
    begriffe: ['longest careers'],
    titel: 'Longest careers',
    text: 'The time between a driver’s first and last start.',
  },
  {
    begriffe: ['longest gap between wins'],
    titel: 'Gap between wins',
    text: 'The longest wait between two consecutive wins of the same driver.',
  },
  {
    begriffe: ['positions gained in a race'],
    titel: 'Positions gained in a race',
    text: 'The biggest climb from starting position to finishing position in a single race.',
  },
  {
    begriffe: ['wins from the back of the grid'],
    titel: 'Wins from the back',
    text: 'Races won from the furthest-back starting positions.',
  },
  {
    begriffe: ['youngest winners', 'oldest winners'],
    titel: 'Age at a win',
    text: 'The driver’s age on the day of the race they won.',
  },
  {
    begriffe: ['youngest pole-sitters'],
    titel: 'Age at pole',
    text: 'The driver’s age on the day they took pole position – the fastest time in qualifying.',
  },
  {
    begriffe: ['youngest world champions', 'oldest world champions'],
    titel: 'Age at the title',
    text: 'The driver’s age at the last race of the season in which they became champion.',
  },
  {
    begriffe: ['successful teams'],
    titel: 'Most successful teams',
    text: 'Teams ranked by wins at this circuit.',
  },

  // -------------------------------------------------- Rekordbewegung (Changes)
  {
    begriffe: ['record'],
    titel: 'Record',
    text: 'An all-time best mark across every World Championship race since 1950.',
  },
  {
    begriffe: ['holder'],
    titel: 'Holder',
    text: 'The driver or team who holds the record right now.',
  },
  {
    begriffe: ['gain'],
    titel: 'Gain',
    text: 'How much a record holder who is still racing has added to the record since first taking it.',
  },
  {
    begriffe: ['extending since'],
    titel: 'Extending since',
    text: 'When the holder took the record – since then every success has pushed it further.',
  },
  {
    begriffe: ['most recently'],
    titel: 'Most recently',
    text: 'The latest race in which the record grew.',
  },
  {
    begriffe: ['has'],
    titel: 'Has',
    text: 'The challenger’s current figure.',
  },
  {
    begriffe: ['to equal'],
    titel: 'To equal',
    text: 'How many more the challenger needs to draw level with the record.',
  },
  {
    begriffe: ['at this rate'],
    titel: 'At this rate',
    text: 'A projection, not a fact: when the challenger would equal the record if they kept the pace of their last three seasons.',
  },

  // ----------------------------------------------------- Teamkollegen-Wertung
  {
    begriffe: ['team-mate'],
    titel: 'Team-mate',
    text: 'The other driver in the same team. Both drive the same car, so beating your team-mate is the fairest way to compare drivers.',
  },
  {
    begriffe: ['rating'],
    titel: 'Rating',
    text: 'A chess-style score built only from duels between team-mates. Beating a strong team-mate raises it a lot, beating a weak one barely. It is a model, not a count.',
  },
  {
    begriffe: ['duels'],
    titel: 'Duels',
    text: 'Races in which both team-mates were classified, so one finished ahead of the other. The more duels, the more the rating can be trusted.',
  },
  {
    begriffe: ['won'],
    titel: 'Duels won',
    text: 'The share of duels the driver finished ahead of the team-mate.',
  },
  {
    begriffe: ['qualifying'],
    titel: 'Qualifying',
    text: 'The timed session before the race that sets the starting order. The fastest driver starts first. In a head-to-head it counts who was faster.',
  },

  // ----------------------------------------------------------- Rennen im Detail
  {
    begriffe: ['pos'],
    titel: 'Position',
    text: 'Finishing position. Drivers who were not classified are listed at the end with the reason, for example an accident or a technical failure.',
  },
  {
    begriffe: ['grid', 'winner started from', 'winner’s grid slot', "winner's grid slot", 'from grid'],
    titel: 'Grid',
    text: 'The starting position. Cars line up on the grid in the order set by qualifying, minus any penalties. P1 is pole position.',
  },
  {
    begriffe: ['laps'],
    titel: 'Laps',
    text: 'How many laps the driver completed. A car that retired early shows fewer laps than the winner.',
  },
  {
    begriffe: ['lap'],
    titel: 'Lap',
    text: 'The lap of the race on which it happened.',
  },
  {
    begriffe: ['gap'],
    titel: 'Gap',
    text: 'The time behind the fastest or leading driver.',
  },
  {
    begriffe: ['time / reason'],
    titel: 'Time or reason',
    text: 'The winner’s total race time, then each driver’s gap to the winner. Lapped drivers show “+1 lap”, retired drivers the reason they stopped.',
  },
  {
    begriffe: ['q1', 'q2', 'q3'],
    titel: 'Q1, Q2, Q3',
    text: 'Qualifying since 2006 runs in three knock-out rounds. The slowest drivers drop out after Q1 and Q2; the last ten fight for pole position in Q3.',
  },
  {
    begriffe: ['qualified'],
    titel: 'Qualified',
    text: 'The position the driver earned in qualifying.',
  },
  {
    begriffe: ['started'],
    titel: 'Started',
    text: 'The position the driver actually started from, after penalties.',
  },
  {
    begriffe: ['penalty'],
    titel: 'Grid penalty',
    text: 'A move back on the grid, typically for fitting more engine parts than the rules allow or for an earlier offence.',
  },
  {
    begriffe: ['stops', 'stop'],
    titel: 'Pit stops',
    text: 'Stops in the pit lane during the race, mostly to change tyres. A modern stop takes two to three seconds while the car stands still.',
  },
  {
    begriffe: ['on laps'],
    titel: 'On laps',
    text: 'The laps on which the driver came in for a pit stop.',
  },
  {
    begriffe: ['fastest'],
    titel: 'Fastest stop',
    text: 'The driver’s quickest pit stop of the race. The time covers the whole trip through the pit lane, usually around 20 seconds – the car itself stands still for only two to three.',
  },
  {
    begriffe: ['no.'],
    titel: 'Car number',
    text: 'The number on the car. Since 2014 drivers choose their own number and keep it for their career; the champion may run number 1.',
  },

  // --------------------------------------------------------- Autos und Teams
  {
    begriffe: ['teams', 'team · engine'],
    titel: 'Team',
    text: 'In Formula 1 the team builds its own car and is officially called a constructor. Many teams buy their engine from another manufacturer, so team and engine name often differ.',
  },
  {
    begriffe: ['constructor'],
    titel: 'Constructor',
    text: 'The company that built the chassis – the car without its engine. In Formula 1 this is what counts as the team.',
  },
  {
    begriffe: ['entrant'],
    titel: 'Entrant',
    text: 'The organisation that entered the car in the race. Often the same as the constructor, but private teams used to enter cars bought from someone else.',
  },
  {
    begriffe: ['chassis'],
    titel: 'Chassis',
    text: 'The car itself, without its engine. Each new car gets its own model name, such as McLaren MP4/4.',
  },
  {
    begriffe: ['engine', 'car · engine'],
    titel: 'Engine',
    text: 'The power unit. Teams either build their own or buy them from a manufacturer such as Mercedes, Ferrari or Honda.',
  },
  {
    begriffe: ['capacity'],
    titel: 'Capacity',
    text: 'The engine’s displacement in litres. The rules have changed it many times – from 4.5 litres in the 1950s to 1.6 litres since 2014.',
  },
  {
    begriffe: ['layout'],
    titel: 'Layout',
    text: 'How the cylinders are arranged, for example V6, V8 or V10. Since 2014 every engine is a 1.6-litre V6 turbo hybrid.',
  },
  {
    begriffe: ['tyres'],
    titel: 'Tyres',
    text: 'The tyre manufacturer. Today one brand supplies every team; in the past several competed against each other.',
  },
  {
    begriffe: ['drivers fielded'],
    titel: 'Drivers fielded',
    text: 'How many different drivers started a race for the team.',
  },
  {
    begriffe: ['drivers'],
    titel: 'Drivers',
    text: 'Drivers who took part in at least one World Championship race.',
  },

  // ----------------------------------------------------------------- Strecke
  {
    begriffe: ['circuits'],
    titel: 'Circuits',
    text: 'Race tracks that have hosted at least one World Championship race. Some are permanent tracks, others are temporary street circuits.',
  },
  {
    begriffe: ['corners'],
    titel: 'Corners',
    text: 'The number of corners on the current layout of the track, as officially counted.',
  },
  {
    begriffe: ['lap length', 'length'],
    titel: 'Lap length',
    text: 'The distance of one lap around the circuit.',
  },
  {
    begriffe: ['race distance'],
    titel: 'Race distance',
    text: 'The total length of the race. A Grand Prix runs just over 305 km – Monaco is the exception – or ends after two hours.',
  },
  {
    begriffe: ['scheduled laps'],
    titel: 'Scheduled laps',
    text: 'The number of laps needed to cover the race distance.',
  },
  {
    begriffe: ['lap record'],
    titel: 'Lap record',
    text: 'The fastest lap ever set during a race on the current layout of this circuit. Laps from qualifying do not count.',
  },

  // ------------------------------------------------------------- Laufbahn
  {
    begriffe: ['first entry'],
    titel: 'First entry',
    text: 'The first race the driver was entered for – even if they did not qualify or start.',
  },
  {
    begriffe: ['first win', 'last win', 'last start'],
    titel: 'Career milestones',
    text: 'The first and last time the driver won a race, and the last race they started.',
  },
]

/** Die Epoche hinter einer Rekordliste: „Most wins, 1950–1969“, „Most wins, Since 2010“. */
const EPOCHE = /,\s*(?:\d{4}\s*[–-]\s*\d{4}|since \d{4})$/i

/** Kleinschreibung, gerade Apostrophe, ohne Epoche und Satzzeichen am Ende. */
export function normiert(text) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(EPOCHE, '')
    .replace(/[:.]$/, (z) => (text.trim().toLowerCase() === 'no.' ? z : ''))
    .trim()
}

/** Begriff → Eintrag, einmal gebaut. */
const INDEX = new Map()
for (const e of GLOSSAR) for (const b of e.begriffe) INDEX.set(normiert(b), e)

/**
 * Der Eintrag zu einer Beschriftung, oder null. „Most podiums“ findet den
 * Eintrag „podiums“: Rekordlisten heißen nach dem, was sie zählen.
 * @param {string} beschriftung
 * @returns {Eintrag | null}
 */
export function erklaerung(beschriftung) {
  const n = normiert(beschriftung)
  if (!n) return null
  return INDEX.get(n) ?? (n.startsWith('most ') ? INDEX.get(n.slice(5)) : null) ?? null
}
