/**
 * The narrator: the only file that knows about Three.js.
 *
 * Everything expensive is gated behind a cadence. `update()` is called from the author's
 * render loop, sixty or more times a second, and on almost all of those calls it does one
 * subtraction and returns. When the cadence does elapse it walks the scene, regroups,
 * redigests, and writes to the DOM only for regions whose digest actually changed.
 *
 * So the cost model is:
 *
 *   per frame        one number comparison
 *   per evaluation   O(N) traversal and digesting, N = described objects
 *   per DOM write    O(regions whose meaning changed)
 *
 * The middle line is the honest caveat. This library is not O(1) in the number of objects;
 * it is O(1) per frame, and it moves the O(N) work off the frame budget and onto a cadence
 * the author chooses. The DOM mutation count, which is what the spike showed to be the
 * expensive part, is independent of N.
 */

import type { Camera, Object3D } from 'three'
import type {
  Descriptor,
  Digest,
  Member,
  NarratorSnapshot,
  Point,
  Region,
  RegionDefinition,
  RegionSnapshot,
} from './types.js'
import { boundsOf, partitionAuto, partitionByDefinitions, type Bounds } from './grouping.js'
import { AnnouncementQueue, computeDigest, digestsEqual } from './digest.js'
import { describeMember, summariseRegion } from './phrasing.js'
import { DomWriter } from './dom.js'

export interface NarratorOptions {
  camera: Camera
  /**
   * Where the accessibility DOM is mounted.
   *
   * Passing the canvas element itself makes the tree canvas fallback content, which the
   * spike measured as costing zero layout time on Chromium, and which is what Babylon's
   * HTML twin does in production. Passing any other element mounts it as a normal sibling.
   * See README for which to choose and what has actually been verified with a screen
   * reader.
   */
  mount: HTMLElement
  /** Accessible name for the scene as a whole. */
  label?: string
  /** Heading level for the scene. Regions use one level below. Default 2. */
  headingLevel?: number
  regions?: 'auto' | RegionDefinition[]
  /** Target number of automatic regions. Empty ones are dropped, so this is a target. */
  autoRegions?: number
  /** Minimum milliseconds between evaluations. Default 250. */
  cadence?: number
  units?: string
  onFocusRegion?: (region: RegionSnapshot | null) => void
  /** Injected in tests. Defaults to `performance.now`. */
  now?: () => number
}

export interface NarratorStats {
  frames: number
  evaluations: number
  digestChanges: number
  domWrites: number
}

export interface Narrator {
  update(): void
  announce(message: string, options?: { assertive?: boolean }): void
  focusRegion(id: string): void
  snapshot(): NarratorSnapshot
  stats(): NarratorStats
  dispose(): void
}

const A11Y_KEY = 'a11y'

/**
 * Attach a descriptor to an object.
 *
 * Stores on `object.userData.a11y`, which means a scene authored in Blender and exported as
 * glTF can carry its descriptions in `extras` and arrive already described, with no code at
 * the object site. This function exists on top of that convention rather than instead of
 * it, so that TypeScript users get a compile error for a typo instead of silence.
 */
export function describe<T extends Object3D>(object: T, descriptor: Descriptor): T {
  object.userData[A11Y_KEY] = descriptor
  return object
}

export function undescribe(object: Object3D): void {
  delete object.userData[A11Y_KEY]
}

function readDescriptor(object: Object3D): Descriptor | null {
  const value = object.userData?.[A11Y_KEY]
  if (!value || typeof value !== 'object') return null
  if (typeof (value as Descriptor).label !== 'string') return null
  return value as Descriptor
}

