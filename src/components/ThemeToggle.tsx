import type { ThemeChoice } from '../lib/theme'

const OPTIONS: { id: ThemeChoice; label: string; title: string }[] = [
  { id: 'system', label: 'Auto', title: 'Dem Systemthema folgen' },
  { id: 'light', label: 'Hell', title: 'Immer hell' },
  { id: 'dark', label: 'Dunkel', title: 'Immer dunkel' },
]

export default function ThemeToggle({
  choice,
  onChange,
}: {
  choice: ThemeChoice
  onChange: (next: ThemeChoice) => void
}) {
  return (
    <div className="theme-toggle" role="group" aria-label="Farbschema">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          className={choice === o.id ? 'active' : ''}
          aria-pressed={choice === o.id}
          title={o.title}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
