import { NextResponse } from 'next/server'
import { loadTranslatorAsset } from '@/lib/translator-static'

export async function GET() {
  const asset = await loadTranslatorAsset('')

  if (!asset) {
    return NextResponse.json({ error: 'Translator bundle not found.' }, { status: 404 })
  }

  return new NextResponse(asset.content, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'no-store',
    },
  })
}
