// Minimal static file server for the benchmark harness.
//
// The harness deliberately has no build step, so it needs three.js served from
// node_modules via an import map. That means serving the repository root, not just
// bench/. Nothing here is intended for anything other than localhost benchmarking.

import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const requested = decodeURIComponent(url.pathname)
    // Refuse anything that escapes the repository root.
    const filePath = join(ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, ''))
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    try {
      const info = await stat(filePath)
      if (!info.isFile()) throw new Error('not a file')
      res.writeHead(200, {
        'content-type': TYPES[extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      createReadStream(filePath).pipe(res)
    } catch {
      res.writeHead(404).end('Not found')
    }
  })

  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      resolvePromise({ server, port: server.address().port })
    })
  })
}

// Allow `node bench/serve.mjs` for poking at the harness by hand.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const { port } = await startServer(8123)
  console.log(`harness: http://127.0.0.1:${port}/bench/harness.html?arm=B&n=1000`)
}
