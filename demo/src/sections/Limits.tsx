import { Line } from '../ui/Line'
import { SOURCE } from '../site'

/**
 * 00:38. What this cannot tell a user.
 *
 * Last section before the footer, and the one worth reading if you only read
 * one. Every item here is a real limitation that would otherwise be found by
 * whoever installed it, and finding it here costs them an afternoon less.
 */

const LIMITS = [
  {
    title: 'Three readers are unverified',
    body: 'NVDA has been driven against this for real. VoiceOver, JAWS and Windows Narrator have not, because there is no machine here to run them on. Canvas fallback content is the mechanism the HTML specification provides and it should reach all of them, but should is not a measurement and this page does not pretend otherwise.',
    file: 'NVDA.md',
  },
  {
    title: 'Automatic regions are a fallback, not a feature',
    body: 'A grid over the two widest axes produces headings like "The north-west of the scene". That is the most an automatic grouping can honestly say about a scene nobody has described. Any scene with real structure should name its own regions, and the ones that do sound completely different.',
    file: 'src/grouping.ts',
  },
  {
    title: 'The grid is fixed on the first evaluation',
    body: 'Region bounds are computed once and then kept, because recomputing them would let a heading quietly come to mean somewhere else while a user was holding a mental map of it. Objects that leave the original bounds are clamped into the nearest edge area instead. For a scene that expands a long way over time, that is a real limitation rather than a subtlety.',
    file: 'src/narrator.ts',
  },
  {
    title: 'It is O(1) per frame, not O(1) in objects',
    body: 'Each evaluation walks every described object. The cadence moves that work off the frame budget and lets the author choose how often it happens; it does not make it free. The DOM write count is independent of the object count, which is the part that was actually expensive, but the traversal is not.',
    file: 'bench/partition.mjs',
  },
  {
    title: 'A described scene can still be described badly',
    body: 'Nothing here checks that a label is meaningful. "mesh_047" is accepted, phrased into a fluent sentence, and read out to somebody who then knows nothing. The library moves the accessibility problem from an impossible one to an ordinary writing one, which is progress and not a solution.',
    file: 'src/phrasing.ts',
  },
  {
    title: "Announcements are the author's job",
    body: 'Nothing in a scene graph says an order was dispatched, a level was completed or a connection dropped. The library infers position, count, kind and state, and stops there. Events with meaning go through narrator.announce(), by design, because inventing them would mean inventing them wrongly.',
    file: 'src/narrator.ts',
  },
] as const

export function Limits() {
  return (
    <Line
      id="limits"
      stamp="00:38"
      title="What this cannot tell a user"
      lede={
        <>
          Six of them, written down here rather than discovered by whoever installs it. If any
          of these is disqualifying for your scene, better to know before the install than
          after.
        </>
      }
    >
      <ul className="limits">
        {LIMITS.map((limit) => (
          <li key={limit.title}>
            <h3>{limit.title}</h3>
            <p>{limit.body}</p>
            <a className="pipeline-file" href={SOURCE(limit.file)}>
              {limit.file}
            </a>
          </li>
        ))}
      </ul>
    </Line>
  )
}
