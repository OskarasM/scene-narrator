/**
 * The delivery yard: 24 vans, most of them moving.
 *
 * The original demo scene, and the shape the library was designed against.
 * Objects move all the time, so a static twin of the scene graph would be
 * wrong within a second, and there is real semantic structure to group by. It
 * is also small enough that a person can hold the whole thing in their head
 * while listening to it, which matters for a demo meant to be heard.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, Object3D } from 'three'
import { useDescribe, useNarrator } from 'scene-narrator/react'
import type { SceneDefinition } from './types'

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
  // Fixed arithmetic rather than Math.random, so the demo looks the same every
  // load and a screen reader transcript taken from it can be reproduced.
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

/** One van. Each has its own Object3D so the narrator can read a real world
 *  position, and the visible geometry is a shared InstancedMesh, so 24 vans
 *  are one draw call. */
function Van({ van, carrier }: { van: VanState; carrier: Object3D }) {
  const ref = useRef<Object3D>(carrier)
  useDescribe(ref, {
    label: van.name,
    role: 'van',
    state: () => (van.parked ? 'parked' : 'moving'),
    importance: van.id === 0 ? 'landmark' : 'normal',
  })
  return null
}

/** Announces things the library cannot infer, which is the author's job by
 *  design. Nothing in the scene graph says a van has been dispatched. */
function Dispatches({ vans, running }: { vans: VanState[]; running: boolean }) {
  const narrator = useNarrator()
  const nextAt = useRef(0)

  useFrame((state) => {
    if (!running) return
    const t = state.clock.elapsedTime
    if (t < nextAt.current) return
    nextAt.current = t + 12
    const van = vans[Math.floor(t / 12) % vans.length]
    narrator.announce(`${van.name} has been dispatched`)
  })

  return null
}

function Yard({ running }: { running: boolean }) {
  const vans = useMemo(makeVans, [])
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  // The Object3Ds the narrator reads. They are children of a group in the
  // scene, carry the descriptors, and are never rendered themselves.
  const carriers = useMemo(() => vans.map(() => new Object3D()), [vans])

  useFrame((_, delta) => {
    const step = running ? Math.min(delta, 1 / 30) : 0
    for (let i = 0; i < vans.length; i++) {
      const van = vans[i]
      if (!van.parked && step > 0) {
        van.x += van.vx * step
        van.z += van.vz * step
        if (van.x > YARD || van.x < -YARD) van.vx = -van.vx
        if (van.z > YARD || van.z < -YARD) van.vz = -van.vz
      }
      carriers[i].position.set(van.x, 0, van.z)
      dummy.position.set(van.x, 0.5, van.z)
      dummy.rotation.y = Math.atan2(van.vx, van.vz)
      dummy.updateMatrix()
      mesh.current?.setMatrixAt(i, dummy.matrix)
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <group>
        {carriers.map((carrier, i) => (
          <primitive key={vans[i].id} object={carrier}>
            <Van van={vans[i]} carrier={carrier} />
          </primitive>
        ))}
      </group>
      <instancedMesh ref={mesh} args={[undefined, undefined, VAN_COUNT]}>
        <boxGeometry args={[1.6, 1, 3]} />
        <meshLambertMaterial color="#a4531c" />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[YARD * 2 + 8, YARD * 2 + 8]} />
        <meshLambertMaterial color="#e9ddc4" />
      </mesh>
      <Dispatches vans={vans} running={running} />
    </>
  )
}

export const yard: SceneDefinition = {
  id: 'yard',
  title: 'Delivery yard',
  objects: VAN_COUNT,
  blurb:
    'Twenty-four vans on a yard, nineteen of them moving. Continuous motion with real semantic structure to group by.',
  regionSource: 'auto',
  narrator: { label: 'Delivery yard', regions: 'auto', autoRegions: 6, units: 'metres' },
  camera: { position: [0, 16, 26], fov: 55 },
  Body: Yard,
}
