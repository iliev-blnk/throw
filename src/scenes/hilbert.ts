import type { SceneDef } from './types'

// A Hilbert curve drawn cell by cell, revealed along its length on the beat, bent around a
// wandering attractor. Tiled to fill wide outputs.
export const hilbert: SceneDef = {
  id: 'hilbert',
  name: 'hilbert',
  params: [
    { name: 'order', default: 0.5 },
    { name: 'warp', default: 0.5 },
    { name: 'line', default: 0.4 },
    { name: 'reveal', default: 0.5 },
  ],
  body: `
ivec2 rot(int n, ivec2 p, int rx, int ry) {
  if (ry == 0) {
    if (rx == 1) p = ivec2(n - 1) - p;
    p = p.yx;
  }
  return p;
}
int xy2d(int n, ivec2 p) {
  int d = 0;
  for (int s = n / 2; s > 0; s /= 2) {
    int rx = (p.x & s) > 0 ? 1 : 0;
    int ry = (p.y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    p = rot(n, p, rx, ry);
  }
  return d;
}
vec2 d2xy(int n, int d) {
  ivec2 p = ivec2(0); int t = d;
  for (int s = 1; s < n; s *= 2) {
    int rx = 1 & (t / 2);
    int ry = 1 & (t ^ rx);
    p = rot(s, p, rx, ry);
    p += s * ivec2(rx, ry);
    t /= 4;
  }
  return vec2(p) + 0.5;
}
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
vec3 render(vec2 uv) {
  int n = 1 << int(floor(mix(3.0, 6.99, uP0.x)));
  float fn = float(n);
  vec2 q = vec2(uv.x * aspect(), uv.y);
  vec2 p = vec2(fract(q.x), q.y);
  vec2 A = vec2(0.5 + 0.3 * sin(uTime * 0.4), 0.5 + 0.3 * cos(uTime * 0.31));
  vec2 dA = p - A;
  p += dA * (uP0.y * (0.35 + uBands.y)) * exp(-dot(dA, dA) * 9.0);
  vec2 g = clamp(p, 0.0, 0.9999) * fn;
  int d = xy2d(n, ivec2(floor(g)));
  vec2 c = vec2(floor(g)) + 0.5;
  float dist = 1e9;
  if (d > 0) dist = min(dist, seg(g, c, d2xy(n, d - 1)));
  if (d < n * n - 1) dist = min(dist, seg(g, c, d2xy(n, d + 1)));
  float w = mix(0.04, 0.3, uP0.z);
  float line = 1.0 - smoothstep(w, w + 0.06, dist);
  float total = fn * fn;
  float head = fract(beatF() * mix(0.02, 0.2, uP0.w)) * total;
  float age = mod(head - float(d) + total, total) / total;
  float lit = exp(-age * 5.0);
  vec3 col = pal(float(d) / total + uTime * 0.02) * line * (0.2 + 1.3 * lit) * (1.0 + uOnset * 0.4);
  return col;
}`,
}
