'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors"
    >
      Sign Out
    </button>
  )
}
