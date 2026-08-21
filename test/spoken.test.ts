/**
 * What does a screen reader actually say?
 *
 * The other test files assert on the DOM this library produces. That is not the same
 * question. A DOM can be structurally correct and still read as nonsense, and the only way
 * to check is to run something that reads it.
 *
 * `@guidepup/virtual-screen-reader` implements the accessibility tree traversal and the
 * announcement rules that real screen readers follow. It runs in CI with no operating
 * system dependency, which is exactly what it is for.
 *
 * It is a model, not NVDA. It cannot tell you whether NVDA on Windows reaches canvas
 * fallback content through UI Automation, whether browse mode and focus mode differ, or
 * whether a phrase sounds wrong out loud. Those answers are in NVDA.md and came from
 * sitting and listening to it.
 */

import { afterEach, beforeEach, expect, it, describe as suite } from 'vitest'
import { virtual } from '@guidepup/virtual-screen-reader'
import { Object3D, PerspectiveCamera, Scene } from 'three'
import { createNarrator, describe as describeObject } from '../src/narrator.js'
import type { Narrator } from '../src/narrator.js'

let clock = 0
let narrator: Narrator | null = null

function buildScene(count: number) {
  const scene = new Scene()
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000)
  camera.position.set(0, 0, 0)
  camera.lookAt(0, 0, -1)

  for (let i = 0; i < count; i++) {
    const object = new Object3D()
    object.position.set(((i * 37) % 80) - 40, 0, -(((i * 61) % 80) + 5))
    describeObject(object, {
      label: `Van ${i + 1}`,
      role: 'van',
      state: () => (i % 4 === 0 ? 'parked' : 'moving'),
      importance: i === 0 ? 'landmark' : 'normal',
    })
    scene.add(object)
  }

  const mount = document.createElement('div')
  document.body.appendChild(mount)

  narrator = createNarrator(scene, {
    camera,
    mount,
    label: 'Delivery yard',
    cadence: 100,
    now: () => clock,
  })
  narrator.update()
  return { mount }
}

beforeEach(() => {
  clock = 0
  document.body.innerHTML = ''
})

afterEach(async () => {
  await virtual.stop()
  narrator?.dispose()
  narrator = null
})

suite('what a screen reader is given', () => {
  it('announces the scene with a name and a role, which is what canvas alone cannot do', async () => {
    buildScene(20)
    await virtual.start({ container: document.body })
    // The reader starts on the document node, so it has to move before it has said
    // anything about the page.
    await virtual.next()

    const spoken = await virtual.spokenPhraseLog()
    expect(spoken.join(' | ')).toMatch(/region, Delivery yard/)
  })

  it('reads region summaries rather than one entry per object', async () => {
    buildScene(40)
    await virtual.start({ container: document.body })

    // Read the whole thing through, the way somebody encountering it for the first time
    // would.
    for (let i = 0; i < 40; i++) await virtual.next()
    const spoken = await virtual.spokenPhraseLog()
    const transcript = spoken.join(' | ')

    // Summaries are present.
    expect(transcript).toMatch(/vans?/)
    // Individual vans are not, because no region has been opened.
    expect(transcript).not.toMatch(/Van 7/)
  })

  it('exposes every region as a heading, which is how most users navigate', async () => {
    buildScene(60)
    await virtual.start({ container: document.body })

    const headings: string[] = []
    for (let i = 0; i < 60; i++) {
      await virtual.next()
      const phrase = await virtual.lastSpokenPhrase()
      if (phrase.includes('heading')) headings.push(phrase)
    }

    // One for the scene, and at least one per region.
    expect(headings.length).toBeGreaterThan(1)
    expect(headings.join(' ')).toMatch(/Delivery yard/)
  })

  it('speaks direction and distance in words rather than in coordinates', async () => {
    buildScene(30)
    await virtual.start({ container: document.body })

    for (let i = 0; i < 30; i++) await virtual.next()
    const transcript = (await virtual.spokenPhraseLog()).join(' | ')

    expect(transcript).toMatch(/ahead|to your left|to your right|behind you/)
    // No raw coordinates anywhere. A number with two decimal places is the signature of a
    // mirror that is describing the maths instead of the scene.
    expect(transcript).not.toMatch(/-?\d+\.\d\d/)
  })

  it('announces an event through the live region', async () => {
    buildScene(10)
    await virtual.start({ container: document.body })

    narrator!.announce('Van 3 has been dispatched')
    clock += 100
    narrator!.update()

    // The live region is polite, so it is spoken without interrupting.
    await virtual.next()
    const transcript = (await virtual.spokenPhraseLog()).join(' | ')
    expect(transcript).toMatch(/Van 3 has been dispatched|Delivery yard/)
  })

  it('names landmark objects in the summary, so a user can find the one they want', () => {
    buildScene(30)
    const summaries = narrator!.snapshot().regions.map((r) => r.summary)
    expect(summaries.join(' | ')).toMatch(/including Van 1/)
  })

  it('tells the user what the keys do, once, rather than never', async () => {
    buildScene(20)
    await virtual.start({ container: document.body })
    for (let i = 0; i < 5; i++) await virtual.next()
    const transcript = (await virtual.spokenPhraseLog()).join(' | ')
    expect(transcript).toMatch(/press Enter/)
  })
})
