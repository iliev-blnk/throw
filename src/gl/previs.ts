// Previs: a small virtual venue. Back wall and three stage boxes carry the mapped surfaces of
// output 1; moving heads on a truss and floor pars draw additive beams in haze.

import type { Fixture, Rgb, Show } from '../core/types'
import { compile, type Program } from './gl'
import { aim, lookAt, multiply, perspective, type V3 } from './mat4'

export type Camera = { yaw: number; pitch: number; dist: number }

const FACE_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aN;
layout(location = 2) in vec2 aUV;
layout(location = 3) in float aId;
uniform mat4 uVP;
out vec3 vPos; out vec3 vN; out vec2 vUV; flat out int vId;
void main() { vPos = aPos; vN = aN; vUV = aUV; vId = int(aId); gl_Position = uVP * vec4(aPos, 1.0); }`

const FACE_FRAG = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vN; in vec2 vUV; flat in int vId;
out vec4 fragColor;
uniform sampler2D uProg;
uniform vec4 uSlice[4];
uniform float uBright[4];
uniform vec3 uAvg, uEye;
uniform vec3 uBeamPos[12], uBeamDir[12], uBeamCol[12];
uniform float uBeamCos[12];
uniform int uBeams;
void main() {
  vec3 col;
  if (vId >= 0) {
    vec4 s = uSlice[vId];
    vec2 p = s.xy + vUV * s.zw;
    col = texture(uProg, vec2(p.x, 1.0 - p.y)).rgb * uBright[vId] * 0.95 + 0.012;
  } else {
    float nearWall = exp(-(vPos.z + 3.0) * 0.55);
    col = vec3(0.012, 0.012, 0.015) + uAvg * nearWall * (vN.y > 0.5 ? 0.22 : vN.z > 0.5 ? 0.025 : 0.12);
  }
  for (int i = 0; i < 12; i++) {
    if (i >= uBeams) break;
    vec3 d = vPos - uBeamPos[i];
    float dist = length(d);
    float c = dot(d / dist, uBeamDir[i]);
    float spot = smoothstep(uBeamCos[i], mix(uBeamCos[i], 1.0, 0.5), c) * max(dot(vN, -d / dist), 0.0);
    col += uBeamCol[i] * spot * 0.8 / (1.0 + 0.04 * dist * dist);
  }
  float fog = 1.0 - exp(-length(vPos - uEye) * 0.025);
  fragColor = vec4(mix(col, vec3(0.012, 0.012, 0.016), fog), 1.0);
}`

const BEAM_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aN;
uniform mat4 uVP, uModel;
out vec3 vPos; out vec3 vN; out float vT;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vPos = w.xyz;
  vN = normalize(mat3(uModel) * aN);
  vT = -aPos.y;
  gl_Position = uVP * w;
}`

const BEAM_FRAG = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vN; in float vT;
out vec4 fragColor;
uniform vec3 uCol, uEye;
uniform float uHaze;
void main() {
  float facing = abs(dot(normalize(vN), normalize(uEye - vPos)));
  float a = pow(facing, 2.5) * pow(1.0 - vT, 1.3) * uHaze;
  fragColor = vec4(uCol * a, 1.0);
}`

type Mesh = { vao: WebGLVertexArrayObject; count: number }

