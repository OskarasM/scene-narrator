/**
 * Integration tests for the narrator against a real Three.js scene graph.
 *
 * No WebGL is involved: `Object3D` and `PerspectiveCamera` are plain maths, so the whole
 * thing runs in jsdom. The one test that matters most in this file is
 * "mutation count is independent of object count", because that is the library's central
 * performance claim and the README is not allowed to make it unless this passes.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { Object3D, PerspectiveCamera, Scene } from 'three'
import { createNarrator, describe as describeObject } from '../src/narrator.js'
import type { Narrator } from '../src/narrator.js'

let clock = 0
const now = () => clock

function scenario(objectCount: number, spread = 100) {
  const scene = new Scene()
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000)
  camera.position.set(0, 0, 0)
  camera.lookAt(0, 0, -1)

  const objects: Object3D[] = []
  for (let i = 0; i < objectCount; i++) {
    const object = new Object3D()
    // Deterministic placement, spread over the scene so that the automatic grid produces
    // more than one region.
    object.position.set(
      ((i * 37) % spread) - spread / 2,
      0,
      -(((i * 61) % spread) + 1),
    )
    describeObject(object, { label: `Object ${i}`, role: 'crate' })
    scene.add(object)
    objects.push(object)
  }

  const mount = document.createElement('div')
  document.body.appendChild(mount)
  return { scene, camera, mount, objects }
}

let narrator: Narrator | null = null

beforeEach(() => {
  clock = 0
  document.body.innerHTML = ''
  narrator?.dispose()
  narrator = null
})

describe('createNarrator', () => {
  it('builds a heading structure rather than a flat list of objects', () => {
    const { scene, camera, mount } = scenario(40)
    narrator = createNarrator(scene, { camera, mount, label: 'Warehouse yard', now })
    narrator.update()

    // The scene gets one heading, regions get the level below. Heading navigation is how
    // 71.6% of screen reader users move around a page, so this structure is the feature.
    expect(mount.querySelector('h2')?.textContent).toBe('Warehouse yard')
    const regionHeadings = [...mount.querySelectorAll('h3')].map((h) => h.textContent)
    expect(regionHeadings.length).toBeGreaterThan(1)
    expect(regionHeadings.length).toBeLessThan(40)
  })

  it('respects the author heading level so it fits the surrounding document outline', () => {
    const { scene, camera, mount } = scenario(10)
    narrator = createNarrator(scene, { camera, mount, headingLevel: 4, now })
    narrator.update()
    expect(mount.querySelector('h4')).not.toBeNull()
    expect(mount.querySelector('h5')).not.toBeNull()
  })

  it('summarises a region instead of enumerating its contents', () => {
    const { scene, camera, mount } = scenario(30)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()

    const summaries = [...mount.querySelectorAll('[data-narrator-region] p')].map((p) => p.textContent ?? '')
    expect(summaries.length).toBeGreaterThan(0)
    for (const summary of summaries) expect(summary).toMatch(/crate/)
    // Nothing is listed per object until a region is opened.
    expect(mount.querySelectorAll('li').length).toBe(0)
  })

  it('ignores objects with no descriptor', () => {
    const { scene, camera, mount } = scenario(5)
    scene.add(new Object3D())
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()
    const total = narrator.snapshot().regions.reduce((n, r) => n + r.memberLabels.length, 0)
    expect(total).toBe(5)
  })

  it('ignores an invisible object, because an invisible object is not in the scene', () => {
    const { scene, camera, mount, objects } = scenario(5)
    objects[0].visible = false
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()
    const total = narrator.snapshot().regions.reduce((n, r) => n + r.memberLabels.length, 0)
    expect(total).toBe(4)
  })
})

describe('cadence', () => {
  it('does nothing on frames inside the cadence window', () => {
    const { scene, camera, mount } = scenario(20)
    narrator = createNarrator(scene, { camera, mount, cadence: 250, now })

    narrator.update()
    const afterFirst = narrator.stats()
    expect(afterFirst.evaluations).toBe(1)

    // Sixty more frames, all inside the same 250ms window.
    for (let i = 0; i < 60; i++) {
      clock += 4
      narrator!.update()
    }
    expect(narrator.stats().evaluations).toBe(1)
    expect(narrator.stats().frames).toBe(61)

    clock += 250
    narrator.update()
    expect(narrator.stats().evaluations).toBe(2)
  })

  it('does not touch the DOM when nothing meaningful changed', () => {
    const { scene, camera, mount, objects } = scenario(20)
    narrator = createNarrator(scene, { camera, mount, cadence: 100, now })
    narrator.update()
    const settled = narrator.stats().domWrites

    // Nudge every object by a hair, repeatedly, across many cadence windows.
    for (let step = 0; step < 20; step++) {
      for (const object of objects) object.position.x += 0.001
      clock += 100
      narrator!.update()
    }

    expect(narrator.stats().evaluations).toBe(21)
    expect(narrator.stats().domWrites).toBe(settled)
  })

  it('writes when motion crosses a quantisation boundary', () => {
    const { scene, camera, mount, objects } = scenario(20)
    narrator = createNarrator(scene, { camera, mount, cadence: 100, now })
    narrator.update()
    const settled = narrator.stats().domWrites

    // Move everything a long way away, which must cross a distance band.
    for (const object of objects) object.position.z -= 500
    clock += 100
    narrator.update()

    expect(narrator.stats().domWrites).toBeGreaterThan(settled)
  })
})

describe('the central performance claim', () => {
  /**
   * The naive mirror writes once per object per frame. This library writes once per region
   * whose meaning changed, at cadence. So the number of DOM mutations produced by the same
   * motion over the same time must not grow with the number of objects.
   *
   * This test is the reason the README is allowed to say that.
   */
  it('mutation count is independent of object count', () => {
    const counts = [50, 500, 5000]
    const writes: number[] = []

    for (const count of counts) {
      clock = 0
      document.body.innerHTML = ''
      const { scene, camera, mount, objects } = scenario(count)
      const n = createNarrator(scene, { camera, mount, cadence: 100, autoRegions: 6, now })

      // Five seconds of motion at 60fps, with everything drifting steadily.
      for (let frame = 0; frame < 300; frame++) {
        for (const object of objects) object.position.z -= 0.5
        clock += 16.7
        n.update()
      }
      writes.push(n.stats().domWrites)
      n.dispose()
    }

    // A hundredfold increase in objects must not produce a materially different number of
    // DOM mutations. The tolerance is deliberately loose: what is being asserted is that
    // the relationship is flat, not that it is identical.
    const [small, , large] = writes
    expect(large).toBeLessThan(small * 2)
  })

  it('per-frame work is constant, so frames inside the cadence cost one comparison', () => {
    const { scene, camera, mount } = scenario(2000)
    narrator = createNarrator(scene, { camera, mount, cadence: 250, now })
    narrator.update()
    const evaluationsAfterFirst = narrator.stats().evaluations

    for (let i = 0; i < 1000; i++) {
      clock += 0.1
      narrator!.update()
    }
    expect(narrator.stats().evaluations).toBe(evaluationsAfterFirst)
  })
})

