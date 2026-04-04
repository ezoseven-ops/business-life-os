export default function AppLoading() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center safe-top safe-bottom"
      style={{ backgroundColor: 'var(--color-cc-bg)' }}
    >
      <div className="flex flex-col items-center gap-8 px-8 max-w-sm">
        {/* Quote */}
        <blockquote className="text-center">
          <p
            className="text-[20px] leading-relaxed font-light tracking-tight"
            style={{ color: 'var(--color-cc-text)', letterSpacing: '-0.01em' }}
          >
            Chaos is expensive.
            <br />
            Structure is leverage.
          </p>
        </blockquote>

        {/* Brand */}
        <span
          className="text-[11px] font-medium uppercase tracking-[0.2em]"
          style={{ color: 'var(--color-cc-text-dim)' }}
        >
          Business Life OS
        </span>
      </div>
    </div>
  )
}
