import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const translatorDistDir = path.resolve(projectRoot, '..', 'tasktranslator', 'frontend', 'dist')
const publicTranslatorDir = path.resolve(projectRoot, 'public', 'Translator')

await rm(publicTranslatorDir, { recursive: true, force: true })
await mkdir(path.dirname(publicTranslatorDir), { recursive: true })
await cp(translatorDistDir, publicTranslatorDir, { recursive: true })

console.log(`Copied translator assets to ${publicTranslatorDir}`)
