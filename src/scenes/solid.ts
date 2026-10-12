import type { SceneDef } from './types'

// A flat palette colour that can dip on every beat. Use the master strobe for strobing.
export const solid: SceneDef = {
  id: 'solid',
  name: 'solid',
  params: [
    { name: 'colour', default: 0 },
    { name: 'beat dip', default: 0.5 },
  ],
  body: `
vec3 render(vec2 uv) {
  return pal(uP0.x) * mix(1.0, 1.0 - uBeat * 0.9, uP0.y);
}`,
}
