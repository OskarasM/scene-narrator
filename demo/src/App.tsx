/**
 * The demo: a delivery yard where vans move continuously.
 *
 * Chosen because it is the shape of scene the library is for. Objects move all the time,
 * so a static twin of the scene graph would be wrong within a second, and there is real
 * semantic structure to group by. It is also small enough that a person can hold the whole
 * thing in their head while listening to it, which matters for a demo that is meant to be
 * heard rather than looked at.
 *
 * The scene is deliberately not the multiplayer room, and shares no code with it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Group, InstancedMesh, Object3D } from 'three'
import { SceneNarrator, useDescribe, useNarrator } from '@oskarasm/scene-narrator/react'
import type { Narrator, RegionSnapshot } from '@oskarasm/scene-narrator'

const VAN_COUNT = 24
const YARD = 30

interface VanState {
  id: number
  name: string
  x: number
  z: number
  vx: number
  vz: number
  parked: boolean
}

function makeVans(): VanState[] {
  // Fixed arithmetic rather than Math.random, so the demo looks the same every load and a
  // screen reader transcript taken from it can be reproduced.
  return Array.from({ length: VAN_COUNT }, (_, i) => ({
    id: i,
    name: `Van ${i + 1}`,
    x: ((i * 37) % (YARD * 2)) - YARD,
    z: ((i * 53) % (YARD * 2)) - YARD,
    vx: (((i * 13) % 7) - 3) * 0.6,
    vz: (((i * 29) % 7) - 3) * 0.6,
    parked: i % 5 === 0,
  }))
}

/**
 * One van. Each has its own Object3D so the narrator can read a real world position, and
 * the visible geometry is a shared InstancedMesh so that 24 vans is 1 draw call.
 */
function Van({ van, target }: { van: VanState; target: Object3D }) {
  const ref = useRef<Object3D>(target)
  useDescribe(ref, {
    label: van.name,
    role: 'van',
    state: () => (van.parked ? 'parked' : 'moving'),
    importance: van.id === 0 ? 'landmark' : 'normal',
  })
  return null
}

function Yard({ vans }: { vans: VanState[] }) {
  const meshRef = useRef<InstancedMesh>(null)
  const groupRef = useRef<Group>(null)
  const dummy = useMemo(() => new Object3D(), [])

  // The Object3Ds the narrator reads. They are children of a Group in the scene, carry the
  // descriptors, and are never rendered themselves.
  const carriers = useMemo(() => vans.map(() => new Object3D()), [vans])

  useFrame((_, delta) => {
    const step = Math.min(delta, 1 / 30)
    for (let i = 0; i < vans.length; i++) {
      const van = vans[i]
      if (!van.parked) {
        van.x += van.vx * step
        van.z += van.vz * step
        if (van.x > YARD || van.x < -YARD) van.vx = -van.vx
        if (van.z > YARD || van.z < -YARD) van.vz = -van.vz
      }
      carriers[i].position.set(van.x, 0, van.z)
      dummy.position.set(van.x, 0.5, van.z)
      dummy.rotation.y = Math.atan2(van.vx, van.vz)
      dummy.updateMatrix()
      meshRef.current?.setMatrixAt(i, dummy.matrix)
    }
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <group ref={groupRef}>
        {carriers.map((carrier, i) => (
          <primitive key={vans[i].id} object={carrier}>
            <Van van={vans[i]} target={carrier} />
          </primitive>
        ))}
      </group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, VAN_COUNT]}>
        <boxGeometry args={[1.6, 1, 3]} />
        <meshLambertMaterial color="#5b8def" />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[YARD * 2 + 8, YARD * 2 + 8]} />
        <meshLambertMaterial color="#2a2f3a" />
      </mesh>
    </>
  )
}

/**
 * Lifts the narrator instance out to the surrounding page.
 *
 * useNarrator only works inside <SceneNarrator>, which is inside <Canvas>, so a plain DOM
 * button next to the canvas cannot call the narrator directly. This passes the instance
 * outward once, which is the same thing an application would do to wire the scene up to
 * its own toolbar.
 */
function ExposeNarrator({ onReady }: { onReady: (narrator: Narrator) => void }) {
  const narrator = useNarrator()
  useEffect(() => onReady(narrator), [narrator, onReady])
  return null
}

/** Announces things the library cannot infer, which is the author's job by design. */
function DispatchEvents({ vans }: { vans: VanState[] }) {
  const narrator = useNarrator()
  const nextRef = useRef(0)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (t < nextRef.current) return
    nextRef.current = t + 12
    const van = vans[Math.floor(t / 12) % vans.length]
    narrator.announce(`${van.name} has been dispatched`)
  })

  return null
}

