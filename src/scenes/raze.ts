import type { SceneDef } from './types'

// Light shafts through a word or a logo. Each pixel marches toward the light and adds up the glow
// the occluder does not block. Ported from the p5-lab GPU raze.
export const raze: SceneDef = {
  id: 'raze',
  name: 'raze',
  tex0: 'occluder',
  params: [
    { name: 'size', default: 0.55 },
    { name: 'motion', default: 0.4 },
    { name: 'exposure', default: 0.5 },
    { name: 'letters', default: 0.15 },
    { name: 'grain', default: 0.5 },
  ],
  body: `
float occ(vec2 uv) {
  if (uTex0Size.x <= 0.0) return 0.0;
  float h = mix(0.25, 0.85, uP0.x);
  vec2 size = vec2(h * uTex0Size.x / aspect(), h);
  if (size.x > 0.9) size *= 0.9 / size.x;
  vec2 r = (uv - vec2(0.5, 0.42)) / size + 0.5;
  if (any(lessThan(r, vec2(0.0))) || any(greaterThan(r, vec2(1.0)))) return 0.0;
  return texture(uTex0, r).a;
}
vec3 glow(float d) {
  float x = d / 0.6;
  vec3 c = mix(uPal[2], uPal[0], smoothstep(0.0, 0.1, x));
  c = mix(c, uPal[1] * 0.35, smoothstep(0.1, 0.45, x));
  return mix(c, vec3(0.0), smoothstep(0.45, 1.0, x));
}
vec3 render(vec2 uv) {
  float m = 0.04 + uP0.y * 0.22;
  vec2 L = vec2(0.5 + m * 1.4 * sin(uTime * 0.5) + 0.03 * uBands.x * sin(uTime * 3.1),
                0.5 + m * 0.5 * sin(uTime * 0.8));
  const int N = 64;
  vec2 delta = (uv - L) / float(N) * 0.92;
  vec2 p = uv; vec3 acc = vec3(0.0); float w = 1.0;
  for (int i = 0; i < N; i++) {
    acc += glow(length((p - L) * vec2(aspect(), 1.0))) * (1.0 - occ(p)) * w;
    w *= 0.965; p -= delta;
  }
  float gain = (2.0 + uP0.z * 6.0) * (1.0 + uBands.w * 1.2 + uOnset * 0.8);
  vec3 col = acc / float(N) * gain;
  col *= 1.0 - occ(uv) * (1.0 - uP0.w);
  if (mod(gl_FragCoord.y, 4.0) < 1.0) col *= 0.82;
  col += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * 0.08 * uP1.x;
  return col;
}`,
}
