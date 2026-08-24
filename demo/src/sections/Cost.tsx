import { Line } from '../ui/Line'
import { useLive } from '../live'
import { sceneById } from '../scenes'
import { download } from '../session'
import { PARTITION, SOURCE, worstCaseCorePct } from '../site'

/**
 * 00:19. Where the cost goes.
 *
 * Two kinds of number live here and they are kept visibly apart. The top block
 * is live, counted this second out of narrator.stats() and the real DOM. The
 * two tables below are recorded: one from bench/partition.mjs and one from the
 * spike. Presenting a recorded figure as if it were live is the single easiest
 * way to make a measurements page dishonest, so the headings say which is
 * which and the download hands over the live series unedited.
 */

/* Chromium, --force-renderer-accessibility, p95 / p99 frame time in ms, three
   runs per cell. Arms as defined in SPIKE.md: A is the scene with no
   accessibility layer at all, B is the naive one-node-per-object mirror, D is
   this library's approach mounted as canvas fallback content. */
const SPIKE_ROWS = [
  { n: 100, baseline: '0.4 / 0.6', mirror: '3.7 / 11.0', grouped: '1.0 / 1.6' },
  { n: 500, baseline: '0.6 / 0.8', mirror: '13.8 / 44.2', grouped: '2.7 / 8.4' },
  { n: 1000, baseline: '0.9 / 1.1', mirror: '56.7 / 138.5', grouped: '5.2 / 12.5' },
  { n: 5000, baseline: '3.3 / 4.2', mirror: '112.0 / 415.0', grouped: '16.7 / 31.5' },
] as const

