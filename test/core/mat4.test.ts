import { describe, expect, it } from 'vitest'
import { lookAt, multiply, perspective, transformPoint } from '../../src/gl/mat4'

describe('mat4', () => {
  it('lookAt puts the target straight ahead (on −z)', () => {
    const v = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    const p = transformPoint(v, [0, 0, 0])
    expect(p[0]).toBeCloseTo(0)
    expect(p[1]).toBeCloseTo(0)
    expect(p[2]).toBeCloseTo(-5)
  })
  it('perspective maps the near plane to −1 and the far plane to 1 in depth', () => {
    const P = perspective(Math.PI / 3, 1, 1, 10)
    const near = transformPoint(P, [0, 0, -1])
    const far = transformPoint(P, [0, 0, -10])
    expect(near[2]).toBeCloseTo(-1)
    expect(far[2]).toBeCloseTo(1)
  })
  it('multiply applies the right matrix first', () => {
    const v = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])
    const P = perspective(Math.PI / 3, 1, 1, 10)
    const a = transformPoint(multiply(P, v), [0, 0, 0])
    const b = transformPoint(P, transformPoint(v, [0, 0, 0]))
    a.forEach((x, i) => {
      expect(x).toBeCloseTo(b[i])
    })
  })
})
