export { createNarrator, describe, undescribe } from './narrator.js'
export type { Narrator, NarratorOptions, NarratorStats } from './narrator.js'
export type {
  Descriptor,
  Digest,
  Member,
  NarratorSnapshot,
  Point,
  Region,
  RegionDefinition,
  RegionSnapshot,
} from './types.js'

// Exported because the phrasing is the part most likely to need replacing for a scene that
// is not a space you move through: a molecule viewer wants different words entirely.
export { BEARINGS, bearingSector, distanceBand, distancePhrase, summariseRegion } from './phrasing.js'
export { partitionAuto, partitionByDefinitions, boundsOf } from './grouping.js'
export { computeDigest, digestsEqual } from './digest.js'
