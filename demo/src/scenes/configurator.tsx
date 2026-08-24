/**
 * The product configurator: six parts, one selection, rich state.
 *
 * The case a WCAG audit actually turns up. There is no motion to speak of and
 * only six objects, so nothing here is about performance: it is about whether
 * a keyboard user configuring a product can tell what they have selected. The
 * naive mirror handles six objects perfectly well and still fails the audit,
 * because what changed is not "mesh_04", it is "brushed steel, selected".
 *
 * This is also the scene that uses author-defined regions rather than the
 * automatic grid. A lamp has a base, an arm and a head; it does not have a
 * north-west. Compass headings are the fallback for a scene nobody has
 * described, and saying so is more honest than presenting the grid as the
 * feature.
 */

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Object3D } from 'three'
import { useDescribe } from 'scene-narrator/react'
import { MATERIALS, PARTS, type Part } from './meta'

function Piece({
  part,
  carrier,
  materialOf,
  selectedId,
  isSelected,
}: {
  part: Part
  carrier: Object3D
  materialOf: (id: string) => string
  selectedId: () => string
  isSelected: boolean
}) {
  const ref = useRef<Object3D>(carrier)
  useDescribe(ref, {
    label: part.label,
    role: part.role,
    // Called at the narrator cadence, never per frame, so it may be as
    // expensive as a property read and no more. This one is a lookup.
    state: () => materialOf(part.id),
    // Only evaluated when this part region has focus, which is where the
    // expensive string building belongs.
    detail: () =>
      selectedId() === part.id
        ? part.label + ', currently selected, finished in ' + materialOf(part.id) + '.'
        : part.label + ', finished in ' + materialOf(part.id) + '.',
    /*
     * Selection is what importance is for.
     *
     * The first version of this scene put ", selected" into state(), which
     * produced "3 parts, mostly oak veneer, selected" once it had been through
     * the digest: state is summarised as the DOMINANT state of the group, so a
     * property belonging to exactly one object came out as a property of all
     * three. Marking the selected part as a landmark keeps it named
     * individually in its area summary instead, which is the question this
     * scene exists to answer: can you tell what you have chosen?
     */
    importance: isSelected ? 'landmark' : 'normal',
  })
  return null
}

export function Configurator({ running }: { running: boolean }) {
  const group = useRef<Group>(null)
  const carriers = useMemo(() => PARTS.map(() => new Object3D()), [])
  const [tick, setTick] = useState(0)
  const nextAt = useRef(0)

  // The descriptor callbacks below are created once and then read the current
  // tick out of a ref, so advancing the selection does not have to rebuild
  // six descriptors and the accessibility tree underneath them.
  const now = useRef(0)
  now.current = tick

  useFrame((frame) => {
    if (!running) return
    const t = frame.clock.elapsedTime
    if (group.current) group.current.rotation.y = Math.sin(t * 0.18) * 0.5
    if (t < nextAt.current) return
    nextAt.current = t + 3.5
    setTick((n) => n + 1)
  })

  const selectedId = () => PARTS[now.current % PARTS.length].id
  const materialOf = (id: string) => {
    const index = PARTS.findIndex((p) => p.id === id)
    return MATERIALS[(index + Math.floor(now.current / PARTS.length)) % MATERIALS.length]
  }
  const selected = PARTS[tick % PARTS.length].id
  const lit = (id: string) => (selected === id ? '#a4531c' : '#8d867a')

  return (
    <group ref={group}>
      {carriers.map((carrier, i) => {
        const part = PARTS[i]
        carrier.position.set(part.at[0], part.at[1], part.at[2])
        return (
          <primitive key={part.id} object={carrier}>
            <Piece
              part={part}
              carrier={carrier}
              materialOf={materialOf}
              selectedId={selectedId}
              isSelected={selected === part.id}
            />
          </primitive>
        )
      })}

      {/* The visible lamp. Geometry only: every word about it lives in the
          descriptors above, which is the separation the library is for. */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.8, 0.9, 0.24, 32]} />
        <meshLambertMaterial color={lit('base')} />
      </mesh>
      <mesh position={[0.5, 0.2, 0.42]}>
        <boxGeometry args={[0.22, 0.16, 0.22]} />
        <meshLambertMaterial color={selected === 'switch' ? '#a4531c' : '#4b463d'} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 1.8, 20]} />
        <meshLambertMaterial color={lit('lower-arm')} />
      </mesh>
      <mesh position={[0.72, 2.02, 0]} rotation={[0, 0, -0.85]}>
        <cylinderGeometry args={[0.08, 0.08, 1.7, 20]} />
        <meshLambertMaterial color={lit('upper-arm')} />
      </mesh>
      <mesh position={[1.58, 2.45, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.55, 0.6, 28, 1, true]} />
        <meshLambertMaterial color={selected === 'shade' ? '#a4531c' : '#6f6959'} side={2} />
      </mesh>
      <mesh position={[1.58, 2.12, 0]}>
        <sphereGeometry args={[0.16, 20, 16]} />
        <meshLambertMaterial color="#f6e6c8" emissive="#f0d9a8" emissiveIntensity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshLambertMaterial color="#e9ddc4" />
      </mesh>
    </group>
  )
}
