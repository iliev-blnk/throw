// Column-major 4×4 matrices for the previs camera (same layout as GL).

export type Mat4 = Float32Array
export type V3 = [number, number, number]

export function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ])
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export function lookAt(eye: V3, target: V3, up: V3): Mat4 {
  const z = norm(sub(eye, target))
  const x = norm(cross(up, z))
  const y = cross(z, x)
  return new Float32Array([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, eye),
    -dot(y, eye),
    -dot(z, eye),
    1,
  ])
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}

/** Transform a point, with the perspective divide. */
export function transformPoint(m: Mat4, p: V3): V3 {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]
  return [x / w, y / w, z / w]
}

/** Model matrix: translate to `at`, then point local −Y along `dir` (for beam cones). */
export function aim(at: V3, dir: V3, scale: V3): Mat4 {
  const y = norm([-dir[0], -dir[1], -dir[2]]) // local +Y points away from the beam
  const ref: V3 = Math.abs(y[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0]
  const x = norm(cross(ref, y))
  const z = cross(x, y)
  return new Float32Array([
    x[0] * scale[0],
    x[1] * scale[0],
    x[2] * scale[0],
    0,
    y[0] * scale[1],
    y[1] * scale[1],
    y[2] * scale[1],
    0,
    z[0] * scale[2],
    z[1] * scale[2],
    z[2] * scale[2],
    0,
    at[0],
    at[1],
    at[2],
    1,
  ])
}
