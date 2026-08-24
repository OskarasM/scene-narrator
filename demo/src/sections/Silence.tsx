import { Line } from '../ui/Line'
import { SOURCE, SURVEY } from '../site'

/**
 * 00:04. Why the obvious thing does not work, and what happens instead.
 *
 * The only section on the page with no live number in it. That is deliberate:
 * the argument here is structural, and dressing it up with a readout would
 * imply it had been measured when what it has been is reasoned.
 */

const STEPS = [
  {
    id: 'traverse',
    name: 'Traverse',
    cost: 'per evaluation',
    body: 'Walk the visible scene graph and collect every object carrying a descriptor, with its world position.',
    file: 'src/narrator.ts',
  },
  {
    id: 'partition',
    name: 'Partition',
    cost: 'per evaluation',
    body: 'Sort those objects into a handful of areas: a uniform grid over the two widest axes, or the regions the author named.',
    file: 'src/grouping.ts',
  },
  {
    id: 'digest',
    name: 'Digest',
    cost: 'per evaluation',
    body: 'Reduce each area to a few quantised numbers: how many, what kind, doing what, which way, how far.',
    file: 'src/digest.ts',
  },
  {
    id: 'write',
    name: 'Write',
    cost: 'only when a digest changed',
    body: 'Phrase the digest as a sentence and put it in the DOM. Identical digest, no write, no announcement, no work.',
    file: 'src/dom.ts',
  },
] as const

export function Silence() {
  return (
    <Line
      id="silence"
      stamp="00:04"
      title="What a screen reader normally gets: nothing"
      lede={
        <>
          A canvas is one element. Whatever is drawn inside it is pixels, and pixels have no
          accessible name, no role and no structure. The browser has nothing to put in the
          accessibility tree, so it puts nothing there.
        </>
      }
      aside={
        <>
          <p className="eyebrow">The quantisation</p>
          <p>
            A bearing is one of eight sectors. A distance is one of five bands. A count is a
            count. Continuous motion only becomes a DOM write when it crosses one of those
            boundaries, which is roughly when it becomes something a person would bother
            mentioning.
          </p>
        </>
      }
    >
      <div className="prose">
        <p>
          The fix everyone reaches for first is a mirror: one visually hidden element per
          object, its text rewritten every frame. It is the obvious shape and it fails twice.
        </p>
        <p>
          It fails on cost, which is measurable and was measured. A 1:1 mirror crosses the
          60fps frame budget somewhere around five hundred objects, in both Chromium and
          Firefox, and at a thousand objects one frame in a hundred takes over a tenth of a
          second. The figures are in{' '}
          <a href={SOURCE('SPIKE.md')}>SPIKE.md</a> with the method beside them.
        </p>
        <p>
          It fails worse on structure, which is not measurable and matters more. A thousand
          mirrored objects is a flat list of a thousand items with no headings in it, and{' '}
          <a href={SURVEY.url}>
            {SURVEY.headingUsersPct} per cent of the {SURVEY.respondents.toLocaleString('en-GB')}{' '}
            respondents
          </a>{' '}
          to the WebAIM screen reader survey named headings as their first way of finding
          anything on a long page. A mirror that ran at sixty frames a second would still be
          unusable. Grouping is therefore the primary design decision here, and the speed is a
          consequence of it rather than the reason for it.
        </p>
      </div>

      <ol className="pipeline">
        {STEPS.map((step, index) => (
          <li key={step.id}>
            <span className="pipeline-index">{index + 1}</span>
            <div>
              <h3>{step.name}</h3>
              <p>{step.body}</p>
            </div>
            <span className="pipeline-cost">{step.cost}</span>
            <a className="pipeline-file" href={SOURCE(step.file)}>
              {step.file}
            </a>
          </li>
        ))}
      </ol>

      <p className="source-line">
        So the cost model is: one number comparison per frame, one pass over the described
        objects per evaluation, and one DOM write per area whose meaning actually changed. The
        middle line is the honest caveat, and it is why the cadence is an argument rather than
        a constant.
      </p>
    </Line>
  )
}
