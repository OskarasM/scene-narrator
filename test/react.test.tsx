/**
 * The React Three Fiber binding.
 *
 * This file exists because of a bug it caught. `useDescribe` originally read `ref.current`
 * during render, where it is always null on the first render, so an object that rendered
 * exactly once was never described. The accessibility tree came out empty and nothing
 * anywhere threw. An untested React binding in an accessibility library is exactly the sort
 * of silent hole this project argues against, so it is tested.
 *
 * `@react-three/test-renderer` runs the real R3F reconciler against a stub WebGL context,
 * so `useFrame`, `useThree` and the scene graph all behave as they do in a browser.
 */

import { afterEach, beforeEach, expect, it, describe as suite } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { Mesh } from 'three'
import { SceneNarrator, useDescribe, useNarrator } from '../src/react.js'

/**
 * The test renderer's canvas is not attached to `document`, so querying the document finds
 * nothing even when the library mounted correctly. This probe captures the real canvas out
 * of R3F's store so the assertions look in the place the DOM actually is.
 */
let canvasElement: HTMLCanvasElement | null = null

function CaptureCanvas() {
  const gl = useThree((s) => s.gl)
  canvasElement = gl.domElement as HTMLCanvasElement
  return null
}

function Box({ label, position }: { label: string; position: [number, number, number] }) {
  // Deliberately the pattern from the README: a ref that starts null.
  const ref = useRef<Mesh>(null)
  useDescribe(ref, { label, role: 'box' })
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </mesh>
  )
}

function findNarratorRoot(): HTMLElement | null {
  if (!canvasElement) return null
  // Look inside the canvas first, then beside it, so the same helper works for both mount
  // points and a wrong mount point shows up as a failure rather than as a pass.
  const inside = canvasElement.querySelector('.scene-narrator')
  if (inside) return inside as HTMLElement
  // Then beside it. In the test renderer the canvas has no parent, so the library's
  // documented fallback puts a sibling mount on document.body; both are checked so that
  // "mounted somewhere outside the canvas" is a pass and "not mounted at all" is not.
  const parent = canvasElement.parentElement ?? canvasElement.ownerDocument.body
  return (parent?.querySelector('.scene-narrator') as HTMLElement | null) ?? null
}

beforeEach(() => {
  canvasElement = null
  document.body.innerHTML = ''
})

afterEach(() => {
  canvasElement = null
  document.body.innerHTML = ''
})

suite('<SceneNarrator>', () => {
  it('describes objects whose ref starts null, which is the documented pattern', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <CaptureCanvas />
        <SceneNarrator label="Test scene" cadence={0} />
        <Box label="First box" position={[-10, 0, -10]} />
        <Box label="Second box" position={[10, 0, -10]} />
        <Box label="Third box" position={[0, 0, -30]} />
      </>,
    )

    // Two frames: the first mounts, the second gives the narrator a tick after the refs
    // have been attached.
    await renderer.advanceFrames(2, 100)

    const root = findNarratorRoot()
    expect(root).not.toBeNull()
    const text = root?.textContent ?? ''
    // Three boxes were described, so the summaries must mention boxes.
    expect(text).toMatch(/box/)
    expect(text).toMatch(/Test scene/)

    await renderer.unmount()
  })

  it('mounts into the canvas element by default, as canvas fallback content', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <CaptureCanvas />
        <SceneNarrator label="Fallback scene" cadence={0} />
        <Box label="Only box" position={[0, 0, -10]} />
      </>,
    )
    await renderer.advanceFrames(2, 100)

    const root = findNarratorRoot()
    expect(root?.parentElement?.tagName.toLowerCase()).toBe('canvas')

    await renderer.unmount()
  })

  it('mounts beside the canvas when asked to', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <CaptureCanvas />
        <SceneNarrator label="Sibling scene" mount="sibling" cadence={0} />
        <Box label="Only box" position={[0, 0, -10]} />
      </>,
    )
    await renderer.advanceFrames(2, 100)

    const root = findNarratorRoot()
    expect(root).not.toBeNull()
    expect(root?.parentElement?.tagName.toLowerCase()).not.toBe('canvas')
    expect(canvasElement?.querySelector('.scene-narrator')).toBeNull()

    await renderer.unmount()
  })

  it('removes the accessibility tree when unmounted, rather than leaving it behind', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <CaptureCanvas />
        <SceneNarrator label="Disposable scene" cadence={0} />
        <Box label="Only box" position={[0, 0, -10]} />
      </>,
    )
    await renderer.advanceFrames(2, 100)
    expect(findNarratorRoot()).not.toBeNull()

    await renderer.unmount()
    expect(findNarratorRoot()).toBeNull()
  })

  it('exposes the narrator to descendants so the app can announce its own events', async () => {
    let announced = false

    function Announcer() {
      const narrator = useNarrator()
      if (!announced) {
        announced = true
        narrator.announce('Something happened')
      }
      return null
    }

    const renderer = await ReactThreeTestRenderer.create(
      <>
        <CaptureCanvas />
        <SceneNarrator label="Eventful scene" cadence={0}>
          <Announcer />
        </SceneNarrator>
        <Box label="Only box" position={[0, 0, -10]} />
      </>,
    )
    await renderer.advanceFrames(3, 100)

    expect(announced).toBe(true)
    const live = findNarratorRoot()?.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Something happened')

    await renderer.unmount()
  })

  it('stops describing an object when its component unmounts', async () => {
    function Scene({ showSecond }: { showSecond: boolean }) {
      return (
        <>
          <CaptureCanvas />
          <SceneNarrator label="Changing scene" cadence={0} />
          <Box label="Permanent box" position={[-10, 0, -10]} />
          {showSecond ? <Box label="Temporary box" position={[10, 0, -10]} /> : null}
        </>
      )
    }

    const renderer = await ReactThreeTestRenderer.create(<Scene showSecond />)
    await renderer.advanceFrames(2, 100)

    await renderer.update(<Scene showSecond={false} />)
    await renderer.advanceFrames(2, 100)

    // The removed object must not still be counted in any region summary. A stale entry in
    // the accessibility tree is worse than a missing one: it sends a user looking for
    // something that is not there.
    const text = findNarratorRoot()?.textContent ?? ''
    expect(text).not.toMatch(/Temporary box/)

    await renderer.unmount()
  })
})
