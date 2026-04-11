'use client'

import { useState } from 'react'

type Props = {
  name: string
  options: string[]
  initialSelected: string[]
  single?: boolean
}

export function ClientChipGroup({ name, options, initialSelected, single = false }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected)

  function toggle(value: string) {
    if (single) {
      setSelected([value])
    } else {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      )
    }
  }

  return (
    <div>
      {/* Hidden inputs carry the values into the form action */}
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`chip ${isSelected ? 'chip-selected' : ''}`}
              style={{ minHeight: 36 }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
