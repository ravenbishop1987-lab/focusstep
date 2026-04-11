import { requireOnboardedProfile } from '@/lib/data'
import { DashboardNav } from '@/components/dashboard-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireOnboardedProfile()

  return (
    <>
      <DashboardNav name={profile.name} plan={profile.plan} />
      {children}
    </>
  )
}
