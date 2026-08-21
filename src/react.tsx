/**
 * React Three Fiber binding.
 *
 * Nothing here holds any semantics of its own. It reads `scene`, `camera` and `gl` out of
 * R3F's store, drives `narrator.update()` from `useFrame`, and gets out of the way. If this
 * file grew logic, that logic would be unavailable to anyone using plain Three.js, which is
 * the wrong shape for an accessibility library.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Object3D } from 'three'
import { createNarrator, describe, undescribe } from './narrator.js'
import type { Narrator, NarratorOptions } from './narrator.js'
import type { Descriptor, RegionSnapshot } from './types.js'

const NarratorContext = createContext<Narrator | null>(null)

export interface NarratorProps
  extends Omit<NarratorOptions, 'camera' | 'mount' | 'onFocusRegion'> {
  /**
   * `canvas` mounts the accessibility tree inside the <canvas> element as fallback
   * content. `sibling` mounts it in the canvas's parent. See the README on which to use;
   * the difference is measured in SPIKE.md and verified against NVDA in NVDA.md.
   */
  mount?: 'canvas' | 'sibling'
  onFocusRegion?: (region: RegionSnapshot | null) => void
  children?: ReactNode
}

/**
 * Place inside <Canvas>. Everything it needs comes from R3F's store.
 *
 * ```tsx
 * <Canvas>
 *   <SceneNarrator label="Warehouse yard" />
 *   <Vans />
 * </Canvas>
 * ```
 */
export function SceneNarrator({ mount = 'canvas', onFocusRegion, children, ...rest }: NarratorProps) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  // Kept in a ref so that changing the callback does not tear down and rebuild the whole
  // accessibility tree, which would move the user's focus out from under them.
  const onFocusRef = useRef(onFocusRegion)
  onFocusRef.current = onFocusRegion

  const options = JSON.stringify({
    mount,
    label: rest.label,
    headingLevel: rest.headingLevel,
    autoRegions: rest.autoRegions,
    cadence: rest.cadence,
    units: rest.units,
    // Author-defined regions are plain data, so they compare by value. Passing a new array
    // literal every render would otherwise rebuild the tree on every render.
    regions: rest.regions,
  })

  const narrator = useMemo(() => {
    const canvas = gl.domElement
    const target =
      mount === 'canvas' ? canvas : (canvas.parentElement ?? canvas.ownerDocument.body)
    return createNarrator(scene, {
      ...rest,
      camera,
      mount: target as HTMLElement,
      onFocusRegion: (region) => onFocusRef.current?.(region),
    })
    // `options` is the value-equality key for everything in `rest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, camera, gl, mount, options])

  useEffect(() => () => narrator.dispose(), [narrator])

  // Priority 1 rather than 0, so the narrator reads positions after the frame's animation
  // callbacks have written them. Reading a frame late would describe the previous frame.
  useFrame(() => narrator.update(), 1)

  return <NarratorContext.Provider value={narrator}>{children}</NarratorContext.Provider>
}

/**
 * Access the narrator from anywhere inside <SceneNarrator>, mainly to announce events the
 * library cannot infer: "order dispatched", "connection lost".
 */
export function useNarrator(): Narrator {
  const narrator = useContext(NarratorContext)
  if (!narrator) throw new Error('useNarrator must be used inside <SceneNarrator>')
  return narrator
}

/**
 * Attach a descriptor to a ref'd object for as long as the component is mounted.
 *
 * ```tsx
 * const ref = useRef<Mesh>(null)
 * useDescribe(ref, { label: 'Delivery van', role: 'vehicle' })
 * return <mesh ref={ref} />
 * ```
 */
export function useDescribe(ref: RefObject<Object3D | null>, descriptor: Descriptor): void {
  // Descriptors carry callbacks, so a dependency array over the object identity would fire
  // on every render. The descriptor is re-applied on every render instead, which is one
  // property assignment and cheaper than the comparison would be.
  const object = ref.current
  useEffect(() => {
    if (!object) return
    describe(object, descriptor)
    return () => undescribe(object)
  })
}

export { describe, undescribe } from './narrator.js'
export type { Narrator, RegionSnapshot, Descriptor }
