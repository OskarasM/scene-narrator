/**
 * Deciding which objects belong together.
 *
 * A 1:1 mirror of a thousand meshes is not merely slow, it is unusable: it produces a flat
 * structureless list that destroys the heading navigation 71.6% of screen reader users rely
 * on (WebAIM screen reader survey #10, n=1,539). Grouping is therefore the primary design
 * decision and the performance benefit is a consequence of it, not the reason for it.
 *
 * Pure, no Three.js, no DOM.
 */

import type { Member, Point, Region, RegionDefinition } from './types.js'

export interface Bounds {
  min: Point
  max: Point
}

export function boundsOf(members: Member[]): Bounds {
  if (members.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
  }
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const m of members) {
    min.x = Math.min(min.x, m.position.x)
    min.y = Math.min(min.y, m.position.y)
    min.z = Math.min(min.z, m.position.z)
    max.x = Math.max(max.x, m.position.x)
    max.y = Math.max(max.y, m.position.y)
    max.z = Math.max(max.z, m.position.z)
  }
  return { min, max }
}

function contains(def: RegionDefinition, p: Point): boolean {
  return (
    p.x >= def.min.x &&
    p.x <= def.max.x &&
    p.y >= def.min.y &&
    p.y <= def.max.y &&
    p.z >= def.min.z &&
    p.z <= def.max.z
  )
}

/**
 * Assign members to author-defined regions. Anything outside every region is collected
 * into one trailing region rather than dropped, because silently omitting an object from
 * the accessibility tree is the failure mode this library exists to prevent.
 */
export function partitionByDefinitions(
  members: Member[],
  definitions: RegionDefinition[],
): Region[] {
  const regions: Region[] = definitions.map((d) => ({ id: d.id, heading: d.heading, members: [] }))
  const elsewhere: Member[] = []

  for (const m of members) {
    const index = definitions.findIndex((d) => contains(d, m.position))
    if (index === -1) elsewhere.push(m)
    else regions[index].members.push(m)
  }

  const out = regions.filter((r) => r.members.length > 0)
  if (elsewhere.length > 0) {
    out.push({ id: 'elsewhere', heading: 'Elsewhere in the scene', members: elsewhere })
  }
  return out
}

/**
 * A uniform grid over the two widest horizontal axes, sized so that a full grid would hold
 * roughly `target` cells. Empty cells are dropped, so `target` is a target and not a
 * guarantee, which the README says in those words.
 *
 * Deliberately a uniform grid rather than an octree. A grid is O(n) to build with no
 * allocation per node, and it is rebuilt at the narrator's cadence rather than per frame.
 * If a real scene shows the grid to be the bottleneck, the interface here is small enough
 * to swap.
 */
export function partitionAuto(members: Member[], bounds: Bounds, target: number): Region[] {
  if (members.length === 0) return []

  const divisions = Math.max(1, Math.ceil(Math.sqrt(target)))
  const spanX = Math.max(bounds.max.x - bounds.min.x, 1e-6)
  const spanZ = Math.max(bounds.max.z - bounds.min.z, 1e-6)

  const cells = new Map<string, Member[]>()
  for (const m of members) {
    // Clamped rather than expanded, so a member that has moved outside the original bounds
    // joins the nearest edge region instead of silently creating a new one every frame.
    const ix = clampIndex(((m.position.x - bounds.min.x) / spanX) * divisions, divisions)
    const iz = clampIndex(((m.position.z - bounds.min.z) / spanZ) * divisions, divisions)
    const key = `${ix}-${iz}`
    const cell = cells.get(key)
    if (cell) cell.push(m)
    else cells.set(key, [m])
  }

  // Sorted so that region order, and therefore reading order, is stable between updates.
  // An accessibility tree that reorders itself under a user is worse than a coarse one.
  return [...cells.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, cellMembers]) => {
      const [ix, iz] = key.split('-').map(Number)
      return {
        id: `region-${key}`,
        heading: gridHeading(ix, iz, divisions),
        members: cellMembers,
      }
    })
}

function clampIndex(value: number, divisions: number): number {
  const i = Math.floor(value)
  if (!Number.isFinite(i)) return 0
  return Math.min(divisions - 1, Math.max(0, i))
}

/**
 * Grid cells get compass headings rather than "region 3-1". A heading is the thing 71.6% of
 * users navigate by, so it has to mean something on its own, read out of context, with no
 * neighbouring headings for comparison.
 */
function gridHeading(ix: number, iz: number, divisions: number): string {
  if (divisions === 1) return 'The scene'
  const westEast = thirds(ix, divisions, ['west', '', 'east'])
  const northSouth = thirds(iz, divisions, ['north', '', 'south'])
  const name = [northSouth, westEast].filter(Boolean).join('-')
  return name ? `The ${name} of the scene` : 'The centre of the scene'
}

function thirds(index: number, divisions: number, names: [string, string, string]): string {
  const third = index / divisions
  if (third < 1 / 3) return names[0]
  if (third >= 2 / 3) return names[2]
  return names[1]
}