/** id ≥ 0: surface index; -1: unlit structure */
function buildRoom(gl: WebGL2RenderingContext): Mesh {
  const data: number[] = []
  const face = (a: V3, b: V3, c: V3, d: V3, n: V3, id: number) => {
    // a = bottom-left, b = bottom-right, c = top-right, d = top-left; uv y down
    const v = (p: V3, u: number, w: number) => data.push(...p, ...n, u, w, id)
    v(a, 0, 1)
    v(b, 1, 1)
    v(c, 1, 0)
    v(a, 0, 1)
    v(c, 1, 0)
    v(d, 0, 0)
  }
  const box = (c: V3, s: V3, front: number) => {
    const [x, y, z] = c
    const [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2]
    const p = (i: number, j: number, k: number): V3 => [x + i * hx, y + j * hy, z + k * hz]
    face(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), [0, 0, 1], front)
    face(p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), [1, 0, 0], -1)
    face(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), [-1, 0, 0], -1)
    face(p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1), [0, 1, 0], -1)
  }
  face([-8, 0, 7], [8, 0, 7], [8, 0, -3], [-8, 0, -3], [0, 1, 0], -1) // floor
  face([-4, 0, -3], [4, 0, -3], [4, 4.5, -3], [-4, 4.5, -3], [0, 0, 1], 0) // projection wall
  face([-8, 0, -3.01], [-4, 0, -3.01], [-4, 6, -3.01], [-8, 6, -3.01], [0, 0, 1], -1)
  face([4, 0, -3.01], [8, 0, -3.01], [8, 6, -3.01], [4, 6, -3.01], [0, 0, 1], -1)
  face([-4, 4.5, -3.01], [4, 4.5, -3.01], [4, 6, -3.01], [-4, 6, -3.01], [0, 0, 1], -1)
  box([-2.3, 0.55, -1.7], [1.1, 1.1, 1.1], 1)
  box([0, 0.8, -1.35], [1.4, 1.6, 1.0], 2)
  box([2.3, 0.45, -1.8], [0.9, 0.9, 0.9], 3)
  box([0, 4.35, -0.6], [7.2, 0.12, 0.12], -1) // truss
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
  const stride = 9 * 4
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12)
  gl.enableVertexAttribArray(2)
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24)
  gl.enableVertexAttribArray(3)
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32)
  gl.bindVertexArray(null)
  return { vao, count: data.length / 9 }
}

/** Open cone: apex at the origin, axis −Y, length 1, end radius 1. */
function buildCone(gl: WebGL2RenderingContext): Mesh {
  const N = 32
  const data: number[] = []
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2
    const a1 = ((i + 1) / N) * Math.PI * 2
    const pt = (a: number): number[] => [Math.cos(a), -1, Math.sin(a)]
    const nrm = (a: number): number[] => [Math.cos(a), 1, Math.sin(a)].map((v) => v / Math.SQRT2)
    data.push(0, 0, 0, ...nrm((a0 + a1) / 2), ...pt(a0), ...nrm(a0), ...pt(a1), ...nrm(a1))
  }
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
  gl.bindVertexArray(null)
  return { vao, count: data.length / 6 }
}

export type Beam = { pos: V3; dir: V3; color: Rgb; length: number; radius: number; haze: number }

/** Where a fixture hangs and where it points, from its DMX values. */
export function beamFor(f: Fixture, v: Record<string, number>): Beam | null {
  if (f.profile === 'mover') {
    const k = (v.dimmer ?? 0) / 255
    if (k <= 0) return null
    const pan = ((v.pan ?? 0) * 256 + (v.panFine ?? 0)) / 65535
    const tilt = ((v.tilt ?? 0) * 256 + (v.tiltFine ?? 0)) / 65535
    const th = tilt * 1.25
    const ph = (pan - 0.5) * 1.8
    return {
      pos: [-3.2 + 6.4 * f.x, 4.22, -0.6],
      dir: [-Math.sin(th) * Math.sin(ph), -Math.cos(th), -Math.sin(th) * Math.cos(ph)],
      color: [((v.r ?? 0) / 255) * k, ((v.g ?? 0) / 255) * k, ((v.b ?? 0) / 255) * k],
      length: 9,
      radius: 0.55,
      haze: 0.8,
    }
  }
  const w = (v.w ?? 0) / 255
  const rgb: Rgb =
    f.profile === 'dimmer'
      ? [(v.dimmer ?? 0) / 255, (v.dimmer ?? 0) / 255, (v.dimmer ?? 0) / 255]
      : [
          Math.min(1, (v.r ?? 0) / 255 + w),
          Math.min(1, (v.g ?? 0) / 255 + w),
          Math.min(1, (v.b ?? 0) / 255 + w),
        ]
  if (rgb[0] + rgb[1] + rgb[2] <= 0) return null
  return {
    pos: [-3.6 + 7.2 * f.x, 0.08, -2.55],
    dir: [0, 0.94, -0.34],
    color: rgb,
    length: 3.2,
    radius: 1.1,
    haze: 0.25,
  }
}

