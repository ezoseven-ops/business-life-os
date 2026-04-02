import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getNoteById } from '@/modules/notes/note.service'
import { NoteDetailClient } from '@/modules/notes/components/NoteDetailClient'
import { notFound } from 'next/navigation'

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const note = await getNoteById(id, session.user.workspaceId!)

  if (!note) {
    notFound()
  }

  return (
    <div className="min-h-dvh bg-white">
      <Header title={note.title || 'Note'} backHref="/notes" />
      <NoteDetailClient note={note} />
    </div>
  )
}
