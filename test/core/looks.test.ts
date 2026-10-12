import { describe, expect, it } from 'vitest'
import { applyLook, beginTransition, capture, nextAutopilot, sample } from '../../src/core/looks'
import { defaultShow } from '../../src/core/show'
import type { Look } from '../../src/core/types'

const show = defaultShow()
const target = (patch: Partial<Look> = {}): Look => ({ ...capture(show), ...patch })

describe('looks', () => {
  it('capture then applyLook restores decks, crossfade, palette and master', () => {
    const l = capture(show)
    const changed = {
      ...show,
      crossfade: 0.7,
      palette: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ] as Look['palette'],
    }
    const back = applyLook(changed, l)
    expect(back.crossfade).toBe(show.crossfade)
    expect(back.palette).toEqual(show.palette)
    expect(back.decks).toEqual(show.decks)
  })

  it('a transition starts on the next whole beat', () => {
    const tr = beginTransition(show, target(), 12.3, 4)
    expect(tr.start).toBe(13)
    expect(beginTransition(show, target(), 12, 4).start).toBe(12)
  })

  it('palette is the midpoint halfway through', () => {
    const to = target({
      palette: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
    })
    const tr = beginTransition(show, to, 0, 4)
    const mid = sample(tr, 2)
    expect(mid.palette[0][0]).toBeCloseTo(show.palette[0][0] / 2)
  })

  it('at the end the look equals the target', () => {
    const to = target({ crossfade: 1, master: { brightness: 0.4, hue: 0.2 } })
    const tr = beginTransition(show, to, 0, 4)
    expect(sample(tr, 4)).toEqual(to)
    expect(sample(tr, 99)).toEqual(to)
  })

  it('before the start beat the look is the origin', () => {
    const tr = beginTransition(show, target({ crossfade: 1 }), 3.5, 2)
    expect(sample(tr, 3.6).crossfade).toBe(show.crossfade)
  })

  it('0 beats is immediate', () => {
    const to = target({ crossfade: 1 })
    const tr = beginTransition(show, to, 7.2, 0)
    expect(sample(tr, 7.2)).toEqual(to)
  })

  it('a scene change on deck A hides deck A before swapping it', () => {
    // deck A shows at crossfade 0; the new scene must not pop in while visible
    const to = target({ decks: [{ scene: 'smoke', params: show.decks[0].params }, show.decks[1]] })
    const tr = beginTransition(show, to, 0, 4)
    const before = sample(tr, 1.99)
    const after = sample(tr, 2.01)
    expect(before.decks[0].scene).toBe('raze')
    expect(after.decks[0].scene).toBe('smoke')
    expect(before.crossfade).toBeGreaterThan(0.95)
    expect(after.crossfade).toBeGreaterThan(0.95)
  })

  it('scene changes on both decks fade through black', () => {
    const to = target({
      decks: [
        { ...show.decks[0], scene: 'smoke' },
        { ...show.decks[1], scene: 'grid' },
      ],
    })
    const tr = beginTransition(show, to, 0, 4)
    expect(sample(tr, 2).master.brightness).toBeLessThan(0.01)
    expect(sample(tr, 2.01).decks[1].scene).toBe('grid')
  })

  it('hue takes the short way round', () => {
    const from = { ...show, master: { ...show.master, hue: 0.9 } }
    const tr = beginTransition(from, target({ master: { brightness: 1, hue: 0.1 } }), 0, 2)
    expect(sample(tr, 1).master.hue).toBeCloseTo(0, 6)
  })
})

describe('autopilot', () => {
  const slots = [true, false, true, true, ...Array(12).fill(false)]
  it('fires once at each 8-bar boundary', () => {
    const st = { last: 0 }
    const fired: number[] = []
    for (let b = 0; b <= 70; b += 0.25) {
      if (nextAutopilot(st, b, 8, slots, 0, false, Math.random) !== null) fired.push(b)
    }
    expect(fired).toEqual([32, 64])
  })

  it('goes to the next stored slot, skipping empty ones and wrapping', () => {
    expect(nextAutopilot({ last: 0 }, 32, 8, slots, 0, false, Math.random)).toBe(2)
    expect(nextAutopilot({ last: 0 }, 32, 8, slots, 3, false, Math.random)).toBe(0)
  })

  it('random never picks the current slot when another exists', () => {
    for (let i = 0; i < 50; i++) {
      expect(nextAutopilot({ last: 0 }, 32, 8, slots, 2, true, Math.random)).not.toBe(2)
    }
  })

  it('returns null when no slot is stored', () => {
    expect(nextAutopilot({ last: 0 }, 32, 8, Array(16).fill(false), 0, false, Math.random)).toBeNull()
  })
})
