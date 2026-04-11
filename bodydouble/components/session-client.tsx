'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DailyCall, DailyParticipant, DailyParticipantsObject } from '@daily-co/daily-js'
import { buildShareText } from '@/lib/utils'

type SessionClientProps = {
  durationMinutes: number
  roomId: string
  roomMessage: string
  roomUrl: string
  partnerId: string
  partnerName: string
  partnerGoal: string
  initialGoal: string
}

function DailyTile({
  participant,
  label,
  muted,
}: {
  participant: DailyParticipant | null
  label: string
  muted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoTrack = participant?.tracks.video.persistentTrack ?? null
  const audioTrack = participant?.tracks.audio.persistentTrack ?? null
  const hasPlayableVideo = participant?.tracks.video.state === 'playable' && videoTrack
  const hasPlayableAudio = participant?.tracks.audio.state === 'playable' && audioTrack

  useEffect(() => {
    const videoElement = videoRef.current
    const audioElement = audioRef.current

    if (videoElement) {
      if (hasPlayableVideo && videoTrack) {
        const stream = new MediaStream()
        stream.addTrack(videoTrack)
        videoElement.srcObject = stream
      } else {
        videoElement.srcObject = null
      }
    }

    if (audioElement) {
      if (!hasPlayableVideo && hasPlayableAudio && audioTrack) {
        const stream = new MediaStream([audioTrack])
        audioElement.srcObject = stream
      } else {
        audioElement.srcObject = null
      }
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null
      }
      if (audioElement) {
        audioElement.srcObject = null
      }
    }
  }, [audioTrack, hasPlayableAudio, hasPlayableVideo, videoTrack])

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-border-card bg-[#0d1720]">
      {hasPlayableVideo ? (
        <video
          autoPlay
          className="aspect-[16/9] h-full min-h-[300px] w-full object-cover"
          muted={muted}
          playsInline
          ref={videoRef}
        />
      ) : (
        <div className="flex aspect-[16/9] min-h-[300px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(114,163,128,0.28),_transparent_55%),linear-gradient(180deg,_#162430,_#0d1720)] p-8 text-center">
          <div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[18px] font-semibold text-white">
              {label
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <p className="text-[18px] font-medium text-white">{label}</p>
            <p className="mt-2 text-[13px] text-white/70">
              {participant
                ? 'Camera is off right now. Quiet presence still counts.'
                : 'Waiting for this tile to connect.'}
            </p>
          </div>
        </div>
      )}
      {!hasPlayableVideo && hasPlayableAudio ? <audio autoPlay muted={muted} playsInline ref={audioRef} /> : null}
      <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[12px] font-medium text-white backdrop-blur">
        {label}
      </div>
    </div>
  )
}

function hasActiveScreenShare(participant: DailyParticipant | null) {
  const screenState = participant?.tracks.screenVideo.state
  return screenState === 'playable' || screenState === 'loading' || screenState === 'interrupted'
}

export function SessionClient({
  durationMinutes,
  roomId,
  roomMessage,
  roomUrl,
  partnerId,
  partnerName,
  partnerGoal,
  initialGoal,
}: SessionClientProps) {
  const totalSeconds = durationMinutes * 60
  const router = useRouter()
  const displayPartnerName = partnerName && partnerName !== 'your partner' ? partnerName : 'Focus partner'
  const isDailyRoom = roomUrl.startsWith('https://') && roomUrl.includes('.daily.co/')
  const callObjectRef = useRef<DailyCall | null>(null)
  const [goal, setGoal] = useState(initialGoal)
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [isRunning, setIsRunning] = useState(true)
  const [ended, setEnded] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [summary, setSummary] = useState<{ minutes: number; streak: number } | null>(null)
  const [friendStatus, setFriendStatus] = useState<'idle' | 'friends' | 'pending' | 'sending'>('idle')
  const [friendMessage, setFriendMessage] = useState('')
  const [dailyState, setDailyState] = useState<'idle' | 'connecting' | 'joined' | 'error'>('idle')
  const [dailyError, setDailyError] = useState('')
  const [participants, setParticipants] = useState<DailyParticipantsObject | null>(null)
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false)
  const [localVideoEnabled, setLocalVideoEnabled] = useState(false)
  const [localScreenShareEnabled, setLocalScreenShareEnabled] = useState(false)
  const [mediaAction, setMediaAction] = useState<'audio' | 'video' | 'screen' | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [showReportModal, setShowReportModal] = useState(false)

  const syncCallState = useCallback(() => {
    const callObject = callObjectRef.current
    if (!callObject) {
      return
    }

    const snapshot = callObject.participants()
    setParticipants({ ...snapshot })
    setLocalAudioEnabled(callObject.localAudio())
    setLocalVideoEnabled(callObject.localVideo())
    setLocalScreenShareEnabled(hasActiveScreenShare(snapshot.local ?? null))
  }, [])

  useEffect(() => {
    setSecondsLeft(totalSeconds)
  }, [totalSeconds])

  useEffect(() => {
    if (!partnerId) {
      return
    }

    let isActive = true

    async function loadFriendStatus() {
      const response = await fetch('/api/friends')
      if (!response.ok) {
        return
      }

      const data = (await response.json()) as {
        friends?: Array<{ id: string }>
        pending?: Array<{ id: string }>
        sent?: Array<{ id: string }>
      }

      if (!isActive) {
        return
      }

      if (data.friends?.some((item) => item.id === partnerId)) {
        setFriendStatus('friends')
        return
      }

      if (data.sent?.some((item) => item.id === partnerId) || data.pending?.some((item) => item.id === partnerId)) {
        setFriendStatus('pending')
        return
      }

      setFriendStatus('idle')
    }

    void loadFriendStatus()

    return () => {
      isActive = false
    }
  }, [partnerId])

  useEffect(() => {
    if (!isRunning || ended) return

    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [ended, isRunning])

  const endSession = useCallback(async () => {
    if (isEnding || ended) {
      return
    }

    setIsEnding(true)
    const minutesCompleted = Math.max(1, Math.round((totalSeconds - secondsLeft) / 60))
    try {
      await callObjectRef.current?.leave().catch(() => undefined)

      const response = await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          goal,
          durationMinutes: minutesCompleted,
        }),
      })

      const data = await response.json()
      setSummary({ minutes: data.durationMinutes ?? minutesCompleted, streak: data.streak ?? 0 })
      setEnded(true)
      setIsRunning(false)
    } finally {
      setIsEnding(false)
    }
  }, [ended, goal, isEnding, roomId, secondsLeft, totalSeconds])

  async function addPartnerAsFriend() {
    if (!partnerId || friendStatus === 'friends' || friendStatus === 'pending' || friendStatus === 'sending') {
      return
    }

    setFriendStatus('sending')
    setFriendMessage('')

    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: partnerId }),
    })

    const data = (await response.json()) as { error?: string; name?: string }

    if (!response.ok) {
      setFriendStatus('idle')
      setFriendMessage(data.error ?? 'Could not send the friend request right now.')
      return
    }

    setFriendStatus('pending')
    setFriendMessage(`Friend request sent to ${data.name ?? displayPartnerName}.`)
  }

  useEffect(() => {
    if (secondsLeft === 0 && !ended && !isEnding) {
      void endSession()
    }
  }, [endSession, ended, isEnding, secondsLeft])

  useEffect(() => {
    if (!isDailyRoom || !roomUrl) {
      setDailyState('idle')
      setDailyError('')
      return
    }

    let isActive = true
    let callObject: DailyCall | null = null

    async function connectDaily() {
      setDailyState('connecting')
      setDailyError('')

      try {
        const dailyModule = await import('@daily-co/daily-js')
        const Daily = dailyModule.default

        if (!isActive) {
          return
        }

        callObject = Daily.createCallObject({
          subscribeToTracksAutomatically: true,
          dailyConfig: {
            avoidEval: true,
          },
        })

        callObjectRef.current = callObject

        const handleParticipantChange = () => {
          if (!isActive) {
            return
          }
          syncCallState()
        }

        const handleJoined = () => {
          if (!isActive) {
            return
          }
          setDailyState('joined')
          syncCallState()
        }

        callObject
          .on('joined-meeting', handleJoined)
          .on('participant-joined', handleParticipantChange)
          .on('participant-updated', handleParticipantChange)
          .on('participant-left', handleParticipantChange)
          .on('camera-error', (event) => {
            if (!isActive) {
              return
            }
            setDailyError(event?.errorMsg?.errorMsg ?? 'Daily could not access your selected camera or microphone.')
            syncCallState()
          })
          .on('left-meeting', () => {
            if (!isActive) {
              return
            }
            setParticipants(null)
            setLocalAudioEnabled(false)
            setLocalVideoEnabled(false)
            setLocalScreenShareEnabled(false)
          })

        await callObject.join({
          url: roomUrl,
          startAudioOff: true,
          startVideoOff: true,
        })
      } catch (error) {
        if (!isActive) {
          return
        }

        setDailyState('error')
        setDailyError(error instanceof Error ? error.message : 'Daily could not load the custom call view.')
      }
    }

    void connectDaily()

    return () => {
      isActive = false

      if (callObject) {
        void callObject.destroy().catch(() => undefined)
      }

      callObjectRef.current = null
    }
  }, [isDailyRoom, roomUrl, syncCallState])

  const toggleLocalAudio = useCallback(async () => {
    const callObject = callObjectRef.current
    if (!callObject) {
      return
    }

    setMediaAction('audio')
    setDailyError('')

    try {
      await callObject.setLocalAudio(!callObject.localAudio())
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Microphone access could not be changed.')
    } finally {
      window.setTimeout(syncCallState, 50)
      setMediaAction(null)
    }
  }, [syncCallState])

  const toggleLocalVideo = useCallback(async () => {
    const callObject = callObjectRef.current
    if (!callObject) {
      return
    }

    setMediaAction('video')
    setDailyError('')

    try {
      await callObject.setLocalVideo(!callObject.localVideo())
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Camera access could not be changed.')
    } finally {
      window.setTimeout(syncCallState, 50)
      setMediaAction(null)
    }
  }, [syncCallState])

  const toggleScreenShare = useCallback(async () => {
    const callObject = callObjectRef.current
    if (!callObject) {
      return
    }

    setMediaAction('screen')
    setDailyError('')

    try {
      if (hasActiveScreenShare(callObject.participants().local ?? null)) {
        await callObject.stopScreenShare()
      } else {
        await callObject.startScreenShare()
      }
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Screen share could not be started.')
    } finally {
      window.setTimeout(syncCallState, 50)
      setMediaAction(null)
    }
  }, [syncCallState])

  const submitReport = useCallback(async () => {
    if (!partnerId || !reportReason.trim() || reportStatus === 'sending') {
      return
    }

    setReportStatus('sending')
    setDailyError('')

    try {
      const response = await fetch('/api/session/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          reportedUserId: partnerId,
          reason: reportReason,
          details: reportDetails,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not submit the report.')
      }

      setReportStatus('sent')
      setReportDetails('')
      setReportReason('')
      window.setTimeout(() => {
        setShowReportModal(false)
        setReportStatus('idle')
      }, 900)
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not submit the report.')
      setReportStatus('idle')
    }
  }, [partnerId, reportDetails, reportReason, reportStatus, roomId])

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100
  const dashOffset = 339 - (339 * progress) / 100
  const shareText = useMemo(() => buildShareText(summary?.minutes ?? durationMinutes, summary?.streak ?? 0), [summary, durationMinutes])
  const hasRoom = Boolean(roomUrl)
  const remoteParticipants = useMemo(
    () =>
      Object.values(participants ?? {})
        .filter((participant) => participant && !participant.local)
        .sort((left, right) => Number(right.video) - Number(left.video)),
    [participants]
  )
  const localParticipant = participants?.local ?? null
  const primaryRemoteParticipant = remoteParticipants[0] ?? null

  if (ended) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="card w-full max-w-[640px] text-center">
          <p className="section-label mb-3">Session complete</p>
          <h1 className="text-[34px] leading-tight">You focused for {summary?.minutes ?? durationMinutes} minutes.</h1>
          <p className="mt-3 text-[14px] text-ink-muted">
            Your streak is now {summary?.streak ?? 0} days. Small, steady focus still counts.
          </p>
          <div className="banner mx-auto mt-5 max-w-[480px] text-left text-[13px]">
            Share what you got done, join the Discord community, or take a breath before the next sprint.
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button className="btn-primary" onClick={() => router.push('/match')} type="button">
              Find another partner
            </button>
            <a
              className="btn-ghost inline-flex items-center justify-center"
              href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#'}
              target="_blank"
            >
              Join the Discord
            </a>
            <a
              className="btn-ghost inline-flex items-center justify-center"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
              target="_blank"
            >
              Share your streak
            </a>
            <button className="btn-ghost" onClick={() => router.push('/dashboard')} type="button">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[1380px]">
        <div className="banner mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label mb-1">Live session</p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[14px]">{`Session with ${displayPartnerName}${partnerGoal ? ` | ${partnerGoal}` : ''}`}</p>
              {partnerId ? (
                <button
                  className="btn-ghost"
                  disabled={friendStatus === 'friends' || friendStatus === 'pending' || friendStatus === 'sending'}
                  onClick={addPartnerAsFriend}
                  type="button"
                >
                  {friendStatus === 'friends'
                    ? 'Already friends'
                    : friendStatus === 'pending'
                      ? 'Request sent'
                      : friendStatus === 'sending'
                        ? 'Sending...'
                        : 'Add as focus friend'}
                </button>
              ) : null}
            </div>
            {friendMessage ? (
              <p className="mt-2 text-[12px]" style={{ color: 'var(--accent-dark)' }}>
                {friendMessage}
              </p>
            ) : null}
          </div>
          <p className="text-[13px]">Camera is optional. Quiet company still helps.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="card p-3">
            <div className="overflow-hidden rounded-[12px] border border-border-card">
              {hasRoom ? (
                <div className="bg-card p-3">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-2 pt-2">
                    <div>
                      <p className="section-label mb-1">{isDailyRoom ? 'Video room' : 'Embedded room'}</p>
                      <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                        {isDailyRoom
                          ? `Daily is running in a custom in-page call view for this ${durationMinutes}-minute focus sprint.`
                          : `The room is running inside the app for this ${durationMinutes}-minute focus sprint. Camera is still optional.`}
                      </p>
                    </div>
                    <a
                      className="btn-ghost inline-flex items-center justify-center"
                      href={roomUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open in new tab
                    </a>
                  </div>
                  {isDailyRoom ? (
                    <div className="rounded-[12px] border border-border-card bg-[var(--surface)] p-3">
                      {dailyState === 'error' ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-[18px] border border-border-card bg-card px-8 text-center">
                          <div className="max-w-[520px]">
                            <p className="section-label mb-3">Call setup issue</p>
                            <h2 className="text-[30px] leading-tight">The custom Daily call view could not connect.</h2>
                            <p className="mt-3 text-[14px] text-ink-muted">
                              You can retry here or open the room directly in a new tab while we keep the timer and notes in place.
                            </p>
                            {dailyError ? (
                              <p className="mt-3 text-[12px]" style={{ color: 'var(--faint)' }}>
                                Daily said: {dailyError}
                              </p>
                            ) : roomMessage ? (
                              <p className="mt-3 text-[12px]" style={{ color: 'var(--faint)' }}>
                                Room note: {roomMessage}
                              </p>
                            ) : null}
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                              <button className="btn-primary" onClick={() => router.refresh()} type="button">
                                Retry call
                              </button>
                              <a
                                className="btn-ghost inline-flex items-center justify-center"
                                href={roomUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Open room in new tab
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                            <DailyTile label={displayPartnerName} participant={primaryRemoteParticipant} />
                            <DailyTile label="You" muted participant={localParticipant} />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border-card bg-card p-4">
                            <div>
                              <p className="text-[14px] font-medium text-ink">
                                {primaryRemoteParticipant ? `${displayPartnerName} is in the room.` : `Waiting for ${displayPartnerName} to join.`}
                              </p>
                              <p className="mt-1 text-[12px] text-ink-muted">
                                {dailyState === 'connecting'
                                  ? 'Connecting to the room now.'
                                  : dailyError || 'Turn camera or mic on only if you want to.'}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                className={localAudioEnabled ? 'btn-primary' : 'btn-ghost'}
                                disabled={mediaAction !== null}
                                onClick={() => void toggleLocalAudio()}
                                type="button"
                              >
                                {mediaAction === 'audio' ? 'Updating mic...' : localAudioEnabled ? 'Mute mic' : 'Turn mic on'}
                              </button>
                              <button
                                className={localVideoEnabled ? 'btn-primary' : 'btn-ghost'}
                                disabled={mediaAction !== null}
                                onClick={() => void toggleLocalVideo()}
                                type="button"
                              >
                                {mediaAction === 'video' ? 'Updating camera...' : localVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                              </button>
                              <button
                                className={localScreenShareEnabled ? 'btn-primary' : 'btn-ghost'}
                                disabled={mediaAction !== null}
                                onClick={() => void toggleScreenShare()}
                                type="button"
                              >
                                {mediaAction === 'screen' ? 'Sharing...' : localScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <iframe
                      allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
                      className="min-h-[420px] w-full rounded-[12px] border border-border-card"
                      src={roomUrl}
                      title="Body Double video room"
                    />
                  )}
                </div>
              ) : (
                <div className="flex min-h-[360px] items-center justify-center bg-card p-6 text-center">
                  <div className="max-w-[420px]">
                    <p className="section-label mb-3">Room unavailable</p>
                    <h2 className="text-[30px] leading-tight">This session does not have a Daily room yet.</h2>
                    <p className="mt-3 text-[14px] text-ink-muted">
                      This session is running in local mock mode or was created before Daily was available. Start a fresh match to launch the embedded video room.
                    </p>
                    {roomMessage ? (
                      <p className="mt-3 text-[12px]" style={{ color: 'var(--faint)' }}>
                        Daily said: {roomMessage}
                      </p>
                    ) : null}
                    <button
                      className="btn-primary mt-6 inline-flex w-full items-center justify-center"
                      onClick={() => router.push('/match')}
                      type="button"
                    >
                      Start fresh match
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="card text-center">
              <p className="section-label mb-3">Pomodoro timer</p>
              <div className="relative mx-auto flex h-[120px] w-[120px] items-center justify-center">
                <svg className="h-[120px] w-[120px] -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" fill="none" r="54" stroke="var(--bdc)" strokeWidth="6" />
                  <circle
                    cx="60"
                    cy="60"
                    fill="none"
                    r="54"
                    stroke="var(--accent)"
                    strokeDasharray="339"
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    strokeWidth="6"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="font-serif text-[32px] text-ink">
                    {minutes}:{seconds}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button className="btn-ghost" onClick={() => setIsRunning(false)} type="button">
                  Pause
                </button>
                <button className="btn-ghost" onClick={() => setIsRunning(true)} type="button">
                  Resume
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setSecondsLeft(totalSeconds)
                    setIsRunning(false)
                  }}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="card">
              <label className="section-label mb-2 block">Your goal this session</label>
              <textarea className="input min-h-[120px]" onChange={(event) => setGoal(event.target.value)} value={goal} />
            </div>

            <div className="card">
              <p className="section-label mb-2">Focus partner</p>
              <p className="text-[16px] font-medium text-ink">{displayPartnerName}</p>
              <p className="mt-2 text-[12px] text-ink-muted">
                Quiet company, gentle accountability, one sprint at a time.
              </p>
              {partnerId ? (
                <button
                  className="btn-ghost mt-4 w-full"
                  disabled={friendStatus === 'friends' || friendStatus === 'pending' || friendStatus === 'sending'}
                  onClick={addPartnerAsFriend}
                  type="button"
                >
                  {friendStatus === 'friends'
                    ? 'Already friends'
                    : friendStatus === 'pending'
                      ? 'Request sent'
                      : friendStatus === 'sending'
                        ? 'Sending...'
                        : 'Add as focus friend'}
                </button>
              ) : null}
              {friendMessage ? (
                <p className="mt-3 text-[12px]" style={{ color: 'var(--accent-dark)' }}>
                  {friendMessage}
                </p>
              ) : null}
              {partnerId ? (
                <button className="btn-ghost mt-3 w-full" onClick={() => setShowReportModal(true)} type="button">
                  Report this user
                </button>
              ) : null}
            </div>

            <div className="card">
              <p className="section-label mb-2">Partner goal</p>
              <div className="chip chip-selected inline-flex">{partnerGoal || 'Quiet accountability'}</div>
            </div>

            <button className="btn-ghost w-full" onClick={endSession} type="button">
              {isEnding ? 'Wrapping up...' : 'End session'}
            </button>
          </aside>
        </div>
      </div>
      {showReportModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="card w-full max-w-[560px]">
            <p className="section-label mb-3">Report user</p>
            <h2 className="text-[28px] leading-tight">Flag {displayPartnerName} for review</h2>
            <p className="mt-2 text-[13px] text-ink-muted">
              This goes to the admin moderation queue so the account can be reviewed and banned if needed.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="section-label mb-2 block">Reason</label>
                <input
                  className="input"
                  onChange={(event) => setReportReason(event.target.value)}
                  placeholder="Harassment, unsafe behavior, spam, etc."
                  value={reportReason}
                />
              </div>
              <div>
                <label className="section-label mb-2 block">Details</label>
                <textarea
                  className="input min-h-[120px]"
                  onChange={(event) => setReportDetails(event.target.value)}
                  placeholder="Anything the moderation team should know"
                  value={reportDetails}
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                className="btn-ghost"
                onClick={() => {
                  if (reportStatus !== 'sending') {
                    setShowReportModal(false)
                    setReportStatus('idle')
                  }
                }}
                type="button"
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={!reportReason.trim() || reportStatus === 'sending'} onClick={() => void submitReport()} type="button">
                {reportStatus === 'sending' ? 'Sending...' : reportStatus === 'sent' ? 'Reported' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
