'use client'

import { cn } from '@/lib/utils'

type ChipGroupProps = {
  name: string
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  multiple?: boolean
}

export function ChipGroup({ name, options, selected, onToggle, multiple = true }: ChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <label
            className={cn('chip inline-flex cursor-pointer items-center justify-center', isSelected && 'chip-selected')}
            key={option}
          >
            <input
              checked={isSelected}
              className="sr-only"
              name={name}
              onChange={() => onToggle(option)}
              type={multiple ? 'checkbox' : 'radio'}
              value={option}
            />
            {option}
          </label>
        )
      })}
    </div>
  )
}
