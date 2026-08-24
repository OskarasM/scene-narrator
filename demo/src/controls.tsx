/**
 * The instrument strip under the scene.
 *
 * Every control here changes something the library was given as an option, so
 * the page is not demonstrating a demo mode: it is demonstrating the same four
 * arguments an application passes to createNarrator. Cadence and region count
 * are construction options rather than settings, so changing either rebuilds
 * the narrator and restarts the measurement, which the strip says out loud
 * rather than leaving somebody to notice the graph jumped.
 */

import { useEffect, useState } from 'react'
import { TabPicker } from './chrome'
import { useLive } from './live'
import { SCENES, sceneById, type SceneId } from './scenes'

export function Controls() {
  const {
    sceneId,
    setSceneId,
    cadence,
    setCadence,
    regionTarget,
    setRegionTarget,
    running,
    setRunning,
    reducedMotion,
    focusScene,
  } = useLive()

  const scene = sceneById(sceneId)
  const authorRegions = scene.regionSource === 'author'

  return (
    <div className="controls">
      <TabPicker<SceneId>
        legend="Choose a scene"
        tabs={SCENES.map((s) => ({ id: s.id, index: String(s.objects), title: s.title }))}
        selected={sceneId}
        onSelect={setSceneId}
        className="scene-picker"
        tabClassName="scene-tab"
      />

      <div className="dials">
        <Dial
          id="cadence"
          label="Cadence"
          unit="ms"
          value={cadence}
          min={100}
          max={1000}
          step={50}
          onCommit={setCadence}
          hint="Minimum time between evaluations."
        />
        <Dial
          id="regions"
          label="Regions"
          unit=""
          value={regionTarget}
          min={2}
          max={16}
          step={1}
          onCommit={setRegionTarget}
          disabled={authorRegions}
          hint={
            authorRegions
              ? 'This scene names its own regions, so there is no grid to size.'
              : 'Target number of areas. Empty ones are dropped, so it is a target.'
          }
        />
      </div>

      <div className="control-buttons">
        <button className="button button-quiet" type="button" onClick={() => setRunning(!running)}>
          {running ? 'Pause the scene' : 'Play the scene'}
        </button>
        {/*
          Why this button exists.

          Loading this page by typing its address leaves keyboard focus in the
          browser's own toolbar, not in the document. The first few Tab presses
          then move through browser chrome and never reach the page, so the
          scene appears unreachable. That is not a screen reader problem and it
          is not a library problem, it is what happens to anybody who visits a
          page by typing its URL, and a demo that cannot survive it demonstrates
          nothing. This uses the same public call an application would:
          narrator.focusRegion(id).
        */}
        {/* The enter-scene class is a contract, not styling: bench/demo-check.mjs
            clicks this button by that name to prove the path works in a real
            browser. Renaming it silently would leave that check green while it
            tested nothing. */}
        <button
          className="button button-accent enter-scene"
          type="button"
          onClick={focusScene}
        >
          Put focus in the scene
        </button>
      </div>

      {reducedMotion && !running ? (
        <p className="control-note" role="status">
          Started paused, because this browser asks for reduced motion. The numbers below are
          readable either way.
        </p>
      ) : null}
    </div>
  )
}

/**
 * A range input that commits on a pause rather than on every pixel of a drag.
 *
 * Without this, dragging the cadence slider from 250 to 600 rebuilds the
 * narrator around thirty times, and each rebuild takes the user's focus out of
 * the accessibility tree with it. The visible value tracks the thumb; the
 * narrator hears the number the drag stopped on.
 */
function Dial({
  id,
  label,
  unit,
  value,
  min,
  max,
  step,
  onCommit,
  hint,
  disabled = false,
}: {
  id: string
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  onCommit: (value: number) => void
  hint: string
  disabled?: boolean
}) {
  const [shown, setShown] = useState(value)

  // Keeps the thumb honest when something else changes the value, such as
  // switching to a scene that names its own regions.
  useEffect(() => setShown(value), [value])

  useEffect(() => {
    if (shown === value) return
    const timer = setTimeout(() => onCommit(shown), 150)
    return () => clearTimeout(timer)
  }, [shown, value, onCommit])

  const hintId = id + '-hint'

  return (
    <div className={disabled ? 'dial is-disabled' : 'dial'}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => setShown(Number(event.target.value))}
      />
      <output htmlFor={id}>
        {shown}
        {unit}
      </output>
      <p className="dial-hint" id={hintId}>
        {hint}
      </p>
    </div>
  )
}
