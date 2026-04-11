import Link from 'next/link'

export default function BannedPage() {
  return (
    <div className="page-shell flex items-center justify-center">
      <div className="card w-full max-w-[620px] text-center">
        <p className="section-label mb-3">Account unavailable</p>
        <h1 className="text-[34px] leading-tight">This account is temporarily blocked.</h1>
        <p className="mt-3 text-[14px] text-ink-muted">
          If you think this was a mistake, contact support so the moderation team can review it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link className="btn-primary" href="/translate">
            Open translator
          </Link>
          <a className="btn-ghost inline-flex items-center justify-center" href="mailto:support@focusstepadhd.com">
            Contact support
          </a>
        </div>
      </div>
    </div>
  )
}
