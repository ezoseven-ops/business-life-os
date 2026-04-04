'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { InlineError } from '@/components/ErrorStates'
import { createEventAction } from '@/modules/events/event.actions'

function getDefaultDate() {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  return now.toISOString().slice(0, 16)
}

function getDefaultEndDate() {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 2)
  return now.toISOString().slice(0, 16)
}

export default function NewEventPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAt, setStartAt] = useState(getDefaultDate())
  const [endAt, setEndAt] = useState(getDefaultEndDate())
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!title.trim() || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await createEventAction({
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: allDay ? new Date(startAt + 'T00:00:00') : new Date(startAt),
        endAt: endAt ? (allDay ? new Date(endAt + 'T23:59:59') : new Date(endAt)) : undefined,
        allDay,
        location: location.trim() || undefined,
      })
      if (result.success) {
        router.push('/calendar')
        router.refresh()
      } else {
        setError(result.error || 'Failed to create event')
      }
    } catch {
      setError('Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <Header
        title="New Event"
        backHref="/calendar"
        action={
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="text-sm font-semibold text-primary disabled:text-gray-300"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      />

      <div className="px-5 py-5 max-w-lg mx-auto space-y-4">
        <input
          type="text"
          placeholder="Event title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError('') }}
          className="w-full text-xl font-bold bg-transparent outline-none placeholder:text-gray-300"
          autoFocus
          disabled={saving}
        />

        {/* All day toggle */}
        <label className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            disabled={saving}
          />
          <span className="text-sm text-gray-600">All day</span>
        </label>

        {/* Date/time inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Start</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? startAt.slice(0, 10) : startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">End</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? endAt.slice(0, 10) : endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
              disabled={saving}
            />
          </div>
        </div>

        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary placeholder:text-gray-400"
          disabled={saving}
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary resize-none placeholder:text-gray-400"
          disabled={saving}
        />

        {error && (
          <InlineError message={error} />
        )}
      </div>
    </div>
  )
}
