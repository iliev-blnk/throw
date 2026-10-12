import type { Vec2 } from './types'

/** 3×3 matrix, row-major, double precision. Use toGL() for a column-major Float32Array. */
export type Mat3 = number[]

const EPS = 1e-6

/** Is the quad TL, TR, BR, BL convex and not degenerate? Every turn must go the same way. */
export function isConvex(q: Vec2[]): boolean {
  if (q.length !== 4 || q.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return false
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const c = q[(i + 2) % 4]
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(cross) < EPS) return false
    const s = Math.sign(cross)
    if (sign && s !== sign) return false
    sign = s
  }
  return true
}

/**
 * Homography taking the unit square (TL 0,0  TR 1,0  BR 1,1  BL 0,1) onto the quad.
 * Closed form (Heckbert, square → quad). Null for a degenerate, concave or self-crossing quad.
 */
export function solveHomography(q: Vec2[]): Mat3 | null {
  if (!isConvex(q)) return null
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const sx = x0 - x1 + x2 - x3
  const sy = y0 - y1 + y2 - y3
  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    a = x1 - x0
    b = x3 - x0
    c = x0
    d = y1 - y0
    e = y3 - y0
    f = y0
    g = 0
    h = 0
  } else {
    const dx1 = x1 - x2
    const dx2 = x3 - x2
    const dy1 = y1 - y2
    const dy2 = y3 - y2
    const den = dx1 * dy2 - dx2 * dy1
    if (Math.abs(den) < 1e-12) return null
    g = (sx * dy2 - dx2 * sy) / den
    h = (dx1 * sy - sx * dy1) / den
    a = x1 - x0 + g * x1
    b = x3 - x0 + h * x3
    c = x0
    d = y1 - y0 + g * y1
    e = y3 - y0 + h * y3
    f = y0
  }
  return [a, b, c, d, e, f, g, h, 1]
}

export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null
  const k = 1 / det
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ]
}

export function apply(m: Mat3, p: Vec2): Vec2 {
  const w = m[6] * p[0] + m[7] * p[1] + m[8]
  return [(m[0] * p[0] + m[1] * p[1] + m[2]) / w, (m[3] * p[0] + m[4] * p[1] + m[5]) / w]
}

/** Column-major Float32Array for gl.uniformMatrix3fv(loc, false, …). */
export function toGL(m: Mat3): Float32Array {
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]])
}
