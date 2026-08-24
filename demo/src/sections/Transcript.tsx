import { useEffect, useRef } from 'react'
import { Line } from '../ui/Line'
import { useLive } from '../live'
import { sceneById } from '../scenes'

/**
 * 00:11. Every line the scene has written.
 *
 * The section this site is built around. Each row is a string the library
 * actually put into the accessibility tree, stamped with the second it wrote
 * it and the area it wrote it about, newest at the bottom. It is not a log of
 * the demo, it is the demo: the transcript rail that runs down the left of
 * every section is a claim, and this is the section that pays it off.
 *
 * Nothing here is generated for display. The strings come from
 * narrator.snapshot(), which reads what the DOM was given.
 */
export function Transcript() {
  const { transcript, sceneId, cadence, clearTranscript, running } = useLive()
  const list = useRef<HTMLDivElement>(null)
  const scene = sceneById(sceneId)

  // Follow the newest line, but only while the scene is running. A visitor who
  // paused it is reading, and yanking the scroll position out from under
  // somebody who is reading is the rudest thing an auto-scroll can do.
  useEffect(() => {
    if (!running) return
    const node = list.current
    if (node) node.scrollTop = node.scrollHeight
  }, [transcript, running])

  return (
    <Line
      id="transcript"
      stamp="00:11"
      title="Every line the scene has written"
      lede={
        <>
          One row per DOM write. The stamp is seconds since this narrator was built, the
          heading is the area whose meaning changed, and the sentence is the string that
          went into the tree, verbatim. Change the scene or the cadence above and this
          starts again, because both of those rebuild the narrator.
        </>
      }
      aside={
        <>
          <p className="eyebrow">Reading it</p>
          <p>
            Long gaps are the point. A quiet transcript means the scene moved and nothing it
            did was worth saying. Turn the cadence down to 100ms and the gaps shrink; turn it
            up to a second and the sentences get further apart without getting less true.
          </p>
        </>
      }
    >
      <div className="transcript">
        <div className="transcript-head">
          <span>
            {scene.narrator.label}, cadence {cadence}ms, {scene.objects.toLocaleString('en-GB')}{' '}
            described objects
          </span>
          <span className="transcript-count">
            {transcript.length} {transcript.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        {/* Focusable, because it scrolls, and a scrollable region a keyboard
            cannot reach is a WCAG 2.1.1 failure.

            The region is a wrapper rather than the list itself. Putting
            role="region" on the <ol> replaces its implicit list role, and its
            own <li> children then have a parent that is not a list, which axe
            reports as a serious 1.3.1 failure. The scroll box and the list are
            two different things, so they are two different elements. */}
        <div
          className="transcript-body"
          ref={list}
          tabIndex={0}
          role="region"
          aria-label="Transcript of every line written to the accessibility tree, scrollable"
        >
          <ol>
          {transcript.map((entry) => (
            <li key={entry.id} className={entry.kind === 'announcement' ? 'is-announcement' : ''}>
              <span className="transcript-at">{stamp(entry.at)}</span>
              <span className="transcript-heading">{entry.heading}</span>
              <span className="transcript-text">{entry.text}</span>
            </li>
          ))}
          {transcript.length === 0 ? (
            <li className="transcript-empty">
              <span className="transcript-at">--:--</span>
              <span className="transcript-text">
                Nothing written yet. The first evaluation happens one cadence after the scene
                mounts.
              </span>
            </li>
          ) : null}
          </ol>
        </div>

        <div className="transcript-foot">
          <p>
            Rows marked in the accent are announcements the application made with{' '}
            <code>narrator.announce()</code>. Nothing in a scene graph says a van has been
            dispatched, so nothing infers it: that one is the author's job by design.
          </p>
          <button className="button button-quiet" type="button" onClick={clearTranscript}>
            Clear
          </button>
        </div>
      </div>
    </Line>
  )
}

const stamp = (seconds: number) =>
  String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
