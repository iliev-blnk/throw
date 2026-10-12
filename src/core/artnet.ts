// Art-Net 4 packets: ArtDMX (0x5000), ArtPoll (0x2000), ArtPollReply (0x2100). No imports, so the
// server can compile this file on its own.

export const ARTNET_PORT = 6454
const ID = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00] // "Art-Net\0"
const PROTOCOL = 14
const OP_POLL = 0x2000
const OP_POLL_REPLY = 0x2100
const OP_DMX = 0x5000

function header(op: number, size: number): Uint8Array {
  const p = new Uint8Array(size)
  p.set(ID, 0)
  p[8] = op & 0xff
  p[9] = op >> 8
  return p
}

const isArtNet = (b: Uint8Array) => b.length >= 10 && ID.every((v, i) => b[i] === v)
const opcode = (b: Uint8Array) => b[8] | (b[9] << 8)

/** ArtDMX for a 15-bit port address. Data is padded to an even length of 2..512. */
export function artDmx(universe: number, seq: number, data: Uint8Array): Uint8Array {
  let len = Math.min(512, Math.max(2, data.length))
  if (len % 2) len++
  const p = header(OP_DMX, 18 + len)
  p[10] = 0
  p[11] = PROTOCOL
  p[12] = seq & 0xff
  p[13] = 0 // physical
  p[14] = universe & 0xff
  p[15] = (universe >> 8) & 0x7f
  p[16] = len >> 8
  p[17] = len & 0xff
  p.set(data.subarray(0, len), 18)
  return p
}

export function parseArtDmx(b: Uint8Array): { universe: number; seq: number; data: Uint8Array } | null {
  if (!isArtNet(b) || b.length < 18 || opcode(b) !== OP_DMX) return null
  const len = (b[16] << 8) | b[17]
  if (b.length < 18 + len) return null
  return { universe: b[14] | ((b[15] & 0x7f) << 8), seq: b[12], data: b.slice(18, 18 + len) }
}

export function artPoll(): Uint8Array {
  const p = header(OP_POLL, 14)
  p[11] = PROTOCOL
  p[12] = 0 // flags
  p[13] = 0 // diag priority
  return p
}

const cstr = (b: Uint8Array, a: number, n: number) => {
  const s = b.subarray(a, a + n)
  const end = s.indexOf(0)
  return new TextDecoder().decode(end < 0 ? s : s.subarray(0, end)).trim()
}

export function parseArtPollReply(b: Uint8Array): { ip: string; shortName: string; longName: string } | null {
  if (!isArtNet(b) || b.length < 108 || opcode(b) !== OP_POLL_REPLY) return null
  return {
    ip: Array.from(b.subarray(10, 14)).join('.'),
    shortName: cstr(b, 26, 18),
    longName: cstr(b, 44, 64),
  }
}
