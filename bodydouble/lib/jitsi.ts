const DEFAULT_JITSI_DOMAIN = 'meet.jit.si'

export function getJitsiDomain() {
  return process.env.NEXT_PUBLIC_JITSI_DOMAIN || DEFAULT_JITSI_DOMAIN
}

export function buildJitsiRoomName() {
  return `BodyDouble-${crypto.randomUUID()}`
}

export function buildJitsiRoomUrl(roomName: string) {
  const domain = getJitsiDomain()
  const baseUrl = new URL(`https://${domain}/${roomName}`)
  baseUrl.searchParams.set('jwt', '')
  return baseUrl.toString().replace('?jwt=', '')
}

