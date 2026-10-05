/**
 * Die Info-Knöpfe: ein kleines „i“ neben jeder Beschriftung, die das Glossar
 * kennt, und eine Infobox, die es öffnet.
 *
 * Die Box ist ein natives Popover (`popover` in Seite.astro). Der Browser
 * schließt es bei Escape und bei einem Klick daneben, und weil jeder Knopf
 * per `popovertarget` auf die Box zeigt, zählt ein Klick auf ein anderes „i“
 * nicht als „daneben“: Die Box bleibt offen und zeigt den neuen Begriff.
 * `popovertargetaction="show"` verhindert, dass derselbe Klick sie wieder
 * schließt.
 *
 * Mit der Maus genügt es, über das „i“ zu fahren: Die Box geht auf, und sie
 * schließt sich, sobald die Maus weder auf dem Knopf noch auf der Box steht.
 * Ein kurzer Aufschub in beide Richtungen sorgt dafür, dass ein Zeiger, der
 * nur über eine Tabelle voller „i“ hinwegzieht, nicht jede Box aufblitzen
 * lässt, und dass man vom Knopf in die Box hinüberfahren kann. Finger und
 * Tastatur tippen weiterhin – für sie gibt es kein Darüberfahren.
 *
 * Die Knöpfe entstehen erst im Browser. Ohne Skript gibt es keine – die
 * Erklärungen am Ende jeder Seite bleiben dann der Weg zur Bedeutung.
 */
import { erklaerung } from './glossar.js'

/**
 * Wo Beschriftungen stehen, die eine Zahl benennen: Kennzahlen, Datenlisten,
 * Spaltenköpfe, Rekordlisten, die Zeilen des Vergleichs, die Meilensteine.
 */
const ZIELE = [
  '.kacheln li > span',
  '.daten li > span',
  'thead th',
  '.rangkarte > h3',
  'table.gegen tbody th[scope="row"]',
  '.meilensteine span',
].join(', ')

/** Teile einer Beschriftung, die nicht zum Begriff gehören: Unterzeile, Zusatz, Vorlesetext. */
const NEBEN = new Set(['SMALL', 'I', 'svg'])

/** Der Begriff, wie er dasteht – ohne Unterzeile, Sortierpfeil und schon gesetzte Knöpfe. */
function beschriftung(el) {
  let text = ''
  for (const k of el.childNodes) {
    if (k.nodeType === Node.TEXT_NODE) text += k.textContent
    else if (k.nodeType === Node.ELEMENT_NODE && !NEBEN.has(k.nodeName) && !k.classList.contains('sr-only') && !k.classList.contains('info')) {
      text += k.textContent
    }
  }
  return text.replace(/[↕▾▴]/g, '').trim()
}

let box = null

function knopf(eintrag, begriff) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'info'
  b.textContent = 'i'
  b.setAttribute('aria-label', `What does “${begriff}” mean?`)
  b.setAttribute('popovertarget', 'info-box')
  b.setAttribute('popovertargetaction', 'show')
  b.dataset.titel = eintrag.titel
  b.dataset.text = eintrag.text
  return b
}

/**
 * Hängt den Knopf an das letzte Wort der Beschriftung, damit beide zusammen
 * umbrechen. In einer schmalen Kachel stand das „i“ sonst allein in der
 * nächsten Zeile. Nicht in Inseln, die React zeichnet: Dort gehört der
 * Textknoten React, und ein geteilter hätte das nächste Neuzeichnen gestört.
 */
function haenge(el, b) {
  const t = el.lastChild
  const text = t?.nodeType === Node.TEXT_NODE ? t.textContent.trimEnd() : ''
  const schnitt = text.lastIndexOf(' ')
  if (!text || el.closest('astro-island')) {
    el.append(b)
    return
  }
  const halt = document.createElement('span')
  halt.className = 'info-halt'
  halt.append(text.slice(schnitt + 1), b)
  t.textContent = text.slice(0, schnitt + 1)
  t.after(halt)
}

