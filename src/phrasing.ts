/**
 * Turning positions into words.
 *
 * The guiding rule is that a screen reader user is listening, not reading. "Ahead and to
 * your left, twenty metres away" is usable. "x: 12.4, y: -3.1, z: 8.8" is three numbers
 * that have to be held in working memory and mentally projected, which is not a reasonable
 * thing to ask of anybody.
 *
 * Everything here is pure and has no Three.js or DOM dependency, so it is directly unit
 * testable.
 */

import type { Digest, Member, Point, PhrasingOptions } from './types.js'

/**
 * Eight sectors, starting at directly ahead and going clockwise when viewed from above.
 * Eight rather than sixteen because the extra precision is not audible and every extra
 * boundary is another chance for a slowly turning camera to trigger a DOM write.
 */
export const BEARINGS = [
  'ahead',
  'ahead and to your right',
  'to your right',
  'behind you and to your right',
  'behind you',
  'behind you and to your left',
  'to your left',
  'ahead and to your left',
] as const

/**
 * Distance bands, spoken as ranges. The bands roughly double in width, because the
 * difference between 2 and 4 units matters and the difference between 200 and 202 does not.
 */
const DISTANCE_BANDS = [
  { limit: 5, phrase: 'very close' },
  { limit: 15, phrase: 'nearby' },
  { limit: 40, phrase: 'some distance away' },
  { limit: 100, phrase: 'far away' },
  { limit: Infinity, phrase: 'in the distance' },
]

export function centroid(members: Member[]): Point {
  if (members.length === 0) return { x: 0, y: 0, z: 0 }
  let x = 0
  let y = 0
  let z = 0
  for (const m of members) {
    x += m.position.x
    y += m.position.y
    z += m.position.z
  }
  return { x: x / members.length, y: y / members.length, z: z / members.length }
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function distanceBand(d: number): number {
  for (let i = 0; i < DISTANCE_BANDS.length; i++) {
    if (d < DISTANCE_BANDS[i].limit) return i
  }
  return DISTANCE_BANDS.length - 1
}

export function distancePhrase(band: number): string {
  return DISTANCE_BANDS[Math.min(band, DISTANCE_BANDS.length - 1)].phrase
}

/**
 * Which of the eight sectors `target` falls into, as seen from `eye` looking along
 * `forward`.
 *
 * Only the horizontal plane is used. Height is left out on purpose: "above you" is
 * genuinely useful in a flight simulator and actively confusing in the flat-ish scenes this
 * library is aimed at, and adding a second axis of quantisation doubles the churn.
 */
export function bearingSector(eye: Point, forward: Point, target: Point): number {
  const tx = target.x - eye.x
  const tz = target.z - eye.z

  // atan2 of the target in the camera's horizontal frame. The forward vector is projected
  // onto the same plane; a camera pointing straight down has no meaningful bearing, and
  // falls back to sector 0 rather than producing noise.
  const fLen = Math.hypot(forward.x, forward.z)
  if (fLen < 1e-6) return 0
  const fx = forward.x / fLen
  const fz = forward.z / fLen

  // Right vector is forward rotated -90 degrees about Y.
  const rx = -fz
  const rz = fx

  const along = tx * fx + tz * fz
  const across = tx * rx + tz * rz

  // Angle clockwise from "ahead", in the range [0, 2pi).
  let angle = Math.atan2(across, along)
  if (angle < 0) angle += Math.PI * 2

  // Offset by half a sector so that "ahead" is centred on 0 rather than starting at it.
  const sector = Math.floor((angle + Math.PI / 8) / (Math.PI / 4)) % 8
  return sector
}

/** English pluralisation, deliberately naive. Authors supply the role text. */
export function plural(word: string, count: number): string {
  if (count === 1) return word
  if (/(s|x|z|ch|sh)$/.test(word)) return word + 'es'
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies'
  return word + 's'
}

export function joinList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]
}

/**
 * The sentence spoken for a region.
 *
 * Describes rather than enumerates: "5 vehicles, mostly moving, ahead and to your left,
 * nearby". A user who wants the individual objects focuses the region and gets them, which
 * is both a smaller DOM and a shorter thing to listen to.
 */
export function summariseRegion(digest: Digest, options: PhrasingOptions): string {
  if (digest.count === 0) return 'empty'

  const parts: string[] = []

  const noun = digest.dominantRole || 'object'
  if (digest.dominantRoleCount === digest.count) {
    parts.push(`${digest.count} ${plural(noun, digest.count)}`)
  } else {
    // Mixed contents. Naming the majority and counting the rest is shorter than listing
    // every kind, and it is what a person would say.
    const others = digest.count - digest.dominantRoleCount
    parts.push(
      `${digest.count} objects, ${digest.dominantRoleCount} ${plural(noun, digest.dominantRoleCount)} ` +
        `and ${others} ${plural('other', others)}`,
    )
  }

  if (digest.dominantState) parts.push(`mostly ${digest.dominantState}`)
  parts.push(BEARINGS[digest.bearing])
  parts.push(distancePhrase(digest.distanceBand))
  if (digest.landmarks.length > 0) parts.push(`including ${joinList(digest.landmarks)}`)

  // `units` is currently unused in the spoken output because distances are given as bands
  // rather than numbers. It is kept in the options so that a future exact-distance mode has
  // somewhere to read from, and so the option does not have to be added in a breaking way.
  void options

  return parts.join(', ')
}

/** The line spoken for a single object when a region has been opened. */
export function describeMember(member: Member, eye: Point, forward: Point): string {
  const parts = [member.descriptor.label]
  if (member.descriptor.role) parts.push(member.descriptor.role)
  const state = member.descriptor.state?.()
  if (state) parts.push(state)
  parts.push(BEARINGS[bearingSector(eye, forward, member.position)])
  parts.push(distancePhrase(distanceBand(distance(eye, member.position))))
  return parts.join(', ')
}