export default function App() {
  const vans = useMemo(makeVans, [])
  const [focused, setFocused] = useState<RegionSnapshot | null>(null)
  const narratorRef = useRef<Narrator | null>(null)

  const holdNarrator = useCallback((narrator: Narrator) => {
    narratorRef.current = narrator
  }, [])

  /*
   * Why this button exists.
   *
   * Loading this page by typing its address leaves keyboard focus in the browser's own
   * toolbar, not in the document. The first few Tab presses then move through browser
   * chrome and never reach the page, so the scene appears unreachable and this panel never
   * changes. That is not a screen reader problem and it is not a library problem, it is
   * what happens to anybody who visits a page by typing its URL, and a demo that cannot
   * survive it demonstrates nothing.
   *
   * So there is a real, visible, focusable control that puts focus into the scene. It uses
   * the same public API an application would: narrator.focusRegion(id).
   */
  const enterScene = useCallback(() => {
    const narrator = narratorRef.current
    const first = narrator?.snapshot().regions[0]
    if (first) narrator?.focusRegion(first.id)
  }, [])

  return (
    <div className="page">
      <header>
        <h1>scene-narrator demo</h1>
        <p>
          A delivery yard with {VAN_COUNT} vans, most of them moving. The 3D view below is a
          single <code>&lt;canvas&gt;</code>, which on its own tells a screen reader nothing
          at all. The accessibility tree beside it is generated by the library and updates as
          the scene changes.
        </p>
        <p>
          <strong>With a screen reader:</strong> the scene is a set of headings. Move between
          them with your heading key, then press Enter on one to hear the vans inside it.
        </p>
        <p>
          <strong>Without one:</strong> click anywhere on this page first, then press Tab to
          reach the scene and use the arrow keys. If you opened this page by typing its
          address, your keyboard focus starts in the browser toolbar rather than the page,
          so the button on the right is the reliable way in.
        </p>
      </header>

      <main>
        {/*
          The focused element lives inside the canvas as fallback content and is visually
          hidden, so it cannot carry a focus ring of its own. CSS :has(:focus-visible) does
          not help either: canvas fallback content is not rendered, so it never matches.
          The library's onFocusRegion callback is the intended answer, and this is what it
          is for. An application would also highlight the focused region in the 3D scene.
        */}
        <div className={focused ? 'viewport viewport-focused' : 'viewport'}>
          {/*
            Camera pulled in close enough that the areas of the yard fall into different
            distance bands. From far outside the yard every area reads "far away", which is
            accurate and useless: the demo exists to be listened to, and a demo where every
            area sounds identical demonstrates nothing.
          */}
          <Canvas
            camera={{ position: [0, 16, 26], fov: 55 }}
            // preserveDrawingBuffer makes the rendered frame readable after it has been
            // presented, which is what lets bench/demo-check.mjs assert that the 3D scene
            // is not blank. Without it the drawing buffer is cleared on present and any
            // pixel read comes back transparent whether the scene rendered or not, which is
            // how a completely blank canvas passed every check this project had.
            gl={{ preserveDrawingBuffer: true }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 20, 8]} intensity={1.1} />
            <Yard vans={vans} />
            <SceneNarrator
              label="Delivery yard"
              headingLevel={2}
              cadence={250}
              autoRegions={6}
              mount="canvas"
              onFocusRegion={setFocused}
            >
              <ExposeNarrator onReady={holdNarrator} />
              <DispatchEvents vans={vans} />
            </SceneNarrator>
          </Canvas>
        </div>

        {/*
          The button sits outside the aside on purpose. The aside is aria-hidden, and a
          focusable control inside an aria-hidden subtree is reachable by Tab while being
          invisible to a screen reader, which strands the user on a control that announces
          nothing. The button is genuinely useful to everyone, so it is exposed to everyone.
        */}
        <div className="side">
          <button type="button" className="enter-scene" onClick={enterScene}>
            Put focus in the scene
          </button>

          <aside aria-hidden="true">
            <h2>What the screen reader is being told</h2>
            {focused ? (
              <>
                <p className="focused-heading">{focused.heading}</p>
                <p className="focused-summary">{focused.summary}</p>
                <p className="focused-meta">
                  {focused.memberLabels.length} vans in this area
                </p>
              </>
            ) : (
              <p className="focused-summary">
                Nothing focused yet. Press the button above, or click anywhere on this page
                and then press Tab.
              </p>
            )}
            <p className="note">
              This panel mirrors the accessibility tree for sighted visitors. It is marked
              aria-hidden, because a screen reader user is already getting this information
              from the real thing and does not need it twice.
            </p>
          </aside>
        </div>
      </main>

      <footer>
        <p>
          <a href="https://github.com/OskarasM/scene-narrator">Source and measurements</a>.
          Verified with NVDA on Windows. VoiceOver and JAWS are untested.
        </p>
      </footer>
    </div>
  )
}
