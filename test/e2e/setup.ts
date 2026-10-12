import { createSocket } from 'node:dgram'
import { resolve } from 'node:path'
import { build } from 'vite'
import type { TestProject } from 'vitest/node'
import { startServer } from '../../server/server.js'

// Build the web app once and serve it with the real throw server (relay + Art-Net bridge).
// Art-Net goes to a local UDP socket so nothing reaches the real network.
export default async function setup(project: TestProject) {
  await build({ logLevel: 'warn' })
  const udp = createSocket('udp4')
  await new Promise<void>((ok) => udp.bind(0, '127.0.0.1', ok))
  const server = await startServer({
    port: 0,
    host: '127.0.0.1',
    artnet: `127.0.0.1:${udp.address().port}`,
    root: resolve(import.meta.dirname, '../../dist'),
    discover: false,
  })
  project.provide('baseUrl', server.url)
  return async () => {
    await server.close()
    udp.close()
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
  }
}
