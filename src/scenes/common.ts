// Shared GLSL for every scene. A scene supplies `vec3 render(vec2 uv)` with uv in 0..1, y up.

export const HEADER = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime, uBeat, uBeats, uOnset;
uniform vec4 uBands, uP0, uP1;
uniform vec3 uPal[3];
uniform sampler2D uTex0, uTex1;
uniform vec2 uTex0Size;   // aspect of the content in uTex0 (w/h, 1) or (0, 0) when empty
#define PI 3.14159265
float aspect() { return uRes.x / uRes.y; }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p, int oct) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
vec3 pal(float t) {
  t = fract(t) * 3.0;
  if (t < 1.0) return mix(uPal[0], uPal[1], t);
  if (t < 2.0) return mix(uPal[1], uPal[2], t - 1.0);
  return mix(uPal[2], uPal[0], t - 2.0);
}
float beatF() { return uBeats + uBeat; }
`

export const FOOTER = `
void main() { fragColor = vec4(max(render(vUV), 0.0), 1.0); }`
