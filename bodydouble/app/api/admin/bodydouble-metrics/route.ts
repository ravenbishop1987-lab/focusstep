import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const now = new Date().toISOString()

  const [
    { count: totalCompletedSessions },
    { data: recentSessions },
    { count: activeQueueCount },
    { count: waitingCount },
    { count: matchedQueueCount },
    { count: upcomingScheduledCount },
    { count: claimedScheduledCount },
  ] = await Promise.all([
    serviceSupabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed'),
    serviceSupabase
      .from('sessions')
      .select('room_id, duration_minutes, started_at, ended_at, user1_goal, user2_goal')
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(5),
    serviceSupabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'matching', 'matched']),
    serviceSupabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting'),
    serviceSupabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'matched'),
    serviceSupabase
      .from('scheduled_slots')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_at', now),
    serviceSupabase
      .from('scheduled_slots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'claimed')
      .gte('scheduled_at', now),
  ])

  const { data: recentWeekSessions } = await serviceSupabase
    .from('sessions')
    .select('duration_minutes')
    .eq('status', 'completed')
    .gte('started_at', sevenDaysAgo)

  const { data: pageEvents } = await serviceSupabase
    .from('page_analytics_events')
    .select('path, session_id, created_at')
    .in('path', ['/', '/translate'])
    .gte('created_at', sevenDaysAgo)

  const totalMinutesLast7Days = (recentWeekSessions ?? []).reduce(
    (sum, session) => sum + (session.duration_minutes ?? 0),
    0
  )

  const sessionsLast7Days = recentWeekSessions?.length ?? 0
  const avgSessionLength =
    sessionsLast7Days > 0 ? Math.round(totalMinutesLast7Days / sessionsLast7Days) : 0

  const homepageTodayViews = (pageEvents ?? []).filter(
    (event) => event.path === '/' && new Date(event.created_at).getTime() >= todayStart.getTime()
  ).length
  const translateTodayViews = (pageEvents ?? []).filter(
    (event) => event.path === '/translate' && new Date(event.created_at).getTime() >= todayStart.getTime()
  ).length
  const homepageTodayVisitors = new Set(
    (pageEvents ?? [])
      .filter((event) => event.path === '/' && new Date(event.created_at).getTime() >= todayStart.getTime())
      .map((event) => event.session_id)
  ).size
  const translateTodayVisitors = new Set(
    (pageEvents ?? [])
      .filter((event) => event.path === '/translate' && new Date(event.created_at).getTime() >= todayStart.getTime())
      .map((event) => event.session_id)
  ).size

  const dailyTrafficMap = new Map<
    string,
    {
      date: string
      homepageViews: number
      homepageVisitors: Set<string>
      translateViews: number
      translateVisitors: Set<string>
    }
  >()

  for (const event of pageEvents ?? []) {
    const date = new Date(event.created_at).toISOString().slice(0, 10)
    const current =
      dailyTrafficMap.get(date) ??
      {
        date,
        homepageViews: 0,
        homepageVisitors: new Set<string>(),
        translateViews: 0,
        translateVisitors: new Set<string>(),
      }

    if (event.path === '/') {
      current.homepageViews += 1
      current.homepageVisitors.add(event.session_id)
    }

    if (event.path === '/translate') {
      current.translateViews += 1
      current.translateVisitors.add(event.session_id)
    }

    dailyTrafficMap.set(date, current)
  }

  const siteTrafficDaily = Array.from(dailyTrafficMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      date: day.date,
      homepageViews: day.homepageViews,
      homepageVisitors: day.homepageVisitors.size,
      translateViews: day.translateViews,
      translateVisitors: day.translateVisitors.size,
    }))

  return NextResponse.json({
    totalCompletedSessions: totalCompletedSessions ?? 0,
    sessionsLast7Days,
    totalMinutesLast7Days,
    avgSessionLength,
    activeQueueCount: activeQueueCount ?? 0,
    waitingCount: waitingCount ?? 0,
    matchedQueueCount: matchedQueueCount ?? 0,
    upcomingScheduledCount: upcomingScheduledCount ?? 0,
    claimedScheduledCount: claimedScheduledCount ?? 0,
    homepageTodayViews,
    homepageTodayVisitors,
    translateTodayViews,
    translateTodayVisitors,
    siteTrafficDaily,
    recentSessions: recentSessions ?? [],
  })
}
