import { APP_NAME } from '@/lib/constants'

type BrandLockupProps = {
  compact?: boolean
}

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'Georgia, serif',
        fontSize: compact ? 18 : 20,
        fontWeight: 700,
        lineHeight: 1,
        color: 'var(--ink)',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--accent)' }}>◎</span>
      <span>{APP_NAME}</span>
    </span>
  )
}
