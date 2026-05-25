'use client'

export type PostType = 'Rant' | 'Confess' | 'Story'

interface PostTypePickerProps {
  selected: PostType
  onChange: (type: PostType) => void
}

export default function PostTypePicker({ selected, onChange }: PostTypePickerProps) {
  const types: { value: PostType; label: string; desc: string; activeStyle: string }[] = [
    {
      value: 'Rant',
      label: '😤 Rant',
      desc: 'Let it out. Loud & unedited.',
      activeStyle: 'bg-burgundy text-cream border-ink translate-y-[2px] shadow-[2px_2px_0px_var(--ink)] scale-[0.98]'
    },
    {
      value: 'Confess',
      label: '💌 Confess',
      desc: 'Drop it on the anonymous wall.',
      activeStyle: 'bg-ink text-cream border-cream translate-y-[2px] shadow-[2px_2px_0px_var(--cream)] scale-[0.98]'
    },
    {
      value: 'Story',
      label: '✨ Story',
      desc: 'A slice of life, textured & detailed.',
      activeStyle: 'bg-gold text-ink border-ink translate-y-[2px] shadow-[2px_2px_0px_var(--ink)] scale-[0.98]'
    }
  ]

  return (
    <div className="flex flex-col gap-2">
      <label className="font-display text-sm font-bold uppercase tracking-wide">
        Select Post Type (Stamp)
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {types.map((t) => {
          const isActive = selected === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={`p-4 text-left border-2 border-ink rounded-md transition-all cursor-pointer shadow-[4px_4px_0px_var(--ink)] ${
                isActive
                  ? t.activeStyle
                  : 'bg-[#FAF6EB] text-ink hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_var(--ink)]'
              }`}
            >
              <div className="font-display text-lg font-black uppercase tracking-tight">
                {t.label}
              </div>
              <div className="text-xs text-zinc-600 mt-1 font-medium">
                {t.desc}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
