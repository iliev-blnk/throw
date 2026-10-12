#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startServer } from './server.js'

const HELP = `throw: live visuals, projection mapping and Art-Net light sync

usage: throw [--port 7700] [--host 0.0.0.0] [--artnet 2.255.255.255] [--open]

  --port     port for the web app (default 7700)
  --host     address to listen on (default 0.0.0.0, so phones on the same network can connect)
  --artnet   where DMX goes: a node's IP, a broadcast address, or 127.0.0.1 for software
             on this computer (default 2.255.255.255)
  --open     open the operator page in the default browser
`

const args = process.argv.slice(2)
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP)
  process.exit(0)
}

const root = fileURLToPath(new URL('../../dist', import.meta.url))
if (!existsSync(root)) {
  process.stderr.write(`no built app at ${root}; run "pnpm build" first\n`)
  process.exit(1)
}

const s = await startServer({
  port: Number(flag('port', '7700')),
  host: flag('host', '0.0.0.0'),
  artnet: flag('artnet', '2.255.255.255'),
  root,
})
const lan = s.lanUrls[0]
process.stdout.write(`throw is running

  on this computer   ${s.url}
${s.lanUrls.map((u) => `  on the network     ${u}`).join('\n')}

Open the network address on this computer if you want to use the phone remote.
Art-Net goes to ${flag('artnet', '2.255.255.255')}. Ctrl+C stops.
`)
if (args.includes('--open')) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(cmd, [lan ?? s.url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' }).unref()
}
const stop = async () => {
  await s.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
