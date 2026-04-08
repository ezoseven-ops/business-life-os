'use client'

import { useState, useTransition } from 'react'
import {
  addProjectPersonAction,
  removeProjectPersonAction,
} from '../project-person.actions'

type PersonData = {
  id: string
  name: string
  email: string | null
  company: string | null
}

type ProjectPersonData = {
  id: string
  role: string | null
  person: PersonData
}

type Props = {
  projectId: string
  projectPeople: ProjectPersonData[]
  availablePeople: PersonData[]
  canManage: boolean
}

export default function ProjectPeopleManager({
  projectId,
  projectPeople: initialPeople,
  availablePeople: initialAvailable,
  canManage,
}: Props) {
  const [people, setPeople] = useState(initialPeople)
  const [available, setAvailable] = useState(initialAvailable)
  const [showForm, setShowForm] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [role, setRole] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAdd = () => {
    if (!selectedPersonId) return
    const person = available.find((p) => p.id === selectedPersonId)
    if (!person) return

    startTransition(async () => {
      const result = await addProjectPersonAction(projectId, selectedPersonId, role || null)
      if (result.success) {
        setPeople((prev) => [
          ...prev,
          { id: 'temp-' + Date.now(), role: role || null, person },
        ])
        setAvailable((prev) => prev.filter((p) => p.id !== selectedPersonId))
        setSelectedPersonId('')
        setRole('')
        setShowForm(false)
        showMsg('success', person.name + ' added to project')
      } else {
        showMsg('error', result.error || 'Failed to add person')
      }
    })
  }

  const handleRemove = (personId: string, personName: string) => {
    startTransition(async () => {
      const result = await removeProjectPersonAction(projectId, personId, personName)
      if (result.success) {
        const removed = people.find((pp) => pp.person.id === personId)
        setPeople((prev) => prev.filter((pp) => pp.person.id !== personId))
        if (removed) {
          setAvailable((prev) =>
            [...prev, removed.person].sort((a, b) => a.name.localeCompare(b.name))
          )
        }
        showMsg('success', personName + ' removed from project')
      } else {
        showMsg('error', result.error || 'Failed to remove person')
      }
    })
  }

  const sectionStyle: React.CSSProperties = {
    marginTop: '32px',
    padding: '20px',
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    border: '1px solid #2a2a3e',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#a0a0b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#7c6ef6',
    color: '#fff',
  }

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#12121f',
    borderRadius: '10px',
    marginBottom: '8px',
  }

  const avatarStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#2dd882',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    color: '#fff',
    marginRight: '12px',
    flexShrink: 0,
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#12121f',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    color: '#e0e0e8',
    fontSize: '13px',
    flex: 1,
    minWidth: 0,
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#12121f',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    color: '#e0e0e8',
    fontSize: '13px',
    width: '140px',
  }

  return (
    <div style={sectionStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>PEOPLE ({people.length})</span>
        {canManage && (
          <button
            style={btnPrimary}
            onClick={() => setShowForm(!showForm)}
            disabled={isPending}
          >
            {showForm ? 'Cancel' : '+ Add Person'}
          </button>
        )}
      </div>

      {message && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: message.type === 'success' ? '#2dd88222' : '#ff5a5a22',
          color: message.type === 'success' ? '#2dd882' : '#ff5a5a',
          border: '1px solid ' + (message.type === 'success' ? '#2dd88244' : '#ff5a5a44'),
        }}>{message.text}</div>
      )}

      {showForm && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          {available.length === 0 ? (
            <span style={{ color: '#6b6b85', fontSize: '13px' }}>All people are already in this project</span>
          ) : (
            <>
              <select
                style={selectStyle}
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
              >
                <option value="">Select a person...</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.company ? ' (' + p.company + ')' : ''}
                  </option>
                ))}
              </select>
              <input
                style={inputStyle}
                type="text"
                placeholder="Role (optional)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              <button
                style={{ ...btnPrimary, opacity: !selectedPersonId || isPending ? 0.5 : 1 }}
                onClick={handleAdd}
                disabled={!selectedPersonId || isPending}
              >
                {isPending ? 'Adding...' : 'Add'}
              </button>
            </>
          )}
        </div>
      )}

      {people.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: '#6b6b85', fontSize: '13px' }}>
          <div style={{ marginBottom: '4px' }}>No people assigned yet</div>
          <div style={{ fontSize: '12px' }}>Click &apos;+ Add Person&apos; to associate contacts with this project</div>
        </div>
      )}

      {people.map((pp) => (
        <div key={pp.id} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={avatarStyle}>{pp.person.name.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0e0e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pp.person.name}
              </div>
              {(pp.person.email || pp.person.company) && (
                <div style={{ fontSize: '12px', color: '#6b6b85', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[pp.person.email, pp.person.company].filter(Boolean).join(' \u00b7 ')}
                </div>
              )}
            </div>
            {pp.role && (
              <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: '#2dd88222', color: '#2dd882', textTransform: 'uppercase', marginLeft: '8px' }}>
                {pp.role}
              </span>
            )}
          </div>
          {canManage && (
            <button
              style={{ background: 'none', border: 'none', color: '#ff5a5a', cursor: 'pointer', fontSize: '18px', padding: '4px 8px', borderRadius: '6px', lineHeight: 1 }}
              onClick={() => handleRemove(pp.person.id, pp.person.name)}
              disabled={isPending}
              title={'Remove ' + pp.person.name}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
