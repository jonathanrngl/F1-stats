/**
 * Das eine Skript, das inline im Kopf jeder Seite steht.
 *
 * Die gespeicherte Wahl hell/dunkel muss gelten, bevor die Seite zum ersten
 * Mal gezeichnet wird – sonst blitzt sie beim Laden im anderen Modus auf. Ein
 * gebündeltes Skript käme dafür zu spät.
 *
 * Es steht hier und nicht im Layout, weil zwei Stellen denselben Text
 * brauchen: das Layout, das es ausgibt, und astro.config.mjs, das seinen Hash
 * in die Inhaltsrichtlinie schreibt. Astro hasht Skripte mit `is:inline`
 * nicht selbst; ohne den Eintrag blockierte der Browser es. Stünde der Text
 * zweimal da, bräche die Richtlinie beim ersten Ändern still.
 *
 * Ohne Speicher (privates Fenster) gilt das System.
 *
 * Dazu setzt es die Klasse `js` am Wurzelelement. Daran hängt, was nur mit
 * JavaScript etwas tut – Suchfeld, Explorer, Vergleichsauswahl: Ohne Skript
 * blendet theme.css es aus und zeigt stattdessen, was ohne geht. Ein Feld,
 * in das man tippt und das nichts tut, ist schlimmer als keines.
 */
export const MODUS_SKRIPT =
  "document.documentElement.classList.add('js');try{var m=localStorage.getItem('modus');if(m==='light'||m==='dark')document.documentElement.dataset.theme=m}catch(e){}"
