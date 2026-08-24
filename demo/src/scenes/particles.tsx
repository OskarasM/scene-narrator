/**
 * The particle field: four thousand described objects.
 *
 * The size at which the naive approach is not slow but absent. The spike
 * measured a 1:1 mirror crossing the 60fps budget at around 500 objects on
 * both engines, so at four thousand there is no version of the mirror that
 * ships; the only question is whether the grouped tree still holds. It does,
 * and bench/partition.mjs is the number.
 *
 * Two things here are different from the other two scenes, and both are the
 * point rather than a shortcut:
 *
 * 1. The carriers are created and described imperatively, with describe(), not
 *    with useDescribe. Four thousand React components to hold four thousand
 *    descriptors would be a bigger problem than the one being solved, and the
 *    plain describe() call is the library core anyway. The React binding is a
 *    convenience over it, not the API.
 * 2. Nothing here is individually interesting, which is exactly the case that
 *    breaks a mirror and suits a summary. Nine headings, four thousand
 *    objects, and the sentence still says something true.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, InstancedMesh, Object3D } from 'three'
import { describe, undescribe } from 'scene-narrator'
import { FIELD_EXTENT as FIELD, PARTICLE_COUNT as COUNT } from './meta'

interface Mote {
  radius: number
  angle: number
  speed: number
  height: number
  settled: boolean
}

function makeMotes(): Mote[] {
  // Fixed arithmetic rather than Math.random, so two visits describe the same
  // field and a transcript taken from it can be checked.
  return Array.from({ length: COUNT }, (_, i) => ({
    radius: 4 + ((i * 7919) % 1000) / 1000 * FIELD,
    angle: ((i * 2654) % 1000) / 1000 * Math.PI * 2,
    speed: 0.04 + ((i * 104729) % 100) / 100 * 0.16,
    height: ((i * 31337) % 100) / 100 * 6,
    settled: i % 7 === 0,
  }))
}

export function Particles({ running }: { running: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const group = useRef<Group>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const motes = useMemo(makeMotes, [])
  const carriers = useMemo(() => motes.map(() => new Object3D()), [motes])

  // Attach the carriers to the scene graph once, describe them once, and take
  // them out again on unmount. Leaving described objects behind would leave
  // the narrator describing a scene that is no longer on screen, which is a
  // worse failure than describing nothing.
  useEffect(() => {
    const parent = group.current
    if (!parent) return
    carriers.forEach((carrier, i) => {
      parent.add(carrier)
      describe(carrier, {
        // Three landmarks in four thousand objects. Any more and the summary
        // stops being a summary.
        label: i % 1500 === 0 ? 'Marker ' + (i / 1500 + 1) : 'Mote ' + (i + 1),
        role: 'mote',
        state: () => (motes[i].settled ? 'settled' : 'drifting'),
        importance: i % 1500 === 0 ? 'landmark' : 'normal',
      })
    })
    return () => {
      for (const carrier of carriers) {
        undescribe(carrier)
        parent.remove(carrier)
      }
    }
  }, [carriers, motes])

  useFrame((_, delta) => {
    const step = running ? Math.min(delta, 1 / 30) : 0
    for (let i = 0; i < motes.length; i++) {
      const mote = motes[i]
      if (!mote.settled && step > 0) mote.angle += mote.speed * step
      const x = Math.cos(mote.angle) * mote.radius
      const z = Math.sin(mote.angle) * mote.radius
      // The carrier is what the narrator reads, so it has to be written every
      // frame the instance matrix is: a described position one frame stale is
      // fine, one that never moves is a lie.
      carriers[i].position.set(x, mote.height, z)
      dummy.position.set(x, mote.height, z)
      dummy.scale.setScalar(mote.settled ? 0.55 : 0.35)
      dummy.updateMatrix()
      mesh.current?.setMatrixAt(i, dummy.matrix)
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <group ref={group} />
      <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshLambertMaterial color="#a4531c" />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[FIELD * 2.6, FIELD * 2.6]} />
        <meshLambertMaterial color="#e9ddc4" />
      </mesh>
    </>
  )
}
