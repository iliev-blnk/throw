import { invert3, type Mat3, solveHomography, toGL } from '../core/homography'
import { averageRect } from '../core/pixelmap'
import { strobeGate } from '../core/strobe'
import type { Look, Rgb, Show, Surface } from '../core/types'
import { FOOTER, HEADER } from '../scenes/common'
import { SCENES, sceneById } from '../scenes/index'
import { compile, type Program, quad, resizeTarget, type Target, target, texture, upload } from './gl'
import { drawTestCard } from './testcard'
import { fontsReady, renderText } from './text'

export type FrameInput = {
  show: Show
  /** the effective look this frame (the show's own values, or a transition sample) */
  look: Look
  /** seconds on the shared clock */
  t: number
  /** beats since the clock anchor, fractional */
  beat: number
  /** bass, mid, high, level, 0..1 */
  bands: [number, number, number, number]
  pulse: number
  /** program: letterboxed program on the canvas; output: mapped surfaces; none: only render the program */
  view: 'program' | 'output' | 'none'
  outputId?: string
  /** surface ids to outline (edit mode) */
  highlight?: string[]
}

export type Engine = {
  frame(f: FrameInput): void
  /** program colour under (x, y) in y-down uv, from a 64×36 readback (operator only) */
  readPixel(x: number, y: number): Rgb
  /** average colour of the whole program (from the same readback) */
  average(): Rgb
  setMedia(deck: 0 | 1, el: HTMLVideoElement | HTMLImageElement | null): void
  setLogo(img: HTMLImageElement | null): void
  /** the program texture, for previs in the same context */
  programTexture(): WebGLTexture
  readonly gl: WebGL2RenderingContext
  contextOk(): boolean
  /** current deck render scale (adaptive) */
  scale(): number
  /** called after a lost context comes back, for code that shares the context */
  onRestore(h: () => void): void
  dispose(): void
}

export type Role = 'operator' | 'output' | 'render'

const MIX = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 fragColor;
uniform sampler2D uA, uB;
uniform float uX, uBright, uHue;
vec3 hue(vec3 c, float h) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * c;
  float a = h * 6.2831853;
  yiq.yz = mat2(cos(a), sin(a), -sin(a), cos(a)) * yiq.yz;
  return toRGB * yiq;
}
void main() {
  vec3 c = mix(texture(uA, vUV).rgb, texture(uB, vUV).rgb, uX);
  if (uHue > 0.0) c = max(hue(c, uHue), 0.0);
  fragColor = vec4(c * uBright, 1.0);
}`

const BLIT = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec4 uBox; // destination rect in 0..1 (x, y, w, h), y up
void main() {
  vec2 p = (vUV - uBox.xy) / uBox.zw;
  if (any(lessThan(p, vec2(0.0))) || any(greaterThan(p, vec2(1.0)))) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  fragColor = vec4(texture(uSrc, p).rgb, 1.0);
}`

