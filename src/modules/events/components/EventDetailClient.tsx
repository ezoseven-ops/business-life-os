'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateEventAction, deleteEventAction } from '@/modules/events/event.actions'
import { InlineError } from '@/components/ErrorStates'

interface EventDetailClientProps {
  event: {
    id: string
    title: string
    description: string | null
    startAt: Date
    endAt: Date | null
    allDay: boolean
    location: string | null
    creator: { id: string; name: string | null } | null
  }
}

function formatDateTime(date: Date, allDay: boolean): string {
  const d = new Date(date)
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function toLocalDatetimeString(date: Date): string {
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function toLocalDateString(date: Date): string {
  return new Date(date).toISOString().slice(0, 10)
}

export function EventDetailClient({ event }: EventDetailClientProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description || '')
  const [startAt, setStartAt] = useState(toLocalDatetimeString(event.startAt))
  const [endAt, setEndAt] = useState(event.endAt ? toLocalDatetimeString(event.endAt) : '')
  const [allDay, setAllDay] = useState(event.allDay)
  const [location, setLocation] = useState(event.location || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleSave() {
    if (!title.trim() || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await updateEventAction(event.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: allDay ? new Date(startAt + 'T00:00:00') : new Date(startAt),
        endAt: endAt ? (allDay ? new Date(endAt + 'T23:59:59') : new Date(endAt)) : null,
        allDay,
        location: location.trim() || null,
      })
      if (result.success) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error || 'Failed to save')
      }
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    try {
      const result = await deleteEventAction(event.id)
      if (result.success) {
        router.push('/calendar')
        router.refresh()
      } else {
        setError(result.error || 'Failed to delete')
        setDeleting(false)
      }
    } catch {
      setError('Failed to delete')
      setDeleting(false)
    }
  }

  function handleCancel() {
    setTitle(event.title)
    setDescription(event.description || '')
    setStartAt(toLocalDatetimeString(event.startAt))
    setEndAt(event.endAt ? toLocalDatetimeString(event.endAt) : '')
    setAllDay(event.allDay)
    setLocation(event.location || '')
    setError('')
    setConfirmingDelete(false)
    setEditing(false)
  }

  return (
    <div className="px-5 py-5 max-w-lg mx-auto">
      {editing ? (
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            placeholder="Event title"
            className="w-full text-xl font-bold bg-transparent outline-none placeholder:text-gray-300"
            autoFocus
            disabled={saving}
          />

          <label className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              disabled={saving}
            />
            <span className="text-sm text-gray-600">All day</span>
          </label>

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
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary resize-none placeholder:text-gray-400"
            disabled={saving}
          />

          <InlineError message={error ?? ''} />

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-xs font-medium text-red-500 px-3 py-1.5"
            >
              {deleting ? 'Deleting...' : confirmingDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={saving} className="text-xs font-medium text-gray-400 px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || saving}
                className="text-xs font-semibold text-white bg-primary px-4 py-1.5 rounded-lg disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">{event.title}</h2>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="text-sm text-gray-700">
                <p>{mounted ? formatDateTime(event.startAt, event.allDay) : '\u00A0'}</p>
                {event.endAt && (
                  <p className="text-gray-400">{mounted ? `to ${formatDateTime(event.endAt, event.allDay)}` : '\u00A0'}</p>
                )}
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                <span className="text-sm text-gray-700">{event.location}</span>
              </div>
            )}
          </div>

          {event.description ? (
            <p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap mb-6">
              {event.description}
            </p>
          ) : (
            <p className="text-base text-gray-400 italic mb-6">No description</p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-red-500 px-3 py-1.5"
            >
              {deleting ? 'Deleting...' : confirmingDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-primary px-3 py-1.5"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
