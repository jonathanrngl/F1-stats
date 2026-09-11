/*
 * Platzhalter in der Form dessen, was kommt: gleiche Zeilenhoehe, gleiche
 * Spaltenbreiten. Ein Layout, das beim Eintreffen der Daten nicht springt,
 * wirkt schneller als eines, das erst "Lade Daten" schreibt und dann umbaut.
 */
export default function Skeleton({ rows = 8, label }: { rows?: number; label: string }) {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton-row" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
  )
}
