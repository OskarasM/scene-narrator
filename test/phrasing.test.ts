import { describe, expect, it } from 'vitest'
import {
  BEARINGS,
  bearingSector,
  centroid,
  distanceBand,
  distancePhrase,
  joinList,
  plural,
  summariseRegion,
} from '../src/phrasing.js'
import type { Digest } from '../src/types.js'

const AHEAD = { x: 0, y: 0, z: -1 }
const EYE = { x: 0, y: 0, z: 0 }

describe('bearingSector', () => {
  it('puts something directly in front into the ahead sector', () => {
    expect(BEARINGS[bearingSector(EYE, AHEAD, { x: 0, y: 0, z: -10 })]).toBe('ahead')
  })

  it('distinguishes left from right, which is the one thing it must never get wrong', () => {
    // Camera at the origin looking down -Z. World +X is then to the camera's right.
    expect(BEARINGS[bearingSector(EYE, AHEAD, { x: 10, y: 0, z: 0 })]).toBe('to your right')
    expect(BEARINGS[bearingSector(EYE, AHEAD, { x: -10, y: 0, z: 0 })]).toBe('to your left')
  })

  it('reports behind', () => {
    expect(BEARINGS[bearingSector(EYE, AHEAD, { x: 0, y: 0, z: 10 })]).toBe('behind you')
  })

  it('rotates with the camera rather than with the world', () => {
    // Camera turned to look down +X. The object at world +X is now straight ahead.
    const facingPlusX = { x: 1, y: 0, z: 0 }
    expect(BEARINGS[bearingSector(EYE, facingPlusX, { x: 10, y: 0, z: 0 })]).toBe('ahead')
  })

  it('ignores height, so an object overhead still reports its horizontal bearing', () => {
    expect(BEARINGS[bearingSector(EYE, AHEAD, { x: 0, y: 500, z: -10 })]).toBe('ahead')
  })

  it('falls back to ahead rather than producing noise for a camera looking straight down', () => {
    expect(bearingSector(EYE, { x: 0, y: -1, z: 0 }, { x: 3, y: 0, z: 4 })).toBe(0)
  })

  it('covers all eight sectors as a target circles the camera', () => {
    const seen = new Set<number>()
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180
      seen.add(bearingSector(EYE, AHEAD, { x: Math.sin(rad) * 10, y: 0, z: -Math.cos(rad) * 10 }))
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('distance bands', () => {
  it('is monotonic, so moving away never sounds like moving closer', () => {
    let previous = -1
    for (const d of [0, 1, 4.9, 5, 14, 15, 39, 40, 99, 100, 1000]) {
      const band = distanceBand(d)
      expect(band).toBeGreaterThanOrEqual(previous)
      previous = band
    }
  })

  it('names every band it can produce', () => {
    for (const d of [0, 10, 30, 80, 5000]) {
      expect(distancePhrase(distanceBand(d))).toMatch(/\w/)
    }
  })
})

describe('plural', () => {
  it('leaves a single item alone', () => {
    expect(plural('vehicle', 1)).toBe('vehicle')
  })

  it('handles the regular case and the two common irregular endings', () => {
    expect(plural('vehicle', 3)).toBe('vehicles')
    expect(plural('box', 3)).toBe('boxes')
    expect(plural('body', 3)).toBe('bodies')
    // A vowel before the y is the exception to the exception.
    expect(plural('trolley', 3)).toBe('trolleys')
  })
})

describe('joinList', () => {
  it('reads as a sentence rather than as an array', () => {
    expect(joinList([])).toBe('')
    expect(joinList(['a'])).toBe('a')
    expect(joinList(['a', 'b'])).toBe('a and b')
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('centroid', () => {
  it('averages positions', () => {
    expect(
      centroid([
        { id: '1', descriptor: { label: 'a' }, position: { x: 0, y: 0, z: 0 } },
        { id: '2', descriptor: { label: 'b' }, position: { x: 10, y: 4, z: -2 } },
      ]),
    ).toEqual({ x: 5, y: 2, z: -1 })
  })

  it('does not divide by zero for an empty region', () => {
    expect(centroid([])).toEqual({ x: 0, y: 0, z: 0 })
  })
})

function digest(overrides: Partial<Digest> = {}): Digest {
  return {
    count: 5,
    dominantRole: 'vehicle',
    dominantRoleCount: 5,
    dominantState: 'moving',
    bearing: 7,
    distanceBand: 1,
    landmarks: [],
    ...overrides,
  }
}

describe('summariseRegion', () => {
  const options = { units: 'metres' }

  it('describes rather than enumerates', () => {
    expect(summariseRegion(digest(), options)).toBe(
      '5 vehicles, mostly moving, ahead and to your left, nearby',
    )
  })

  it('names the majority and counts the rest when contents are mixed', () => {
    const summary = summariseRegion(digest({ count: 7, dominantRoleCount: 5 }), options)
    expect(summary).toContain('7 objects, 5 vehicles and 2 others')
  })

  it('omits state entirely when nothing reports one', () => {
    expect(summariseRegion(digest({ dominantState: '' }), options)).not.toContain('mostly')
  })

  it('names landmarks, because those are what a user is actually looking for', () => {
    expect(summariseRegion(digest({ landmarks: ['The loading bay'] }), options)).toContain(
      'including The loading bay',
    )
  })

  it('says empty rather than producing a sentence about nothing', () => {
    expect(summariseRegion(digest({ count: 0 }), options)).toBe('empty')
  })

  it('falls back to a generic noun when the author gave no role', () => {
    expect(summariseRegion(digest({ dominantRole: '' }), options)).toContain('5 objects')
  })
})
