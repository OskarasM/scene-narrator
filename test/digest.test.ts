import { describe, expect, it } from 'vitest'
import { AnnouncementQueue, computeDigest, digestsEqual } from '../src/digest.js'
import type { Member, Region } from '../src/types.js'

const EYE = { x: 0, y: 0, z: 0 }
const AHEAD = { x: 0, y: 0, z: -1 }

function region(members: Member[]): Region {
  return { id: 'r', heading: 'Region', members }
}

function member(id: string, x: number, z: number, extra: Partial<Member['descriptor']> = {}): Member {
  return { id, descriptor: { label: id, ...extra }, position: { x, y: 0, z } }
}

describe('computeDigest', () => {
  it('counts members and finds the dominant role', () => {
    const d = computeDigest(
      region([
        member('a', 0, -10, { role: 'vehicle' }),
        member('b', 1, -10, { role: 'vehicle' }),
        member('c', 2, -10, { role: 'crate' }),
      ]),
      EYE,
      AHEAD,
    )
    expect(d.count).toBe(3)
    expect(d.dominantRole).toBe('vehicle')
    expect(d.dominantRoleCount).toBe(2)
  })

  it('collects landmarks in a stable order', () => {
    const d = computeDigest(
      region([
        member('zebra', 0, -10, { importance: 'landmark' }),
        member('apple', 1, -10, { importance: 'landmark' }),
        member('plain', 2, -10),
      ]),
      EYE,
      AHEAD,
    )
    expect(d.landmarks).toEqual(['apple', 'zebra'])
  })

  it('calls state once per member and uses the most common answer', () => {
    let calls = 0
    const state = (value: string) => () => {
      calls++
      return value
    }
    const d = computeDigest(
      region([
        member('a', 0, -10, { state: state('moving') }),
        member('b', 1, -10, { state: state('moving') }),
        member('c', 2, -10, { state: state('stopped') }),
      ]),
      EYE,
      AHEAD,
    )
    expect(d.dominantState).toBe('moving')
    expect(calls).toBe(3)
  })

  it('survives an author state callback that throws', () => {
    const d = computeDigest(
      region([
        member('bad', 0, -10, {
          state: () => {
            throw new Error('author bug')
          },
        }),
        member('good', 1, -10, { state: () => 'idle' }),
      ]),
      EYE,
      AHEAD,
    )
    // The object stays in the tree. Losing an object from the accessibility tree because a
    // callback threw would be the worst possible failure mode for this library.
    expect(d.count).toBe(2)
    expect(d.dominantState).toBe('idle')
  })
})

describe('digestsEqual', () => {
  const base = computeDigest(region([member('a', 0, -10, { role: 'vehicle' })]), EYE, AHEAD)

  it('treats an absent previous digest as different, so the first write always happens', () => {
    expect(digestsEqual(undefined, base)).toBe(false)
  })

  it('ignores movement that stays inside the same quantisation cell', () => {
    // Moved a little, still ahead, still in the same distance band.
    const nudged = computeDigest(region([member('a', 0.2, -10.3, { role: 'vehicle' })]), EYE, AHEAD)
    expect(digestsEqual(base, nudged)).toBe(true)
  })

  it('notices a change of bearing', () => {
    const moved = computeDigest(region([member('a', 10, 0, { role: 'vehicle' })]), EYE, AHEAD)
    expect(digestsEqual(base, moved)).toBe(false)
  })

  it('notices a change of distance band', () => {
    const far = computeDigest(region([member('a', 0, -200, { role: 'vehicle' })]), EYE, AHEAD)
    expect(digestsEqual(base, far)).toBe(false)
  })

  it('notices a member arriving', () => {
    const more = computeDigest(
      region([member('a', 0, -10, { role: 'vehicle' }), member('b', 1, -10, { role: 'vehicle' })]),
      EYE,
      AHEAD,
    )
    expect(digestsEqual(base, more)).toBe(false)
  })

  it('notices a change of landmarks', () => {
    const withLandmark = computeDigest(
      region([member('a', 0, -10, { role: 'vehicle', importance: 'landmark' })]),
      EYE,
      AHEAD,
    )
    expect(digestsEqual(base, withLandmark)).toBe(false)
  })
})

describe('AnnouncementQueue', () => {
  it('replaces rather than queues, so a burst produces one announcement', () => {
    const q = new AnnouncementQueue(100)
    q.push('first')
    q.push('second')
    q.push('third')
    expect(q.take(1000)).toBe('third')
    expect(q.take(2000)).toBe(null)
  })

  it('holds messages back until the minimum interval has passed', () => {
    const q = new AnnouncementQueue(100)
    q.push('a')
    expect(q.take(1000)).toBe('a')
    q.push('b')
    expect(q.take(1050)).toBe(null)
    expect(q.take(1100)).toBe('b')
  })

  it('returns null when there is nothing to say', () => {
    expect(new AnnouncementQueue(100).take(0)).toBe(null)
  })
})
