// Everything on the page that is a fact about this project rather than a fact
// about the layout. Kept apart so the sections stay presentational and the two
// sibling sites can copy a section without dragging this repo's strings along.

export const REPO_URL = 'https://github.com/OskarasM/scene-narrator'
export const SOURCE = (path: string) => `${REPO_URL}/blob/main/${path}`
export const INSTALL_COMMAND = 'npm i scene-narrator'

export const BRAND = ['scene', 'narrator'] as const

export const NAV = [
  { href: '#silence', label: 'Why' },
  { href: '#transcript', label: 'Transcript' },
  { href: '#cost', label: 'Cost' },
  { href: '#nvda', label: 'NVDA' },
  { href: '#use', label: 'Use it' },
] as const

export const SIBLING_SITES = [
  { href: 'https://three-dispose-guard.vercel.app', label: 'three-dispose-guard' },
  { href: 'https://realtime-3d-room.vercel.app', label: 'realtime-3d-room' },
] as const

/**
 * The survey figure the whole grouping decision rests on.
 *
 * WebAIM Screen Reader User Survey #10, n=1,539: 71.6% of respondents named
 * headings as their first way of finding information on a long page. A flat
 * list of a thousand mirrored objects has no headings in it, which is why this
 * library groups before it does anything else.
 */
export const SURVEY = {
  headingUsersPct: 71.6,
  respondents: 1539,
  name: 'WebAIM Screen Reader User Survey #10',
  url: 'https://webaim.org/projects/screenreadersurvey10/',
} as const

/**
 * Measured by bench/partition.mjs on the committed build, three sizes, 200
 * evaluations each after a warm-up. Grouping, digesting and phrasing only: the
 * Three.js traversal and the DOM writes are measured live further down the
 * page, in a browser, where they are real rather than simulated.
 */
export const PARTITION = {
  cadenceMs: 250,
  rows: [
    { objects: 24, msPerEvaluation: 0.033 },
    { objects: 400, msPerEvaluation: 0.085 },
    { objects: 4000, msPerEvaluation: 0.521 },
  ],
  script: 'bench/partition.mjs',
} as const

/** The share of a single core the largest of those costs, at that cadence. */
export const worstCaseCorePct =
  (PARTITION.rows[PARTITION.rows.length - 1].msPerEvaluation / PARTITION.cadenceMs) * 100

export const formatMs = (ms: number) => `${ms.toFixed(ms < 1 ? 3 : 1)} ms`
