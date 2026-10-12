import { describe, expect, it } from 'vitest'
import { apply, invert3, solveHomography } from '../../src/core/homography'
import type { Vec2 } from '../../src/core/types'

const UNIT: Vec2[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]
const QUAD: [Vec2, Vec2, Vec2, Vec2] = [
  [0.1, 0.2],
  [0.85, 0.05],
  [0.95, 0.9],
  [0.2, 0.7],
]

const close = (a: Vec2, b: Vec2, eps = 1e-9) => {
  expect(Math.abs(a[0] - b[0])).toBeLessThan(eps)
  expect(Math.abs(a[1] - b[1])).toBeLessThan(eps)
}

describe('homography', () => {
  it('maps the unit square corners exactly onto a convex quad', () => {
    const H = solveHomography(QUAD)!
    expect(H).not.toBeNull()
    UNIT.forEach((p, i) => {
      close(apply(H, p), QUAD[i])
    })
  })

  it('maps the centre of a square to its centre', () => {
    const H = solveHomography([
      [0.2, 0.2],
      [0.6, 0.2],
      [0.6, 0.6],
      [0.2, 0.6],
    ])!
    close(apply(H, [0.5, 0.5]), [0.4, 0.4])
  })

  it('inverts back to the unit square', () => {
    const Hi = invert3(solveHomography(QUAD)!)!
    QUAD.forEach((p, i) => {
      close(apply(Hi, p), UNIT[i], 1e-7)
    })
  })

  it('returns null when three corners are collinear', () => {
    expect(
      solveHomography([
        [0, 0],
        [0.5, 0],
        [1, 0],
        [0, 1],
      ]),
    ).toBeNull()
  })

  it('returns null for a self-crossing (bow-tie) quad', () => {
    expect(
      solveHomography([
        [0, 0],
        [1, 1],
        [1, 0],
        [0, 1],
      ]),
    ).toBeNull()
  })

  it('returns null for non-finite corners', () => {
    expect(
      solveHomography([
        [0, 0],
        [Number.NaN, 0],
        [1, 1],
        [0, 1],
      ]),
    ).toBeNull()
  })
})
