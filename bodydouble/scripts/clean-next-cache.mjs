import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'

const nextDir = path.join(process.cwd(), '.next')

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true })
  console.log('Cleared stale .next cache before starting dev server.')
}
