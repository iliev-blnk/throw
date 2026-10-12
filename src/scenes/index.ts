import { grid } from './grid'
import { hilbert } from './hilbert'
import { media } from './media'
import { raze } from './raze'
import { scan } from './scan'
import { smoke } from './smoke'
import { solid } from './solid'
import { type } from './type'
import type { SceneDef } from './types'

export type { ParamDef, SceneDef } from './types'

export const SCENES: SceneDef[] = [raze, scan, hilbert, smoke, type, grid, media, solid]

export const sceneById = (id: string): SceneDef => SCENES.find((s) => s.id === id) ?? SCENES[0]

/** Deck params for a scene: its defaults, padded to 8. */
export const defaultParams = (id: string): number[] =>
  Array.from({ length: 8 }, (_, i) => sceneById(id).params[i]?.default ?? 0.5)