/** Setzt die Knöpfe in `wurzel`. Was schon einen hat, bleibt unberührt. */
export function beschrifte(wurzel = document) {
  for (const el of wurzel.querySelectorAll(ZIELE)) {
    if (el.dataset.info || el.closest('a, button, summary')) continue
    el.dataset.info = '1'
    const begriff = beschriftung(el)
    const eintrag = begriff && erklaerung(begriff)
    if (!eintrag) continue
    const b = knopf(eintrag, begriff)
    /* Im Spaltenkopf neben den Sortierknopf, im Vergleich vor die Unterzeile. */
    const sortierer = el.querySelector(':scope > button:not(.info)')
    const unterzeile = el.querySelector(':scope > small')
    if (sortierer) sortierer.after(b)
    else if (unterzeile) unterzeile.before(b)
    else haenge(el, b)
  }
}

/**
 * Die Box an den Knopf legen: darunter, wenn dort Platz ist, sonst darüber;
 * waagerecht so, dass sie nicht aus dem Fenster ragt.
 */
function lege(an) {
  const r = an.getBoundingClientRect()
  const w = box.offsetWidth
  const h = box.offsetHeight
  const rand = 8
  const links = Math.min(Math.max(rand, r.left + r.width / 2 - 24), window.innerWidth - w - rand)
  const unten = r.bottom + 8 + h <= window.innerHeight - rand
  box.style.left = `${links}px`
  box.style.top = `${unten ? r.bottom + 8 : Math.max(rand, r.top - 8 - h)}px`
}

export function starte() {
  box = document.getElementById('info-box')
  if (!box || typeof box.showPopover !== 'function') return

  const titel = box.querySelector('[data-info-titel]')
  const text = box.querySelector('[data-info-text]')
  let aktiv = null
  /* Die beiden Aufschübe beim Darüberfahren, siehe unten. */
  let auf = 0
  let zu = 0

  const fuelle = (b) => {
    titel.textContent = b.dataset.titel
    text.textContent = b.dataset.text
    aktiv = b
  }

  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button.info') : null
    if (!b) return
    clearTimeout(auf)
    clearTimeout(zu)
    fuelle(b)
    /* Erst nach dem Klick ist die Box offen und hat ihre Größe. */
    requestAnimationFrame(() => lege(b))
  })

  /* Darüberfahren mit der Maus: öffnen nach kurzem Verweilen, schließen nach kurzem Verlassen. */
  const istMaus = (e) => e.pointerType === 'mouse'
  const infoKnopf = (el) => (el instanceof Element ? el.closest('button.info') : null)

  const schliesseBald = () => {
    clearTimeout(auf)
    clearTimeout(zu)
    zu = setTimeout(() => { if (box.matches(':popover-open')) box.hidePopover() }, 250)
  }

  document.addEventListener('pointerover', (e) => {
    const b = infoKnopf(e.target)
    if (!b || !istMaus(e)) return
    clearTimeout(zu)
    clearTimeout(auf)
    auf = setTimeout(() => {
      fuelle(b)
      if (!box.matches(':popover-open')) box.showPopover()
      lege(b)
    }, 120)
  })

  document.addEventListener('pointerout', (e) => {
    const b = infoKnopf(e.target)
    if (!b || !istMaus(e) || b.contains(e.relatedTarget) || box.contains(e.relatedTarget)) return
    schliesseBald()
  })

  box.addEventListener('pointerenter', (e) => { if (istMaus(e)) clearTimeout(zu) })
  box.addEventListener('pointerleave', (e) => {
    if (istMaus(e) && !infoKnopf(e.relatedTarget)) schliesseBald()
  })

  /* Beim Scrollen und Umbrechen klebt die Box am Knopf, statt stehen zu bleiben. */
  const nach = () => { if (aktiv && box.matches(':popover-open')) lege(aktiv) }
  window.addEventListener('scroll', nach, { passive: true, capture: true })
  window.addEventListener('resize', nach)
  box.addEventListener('toggle', (e) => { if (e.newState === 'closed') aktiv = null })

  beschrifte()

  /*
   * Vergleich und Explorer zeichnen ihre Tabellen erst im Browser (React).
   * Was dort neu erscheint, bekommt seine Knöpfe nach, einmal je Bild.
   */
  let geplant = false
  new MutationObserver(() => {
    if (geplant) return
    geplant = true
    requestAnimationFrame(() => { geplant = false; beschrifte() })
  }).observe(document.body, { childList: true, subtree: true })
}
