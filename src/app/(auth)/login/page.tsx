import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginButtons } from './login-buttons'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/')

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text">Business Life OS</h1>
          <p className="mt-2 text-text-secondary">Your command center</p>
        </div>

        <LoginButtons isDev={isDev} />
      </div>
    </div>
  )
}
