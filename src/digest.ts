/**
 * The digest is what makes this library cheap.
 *
 * The naive approach writes to the DOM once per object per frame. The spike measured that
 * costing 39ms per frame in layout alone at 5,000 objects on Chromium. This library instead
 * computes a small quantised summary per region, compares it to the previous one, and
 * touches the DOM only when the summary changed.
 *
 * "Changed" is doing real work here. Every field is quantised, so continuous motion
 * produces a change only when it crosses a boundary. That is deliberately close to the
 * point at which a person would say something new about the scene.
 *
 * Pure, no Three.js, no DOM.
 */

import type { Digest, Member, Point, Region } from './types.js'
import { bearingSector, centroid, distance, distanceBand } from './phrasing.js'

function mostCommon(values: string[]): { value: string; count: number } {
  if (values.length === 0) return { value: '', count: 0 }
  const counts = new Map<string, number>()
  let best = ''
  let bestCount = 0
  for (const v of values) {
    if (!v) continue
    const next = (counts.get(v) ?? 0) + 1
    counts.set(v, next)
    // Ties resolve to whichever value was seen first, which given a stable member order
    // means the answer is stable rather than flickering between equally common states.
    if (next > bestCount) {
      best = v
      bestCount = next
    }
  }
  return { value: best, count: bestCount }
}

export function computeDigest(region: Region, eye: Point, forward: Point): Digest {
  const roles = mostCommon(region.members.map((m) => m.descriptor.role ?? ''))

  // `state()` is author code. It is called once per member per evaluation, which happens at
  // the narrator's cadence and not per frame. That budget is the reason the option is safe
  // to offer at all, and it is documented on the type.
  const states = mostCommon(
    region.members.map((m) => {
      try {
        return m.descriptor.state?.() ?? ''
      } catch {
        // An author's state callback throwing must not take down the accessibility layer.
        // The object stays in the tree with no state rather than disappearing from it.
        return ''
      }
    }),
  )

  const c = centroid(region.members)

  const landmarks = region.members
    .filter((m) => m.descriptor.importance === 'landmark')
    .map((m) => m.descriptor.label)
    .sort()

  return {
    count: region.members.length,
    dominantRole: roles.value,
    dominantRoleCount: roles.count,
    dominantState: states.value,
    bearing: bearingSector(eye, forward, c),
    distanceBand: distanceBand(distance(eye, c)),
    landmarks,
  }
}

export function digestsEqual(a: Digest | undefined, b: Digest): boolean {
  if (!a) return false
  return (
    a.count === b.count &&
    a.dominantRole === b.dominantRole &&
    a.dominantRoleCount === b.dominantRoleCount &&
    a.dominantState === b.dominantState &&
    a.bearing === b.bearing &&
    a.distanceBand === b.distanceBand &&
    a.landmarks.length === b.landmarks.length &&
    a.landmarks.every((l, i) => l === b.landmarks[i])
  )
}

/**
 * Coalescing queue for the polite live region.
 *
 * Replace, do not queue. If fifty objects spawn in one frame, a queue would read fifty
 * announcements at a screen reader user, one after another, with no way to skip them. One
 * replacing message is the correct behaviour, and `minIntervalMs` stops even that from
 * becoming a stream.
 */
export class AnnouncementQueue {
  private pending: string | null = null
  private lastEmittedAt = 0

  constructor(private readonly minIntervalMs: number) {}

  push(message: string): void {
    this.pending = message
  }

  /** Returns the message to write now, or null if nothing should be written yet. */
  take(now: number): string | null {
    if (this.pending === null) return null
    if (now - this.lastEmittedAt < this.minIntervalMs) return null
    const message = this.pending
    this.pending = null
    this.lastEmittedAt = now
    return message
  }
}
