import type { SceneDef } from './types'

// A grid of dots; each beat a ripple starts from a new point and swells the dots it passes.
export const grid: SceneDef = {
  id: 'grid',
  name: 'grid',
  params: [
    { name: 'density', default: 0.4 },
    { name: 'dot', default: 0.5 },
    { name: 'ripple', default: 0.5 },
    { name: 'square', default: 0.2 },
  ],
  body: `
vec3 render(vec2 uv) {
  float n = floor(mix(8.0, 48.0, uP0.x));
  vec2 g = uv * vec2(n * aspect(), n);
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 cuv = (cell + 0.5) / vec2(n * aspect(), n);
  vec2 origin = vec2(hash1(uBeats + 0.5), hash1(uBeats + 7.3));
  float d = length((cuv - origin) * vec2(aspect(), 1.0));
  float front = uBeat * mix(0.6, 2.2, uP0.z);
  float ring = exp(-pow((d - front) * 7.0, 2.0));
  float size = mix(0.12, 0.46, uP0.y) * (0.55 + ring * 0.8 + uBands.x * 0.25);
  float shape = uP0.w > 0.5 ? max(abs(f.x), abs(f.y)) : length(f);
  float dot_ = 1.0 - smoothstep(size - 0.04, size, shape);
  return pal(d * 0.6 + uBeats * 0.13) * dot_ * (0.6 + ring * 0.8);
}`,
}
