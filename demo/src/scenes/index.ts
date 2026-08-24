import { yard } from './yard'
import { configurator } from './configurator'
import { particles } from './particles'
import type { SceneDefinition, SceneId } from './types'

/**
 * Three scenes, one narrator, in the order they make the argument: the shape
 * the library was designed for, the shape an audit actually turns up, and the
 * shape that has no alternative at all.
 */
export const SCENES: readonly SceneDefinition[] = [yard, configurator, particles]

export const sceneById = (id: SceneId): SceneDefinition =>
  SCENES.find((scene) => scene.id === id) ?? yard

export type { SceneDefinition, SceneId }
