import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ClientNav } from '@/components/ClientNav'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  // Only CLIENT role can access the client portal
  // OWNER and TEAM should use the main app
  if (session.user.role !== 'CLIENT') redirect('/')

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ backgroundColor: '#f9fafb' }}>
      <main className="flex-1 pb-20">
        {children}
      </main>
      <ClientNav />
    </div>
  )
}
