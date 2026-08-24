/**
 * 00:00. The scene, and the sentence it is writing about itself.
 *
 * The page opens on the thing rather than on a description of the thing. The
 * one voice moment on this site is directly below the canvas: the sentence set
 * at display size is not written by me, it is the string the library last put
 * into the accessibility tree, verbatim. The loudest text on the page being
 * machine output is the whole argument in one line.
 *
 * The canvas itself is in SceneCanvas.tsx and arrives in its own chunk, so the
 * argument paints before the machinery does.
 */

import { Suspense, lazy } from 'react'
import { Controls } from '../controls'
import { useLive } from '../live'
import { WEBGL_AVAILABLE } from '../webgl'
import { SURVEY } from '../site'

const SceneCanvas = lazy(() => import('./SceneCanvas'))

export function Stage() {
  const { focused, transcript, snapshot } = useLive()

  // The newest line the library wrote, whatever wrote it. Before the first
  // evaluation there is nothing to show and the placeholder says so rather
  // than inventing a sentence.
  const spoken = transcript[transcript.length - 1]?.text ?? snapshot?.regions[0]?.summary ?? null

  return (
    <section className="line line-stage" id="scene" aria-labelledby="scene-title">
      <div className="line-shell">
        <div className="stamp">
          <span className="section-number">00:00</span>
        </div>

        <div className="line-body">
          <p className="eyebrow">
            <span>scene-narrator</span> An accessibility layer for moving 3D scenes
          </p>
          <h1 id="scene-title">A screen reader can hear this scene move</h1>
          <p className="lede">
            A canvas contributes nothing to the browser accessibility tree, so an interactive
            WebGL scene fails WCAG 4.1.2 outright. The usual answer, one hidden DOM node per
            object rewritten every frame, is slow before it is unusable and unusable before
            that: a flat list of a thousand items destroys the heading navigation{' '}
            <a href={SURVEY.url}>{SURVEY.headingUsersPct} per cent of screen reader users</a>{' '}
            rely on. This groups the scene into a handful of areas instead, gives each one a
            real heading, and rewrites its sentence only when the meaning changes.
          </p>

          {/*
            The focused element lives inside the canvas as fallback content and
            is visually hidden, so it cannot carry a focus ring of its own. CSS
            :has(:focus-visible) does not help either: canvas fallback content
            is not rendered, so it never matches. The library's onFocusRegion
            callback is the intended answer, and this is what it is for. An
            application would also highlight the focused region in the scene.
          */}
          <div className={focused ? 'viewport viewport-focused' : 'viewport'}>
            {WEBGL_AVAILABLE ? (
              <Suspense
                fallback={
                  <p className="viewport-pending" role="status">
                    Loading the scene.
                  </p>
                }
              >
                <SceneCanvas />
              </Suspense>
            ) : (
              <div className="viewport-refused">
                <h2>This browser will not give up a WebGL context</h2>
                <p>
                  So there is no scene to describe, and the live readouts on this page have
                  nothing to read. Everything else still holds: the measurements below were
                  recorded elsewhere and are committed to the repository.
                </p>
              </div>
            )}
          </div>

          <figure className="spoken">
            <figcaption className="eyebrow">What it is saying right now</figcaption>
            {/*
              role="status" rather than aria-live="polite" on a div: this is a
              mirror of the accessibility tree for sighted visitors, and a
              screen reader user is already getting it from the real thing. It
              is announced once, quietly, rather than competing.
            */}
            <p className="spoken-line" role="status">
              {spoken ?? 'Nothing yet. The first evaluation happens one cadence from now.'}
            </p>
          </figure>

          <Controls />
        </div>

        <div className="margin-note">
          <FocusReadout />
        </div>
      </div>
    </section>
  )
}

/**
 * The annotation margin: what the screen reader is being told, right now.
 *
 * Not aria-hidden, unlike the panel this replaced. That panel was hidden on
 * the grounds that a screen reader user already has the real thing, which is
 * true of the summary and false of the heading count and the member list, and
 * hiding a whole region to avoid repeating part of it is the wrong trade.
 * Nothing here is focusable, so nobody gets stranded in it.
 */
function FocusReadout() {
  const { focused, snapshot } = useLive()

  return (
    <div className="readout">
      <p className="eyebrow">In the tree</p>
      <dl>
        <div>
          <dt>Areas</dt>
          <dd>{snapshot?.regions.length ?? 0}</dd>
        </div>
        <div>
          <dt>Focused</dt>
          <dd>{focused ? focused.heading : 'none'}</dd>
        </div>
      </dl>
      {focused ? (
        <>
          <p className="readout-summary">{focused.summary}</p>
          <p className="readout-meta">
            {focused.memberLabels.length} described{' '}
            {focused.memberLabels.length === 1 ? 'object' : 'objects'} in this area
          </p>
        </>
      ) : (
        <p className="readout-meta">
          Nothing focused. Press the button under the scene, or click the page and then press
          Tab.
        </p>
      )}
    </div>
  )
}
