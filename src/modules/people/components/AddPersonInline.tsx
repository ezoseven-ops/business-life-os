'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPersonAction } from '@/modules/people/people.actions'

interface AddPersonInlineProps {
  onCancel?: () => void
}

export function AddPersonInline({ onCancel }: AddPersonInlineProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const [whatsappId, setWhatsappId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await createPersonAction({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        telegramId: telegramId.trim() || undefined,
        whatsappId: whatsappId.trim() || undefined,
      })
      if (result.success) {
        setName('')
        setEmail('')
        setPhone('')
        setCompany('')
        setTelegramId('')
        setWhatsappId('')
        router.refresh()
        onCancel?.()
      } else {
        setError(result.error || 'Failed to add person')
      }
    } catch {
      setError('Failed to add person')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        placeholder="Name *"
        className="w-full text-sm font-medium bg-transparent outline-none placeholder:text-gray-400"
        autoFocus
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="text-sm bg-transparent outline-none placeholder:text-gray-400 border border-border rounded-lg px-3 py-2"
          disabled={saving}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="text-sm bg-transparent outline-none placeholder:text-gray-400 border border-border rounded-lg px-3 py-2"
          disabled={saving}
        />
      </div>
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company"
        className="w-full text-sm bg-transparent outline-none placeholder:text-gray-400 border border-border rounded-lg px-3 py-2"
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          placeholder="Telegram ID"
          className="text-sm bg-transparent outline-none placeholder:text-gray-400 border border-border rounded-lg px-3 py-2"
          disabled={saving}
        />
        <input
          type="text"
          value={whatsappId}
          onChange={(e) => setWhatsappId(e.target.value)}
          placeholder="WhatsApp ID"
          className="text-sm bg-transparent outline-none placeholder:text-gray-400 border border-border rounded-lg px-3 py-2"
          disabled={saving}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="text-xs text-gray-400 font-medium px-3 py-1.5">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="text-xs font-semibold text-white bg-primary px-4 py-1.5 rounded-lg disabled:opacity-40"
        >
          {saving ? '...' : 'Add Person'}
        </button>
      </div>
    </form>
  )
}
