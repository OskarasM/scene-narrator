/**
 * The WebGL half of the stage, split out so it is not on the critical path.
 *
 * Three.js, React Three Fiber and three scenes are about a megabyte, and while
 * that was in the entry chunk the browser had to parse all of it before it
 * painted a word. Lighthouse named the lede paragraph as the largest
 * contentful paint element, which is a page whose argument is waiting on
 * machinery the argument does not need: the text, the transcript and every
 * recorded measurement on this page read perfectly well with no context at
 * all, and the section below the fold proves it.
 *
 * So the canvas arrives in its own chunk, after first paint, into a box that
 * has already reserved its space. Nothing moves when it lands.
 */

import { useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { SceneNarrator, useNarrator } from 'scene-narrator/react'
import type { Narrator } from 'scene-narrator'
import { useLive } from '../live'
import { BODIES } from '../scenes'
import { sceneById } from '../scenes/meta'

/**
 * Lifts the narrator and its canvas out to the surrounding page.
 *
 * useNarrator only works inside <SceneNarrator>, which is inside <Canvas>, so
 * a DOM control next to the canvas cannot reach the narrator directly. This
 * passes both outward once, which is what an application would do to wire a
 * scene up to its own toolbar.
 */
function Expose({ onReady }: { onReady: (narrator: Narrator, canvas: HTMLCanvasElement) => void }) {
  const narrator = useNarrator()
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => onReady(narrator, canvas), [narrator, canvas, onReady])
  return null
}

export default function SceneCanvas() {
  const { sceneId, cadence, regionTarget, running, attach, setFocused } = useLive()
  const scene = sceneById(sceneId)
  const Body = BODIES[sceneId]

  const onReady = useCallback(
    (narrator: Narrator, canvas: HTMLCanvasElement) => attach(narrator, canvas),
    [attach],
  )

  return (
    <Canvas
      key={sceneId}
      camera={{ position: scene.camera.position, fov: scene.camera.fov }}
      // preserveDrawingBuffer makes the rendered frame readable after it has
      // been presented, which is what lets bench/demo-check.mjs assert that the
      // scene is not blank. Without it the buffer is cleared on present and any
      // pixel read comes back transparent whether the scene rendered or not,
      // which is how a completely blank canvas passed every check this project
      // had.
      gl={{ preserveDrawingBuffer: true }}
    >
      {/* Warm and just under clipping. Every scene here sits on a cream ground,
          and a nearly unsaturated cream lit past one arrives as flat grey,
          which took the warmth out of all three at once. */}
      <ambientLight intensity={0.8} color="#fff4e6" />
      <directionalLight position={[10, 20, 8]} intensity={0.85} color="#fff8ee" />
      <SceneNarrator
        label={scene.narrator.label}
        headingLevel={2}
        cadence={cadence}
        regions={scene.narrator.regions}
        autoRegions={scene.narrator.autoRegions ?? regionTarget}
        units={scene.narrator.units}
        mount="canvas"
        onFocusRegion={setFocused}
      >
        {/* The scene renders inside the provider so that a scene can reach the
            narrator with useNarrator and announce the things no scene graph
            carries: a van dispatched, a level finished, a connection dropped.
            The narrator subscribes to the frame loop first and so reads
            positions written later in the same frame one frame late, which at a
            cadence measured in hundreds of milliseconds is not a difference
            anybody can perceive. */}
        <Body running={running} />
        <Expose onReady={onReady} />
      </SceneNarrator>
    </Canvas>
  )
}
