import type { SceneDef } from './types'

// Bars that step one place per beat, plus a sweep line once a bar. Reads on any surface.
export const scan: SceneDef = {
  id: 'scan',
  name: 'scan',
  params: [
    { name: 'bars', default: 0.35 },
    { name: 'direction', default: 0.2 },
    { name: 'width', default: 0.4 },
    { name: 'speed', default: 0.3 },
  ],
  body: `
float bars(float coord, float n) {
  float step_ = uBeats + smoothstep(0.0, 0.35, uBeat);
  float pos = coord * n + step_ * (0.25 + uP0.w * 2.0);
  float f = fract(pos);
  float width = mix(0.1, 0.8, uP0.z) * (0.75 + 0.5 * uBands.x);
  return 1.0 - smoothstep(width - 0.04, width, abs(f - 0.5) * 2.0);
}
vec3 render(vec2 uv) {
  float n = floor(mix(2.0, 24.0, uP0.x));
  float o = uP0.y;
  float b = o < 0.33 ? bars(uv.y, n) : o < 0.66 ? bars(uv.x, n) : bars(uv.x, n) * bars(uv.y, n);
  float idx = floor((o < 0.33 ? uv.y : uv.x) * n);
  float flash = 0.55 + 0.45 * (1.0 - uBeat);
  vec3 col = pal(idx / n * 0.6 + uBeats * 0.11) * b * flash;
  float sweep = fract(beatF() / 4.0);
  float line = exp(-pow(((o < 0.33 ? uv.x : uv.y) - sweep) * 90.0, 2.0));
  return col + uPal[2] * line * 0.8;
}`,
}
