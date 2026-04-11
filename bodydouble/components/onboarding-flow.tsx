'use client'

import { useMemo, useState } from 'react'
import { ADHD_TYPES, AVAILABILITY_OPTIONS, FOCUS_TYPES, TIMEZONE_OPTIONS } from '@/lib/constants'
import { ChipGroup } from '@/components/chip-group'

type OnboardingFlowProps = {
  defaultName: string
  defaultTimezone: string
  action: (formData: FormData) => Promise<void>
}

const steps = [
  { label: 'Profile', title: 'Let’s make this space feel like yours.' },
  { label: 'ADHD type', title: 'How does your attention usually show up?' },
  { label: 'Focus areas', title: 'What kinds of sessions do you usually want?' },
  { label: 'Availability', title: 'When does body doubling help you most?' },
]

export function OnboardingFlow({ defaultName, defaultTimezone, action }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(defaultName)
  const [timezone, setTimezone] = useState(defaultTimezone || 'America/New_York')
  const [adhdType, setAdhdType] = useState('Not sure')
  const [focusTypes, setFocusTypes] = useState<string[]>([])
  const [availability, setAvailability] = useState<string[]>([])

  const progress = useMemo(() => `${((step + 1) / steps.length) * 100}%`, [step])

  function toggle(values: string[], next: string, multiple = true) {
    if (!multiple) return [next]
    return values.includes(next) ? values.filter((value) => value !== next) : [...values, next]
  }

  return (
    <div className="page-shell flex items-center justify-center">
      <form action={action} className="card w-full max-w-[680px]">
        <input name="name" type="hidden" value={name} />
        <input name="timezone" type="hidden" value={timezone} />
        <input name="adhd_type" type="hidden" value={adhdType} />
        {focusTypes.map((value) => (
          <input key={`focus-${value}`} name="focus_types" readOnly type="hidden" value={value} />
        ))}
        {availability.map((value) => (
          <input key={`availability-${value}`} name="availability" readOnly type="hidden" value={value} />
        ))}

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="section-label">{steps[step].label}</span>
            <span className="text-[12px] text-ink-faint">
              {step + 1} / {steps.length}
            </span>
          </div>
          <div className="mb-5 h-[8px] rounded-[999px] border border-border-card bg-bg p-[1px]">
            <div className="h-full rounded-[999px] bg-accent" style={{ width: progress }} />
          </div>
          <h1 className="text-[32px] leading-tight">{steps[step].title}</h1>
        </div>

        {step === 0 ? (
          <div className="space-y-6">
            <div>
              <label className="section-label mb-2 block">Name</label>
              <input className="input" onChange={(event) => setName(event.target.value)} value={name} />
            </div>
            <div>
              <label className="section-label mb-2 block">Timezone</label>
              <ChipGroup
                multiple={false}
                name="timezone-visible"
                onToggle={(value) => setTimezone(value)}
                options={TIMEZONE_OPTIONS}
                selected={[timezone]}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <ChipGroup
              multiple={false}
              name="adhd_type_visible"
              onToggle={(value) => setAdhdType(value)}
              options={ADHD_TYPES}
              selected={[adhdType]}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <ChipGroup
              name="focus_types_visible"
              onToggle={(value) => setFocusTypes((current) => toggle(current, value))}
              options={FOCUS_TYPES}
              selected={focusTypes}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <ChipGroup
              name="availability_visible"
              onToggle={(value) => setAvailability((current) => toggle(current, value))}
              options={AVAILABILITY_OPTIONS}
              selected={availability}
            />
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((current) => current - 1)} type="button">
            Back
          </button>
          {step < steps.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep((current) => current + 1)} type="button">
              Continue
            </button>
          ) : (
            <button className="btn-primary" type="submit">
              Finish onboarding
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