describe('announcements', () => {
  it('coalesces a burst into one polite message', () => {
    const { scene, camera, mount } = scenario(10)
    narrator = createNarrator(scene, { camera, mount, cadence: 250, now })
    narrator.update()

    for (let i = 0; i < 50; i++) narrator.announce(`Object ${i} spawned`)
    clock += 250
    narrator.update()

    const live = mount.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Object 49 spawned')
  })

  it('sends assertive messages immediately and only when the author asks', () => {
    const { scene, camera, mount } = scenario(10)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()

    narrator.announce('Collision', { assertive: true })
    expect(mount.querySelector('[aria-live="assertive"]')?.textContent).toBe('Collision')
    // Nothing the library infers by itself is ever assertive.
    expect(mount.querySelector('[aria-live="polite"]')?.textContent).not.toBe('Collision')
  })

  it('has both live channels marked atomic so a replaced message reads as one thing', () => {
    const { scene, camera, mount } = scenario(5)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()
    for (const channel of mount.querySelectorAll('[aria-live]')) {
      expect(channel.getAttribute('aria-atomic')).toBe('true')
    }
  })
})

describe('focus and detail', () => {
  it('materialises per-object detail only when a region is opened', () => {
    const { scene, camera, mount } = scenario(30)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()

    expect(mount.querySelectorAll('li').length).toBe(0)

    const section = mount.querySelector('[data-narrator-region]') as HTMLElement
    section.focus()
    section.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(mount.querySelectorAll('li').length).toBeGreaterThan(0)

    section.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(mount.querySelectorAll('li').length).toBe(0)
  })

  it('keeps exactly one tab stop and moves between regions with the arrow keys', () => {
    const { scene, camera, mount } = scenario(60)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()

    const sections = [...mount.querySelectorAll('[data-narrator-region]')] as HTMLElement[]
    expect(sections.length).toBeGreaterThan(1)
    expect(sections.filter((s) => s.tabIndex === 0).length).toBe(1)

    sections[0].focus()
    sections[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(sections[1])

    // And it wraps, so a user cannot get stuck at either end.
    sections[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement).toBe(sections[0])
    sections[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement).toBe(sections[sections.length - 1])
  })

  it('tells the application which region has focus, so the camera can follow', () => {
    const { scene, camera, mount } = scenario(60)
    const focused: (string | null)[] = []
    narrator = createNarrator(scene, {
      camera,
      mount,
      now,
      onFocusRegion: (region) => focused.push(region?.id ?? null),
    })
    narrator.update()

    const sections = [...mount.querySelectorAll('[data-narrator-region]')] as HTMLElement[]
    sections[1].focus()
    expect(focused).toHaveLength(1)
    expect(focused[0]).toBe(sections[1].dataset.narratorRegion)
  })

  it('leaves keys it does not handle alone, so screen reader shortcuts still work', () => {
    const { scene, camera, mount } = scenario(20)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()

    const section = mount.querySelector('[data-narrator-region]') as HTMLElement
    section.focus()
    const event = new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true })
    section.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('hiding', () => {
  it('uses clipping rather than display none, which would remove it from the tree', () => {
    const { scene, camera, mount } = scenario(5)
    narrator = createNarrator(scene, { camera, mount, now })
    narrator.update()

    const root = mount.querySelector('.scene-narrator') as HTMLElement
    const style = document.getElementById('scene-narrator-style')?.textContent ?? ''
    expect(root.className).toContain('scene-narrator-sr-only')
    expect(style).toContain('clip-path: inset(50%)')
    expect(style).not.toContain('display: none')
    expect(style).not.toContain('visibility: hidden')
  })
})

describe('dispose', () => {
  it('removes everything it added', () => {
    const { scene, camera, mount } = scenario(20)
    const n = createNarrator(scene, { camera, mount, now })
    n.update()
    expect(mount.querySelector('.scene-narrator')).not.toBeNull()
    n.dispose()
    expect(mount.querySelector('.scene-narrator')).toBeNull()
  })
})
