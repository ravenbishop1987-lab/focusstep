import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const translatorDistCandidates = [
  process.env.TRANSLATOR_DIST_DIR,
  path.join(process.cwd(), 'public', 'Translator'),
  path.join(process.cwd(), '..', 'tasktranslator', 'frontend', 'dist'),
  path.join(process.cwd(), 'tasktranslator', 'frontend', 'dist'),
  path.join(process.cwd(), '..', 'Focus Step Task Translator', 'frontend', 'dist'),
].filter((value): value is string => Boolean(value))

const translatorDistDir =
  translatorDistCandidates.find((candidate) => existsSync(candidate)) ?? translatorDistCandidates[0]

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function getMimeType(filePath: string) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function hasFileExtension(requestPath: string) {
  return path.extname(requestPath) !== ''
}

export async function loadTranslatorAsset(requestPath: string) {
  if (!existsSync(translatorDistDir)) {
    return null
  }

  const cleanedPath = requestPath.replace(/^\/+/, '')
  const relativePath = cleanedPath ? cleanedPath.split('/').join(path.sep) : 'index.html'
  const resolvedPath = path.resolve(translatorDistDir, relativePath)

  if (!resolvedPath.startsWith(translatorDistDir)) {
    return null
  }

  try {
    const content = await readFile(resolvedPath)
    return {
      content,
      contentType: getMimeType(resolvedPath),
    }
  } catch {
    if (hasFileExtension(cleanedPath)) {
      return null
    }

    const indexPath = path.join(translatorDistDir, 'index.html')
    if (!existsSync(indexPath)) {
      return null
    }

    const content = await readFile(indexPath)
    return {
      content,
      contentType: getMimeType(indexPath),
    }
  }
}
