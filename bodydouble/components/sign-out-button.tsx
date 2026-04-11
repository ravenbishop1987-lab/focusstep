'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  className?: string
  style?: React.CSSProperties
}

export function SignOutButton({ className, style }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <button
      className={className}
      disabled={loading}
      onClick={handleSignOut}
      style={style}
      type="button"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
