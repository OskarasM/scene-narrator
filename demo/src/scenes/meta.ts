/**
 * Everything about the three scenes that is not geometry.
 *
 * This file imports nothing from Three.js, and that is its entire reason for
 * existing. The controls need the scene names and object counts, the live
 * poller needs the counts, and the transcript needs the narrator label; if any
 * of those reached for a module that imports Three, the whole engine landed in
 * the entry chunk and the page could not paint a word until a megabyte had
 * parsed. Splitting the canvas out achieved nothing until this was split out
 * first.
 *
 * It also owns the numbers the page quotes. The object counts are stated on
 * screen, so they are defined once here and the scene bodies read them, rather
 * than being written down twice and drifting apart.
 */

import type { RegionDefinition } from 'scene-narrator'

export type SceneId = 'yard' | 'configurator' | 'particles'

export interface SceneMeta {
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
}

/* ---- The delivery yard ---- */

export const VAN_COUNT = 24
export const YARD_EXTENT = 30

/* ---- The configurator ---- */

export const MATERIALS = ['brushed steel', 'matte black', 'oak veneer', 'brass'] as const

export interface Part {
  id: string
  label: string
  role: string
  /** World position of the part, which is what puts it in a region. */
  at: [number, number, number]
}

export const PARTS: Part[] = [
  { id: 'base', label: 'Base', role: 'part', at: [0, 0.12, 0] },
  { id: 'switch', label: 'Switch', role: 'control', at: [0.5, 0.2, 0.42] },
  { id: 'lower-arm', label: 'Lower arm', role: 'part', at: [0, 1.05, 0] },
  { id: 'upper-arm', label: 'Upper arm', role: 'part', at: [0.72, 2.02, 0] },
  { id: 'shade', label: 'Shade', role: 'part', at: [1.58, 2.45, 0] },
  { id: 'bulb', label: 'Bulb', role: 'part', at: [1.58, 2.12, 0] },
]

// Boxes wide in x and z and split in y, because a lamp is a vertical thing and
// these three names are the three heights a person thinks of it in.
export const LAMP_REGIONS: RegionDefinition[] = [
  ['base', 'The base and its switch', -1, 0.6],
  ['arm', 'The arm', 0.6, 2.2],
  ['head', 'The head', 2.2, 6],
].map(([id, heading, low, high]) => ({
  id: id as string,
  heading: heading as string,
  min: { x: -6, y: low as number, z: -6 },
  max: { x: 6, y: high as number, z: 6 },
}))

/* ---- The particle field ---- */

export const PARTICLE_COUNT = 4000
export const FIELD_EXTENT = 60

/**
 * Three scenes, one narrator, in the order they make the argument: the shape
 * the library was designed for, the shape an audit actually turns up, and the
 * shape that has no alternative at all.
 */
export const SCENES: readonly SceneMeta[] = [
  {
    id: 'yard',
    title: 'Delivery yard',
    objects: VAN_COUNT,
    blurb:
      'Twenty-four vans on a yard, nineteen of them moving. Continuous motion with real semantic structure to group by.',
    regionSource: 'auto',
    narrator: { label: 'Delivery yard', regions: 'auto', autoRegions: 6, units: 'metres' },
    camera: { position: [0, 16, 26], fov: 55 },
  },
  {
    id: 'configurator',
    title: 'Product configurator',
    objects: PARTS.length,
    blurb:
      'Six named parts, one of them selected, each reporting its finish. Small enough that speed is not the argument. The argument is whether you can tell what you have chosen.',
    regionSource: 'author',
    narrator: { label: 'Task lamp configurator', regions: LAMP_REGIONS, units: 'metres' },
    camera: { position: [4.2, 3.1, 4.6], fov: 45 },
  },
  {
    id: 'particles',
    title: 'Particle field',
    objects: PARTICLE_COUNT,
    blurb:
      'Four thousand described motes on one field. Eight times the object count at which the spike measured a per-object mirror crossing the frame budget, so the only question left is whether a summary can still say something true.',
    regionSource: 'auto',
    narrator: { label: 'Particle field', regions: 'auto', autoRegions: 9, units: 'metres' },
    camera: { position: [0, 46, 96], fov: 50 },
  },
]

export const sceneById = (id: SceneId): SceneMeta =>
  SCENES.find((scene) => scene.id === id) ?? SCENES[0]
