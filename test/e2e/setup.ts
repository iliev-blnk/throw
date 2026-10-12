import { build, preview } from 'vite'
import type { TestProject } from 'vitest/node'

// Build the web app once and serve it for every e2e file.
export default async function setup(project: TestProject) {
  await build({ logLevel: 'warn' })
  const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'warn' })
  const url = server.resolvedUrls!.local[0]
  project.provide('baseUrl', url)
  return async () => {
    await server.close()
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
  }
}
