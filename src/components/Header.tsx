import Link from 'next/link'

interface HeaderProps {
  title: string
  backHref?: string
  action?: React.ReactNode
}

export function Header({ title, backHref, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {backHref && (
            <Link href={backHref} className="text-primary -ml-2 p-1.5 rounded-lg hover:bg-gray-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
          )}
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  )
}
