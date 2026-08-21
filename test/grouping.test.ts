import { describe, expect, it } from 'vitest'
import { boundsOf, partitionAuto, partitionByDefinitions } from '../src/grouping.js'
import type { Member, RegionDefinition } from '../src/types.js'

function member(id: string, x: number, z: number, label = id): Member {
  return { id, descriptor: { label }, position: { x, y: 0, z } }
}

describe('boundsOf', () => {
  it('covers every member', () => {
    const bounds = boundsOf([member('a', -5, 2), member('b', 10, -8)])
    expect(bounds.min.x).toBe(-5)
    expect(bounds.max.x).toBe(10)
    expect(bounds.min.z).toBe(-8)
    expect(bounds.max.z).toBe(2)
  })

  it('returns a degenerate box rather than infinities for an empty scene', () => {
    expect(boundsOf([])).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } })
  })
})

describe('partitionAuto', () => {
  const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 0, z: 100 } }

  it('never loses a member', () => {
    const members = Array.from({ length: 50 }, (_, i) => member(String(i), i * 2, (i * 7) % 100))
    const regions = partitionAuto(members, bounds, 6)
    expect(regions.flatMap((r) => r.members).length).toBe(50)
  })

  it('drops empty cells, so the target region count is a target', () => {
    const regions = partitionAuto([member('a', 1, 1), member('b', 2, 2)], bounds, 9)
    expect(regions.length).toBe(1)
  })

  it('separates members that are far apart', () => {
    const regions = partitionAuto([member('a', 1, 1), member('b', 99, 99)], bounds, 4)
    expect(regions.length).toBe(2)
  })

  it('clamps members outside the bounds into an edge region instead of inventing one', () => {
    const regions = partitionAuto([member('far', 1e6, 1e6)], bounds, 4)
    expect(regions.length).toBe(1)
    expect(regions[0].members[0].id).toBe('far')
  })

  it('produces a stable region order between calls, so reading order never shuffles', () => {
    const members = Array.from({ length: 30 }, (_, i) => member(String(i), (i * 13) % 100, (i * 29) % 100))
    const first = partitionAuto(members, bounds, 9).map((r) => r.id)
    const second = partitionAuto(members.slice().reverse(), bounds, 9).map((r) => r.id)
    expect(second).toEqual(first)
  })

  it('gives every region a heading that means something read on its own', () => {
    const members = Array.from({ length: 40 }, (_, i) => member(String(i), (i * 11) % 100, (i * 23) % 100))
    for (const region of partitionAuto(members, bounds, 9)) {
      expect(region.heading).toMatch(/scene/)
      expect(region.heading).not.toMatch(/\d/)
    }
  })

  it('returns nothing for an empty scene rather than one empty region', () => {
    expect(partitionAuto([], bounds, 6)).toEqual([])
  })
})

describe('partitionByDefinitions', () => {
  const definitions: RegionDefinition[] = [
    { id: 'yard', heading: 'Loading yard', min: { x: 0, y: -10, z: 0 }, max: { x: 10, y: 10, z: 10 } },
    { id: 'road', heading: 'Access road', min: { x: 20, y: -10, z: 0 }, max: { x: 30, y: 10, z: 10 } },
  ]

  it('assigns members to the region containing them', () => {
    const regions = partitionByDefinitions([member('a', 5, 5), member('b', 25, 5)], definitions)
    expect(regions.map((r) => r.id)).toEqual(['yard', 'road'])
  })

  it('collects strays rather than dropping them, because a dropped object is invisible', () => {
    const regions = partitionByDefinitions([member('stray', 500, 500)], definitions)
    expect(regions.map((r) => r.id)).toEqual(['elsewhere'])
    expect(regions[0].members[0].id).toBe('stray')
  })

  it('omits regions that are currently empty', () => {
    const regions = partitionByDefinitions([member('a', 5, 5)], definitions)
    expect(regions.map((r) => r.id)).toEqual(['yard'])
  })

  it('puts a member into the first matching region when definitions overlap', () => {
    const overlapping: RegionDefinition[] = [
      ...definitions,
      { id: 'everything', heading: 'Everything', min: { x: -1e3, y: -1e3, z: -1e3 }, max: { x: 1e3, y: 1e3, z: 1e3 } },
    ]
    const regions = partitionByDefinitions([member('a', 5, 5)], overlapping)
    expect(regions.map((r) => r.id)).toEqual(['yard'])
  })
})
