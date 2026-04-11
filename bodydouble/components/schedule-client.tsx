'use client'

import { useState } from 'react'

export function ScheduleClient({ defaultDate }: { defaultDate: string }) {
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('09:00')

  return (
    <>
      <input className="input" name="date" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
      <input className="input" name="time" onChange={(event) => setTime(event.target.value)} type="time" value={time} />
    </>
  )
}
