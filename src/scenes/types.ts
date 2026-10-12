export type ParamDef = { name: string; default: number }

/** A scene is a stateless fragment shader: one frame depends only on its uniforms. */
export type SceneDef = {
  id: string
  name: string
  /** up to 8, mapped to uP0.xyzw, uP1.xyzw */
  params: ParamDef[]
  /** what the engine binds to uTex0 */
  tex0?: 'occluder' | 'word' | 'media'
  /** GLSL defining `vec3 render(vec2 uv)`; HEADER and FOOTER are added by the engine */
  body: string
}
