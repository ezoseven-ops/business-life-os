import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { MobileNav } from '@/components/MobileNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  // Redirect CLIENT users to the client portal
  if (session.user.role === 'CLIENT') redirect('/portal')

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom" style={{ backgroundColor: '#f9fafb' }}>
      <main className="flex-1 pb-20">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