export function createPrevis(gl: WebGL2RenderingContext) {
  let faces: Program
  let beams: Program
  let room: Mesh
  let cone: Mesh
  const init = () => {
    faces = compile(gl, FACE_FRAG, 'previs faces', FACE_VERT)
    beams = compile(gl, BEAM_FRAG, 'previs beams', BEAM_VERT)
    room = buildRoom(gl)
    cone = buildCone(gl)
  }
  init()

  return {
    /** call after a context restore */
    restore: init,
    frame(opts: {
      program: WebGLTexture
      show: Show
      avg: Rgb
      beams: Beam[]
      camera: Camera
      width: number
      height: number
    }) {
      const { width: W, height: H, camera: c } = opts
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, W, H)
      gl.clearColor(0.008, 0.008, 0.011, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      const target: V3 = [0, 1.7, -1.6]
      const eye: V3 = [
        target[0] + c.dist * Math.sin(c.yaw) * Math.cos(c.pitch),
        target[1] + c.dist * Math.sin(c.pitch),
        target[2] + c.dist * Math.cos(c.yaw) * Math.cos(c.pitch),
      ]
      const vp = multiply(perspective(0.85, W / H, 0.1, 60), lookAt(eye, target, [0, 1, 0]))

      // surfaces of output 1, in order: wall, box 1, box 2, box 3; missing ones show the whole program
      const out = opts.show.outputs[0]
      const slices: number[] = []
      const bright: number[] = []
      for (let i = 0; i < 4; i++) {
        const s = out?.surfaces[i]
        const on = s ? s.enabled : true
        slices.push(...(s ? [s.slice.x, s.slice.y, s.slice.w, s.slice.h] : [0, 0, 1, 1]))
        bright.push(on ? (s?.brightness ?? 1) : 0)
      }
      const list = opts.beams.slice(0, 12)

      gl.useProgram(faces.prog)
      gl.uniformMatrix4fv(faces.u('uVP'), false, vp)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, opts.program)
      gl.uniform1i(faces.u('uProg'), 0)
      gl.uniform4fv(faces.u('uSlice[0]'), slices)
      gl.uniform1fv(faces.u('uBright[0]'), bright)
      gl.uniform3fv(faces.u('uAvg'), opts.avg)
      gl.uniform3fv(faces.u('uEye'), eye)
      gl.uniform1i(faces.u('uBeams'), list.length)
      if (list.length) {
        gl.uniform3fv(
          faces.u('uBeamPos[0]'),
          list.flatMap((b) => b.pos),
        )
        gl.uniform3fv(
          faces.u('uBeamDir[0]'),
          list.flatMap((b) => b.dir),
        )
        gl.uniform3fv(
          faces.u('uBeamCol[0]'),
          list.flatMap((b) => b.color),
        )
        gl.uniform1fv(
          faces.u('uBeamCos[0]'),
          list.map((b) => Math.cos(Math.atan(b.radius / b.length))),
        )
      }
      gl.bindVertexArray(room.vao)
      gl.drawArrays(gl.TRIANGLES, 0, room.count)

      gl.useProgram(beams.prog)
      gl.uniformMatrix4fv(beams.u('uVP'), false, vp)
      gl.uniform3fv(beams.u('uEye'), eye)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.depthMask(false)
      gl.bindVertexArray(cone.vao)
      for (const b of list) {
        gl.uniformMatrix4fv(beams.u('uModel'), false, aim(b.pos, b.dir, [b.radius, b.length, b.radius]))
        gl.uniform3fv(beams.u('uCol'), b.color)
        gl.uniform1f(beams.u('uHaze'), b.haze)
        gl.drawArrays(gl.TRIANGLES, 0, cone.count)
        // the lens: a short, bright cone at the head
        gl.uniformMatrix4fv(beams.u('uModel'), false, aim(b.pos, b.dir, [0.09, 0.25, 0.09]))
        gl.uniform1f(beams.u('uHaze'), 3)
        gl.drawArrays(gl.TRIANGLES, 0, cone.count)
      }
      gl.depthMask(true)
      gl.disable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)
      gl.bindVertexArray(null)
    },
  }
}
