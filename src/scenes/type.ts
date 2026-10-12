import type { SceneDef } from './types'

// One giant word per beat from the word list, stretched toward the frame. Punches on the beat.
export const type: SceneDef = {
  id: 'type',
  name: 'type',
  tex0: 'word',
  params: [
    { name: 'stretch', default: 0.6 },
    { name: 'invert', default: 0.7 },
    { name: 'punch', default: 0.5 },
  ],
  body: `
vec3 render(vec2 uv) {
  float s = 1.0 + (uOnset * 0.06 + (1.0 - smoothstep(0.0, 0.25, uBeat)) * 0.05) * uP0.z * 2.0;
  vec2 c = (uv - 0.5) / s;
  float ca = max(uTex0Size.x, 0.01);
  vec2 box = vec2(0.92, 0.92 * aspect() / ca);
  if (box.y > 0.92) box = vec2(0.92 * ca / aspect(), 0.92);
  box.y = mix(box.y, 0.92, uP0.x);
  vec2 r = c / box + 0.5;
  float a = (uTex0Size.x > 0.0 && all(greaterThan(r, vec2(0.0))) && all(lessThan(r, vec2(1.0)))) ? texture(uTex0, r).a : 0.0;
  vec3 ink = pal(uBeats * 0.37 + 0.05);
  vec3 bg = vec3(0.015);
  bool inv = uP0.y > 0.5 && mod(uBeats, 2.0) > 0.5;
  return inv ? mix(ink, bg, a) : mix(bg, ink, a);
}`,
}
