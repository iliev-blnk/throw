import type { SceneDef } from './types'

// A local video or image. Without media it shows a dim palette gradient, so the surface is visibly on.
export const media: SceneDef = {
  id: 'media',
  name: 'media',
  tex0: 'media',
  params: [
    { name: 'contain', default: 0 },
    { name: 'react', default: 0 },
  ],
  body: `
vec3 render(vec2 uv) {
  if (uTex0Size.x <= 0.0) return pal(uv.y * 0.3 + uTime * 0.02) * 0.25;
  float ca = uTex0Size.x, fa = aspect();
  vec2 r = uv;
  bool wider = fa > ca;
  if ((uP0.x < 0.5) == wider) r.y = (uv.y - 0.5) * ca / fa + 0.5;
  else r.x = (uv.x - 0.5) * fa / ca + 0.5;
  if (any(lessThan(r, vec2(0.0))) || any(greaterThan(r, vec2(1.0)))) return vec3(0.0);
  return texture(uTex0, r).rgb * mix(1.0, 0.4 + uBands.w * 1.2, uP0.y);
}`,
}
