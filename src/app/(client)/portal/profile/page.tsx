import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { SignOutButton } from './SignOutButton'

export default async function ClientProfilePage() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <div>
      <Header title="Profile" />

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        {/* Profile Card */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || ''}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-primary">
                {session.user.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {session.user.name || 'Unnamed'}
            </p>
            <p className="text-sm text-gray-500">{session.user.email}</p>
          </div>
          <div className="inline-block bg-blue-100 text-blue-700 text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
            Client
          </div>
        </section>

        {/* Account Info */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Account
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{session.user.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Role</span>
              <span className="text-sm font-medium text-gray-900">Client</span>
            </div>
          </div>
        </section>

        {/* Sign Out */}
        <SignOutButton />
      </div>
    </div>
  )
}
