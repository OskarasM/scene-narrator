/**
 * The rolling measurement behind the cost section.
 *
 * The narrator reports cumulative counters. What a reader wants is a rate, and
 * what a sceptical reader wants is the raw series, so this keeps one sample a
 * second for sixty seconds and can hand the whole thing over as JSON or CSV.
 * Nothing here is simulated: every field is either read off narrator.stats()
 * or counted out of the live DOM.
 *
 * The counterfactual column is the one to be careful with. It is not a
 * measurement, it is arithmetic: a 1:1 mirror rewrites one node per object per
 * frame, so its write rate is objects times frames per second, by definition.
 * The page says so in those words rather than presenting it as a second run.
 */

import type { NarratorStats } from 'scene-narrator'

export interface Second {
  /** Whole seconds since the session started. */
  t: number
  domWrites: number
  frames: number
  evaluations: number
  digestChanges: number
  objects: number
  /** Elements currently in the accessibility tree the narrator maintains. */
  a11yNodes: number
  /** objects * frames. What a per-object mirror would have written. */
  naiveWrites: number
}

const WINDOW_SECONDS = 60

const zero: NarratorStats = { frames: 0, evaluations: 0, digestChanges: 0, domWrites: 0 }

export class Session {
  private samples: Second[] = []
  private previous: NarratorStats = zero
  private startedAt = 0
  private lastSampledAt = 0

  /** Restarts the series. Changing scene or cadence rebuilds the narrator, so
   *  its counters go back to zero and a series spanning the change would be
   *  two different measurements drawn as one line. */
  reset(now: number): void {
    this.samples = []
    this.previous = zero
    this.startedAt = now
    this.lastSampledAt = now
  }

  /** Call as often as you like. It records at most one sample a second. */
  sample(stats: NarratorStats, objects: number, a11yNodes: number, now: number): boolean {
    if (this.startedAt === 0) this.reset(now)
    if (now - this.lastSampledAt < 1000) return false

    const elapsed = (now - this.lastSampledAt) / 1000
    this.lastSampledAt = now

    const frames = Math.round((stats.frames - this.previous.frames) / elapsed)
    const sample: Second = {
      t: Math.round((now - this.startedAt) / 1000),
      domWrites: Math.round((stats.domWrites - this.previous.domWrites) / elapsed),
      frames,
      evaluations: Math.round((stats.evaluations - this.previous.evaluations) / elapsed),
      digestChanges: Math.round((stats.digestChanges - this.previous.digestChanges) / elapsed),
      objects,
      a11yNodes,
      naiveWrites: objects * frames,
    }
    this.previous = { ...stats }

    this.samples.push(sample)
    if (this.samples.length > WINDOW_SECONDS) this.samples.shift()
    return true
  }

  get series(): readonly Second[] {
    return this.samples
  }

  latest(): Second | null {
    return this.samples[this.samples.length - 1] ?? null
  }

  /** Peak DOM writes per second over the window, which is the number that
   *  decides whether this is cheap. An average would hide the evaluation the
   *  whole region set changed on. */
  peakWrites(): number {
    return this.samples.reduce((peak, s) => Math.max(peak, s.domWrites), 0)
  }

  toJson(scene: string): string {
    return JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        scene,
        windowSeconds: WINDOW_SECONDS,
        note: 'naiveWrites is objects * frames, the write rate of a one node per object mirror. It is arithmetic, not a second measurement.',
        samples: this.samples,
      },
      null,
      2,
    )
  }

  toCsv(scene: string): string {
    const header = [
      'second',
      'scene',
      'objects',
      'frames_per_second',
      'evaluations_per_second',
      'digest_changes_per_second',
      'dom_writes_per_second',
      'naive_writes_per_second',
      'a11y_nodes',
    ]
    const rows = this.samples.map((s) => [
      s.t,
      scene,
      s.objects,
      s.frames,
      s.evaluations,
      s.digestChanges,
      s.domWrites,
      s.naiveWrites,
      s.a11yNodes,
    ])
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  }
}

/**
 * Quote, escape, and refuse to hand a spreadsheet a formula.
 *
 * A cell beginning with one of these characters is executed on open by Excel,
 * Sheets and LibreOffice alike. Everything this file writes is a number or a
 * scene name chosen in this repo, so the real risk here is nil, but a CSV
 * export that does not guard is a habit rather than a decision, and the next
 * one will carry a user string.
 */
export function csvCell(value: string | number): string {
  const text = String(value)
  const guarded = /^[=+\-@\t\r]/.test(text) ? "'" + text : text
  return /[",\n\r]/.test(guarded) ? '"' + guarded.replace(/"/g, '""') + '"' : guarded
}

/** Hands the browser a file without a server and without leaving a blob URL
 *  behind. The link is created, clicked and revoked in one turn. */
export function download(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