export function createNarrator(scene: Object3D, options: NarratorOptions): Narrator {
  const cadence = options.cadence ?? 250
  const units = options.units ?? 'metres'
  const label = options.label ?? '3D scene'
  const autoRegions = options.autoRegions ?? 6
  const now = options.now ?? (() => performance.now())

  const stats: NarratorStats = { frames: 0, evaluations: 0, digestChanges: 0, domWrites: 0 }
  const digests = new Map<string, Digest>()
  const queue = new AnnouncementQueue(cadence)

  let regions: Region[] = []
  let lastRegionIds = ''
  let lastEvaluatedAt = -Infinity
  /**
   * Auto-region bounds are computed once, on the first evaluation, and then kept.
   *
   * Recomputing them every evaluation would mean the grid follows the objects, so a region
   * would silently come to mean something different as the scene moved, and a user's mental
   * map of the space would quietly stop being true. Members that leave the original bounds
   * are clamped into the nearest edge region instead. This is a real limitation for a scene
   * that expands a long way over time, and the README says so.
   */
  let bounds: Bounds | null = null

  const eye: Point = { x: 0, y: 0, z: 0 }
  const forward: Point = { x: 0, y: 0, z: -1 }

  function readCamera(): void {
    const camera = options.camera
    camera.updateMatrixWorld()
    const m = camera.matrixWorld.elements
    eye.x = m[12]
    eye.y = m[13]
    eye.z = m[14]
    // A camera looks down its local -Z. Column 2 of the world matrix is the local +Z axis,
    // so forward is its negation. Read straight out of the matrix to avoid allocating a
    // Vector3 on every evaluation.
    forward.x = -m[8]
    forward.y = -m[9]
    forward.z = -m[10]
  }

  function collect(): Member[] {
    const members: Member[] = []
    scene.traverseVisible((object) => {
      const descriptor = readDescriptor(object)
      if (!descriptor) return
      object.updateWorldMatrix(true, false)
      const m = object.matrixWorld.elements
      members.push({
        id: String(object.id),
        descriptor,
        position: { x: m[12], y: m[13], z: m[14] },
      })
    })
    return members
  }

  function membersOf(id: string): Member[] {
    return regions.find((r) => r.id === id)?.members ?? []
  }

  const dom = new DomWriter({
    mount: options.mount,
    label,
    headingLevel: options.headingLevel ?? 2,
    onFocusRegion: (id) => {
      if (!options.onFocusRegion) return
      options.onFocusRegion(id === null ? null : snapshotRegion(id))
    },
    renderMembers: (id) => membersOf(id).map((m) => describeMember(m, eye, forward)),
  })

  function snapshotRegion(id: string): RegionSnapshot | null {
    const region = regions.find((r) => r.id === id)
    const digest = digests.get(id)
    const written = dom.snapshotRegion(id)
    if (!region || !digest || !written) return null
    return {
      id,
      heading: written.heading,
      summary: written.summary,
      digest,
      memberLabels: region.members.map((m) => m.descriptor.label),
    }
  }

  function evaluate(): void {
    stats.evaluations++
    readCamera()

    const members = collect()

    if (options.regions && options.regions !== 'auto') {
      regions = partitionByDefinitions(members, options.regions)
    } else {
      if (!bounds) bounds = boundsOf(members)
      regions = partitionAuto(members, bounds, autoRegions)
    }

    // Structural reconciliation only when the set of regions actually changed. Comparing
    // joined ids is cheap next to touching the DOM, and the set changes rarely.
    const ids = regions.map((r) => r.id).join('|')
    if (ids !== lastRegionIds) {
      dom.syncRegions(regions)
      lastRegionIds = ids
      for (const id of [...digests.keys()]) {
        if (!regions.some((r) => r.id === id)) digests.delete(id)
      }
    }

    for (const region of regions) {
      const digest = computeDigest(region, eye, forward)
      if (digestsEqual(digests.get(region.id), digest)) continue
      digests.set(region.id, digest)
      stats.digestChanges++
      dom.writeSummary(region.id, summariseRegion(digest, { units }))
      // An open region shows individual objects, and those have moved too. Rebuilding it
      // is the one place where cost scales with the number of objects in a region, which is
      // bounded by the user having chosen to open exactly one.
      if (dom.isOpen(region.id)) {
        dom.closeRegion(region.id)
        dom.openRegion(region.id)
      }
    }
  }

  return {
    update() {
      stats.frames++
      const t = now()
      if (t - lastEvaluatedAt >= cadence) {
        lastEvaluatedAt = t
        evaluate()
      }
      const message = queue.take(t)
      if (message !== null) dom.announce(message, false)
      stats.domWrites = dom.domWrites
    },

    announce(message, announceOptions) {
      if (announceOptions?.assertive) {
        // Assertive interrupts whatever the user is listening to. Nothing this library
        // infers ever goes here; it is reserved for events the author has decided are
        // worth interrupting for, and it bypasses the coalescing queue by design.
        dom.announce(message, true)
        stats.domWrites = dom.domWrites
        return
      }
      queue.push(message)
    },

    focusRegion(id) {
      dom.focusRegion(id)
    },

    snapshot(): NarratorSnapshot {
      return {
        label,
        regions: regions
          .map((r) => snapshotRegion(r.id))
          .filter((r): r is RegionSnapshot => r !== null),
        lastAnnouncement: dom.lastAnnouncement,
      }
    },

    stats() {
      return { ...stats, domWrites: dom.domWrites }
    },

    dispose() {
      dom.dispose()
      digests.clear()
      regions = []
    },
  }
}
