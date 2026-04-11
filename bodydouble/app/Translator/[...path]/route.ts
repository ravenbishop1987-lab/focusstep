import { NextResponse } from 'next/server'
import { loadTranslatorAsset } from '@/lib/translator-static'

export async function GET(_: Request, { params }: { params: { path: string[] } }) {
  const asset = await loadTranslatorAsset(params.path.join('/'))

  if (!asset) {
    return NextResponse.json({ error: 'Translator asset not found.' }, { status: 404 })
  }

  return new NextResponse(asset.content, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': asset.contentType.startsWith('text/html') ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  })
}
