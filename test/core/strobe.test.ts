import { describe, expect, it } from 'vitest'
import { strobeGate } from '../../src/core/strobe'

describe('strobe', () => {
  it('0 Hz is always open', () => expect(strobeGate(0, 10, 1.234)).toBe(true))
  it('30 Hz with a 10 Hz cap flashes at 10 Hz', () => {
    expect(strobeGate(30, 10, 0.02)).toBe(true)
    expect(strobeGate(30, 10, 0.06)).toBe(false)
    expect(strobeGate(30, 10, 0.12)).toBe(true)
  })
  it('a cap above 15 Hz is still held to 15 Hz', () => {
    // at 15 Hz the period is 1/15 s; at 20 Hz t = 0.03 would already be closed
    expect(strobeGate(20, 40, 0.03)).toBe(true)
    expect(strobeGate(20, 40, 0.04)).toBe(false)
  })
})
