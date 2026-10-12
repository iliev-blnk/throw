import type { SceneDef } from './types'

// Domain-warped fbm in palette colours. Bass pushes the warp, highs add detail.
export const smoke: SceneDef = {
  id: 'smoke',
  name: 'smoke',
  params: [
    { name: 'scale', default: 0.4 },
    { name: 'drift', default: 0.3 },
    { name: 'detail', default: 0.5 },
    { name: 'pressure', default: 0.6 },
  ],
  body: `
vec3 render(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0) * mix(1.5, 5.0, uP0.x);
  float t = uTime * (0.05 + uP0.y * 0.3);
  int oct = 3 + int(uBands.z * 2.0 + uP0.z * 3.0);
  vec2 q = vec2(fbm(p + t, oct), fbm(p + vec2(5.2, 1.3) - t, oct));
  float press = 1.5 + uBands.x * 3.0 * uP0.w + uOnset;
  vec2 r = vec2(fbm(p + press * q + vec2(1.7, 9.2) + 0.15 * t, oct),
                fbm(p + press * q + vec2(8.3, 2.8) + 0.126 * t, oct));
  float f = fbm(p + press * r, oct);
  vec3 col = mix(pal(f + 0.1 * t), pal(f * 0.5 + 0.5), clamp(length(q), 0.0, 1.0));
  return col * smoothstep(0.15, 0.9, f) * 1.7;
}`,
}
