/**
 * The scene bodies: the half that imports Three.js.
 *
 * Only SceneCanvas.tsx imports this, and SceneCanvas is itself lazily loaded,
 * so nothing on the critical path can reach Three through here. Everything the
 * rest of the page needs about a scene is in meta.ts, which imports nothing.
 */

import type { ComponentType } from 'react'
import { Yard } from './yard'
import { Configurator } from './configurator'
import { Particles } from './particles'
import type { SceneId } from './meta'

export type SceneBody = ComponentType<{ running: boolean }>

export const BODIES: Record<SceneId, SceneBody> = {
  yard: Yard,
  configurator: Configurator,
  particles: Particles,
}