const WARP = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform mat3 uHinv;
uniform vec4 uSlice;    // x, y, w, h in source uv, y down
uniform vec2 uRes;
uniform float uFeather, uBright, uOutline;
void main() {
  vec2 o = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  vec3 q = uHinv * vec3(o, 1.0);
  if (q.z <= 0.0) discard;
  vec2 s = q.xy / q.z;
  if (any(lessThan(s, vec2(0.0))) || any(greaterThan(s, vec2(1.0)))) discard;
  vec2 p = uSlice.xy + s * uSlice.zw;
  vec3 c = texture(uSrc, vec2(p.x, 1.0 - p.y)).rgb;
  float e = min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y));
  float k = uFeather > 0.0 ? smoothstep(0.0, uFeather, e) : 1.0;
  c *= k * uBright;
  if (uOutline > 0.0 && e < 0.006) c = vec3(1.0, 0.85, 0.2);
  fragColor = vec4(c, 1.0);
}`

const READ_W = 64
const READ_H = 36
const MIN_SCALE = 0.35

type TextTex = { tex: WebGLTexture; aspect: number }

type Resources = {
  vao: WebGLVertexArrayObject
  scenes: Map<string, Program>
  mix: Program
  blit: Program
  warp: Program
  decks: [Target, Target]
  program: Target
  read: Target
  empty: WebGLTexture
  media: [WebGLTexture, WebGLTexture]
  logo: WebGLTexture
}

export function createEngine(canvas: HTMLCanvasElement, opts: { role: Role; readback?: boolean }): Engine {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: opts.role === 'render',
    powerPreference: 'high-performance',
  })
  if (!gl) throw new Error('WebGL2 is not available in this browser')

  let res: Resources | null = null
  let lost = false
  let fonts = false
  void fontsReady().then(() => {
    fonts = true
    texts.clear()
    cards.clear() // redraw test cards with the real face
  })
  const texts = new Map<string, TextTex>()
  const cards = new Map<string, WebGLTexture>()
  const mediaEls: [HTMLVideoElement | HTMLImageElement | null, HTMLVideoElement | HTMLImageElement | null] = [
    null,
    null,
  ]
  const mediaAspect: [number, number] = [0, 0]
  let logoImg: HTMLImageElement | null = null
  let logoAspect = 0
  const lastH = new Map<string, Mat3>()
  const readback = new Uint8Array(READ_W * READ_H * 4)
  let scale = opts.role === 'render' ? 1 : 0.75
  let frameMs = 16
  let lastFrame = 0
  let frames = 0

  function init(): Resources {
    const scenes = new Map<string, Program>()
    for (const s of SCENES) scenes.set(s.id, compile(gl!, HEADER + s.body + FOOTER, `scene ${s.id}`))
    const r: Resources = {
      vao: quad(gl!),
      scenes,
      mix: compile(gl!, MIX, 'mix'),
      blit: compile(gl!, BLIT, 'blit'),
      warp: compile(gl!, WARP, 'warp'),
      decks: [target(gl!, 2, 2), target(gl!, 2, 2)],
      program: target(gl!, 2, 2),
      read: target(gl!, READ_W, READ_H),
      empty: texture(gl!, 1, 1),
      media: [texture(gl!), texture(gl!)],
      logo: texture(gl!),
    }
    texts.clear()
    cards.clear()
    if (logoImg) upload(gl!, r.logo, logoImg)
    return r
  }

  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    res = null
  }
  const onRestored = () => {
    res = init()
    lost = false
    for (const h of restoreHooks) h()
  }
  const restoreHooks = new Set<() => void>()
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  res = init()

  function textTexture(word: string): TextTex | null {
    if (!fonts) return null
    let t = texts.get(word)
    if (!t) {
      if (texts.size > 48) {
        for (const v of texts.values()) gl!.deleteTexture(v.tex)
        texts.clear()
      }
      const { canvas: c, aspect } = renderText(word)
      const tex = texture(gl!)
      upload(gl!, tex, c)
      t = { tex, aspect }
      texts.set(word, t)
    }
    return t
  }

  function cardTexture(label: string): WebGLTexture {
    let t = cards.get(label)
    if (!t) {
      t = texture(gl!)
      upload(gl!, t, drawTestCard(label))
      cards.set(label, t)
    }
    return t
  }

  /** Bind the deck's uTex0 and return the content aspect (0 when empty). */
  function bindTex0(r: Resources, deck: 0 | 1, sceneId: string, f: FrameInput): number {
    const def = sceneById(sceneId)
    let tex = r.empty
    let aspect = 0
    if (def.tex0 === 'occluder') {
      if (logoImg && logoAspect) {
        tex = r.logo
        aspect = logoAspect
      } else {
        const t = textTexture(f.show.settings.text)
        if (t) ({ tex, aspect } = t)
      }
    } else if (def.tex0 === 'word') {
      const words = f.show.settings.words.length ? f.show.settings.words : ['throw']
      const b = Math.max(0, Math.floor(f.beat + 1e-9))
      const t = textTexture(words[b % words.length])
      if (t) ({ tex, aspect } = t)
    } else if (def.tex0 === 'media') {
      const el = mediaEls[deck]
      if (el && mediaAspect[deck]) {
        if (el instanceof HTMLVideoElement) {
          if (el.readyState >= 2) upload(gl!, r.media[deck], el)
        }
        tex = r.media[deck]
        aspect = mediaAspect[deck]
      }
    }
    gl!.activeTexture(gl!.TEXTURE0)
    gl!.bindTexture(gl!.TEXTURE_2D, tex)
    gl!.activeTexture(gl!.TEXTURE1)
    gl!.bindTexture(gl!.TEXTURE_2D, r.empty)
    return aspect
  }

  function drawScene(r: Resources, deck: 0 | 1, f: FrameInput) {
    const d = f.look.decks[deck]
    const prog = r.scenes.get(sceneById(d.scene).id)!
    const tgt = r.decks[deck]
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, tgt.fb)
    gl!.viewport(0, 0, tgt.w, tgt.h)
    gl!.useProgram(prog.prog)
    const aspect = bindTex0(r, deck, d.scene, f)
    const u = prog.u
    const p = d.params
    gl!.uniform2f(u('uRes'), tgt.w, tgt.h)
    gl!.uniform1f(u('uTime'), f.t)
    const beat = Math.max(0, f.beat)
    gl!.uniform1f(u('uBeat'), beat - Math.floor(beat))
    gl!.uniform1f(u('uBeats'), Math.floor(beat + 1e-9))
    gl!.uniform1f(u('uOnset'), f.pulse)
    gl!.uniform4f(u('uBands'), ...f.bands)
    gl!.uniform4f(u('uP0'), p[0] ?? 0.5, p[1] ?? 0.5, p[2] ?? 0.5, p[3] ?? 0.5)
    gl!.uniform4f(u('uP1'), p[4] ?? 0.5, p[5] ?? 0.5, p[6] ?? 0.5, p[7] ?? 0.5)
    gl!.uniform3fv(u('uPal[0]'), f.look.palette.flat())
    gl!.uniform1i(u('uTex0'), 0)
    gl!.uniform1i(u('uTex1'), 1)
    gl!.uniform2f(u('uTex0Size'), aspect, aspect ? 1 : 0)
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }

  function sizeTargets(r: Resources, s: Show) {
    const W = s.settings.masterW
    const H = s.settings.masterH
    resizeTarget(gl!, r.program, W, H)
    const k = opts.role === 'render' ? 1 : scale
    const dw = Math.max(2, Math.round(W * k))
    const dh = Math.max(2, Math.round(H * k))
    resizeTarget(gl!, r.decks[0], dw, dh)
    resizeTarget(gl!, r.decks[1], dw, dh)
  }

  function adapt(s: Show) {
    if (opts.role === 'render') return
    const now = performance.now()
    if (lastFrame) frameMs = frameMs * 0.95 + (now - lastFrame) * 0.05
    lastFrame = now
    if (++frames % 60) return
    const cap = s.settings.sceneScale
    if (frameMs > 24 && scale > MIN_SCALE) scale = Math.max(MIN_SCALE, scale * 0.85)
    else if (frameMs < 15 && scale < cap) scale = Math.min(cap, scale * 1.1)
    scale = Math.min(scale, cap)
  }

  function renderProgram(r: Resources, f: FrameInput) {
    const x = f.look.crossfade
    if (x < 1) drawScene(r, 0, f)
    if (x > 0) drawScene(r, 1, f)
    const m = f.show.master
    const open = strobeGate(m.strobe, f.show.settings.strobeCap, f.t)
    const bright = m.blackout || !open ? 0 : f.look.master.brightness
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, r.program.fb)
    gl!.viewport(0, 0, r.program.w, r.program.h)
    gl!.useProgram(r.mix.prog)
    gl!.activeTexture(gl!.TEXTURE0)
    gl!.bindTexture(gl!.TEXTURE_2D, x < 1 ? r.decks[0].tex : r.empty)
    gl!.activeTexture(gl!.TEXTURE1)
    gl!.bindTexture(gl!.TEXTURE_2D, x > 0 ? r.decks[1].tex : r.empty)
    gl!.uniform1i(r.mix.u('uA'), 0)
    gl!.uniform1i(r.mix.u('uB'), 1)
    gl!.uniform1f(r.mix.u('uX'), x)
    gl!.uniform1f(r.mix.u('uBright'), bright)
    gl!.uniform1f(r.mix.u('uHue'), f.look.master.hue)
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }

  function blit(
    r: Resources,
    src: WebGLTexture,
    fb: WebGLFramebuffer | null,
    w: number,
    h: number,
    box: number[],
  ) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb)
    gl!.viewport(0, 0, w, h)
    gl!.useProgram(r.blit.prog)
    gl!.activeTexture(gl!.TEXTURE0)
    gl!.bindTexture(gl!.TEXTURE_2D, src)
    gl!.uniform1i(r.blit.u('uSrc'), 0)
    gl!.uniform4f(r.blit.u('uBox'), box[0], box[1], box[2], box[3])
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }

  function inverseFor(s: Surface): Mat3 | null {
    const H = solveHomography(s.corners)
    const inv = H && invert3(H)
    if (inv) lastH.set(s.id, inv)
    return lastH.get(s.id) ?? null
  }

  function drawSurface(
    r: Resources,
    src: WebGLTexture,
    inv: Mat3,
    slice: number[],
    s: Surface,
    outline: boolean,
  ) {
    gl!.useProgram(r.warp.prog)
    gl!.activeTexture(gl!.TEXTURE0)
    gl!.bindTexture(gl!.TEXTURE_2D, src)
    gl!.uniform1i(r.warp.u('uSrc'), 0)
    gl!.uniformMatrix3fv(r.warp.u('uHinv'), false, toGL(inv))
    gl!.uniform4f(r.warp.u('uSlice'), slice[0], slice[1], slice[2], slice[3])
    gl!.uniform2f(r.warp.u('uRes'), canvas.width, canvas.height)
    gl!.uniform1f(r.warp.u('uFeather'), s.feather)
    gl!.uniform1f(r.warp.u('uBright'), s.brightness)
    gl!.uniform1f(r.warp.u('uOutline'), outline ? 1 : 0)
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }

  function renderOutput(r: Resources, f: FrameInput) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null)
    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.clearColor(0, 0, 0, 1)
    gl!.clear(gl!.COLOR_BUFFER_BIT)
    const out = f.show.outputs.find((o) => o.id === f.outputId) ?? f.show.outputs[0]
    if (!out) return
    for (const s of out.surfaces) {
      if (!s.enabled) continue
      const inv = inverseFor(s)
      if (!inv) continue
      const outline = !!f.highlight?.includes(s.id)
      if (out.testCard) drawSurface(r, cardTexture(`${out.name} · ${s.id}`), inv, [0, 0, 1, 1], s, outline)
      else drawSurface(r, r.program.tex, inv, [s.slice.x, s.slice.y, s.slice.w, s.slice.h], s, outline)
    }
  }

  function renderView(r: Resources) {
    // letterbox the program into the canvas
    const pa = r.program.w / r.program.h
    const ca = canvas.width / canvas.height
    const box = ca > pa ? [(1 - pa / ca) / 2, 0, pa / ca, 1] : [0, (1 - ca / pa) / 2, 1, ca / pa]
    blit(r, r.program.tex, null, canvas.width, canvas.height, box)
  }

  return {
    gl,
    frame(f) {
      if (lost || !res || gl.isContextLost()) return
      adapt(f.show)
      gl.bindVertexArray(res.vao)
      sizeTargets(res, f.show)
      renderProgram(res, f)
      if (opts.role === 'operator' || opts.readback) {
        blit(res, res.program.tex, res.read.fb, READ_W, READ_H, [0, 0, 1, 1])
        gl.readPixels(0, 0, READ_W, READ_H, gl.RGBA, gl.UNSIGNED_BYTE, readback)
      }
      if (f.view === 'output') renderOutput(res, f)
      else if (f.view === 'program') renderView(res)
    },
    readPixel: (x, y) => averageRect(readback, READ_W, READ_H, x, y, 1 / READ_W),
    average: () => averageRect(readback, READ_W, READ_H, 0.5, 0.5, 0.5),
    setMedia(deck, el) {
      mediaEls[deck] = el
      mediaAspect[deck] = 0
      if (!el || !res) return
      const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
      const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
      if (w && h) mediaAspect[deck] = w / h
      if (el instanceof HTMLImageElement && w) upload(gl, res.media[deck], el)
    },
    setLogo(img) {
      logoImg = img
      logoAspect = img?.naturalWidth ? img.naturalWidth / img.naturalHeight : 0
      if (img && res) upload(gl, res.logo, img)
    },
    programTexture: () => res!.program.tex,
    contextOk: () => !lost && !!res && !gl.isContextLost(),
    scale: () => scale,
    onRestore: (h) => {
      restoreHooks.add(h)
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
