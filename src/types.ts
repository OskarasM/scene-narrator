/**
 * Shared types.
 *
 * The pure parts of this library (grouping, digesting, phrasing) deliberately know nothing
 * about Three.js. They work on plain `{ x, y, z }` points, which means they can be unit
 * tested without a WebGL context, a canvas or a DOM. `narrator.ts` is the only file that
 * adapts Three.js objects onto them.
 */

export interface Point {
  x: number
  y: number
  z: number
}

/**
 * What an author says about one object. Attached with `describe()`, stored on
 * `object.userData.a11y`.
 */
export interface Descriptor {
  /** Short human name. "Delivery van", not "mesh_047". Spoken as-is. */
  label: string
  /**
   * What kind of thing this is, in plain words: "vehicle", "tree", "control point".
   * Used to summarise a group ("5 vehicles") so it is worth keeping consistent.
   * This is free text that gets spoken. It is not an ARIA role.
   */
  role?: string
  /**
   * Current state as a short phrase: "moving", "stopped", "selected". Called at the
   * narrator's cadence, never once per frame, so it may be as expensive as a property read
   * and no more.
   */
  state?: () => string
  /**
   * Longer description, only evaluated when the containing region has focus and the user
   * has asked for detail. This is where the expensive string building belongs.
   */
  detail?: () => string
  /**
   * `landmark` keeps this object individually named in its region's summary even when the
   * region has many members. Use it sparingly, for the two or three things in a scene that
   * a user is actually looking for.
   */
  importance?: 'normal' | 'landmark'
}

/** One described object, flattened out of the scene graph. */
export interface Member {
  id: string
  descriptor: Descriptor
  position: Point
}

/** An author-defined region, as opposed to one the library worked out for itself. */
export interface RegionDefinition {
  id: string
  /** Spoken heading for this region. */
  heading: string
  /** World-space box. A member is in this region if its position falls inside. */
  min: Point
  max: Point
}

export interface Region {
  id: string
  heading: string
  members: Member[]
}

/**
 * The cheap summary of a region that decides whether the DOM is touched at all.
 *
 * Every field here is quantised. That is the entire trick: continuous motion only becomes
 * a DOM write when it crosses a quantisation boundary, which is roughly when it becomes
 * something a person would bother mentioning.
 */
export interface Digest {
  count: number
  /** The most common `role` among members, with its count. */
  dominantRole: string
  dominantRoleCount: number
  /** The most common `state()` result among members. Empty when nothing reports state. */
  dominantState: string
  /** Compass-style sector of the region centroid relative to the camera, 0 to 7. */
  bearing: number
  /** Quantised distance band from the camera. */
  distanceBand: number
  /** Names of members marked `importance: 'landmark'`, sorted, so ordering is stable. */
  landmarks: string[]
}

export interface RegionSnapshot {
  id: string
  heading: string
  /** The sentence a screen reader would speak for this region right now. */
  summary: string
  digest: Digest
  memberLabels: string[]
}

export interface NarratorSnapshot {
  label: string
  regions: RegionSnapshot[]
  /** Last thing written to the polite live region, or null if nothing has been. */
  lastAnnouncement: string | null
}

export interface PhrasingOptions {
  /** Spoken unit for distances. Distances are in scene units; this only names them. */
  units: string
}
