'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { messageToTaskAction, sendReplyAction } from '@/modules/communications/comms.actions'

interface ThreadActionsProps {
  personId: string
  personName: string
  projects: { id: string; name: string }[]
  messages: { id: string; content: string | null }[]
  hasTelegram: boolean
  hasWhatsApp: boolean
}

type Mode = 'idle' | 'reply' | 'create-task'

export function ThreadActions({
  personId,
  personName,
  projects,
  messages,
  hasTelegram,
  hasWhatsApp,
}: ThreadActionsProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reply state
  const [replyText, setReplyText] = useState('')
  const [replyChannel, setReplyChannel] = useState<'TELEGRAM' | 'WHATSAPP'>(
    hasTelegram ? 'TELEGRAM' : 'WHATSAPP'
  )

  // Create task state
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskProjectId, setTaskProjectId] = useState(projects[0]?.id || '')
  const [selectedMessageId, setSelectedMessageId] = useState('')

  async function handleReply() {
    if (!replyText.trim() || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await sendReplyAction({
        personId,
        channel: replyChannel,
        content: replyText.trim(),
      })
      if (result.success) {
        setReplyText('')
        setMode('idle')
        router.refresh()
      } else {
        setError(result.error || 'Failed to send')
      }
    } catch {
      setError('Failed to send message')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateTask() {
    if (!taskTitle.trim() || !taskProjectId || saving) return
    const msgId = selectedMessageId || messages[messages.length - 1]?.id
    if (!msgId) { setError('No message to link'); return }
    setError('')
    setSaving(true)
    try {
      const result = await messageToTaskAction({
        messageId: msgId,
        projectId: taskProjectId,
        title: taskTitle.trim(),
        description: taskDescription,
      })
      if (result.success) {
        setTaskTitle('')
        setTaskDescription('')
        setMode('idle')
        router.refresh()
      } else {
        setError(result.error || 'Failed to create task')
      }
    } catch {
      setError('Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  function startCreateTask(messageId?: string) {
    const msg = messageId
      ? messages.find(m => m.id === messageId)
      : messages[messages.length - 1]
    setSelectedMessageId(msg?.id || '')
    setTaskTitle(msg?.content?.slice(0, 100) || '')
    setTaskDescription(msg?.content || '')
    setMode('create-task')
  }

  if (mode === 'idle') {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-30">
        <div className="flex items-center gap-2 px-4 py-3 max-w-lg mx-auto">
          {(hasTelegram || hasWhatsApp) && (
            <button
              onClick={() => setMode('reply')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
              Reply
            </button>
          )}
          <button
            onClick={() => startCreateTask()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Task
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'reply') {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-30">
        <div className="px-4 py-3 max-w-lg mx-auto space-y-2">
          {hasTelegram && hasWhatsApp && (
            <div className="flex gap-2">
              <button
                onClick={() => setReplyChannel('TELEGRAM')}
                className={`text-xs font-semibold px-3 py-1 rounded-full ${replyChannel === 'TELEGRAM' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}
              >
                Telegram
              </button>
              <button
                onClick={() => setReplyChannel('WHATSAPP')}
                className={`text-xs font-semibold px-3 py-1 rounded-full ${replyChannel === 'WHATSAPP' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
              >
                WhatsApp
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => { setReplyText(e.target.value); setError('') }}
              placeholder={`Reply to ${personName}...`}
              rows={2}
              className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none resize-none border border-gray-200 focus:border-primary"
              autoFocus
              disabled={saving}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || saving}
                className="p-2.5 bg-primary text-white rounded-xl disabled:opacity-40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
              <button onClick={() => { setMode('idle'); setError('') }} className="p-2 text-gray-400 text-xs">
                Cancel
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    )
  }

  // create-task mode
  return (
    <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-30">
      <div className="px-4 py-3 max-w-lg mx-auto space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase text-gray-500">Create Task from Conversation</h4>
          <button onClick={() => { setMode('idle'); setError('') }} className="text-xs text-gray-400">Cancel</button>
        </div>
        <input
          type="text"
          value={taskTitle}
          onChange={(e) => { setTaskTitle(e.target.value); setError('') }}
          placeholder="Task title"
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-gray-200 focus:border-primary"
          autoFocus
          disabled={saving}
        />
        <select
          value={taskProjectId}
          onChange={(e) => setTaskProjectId(e.target.value)}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-gray-200"
          disabled={saving}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <textarea
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          placeholder="Description (from message)"
          rows={2}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none resize-none border border-gray-200"
          disabled={saving}
        />
        <button
          onClick={handleCreateTask}
          disabled={!taskTitle.trim() || !taskProjectId || saving}
          className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {saving ? 'Creating...' : 'Create Task'}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}
