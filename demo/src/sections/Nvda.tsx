import { Line } from '../ui/Line'
import { SOURCE } from '../site'

/**
 * 00:26. What NVDA actually said.
 *
 * Verbatim, from a real screen reader on a real machine, because "accessible"
 * is a claim and a transcript is evidence. The support matrix beside it is
 * mostly UNVERIFIED, which is the honest state of it: one reader has been
 * driven against this library and three have not.
 */

/* Recorded from the demo as it stood on the date in NVDA.md. The page chrome
   around the scene has been rewritten since, so the lines quoting the old
   heading and paragraphs would not appear today; the scene lines below are the
   library's own output and are unchanged. The full session, including the
   parts this excerpt drops, is in the file. */
const BROWSE = `main landmark, clickable, region, heading, level 2, Delivery yard
Areas of the scene are listed as headings. Move to an area and press Enter to hear what is
  in it.
grouping, heading, level 3, The north-west of the scene
6 vans, mostly parked, ahead, far away, including Van 1
out of grouping, grouping, heading, level 3, The south-west of the scene
7 vans, mostly moving, ahead and to your left, some distance away
out of grouping, grouping, heading, level 3, The north-east of the scene
5 vans, mostly moving, ahead, far away
out of grouping, grouping, heading, level 3, The south-east of the scene
5 vans, mostly moving, ahead and to your right, some distance away
out of grouping, Van 1 has been dispatched
out of region, blank
Van 2 has been dispatched`

const HEADINGS = `main landmark, clickable, Delivery yard, region, Delivery yard, heading, level 2
The north-west of the scene, grouping, The north-west of the scene, heading, level 3
The south-west of the scene, grouping, The south-west of the scene, heading, level 3
The north-east of the scene, grouping, The north-east of the scene, heading, level 3
The south-east of the scene, grouping, The south-east of the scene, heading, level 3
no next heading`

const MATRIX = [
  {
    reader: 'NVDA 2024.4, Chromium, Windows 11',
    browse: 'PASS',
    focus: 'PASS',
    note: 'Transcripts above, recorded with Guidepup driving the real reader.',
  },
  {
    reader: 'Keyboard only, no reader, Chromium',
    browse: 'PASS',
    focus: 'PASS',
    note: 'Tab reaches the scene in one stop, arrows move between areas and wrap, no trap.',
  },
  {
    reader: 'VoiceOver, Safari, macOS',
    browse: 'UNVERIFIED',
    focus: 'UNVERIFIED',
    note: 'No machine to run it on. Canvas fallback content is the specified mechanism and should reach it, but should is not a measurement.',
  },
  {
    reader: 'JAWS, Windows',
    browse: 'UNVERIFIED',
    focus: 'UNVERIFIED',
    note: 'No licence. Its virtual buffer differs from NVDA and could behave differently.',
  },
] as const

export function Nvda() {
  return (
    <Line
      id="nvda"
      stamp="00:26"
      title="What NVDA actually said"
      lede={
        <>
          Driven by Guidepup against a real NVDA install, not a virtual one. The lines below
          are what came out of the speech buffer, copied without editing. Everything imperfect
          about them is written down in the file rather than trimmed out of the excerpt.
        </>
      }
      aside={
        <>
          <p className="eyebrow">Two words that cost something</p>
          <p>
            <strong>grouping</strong> is the role on each area container. It buys the
            announcement in focus mode and costs one extra word per area in browse mode.
          </p>
          <p>
            <strong>clickable</strong> comes from React Three Fiber attaching pointer handlers
            to the canvas, not from this library. A user hears it all the same.
          </p>
        </>
      }
    >
      <div className="transcripts">
        <figure>
          <figcaption className="eyebrow">Browse mode, reading from the top</figcaption>
          <pre tabIndex={0} role="region" aria-label="NVDA browse mode transcript, scrollable">
            <code>{BROWSE}</code>
          </pre>
        </figure>

        <figure>
          <figcaption className="eyebrow">Pressing H repeatedly</figcaption>
          <pre tabIndex={0} role="region" aria-label="NVDA heading navigation transcript, scrollable">
            <code>{HEADINGS}</code>
          </pre>
        </figure>
      </div>

      <div className="prose">
        <p>
          Five headings, in a stable order, each one meaning something read on its own. That
          is the navigation model the library is designed around, and it is the one thing on
          this page that could not have been reasoned about instead of tested.
        </p>
      </div>

      <div className="table-scroll" tabIndex={0} role="region" aria-label="Screen reader support, scrollable">
        <table className="data-table matrix">
          <caption className="sr-only">
            Which screen readers have been driven against this library, and in which mode
          </caption>
          <thead>
            <tr>
              <th scope="col">Reader</th>
              <th scope="col">Browse</th>
              <th scope="col">Focus</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.reader}>
                <th scope="row">{row.reader}</th>
                <td>
                  <Verdict value={row.browse} />
                </td>
                <td>
                  <Verdict value={row.focus} />
                </td>
                <td className="matrix-note">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="source-line">
        These lines were recorded against the demo as it stood on the date in the file, and
        cover the scene itself, which is the library's own output and has not changed. The
        page around it has been rewritten since, so the parts of that session quoting the old
        headings and paragraphs are not what a reader would hear today. Re-recording needs
        Windows, an NVDA install and an unattended machine, so it is stated rather than
        quietly trimmed.{' '}
        Full session, both modes, and the list of what is imperfect in each:{' '}
        <a href={SOURCE('NVDA.md')}>NVDA.md</a>. The runner is{' '}
        <a href={SOURCE('nvda/demo.spec.ts')}>nvda/demo.spec.ts</a>, which is deliberately not
        part of the test suite: it needs Windows, an NVDA install and a machine nothing else
        is going to steal focus from, so its output is committed instead of rerun.
      </p>
    </Line>
  )
}

/** Never colour alone: the word is the signal and the colour agrees with it. */
function Verdict({ value }: { value: string }) {
  return <span className={'verdict is-' + value.toLowerCase()}>{value}</span>
}
