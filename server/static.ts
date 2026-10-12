import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

/** Serve files under root. "/" is index.html; anything outside root or missing is 404. */
export function serveStatic(root: string) {
  const base = normalize(root + sep)
  return async (req: IncomingMessage, res: ServerResponse) => {
    let path: string
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    } catch {
      path = ''
    }
    if (path === '/') path = '/index.html'
    const file = normalize(join(base, path))
    const info = file.startsWith(base) ? await stat(file).catch(() => null) : null
    if (!info?.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-cache',
    })
    createReadStream(file).pipe(res)
  }
}
