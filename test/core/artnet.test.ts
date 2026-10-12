import { describe, expect, it } from 'vitest'
import { ARTNET_PORT, artDmx, artPoll, parseArtDmx, parseArtPollReply } from '../../src/core/artnet'

const ascii = (b: Uint8Array, a: number, n: number) => String.fromCharCode(...b.slice(a, a + n))

describe('Art-Net', () => {
  it('port is 6454', () => expect(ARTNET_PORT).toBe(6454))

  it('ArtDMX header, opcode, protocol, sequence, universe and length', () => {
    const data = new Uint8Array(512).map((_, i) => i & 255)
    const p = artDmx(0x0123, 7, data)
    expect(p.length).toBe(18 + 512)
    expect(ascii(p, 0, 8)).toBe('Art-Net\0')
    expect([p[8], p[9]]).toEqual([0x00, 0x50])
    expect([p[10], p[11]]).toEqual([0x00, 0x0e])
    expect(p[12]).toBe(7)
    expect(p[13]).toBe(0)
    expect([p[14], p[15]]).toEqual([0x23, 0x01])
    expect([p[16], p[17]]).toEqual([0x02, 0x00])
    expect(p[18 + 300]).toBe(300 & 255)
  })

  it('pads odd data to an even length', () => {
    const p = artDmx(0, 1, new Uint8Array([1, 2, 3]))
    expect([p[16], p[17]]).toEqual([0, 4])
    expect(p.length).toBe(22)
  })

  it('round-trips through parseArtDmx', () => {
    const data = new Uint8Array(512).fill(9)
    expect(parseArtDmx(artDmx(5, 200, data))).toEqual({ universe: 5, seq: 200, data })
  })

  it('parseArtDmx rejects other packets', () => {
    expect(parseArtDmx(artPoll())).toBeNull()
    expect(parseArtDmx(new Uint8Array(4))).toBeNull()
  })

  it('ArtPoll is a 14-byte OpPoll', () => {
    const p = artPoll()
    expect(p.length).toBe(14)
    expect([p[8], p[9]]).toEqual([0x00, 0x20])
  })

  it('parses an ArtPollReply', () => {
    const b = new Uint8Array(239)
    b.set(new TextEncoder().encode('Art-Net\0'), 0)
    b[8] = 0x00
    b[9] = 0x21
    b.set([192, 168, 1, 50], 10)
    b.set(new TextEncoder().encode('Node A'), 26)
    b.set(new TextEncoder().encode('Four-port Art-Net node'), 44)
    expect(parseArtPollReply(b)).toEqual({
      ip: '192.168.1.50',
      shortName: 'Node A',
      longName: 'Four-port Art-Net node',
    })
    expect(parseArtPollReply(artPoll())).toBeNull()
  })
})
