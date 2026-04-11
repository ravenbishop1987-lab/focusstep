import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const translatorFrontendDir = path.resolve(__dirname, '..', '..', 'tasktranslator', 'frontend')

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: translatorFrontendDir,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ...extraEnv,
      },
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })

    child.on('error', reject)
  })
}

await run('npm', ['install'])
await run('npm', ['run', 'build'], { VITE_APP_BASE: '/Translator/' })