export function Cost() {
  const { second, series, session, sceneId } = useLive()
  const scene = sceneById(sceneId)

  const ratio =
    second && second.domWrites > 0 ? Math.round(second.naiveWrites / second.domWrites) : null

  return (
    <Line
      id="cost"
      stamp="00:19"
      title="Where the cost goes"
      lede={
        <>
          The counters below are read off the running narrator once a second and are not
          smoothed. The counterfactual column is arithmetic rather than a second run: a mirror
          rewrites one node per object per frame, so its rate is objects times frames, by
          definition.
        </>
      }
      aside={
        <>
          <p className="eyebrow">The node count</p>
          <p>
            The tree holds a heading, a summary and a container per area, plus one live region
            for the whole scene. That is why the node count barely moves when the object count
            goes from twenty-four to four thousand: it is a function of the number of areas,
            not the number of objects.
          </p>
        </>
      }
    >
      <h3 className="block-heading">Live, this second</h3>
      <dl className="readouts">
        <Readout label="Described objects" value={scene.objects.toLocaleString('en-GB')} />
        <Readout label="Frames / s" value={second ? second.frames : '--'} />
        <Readout label="Evaluations / s" value={second ? second.evaluations : '--'} />
        <Readout label="Digest changes / s" value={second ? second.digestChanges : '--'} />
        <Readout label="DOM writes / s" value={second ? second.domWrites : '--'} tone="accent" />
        <Readout
          label="Mirror would write / s"
          value={second ? second.naiveWrites.toLocaleString('en-GB') : '--'}
          tone="warn"
        />
        <Readout label="Nodes in the tree" value={second ? second.a11yNodes : '--'} />
        <Readout label="Ratio" value={ratio ? ratio.toLocaleString('en-GB') + ':1' : '--'} />
      </dl>

      <Sparkline series={series} />

      <div className="downloads">
        <p>
          The whole sixty-second series, as it was counted, with nothing removed. Both formats
          carry the same rows.
        </p>
        <div className="download-buttons">
          <button
            className="button button-quiet"
            type="button"
            onClick={() =>
              download(
                'scene-narrator-' + scene.id + '.json',
                session.toJson(scene.title),
                'application/json',
              )
            }
          >
            Download JSON
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={() =>
              download('scene-narrator-' + scene.id + '.csv', session.toCsv(scene.title), 'text/csv')
            }
          >
            Download CSV
          </button>
        </div>
      </div>

      <h3 className="block-heading">Recorded: grouping and phrasing, by object count</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Evaluation cost by object count, scrollable">
        <table className="data-table">
          <caption className="sr-only">
            Milliseconds spent grouping, digesting and phrasing one evaluation, at three
            object counts
          </caption>
          <thead>
            <tr>
              <th scope="col">Described objects</th>
              <th scope="col">ms per evaluation</th>
              <th scope="col">Share of one core at {PARTITION.cadenceMs}ms cadence</th>
            </tr>
          </thead>
          <tbody>
            {PARTITION.rows.map((row) => (
              <tr key={row.objects}>
                <th scope="row">{row.objects.toLocaleString('en-GB')}</th>
                <td className="num">{row.msPerEvaluation.toFixed(3)}</td>
                <td className="num">
                  {((row.msPerEvaluation / PARTITION.cadenceMs) * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="source-line">
        Four thousand described objects cost {worstCaseCorePct.toFixed(2)} per cent of one core
        at the default cadence. Run it yourself:{' '}
        <a href={SOURCE(PARTITION.script)}>{PARTITION.script}</a>. This measures the pure path
        only, because it is the part with no browser in it; the DOM writes are the block above,
        counted live.
      </p>

      <h3 className="block-heading">Recorded: frame time, against a mirror</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Frame time by approach, scrollable">
        <table className="data-table">
          <caption className="sr-only">
            Chromium p95 and p99 frame time in milliseconds, by object count, for no
            accessibility layer, a one node per object mirror, and this library
          </caption>
          <thead>
            <tr>
              <th scope="col">Objects</th>
              <th scope="col">No layer</th>
              <th scope="col">1:1 mirror</th>
              <th scope="col">This library</th>
            </tr>
          </thead>
          <tbody>
            {SPIKE_ROWS.map((row) => (
              <tr key={row.n}>
                <th scope="row">{row.n.toLocaleString('en-GB')}</th>
                <td className="num">{row.baseline}</td>
                <td className="num series-b">{row.mirror}</td>
                <td className="num series-a">{row.grouped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="source-line">
        p95 / p99, in milliseconds, three runs per cell, accessibility forced on. The 60fps
        budget is 16.7ms. The mirror crosses it between 500 and 1,000 objects and Firefox
        agrees, so the cliff is not one engine's quirk. Method, environment and the run to run
        spread are in <a href={SOURCE('SPIKE.md')}>SPIKE.md</a>; the harness is{' '}
        <a href={SOURCE('bench/harness.js')}>bench/harness.js</a>.
      </p>
    </Line>
  )
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'accent' | 'warn'
}) {
  return (
    <div className={tone ? 'readout-cell is-' + tone : 'readout-cell'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * Sixty seconds of DOM writes.
 *
 * Drawn as an SVG with a title and a description, and repeated underneath as a
 * real table, because a line somebody cannot see is not a measurement they can
 * read. Never colour alone: the series is named in the legend and again in the
 * table header.
 */
function Sparkline({ series }: { series: readonly { t: number; domWrites: number }[] }) {
  const width = 960
  const height = 120
  const peak = Math.max(4, ...series.map((s) => s.domWrites))
  const step = series.length > 1 ? width / (series.length - 1) : width

  // Six pixels of headroom top and bottom, so the peak is a peak rather than a
  // line lying along the edge of its own box.
  const inset = 6
  const span = height - inset * 2
  const points = series
    .map((sample, i) => i * step + ',' + (height - inset - (sample.domWrites / peak) * span))
    .join(' ')

  return (
    <figure className="sparkline">
      <figcaption className="eyebrow">
        DOM writes per second, last {series.length} of 60 seconds. Peak {peak}.
      </figcaption>
      <svg viewBox={'0 0 ' + width + ' ' + height} preserveAspectRatio="none" role="img" aria-labelledby="spark-title spark-desc">
        <title id="spark-title">DOM writes per second over the last minute</title>
        <desc id="spark-desc">
          {series.length === 0
            ? 'No samples yet. The first appears one second after the scene starts.'
            : 'A line from ' +
              series[0].domWrites +
              ' writes per second to ' +
              series[series.length - 1].domWrites +
              ', peaking at ' +
              peak +
              '. The same numbers are in the table below.'}
        </desc>
        {series.length > 1 ? (
          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>

      <details className="sparkline-table">
        <summary>The same series as a table</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Sampled series, scrollable">
          <table className="data-table">
            <caption className="sr-only">DOM writes per second, one row per second</caption>
            <thead>
              <tr>
                <th scope="col">Second</th>
                <th scope="col">DOM writes</th>
                <th scope="col">Frames</th>
                <th scope="col">Nodes in the tree</th>
              </tr>
            </thead>
            <tbody>
              {(series as readonly { t: number; domWrites: number; frames: number; a11yNodes: number }[]).map(
                (sample) => (
                  <tr key={sample.t}>
                    <th scope="row">{sample.t}</th>
                    <td className="num">{sample.domWrites}</td>
                    <td className="num">{sample.frames}</td>
                    <td className="num">{sample.a11yNodes}</td>
                  </tr>
                ),
              )}
              {series.length === 0 ? (
                <tr>
                  <th scope="row">--</th>
                  <td className="num" colSpan={3}>
                    No samples yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
