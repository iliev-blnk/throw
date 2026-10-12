import { describe, expect, it } from 'vitest'
import { distanceFor, heightFor, imageWidth } from '../../src/core/throwcalc'

describe('throw calculator', () => {
  it('throw ratio 1.5 at 6 m gives a 4 m wide image', () => expect(imageWidth(6, 1.5)).toBeCloseTo(4))
  it('a 4 m image at throw ratio 1.5 needs 6 m', () => expect(distanceFor(4, 1.5)).toBeCloseTo(6))
  it('16:9 at 4 m wide is 2.25 m high', () => expect(heightFor(4, 16 / 9)).toBeCloseTo(2.25))
  it('rejects a zero throw ratio with NaN', () => expect(imageWidth(6, 0)).toBeNaN())
})
