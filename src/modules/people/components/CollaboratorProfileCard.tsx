'use client'

import { useState, useCallback } from 'react'
import {
  getCollaboratorProfileAction,
  updateCollaboratorProfileAction,
  captureCollaboratorAction,
} from '../collaborator.actions'
import { ErrorBanner } from '@/components/ErrorStates'
import type { CollaboratorProfile, UpdateCollaboratorInput } from '../collaborator.types'

const AVAILABILITY_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACTOR: 'Contractor',
  OCCASIONAL: 'Occasional',
  UNKNOWN: 'Unknown',
}

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  email: 'Email',
  internal: 'Internal',
}

export function CollaboratorProfileCard({
  personId,
  personName,
  initialProfile,
}: {
  personId: string
  personName: string
  initialProfile: CollaboratorProfile | null
}) {
  const [profile, setProfile] = useState<CollaboratorProfile | null>(initialProfile)
  const [editing, setEditing] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseText, setParseText] = useState('')
  const [showParseInput, setShowParseInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state
  const [editRole, setEditRole] = useState(profile?.role ?? '')
  const [editSkills, setEditSkills] = useState(profile?.skills?.join(', ') ?? '')
  const [editStrengths, setEditStrengths] = useState(profile?.strengths?.join(', ') ?? '')
  const [editAvailability, setEditAvailability] = useState(profile?.availability ?? 'UNKNOWN')
  const [editReliability, setEditReliability] = useState(profile?.reliabilityScore ?? 50)
  const [editTimezone, setEditTimezone] = useState(profile?.timezone ?? '')
  const [editChannel, setEditChannel] = useState(profile?.preferredChannel ?? '')

  const hasProfile = profile && (profile.role || profile.skills.length > 0 || profile.strengths.length > 0)

  const handleStartEdit = useCallback(() => {
    setEditRole(profile?.role ?? '')
    setEditSkills(profile?.skills?.join(', ') ?? '')
    setEditStrengths(profile?.strengths?.join(', ') ?? '')
    setEditAvailability(profile?.availability ?? 'UNKNOWN')
    setEditReliability(profile?.reliabilityScore ?? 50)
    setEditTimezone(profile?.timezone ?? '')
    setEditChannel(profile?.preferredChannel ?? '')
    setEditing(true)
    setError(null)
  }, [profile])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)

    const result = await updateCollaboratorProfileAction({
      personId,
      role: editRole.trim() || null,
      skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
      strengths: editStrengths.split(',').map(s => s.trim()).filter(Boolean),
      availability: editAvailability as UpdateCollaboratorInput['availability'],
      reliabilityScore: editReliability,
      timezone: editTimezone.trim() || null,
      preferredChannel: editChannel ? (editChannel as UpdateCollaboratorInput['preferredChannel']) : null,
    })

    setSaving(false)

    if (result.success) {
      setProfile(result.data)
      setEditing(false)
    } else {
      setError(result.error)
    }
  }, [personId, editRole, editSkills, editStrengths, editAvailability, editReliability, editTimezone, editChannel])

  const handleParseFromText = useCallback(async () => {
    if (!parseText.trim()) return
    setParsing(true)
    setError(null)

    const result = await captureCollaboratorAction(parseText.trim())
    setParsing(false)

    if (result.success) {
      // Refresh profile
      const profileResult = await getCollaboratorProfileAction(personId)
      if (profileResult.success) {
        setProfile(profileResult.data)
      }
      setShowParseInput(false)
      setParseText('')
    } else {
      setError(result.error)
    }
  }, [parseText, personId])

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-cc-text-muted)]">
          Collaborator Profile
        </h3>
        <div className="flex items-center gap-2">
          {!editing && !showParseInput && (
            <>
              <button
                onClick={() => setShowParseInput(true)}
                className="text-xs font-medium text-[var(--color-cc-accent)]/70 hover:text-[var(--color-cc-accent)] transition-colors"
                style={{ minHeight: '44px', padding: '10px 12px' }}
              >
                AI Parse
              </button>
              <button
                onClick={handleStartEdit}
                className="text-xs font-medium text-[var(--color-cc-accent)]/70 hover:text-[var(--color-cc-accent)] transition-colors"
                style={{ minHeight: '44px', padding: '10px 12px' }}
              >
                {hasProfile ? 'Edit' : 'Add Profile'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-3"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}

      {/* AI Parse Input */}
      {showParseInput && (
        <div className="space-y-3 mb-4">
          <textarea
            value={parseText}
            onChange={(e) => setParseText(e.target.value)}
            placeholder={`Describe ${personName}'s profile, e.g. "backend developer, great with APIs and TypeScript, very reliable, available full-time"`}
            rows={3}
            className="w-full text-sm border border-white/6 rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-cc-accent)]/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleParseFromText}
              disabled={parsing || !parseText.trim()}
              className="flex-1 text-sm font-semibold rounded-xl bg-[var(--color-cc-accent)] text-[var(--color-cc-bg)] disabled:opacity-40 transition-all"
              style={{ height: '44px' }}
            >
              {parsing ? 'Analyzing...' : 'Parse with AI'}
            </button>
            <button
              onClick={() => { setShowParseInput(false); setParseText(''); setError(null) }}
              className="text-sm text-[var(--color-cc-text-muted)] rounded-xl transition-all"
              style={{ height: '44px', padding: '0 12px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">Role</label>
            <input
              type="text"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              placeholder="e.g. Backend Developer"
              className="w-full text-sm border border-white/6 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-cc-accent)]/50"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">Skills (comma-separated)</label>
            <input
              type="text"
              value={editSkills}
              onChange={(e) => setEditSkills(e.target.value)}
              placeholder="TypeScript, React, API design"
              className="w-full text-sm border border-white/6 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-cc-accent)]/50"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">Strengths (comma-separated)</label>
            <input
              type="text"
              value={editStrengths}
              onChange={(e) => setEditStrengths(e.target.value)}
              placeholder="Reliable, fast learner"
              className="w-full text-sm border border-white/6 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-cc-accent)]/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">Availability</label>
              <select
                value={editAvailability}
                onChange={(e) => setEditAvailability(e.target.value as typeof editAvailability)}
                className="w-full text-sm border border-white/6 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-cc-accent)]/50 bg-transparent"
              >
                {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">Preferred Channel</label>
              <select
                value={editChannel}
                onChange={(e) => setEditChannel(e.target.value)}
                className="w-full text-sm border border-white/6 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-cc-accent)]/50 bg-transparent"
              >
                <option value="">Not set</option>
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">
              Reliability Score: {editReliability}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={editReliability}
              onChange={(e) => setEditReliability(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-cc-text-muted)] mb-1 block">Timezone</label>
            <input
              type="text"
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
              placeholder="Europe/Warsaw"
              className="w-full text-sm border border-white/6 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-cc-accent)]/50"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-sm font-semibold rounded-xl bg-[var(--color-cc-accent)] text-[var(--color-cc-bg)] disabled:opacity-40 transition-all"
              style={{ height: '44px' }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null) }}
              className="text-sm text-[var(--color-cc-text-muted)] rounded-xl transition-all"
              style={{ height: '44px', padding: '0 12px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profile Display */}
      {!editing && !showParseInput && (
        <>
          {hasProfile ? (
            <div className="space-y-2.5">
              {profile.role && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--color-cc-text-muted)] w-24">Role</span>
                  <span className="text-[var(--color-cc-text)] font-medium">{profile.role}</span>
                </div>
              )}
              {profile.skills.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-[var(--color-cc-text-muted)] w-24 pt-0.5">Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill, i) => (
                      <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.strengths.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="text-[var(--color-cc-text-muted)] w-24 pt-0.5">Strengths</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.strengths.map((s, i) => (
                      <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[var(--color-cc-text-muted)] w-24">Availability</span>
                <span className="text-[var(--color-cc-text)]">{AVAILABILITY_LABELS[profile.availability] ?? 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[var(--color-cc-text-muted)] w-24">Reliability</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-transparent/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${profile.reliabilityScore}%`,
                        backgroundColor: profile.reliabilityScore > 70 ? 'var(--color-cc-success)'
                          : profile.reliabilityScore > 40 ? 'var(--color-cc-risk)'
                          : 'var(--color-cc-fire)',
                      }}
                    />
                  </div>
                  <span className="text-[var(--color-cc-text-secondary)] text-xs">{profile.reliabilityScore}%</span>
                </div>
              </div>
              {profile.timezone && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--color-cc-text-muted)] w-24">Timezone</span>
                  <span className="text-[var(--color-cc-text)]">{profile.timezone}</span>
                </div>
              )}
              {profile.preferredChannel && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--color-cc-text-muted)] w-24">Channel</span>
                  <span className="text-[var(--color-cc-text)]">{CHANNEL_LABELS[profile.preferredChannel] ?? profile.preferredChannel}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-cc-text-muted)]">
              No collaborator profile yet. Use AI Parse or add manually.
            </p>
          )}
        </>
      )}
    </div>
  )
}
