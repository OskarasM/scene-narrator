import type { ComponentType } from 'react'
import type { RegionDefinition } from 'scene-narrator'

export type SceneId = 'yard' | 'configurator' | 'particles'

/**
 * What a scene has to provide.
 *
 * Deliberately small. A scene owns its geometry, its descriptors and the
 * narrator settings that suit it, and nothing else: the page owns the canvas,
 * the controls and the transcript, so switching scene changes the argument
 * being made without changing any of the machinery making it.
 */
export interface SceneDefinition {
  id: SceneId
  title: string
  /** Described objects in this scene. Quoted on the page, so it has to be the
   *  real number rather than a round one. */
  objects: number
  blurb: string
  /** Which half of the grouping API this scene exercises. The page says so,
   *  because "auto" being a fallback rather than the point is easy to miss. */
  regionSource: 'auto' | 'author'
  narrator: {
    label: string
    regions: 'auto' | RegionDefinition[]
    autoRegions?: number
    units: string
  }
  camera: { position: [number, number, number]; fov: number }
  Body: ComponentType<{ running: boolean }>
}
