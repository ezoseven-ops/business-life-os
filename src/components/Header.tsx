import Link from 'next/link'

interface HeaderProps {
  title: string
  backHref?: string
  action?: React.ReactNode
}

export function Header({ title, backHref, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 os-header">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              className="-ml-1 p-2.5 rounded-xl active:scale-[0.95]"
              style={{ color: 'var(--color-cc-accent)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
          )}
          <h1
            className="text-[18px] font-bold tracking-[-0.02em]"
            style={{ color: 'var(--color-cc-text)' }}
          >
            {title}
          </h1>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  )
}
