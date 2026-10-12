// Small WebGL2 helpers: programs, render targets, textures, the full-screen quad.

export const VERT = `#version 300 es
in vec2 aPos; out vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

export type Program = { prog: WebGLProgram; u: (name: string) => WebGLUniformLocation | null }

export function compile(gl: WebGL2RenderingContext, frag: string, label: string, vert = VERT): Program {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      throw new Error(`${label}: ${gl.getShaderInfoLog(s)}`)
    }
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vert))
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag))
  gl.bindAttribLocation(prog, 0, 'aPos')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`${label}: ${gl.getProgramInfoLog(prog)}`)
  }
  const cache = new Map<string, WebGLUniformLocation | null>()
  return {
    prog,
    u: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name))
      return cache.get(name)!
    },
  }
}

export function quad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  return vao
}

export type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export function texture(gl: WebGL2RenderingContext, w = 1, h = 1): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

export function target(gl: WebGL2RenderingContext, w: number, h: number): Target {
  const tex = texture(gl, w, h)
  const fb = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { fb, tex, w, h }
}

export function resizeTarget(gl: WebGL2RenderingContext, t: Target, w: number, h: number): void {
  if (t.w === w && t.h === h) return
  gl.bindTexture(gl.TEXTURE_2D, t.tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  t.w = w
  t.h = h
}

/** Upload an image, canvas or video frame. Flips Y so the texture is y-up like everything else. */
export function upload(gl: WebGL2RenderingContext, tex: WebGLTexture, src: TexImageSource): void {
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
}
