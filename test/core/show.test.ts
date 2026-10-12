import { describe, expect, it } from 'vitest'
import { defaultShow, parseShow } from '../../src/core/show'

describe('show', () => {
  it('defaultShow round-trips through parseShow', () => {
    const show = defaultShow()
    const r = parseShow(JSON.parse(JSON.stringify(show)))
    expect(r).toEqual({ ok: true, show })
  })

  it('defaultShow has one output with one full-frame surface and 16 empty looks', () => {
    const s = defaultShow()
    expect(s.outputs).toHaveLength(1)
    expect(s.outputs[0].surfaces[0].slice).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(s.outputs[0].surfaces[0].corners).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ])
    expect(s.looks).toHaveLength(16)
    expect(s.looks.every((l) => l === null)).toBe(true)
  })

  it('parseShow fills a missing settings block', () => {
    const raw = JSON.parse(JSON.stringify(defaultShow()))
    delete raw.settings
    const r = parseShow(raw)
    expect(r.ok && r.show.settings).toEqual(defaultShow().settings)
  })

  it('parseShow rejects version 2', () => {
    expect(parseShow({ ...defaultShow(), version: 2 })).toEqual({
      ok: false,
      error: 'unsupported show version 2',
    })
  })

  it('parseShow rejects a non-object', () => {
    expect(parseShow('nope').ok).toBe(false)
    expect(parseShow(null).ok).toBe(false)
  })

  it('parseShow rejects decks that are not an array of two', () => {
    const r = parseShow({ ...defaultShow(), decks: 'x' })
    expect(r).toEqual({ ok: false, error: 'decks must be an array of 2' })
  })

  it('parseShow clamps crossfade and brightness to 0..1', () => {
    const r = parseShow({
      ...defaultShow(),
      crossfade: 3,
      master: { ...defaultShow().master, brightness: -2 },
    })
    expect(r.ok && r.show.crossfade).toBe(1)
    expect(r.ok && r.show.master.brightness).toBe(0)
  })

  it('parseShow clamps the strobe cap to 15 Hz', () => {
    const r = parseShow({ ...defaultShow(), settings: { ...defaultShow().settings, strobeCap: 40 } })
    expect(r.ok && r.show.settings.strobeCap).toBe(15)
  })

  it('parseShow rejects an output whose surface has three corners', () => {
    const s = defaultShow() as any
    s.outputs[0].surfaces[0].corners = [
      [0, 0],
      [1, 0],
      [1, 1],
    ]
    expect(parseShow(s)).toEqual({ ok: false, error: 'outputs[0].surfaces[0].corners must be 4 points' })
  })

  it('parseShow pads looks to 16 slots', () => {
    const r = parseShow({ ...defaultShow(), looks: [] })
    expect(r.ok && r.show.looks).toHaveLength(16)
  })
})

import { defaultParams } from '../../src/scenes/index'

describe('default show', () => {
  it('starts each deck on its scene defaults', () => {
    const s = defaultShow()
    for (const d of s.decks) expect(d.params).toEqual(defaultParams(d.scene))
  })
})
