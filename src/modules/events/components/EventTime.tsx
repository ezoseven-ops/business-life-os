'use client'

import { useState, useEffect } from 'react'

interface EventTimeProps {
  date: Date | string
  format: 'time' | 'datetime' | 'month-short' | 'day'
  allDay?: boolean
  prefix?: string
  className?: string
  style?: React.CSSProperties
}

function formatEventDate(date: Date | string, format: string, allDay?: boolean): string {
  const d = new Date(date)
  switch (format) {
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    case 'datetime':
      if (allDay) {
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      }
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
        ' at ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    case 'month-short':
      return d.toLocaleDateString('en-US', { month: 'short' })
    case 'day':
      return String(d.getDate())
    default:
      return ''
  }
}

export function EventTime({ date, format, allDay, prefix, className, style }: EventTimeProps) {
  const [text, setText] = useState('')

  useEffect(() => {
    setText(formatEventDate(date, format, allDay))
  }, [date, format, allDay])

  return (
    <span className={className} style={style}>
      {prefix}{text}
    </span>
  )
}
