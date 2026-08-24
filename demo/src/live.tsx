/**
 * One narrator, read by four sections.
 *
 * The scene is at the top of the page, the transcript is a third of the way
 * down and the cost figures are halfway, and all three are looking at the same
 * running instance. Rather than have each of them poll, there is one poller
 * here, at four hertz, and everything below reads what it produced.
 *
 * Four hertz is not an arbitrary number. The narrator's default cadence is
 * 250ms, so sampling faster would show the same snapshot twice and sampling
 * slower would miss lines it wrote. It is the rate at which something can
 * actually have changed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Narrator, NarratorSnapshot, RegionSnapshot } from 'scene-narrator'
import { Session, type Second } from './session'
import { sceneById, type SceneId } from './scenes'

export interface TranscriptEntry {
  id: number
  /** Seconds since this narrator was built, which is the timestamp the rail
   *  is stamped in. */
  at: number
  kind: 'summary' | 'announcement'
  heading: string
  text: string
}

const TRANSCRIPT_LIMIT = 160
const POLL_MS = 250

interface LiveValue {
  sceneId: SceneId
  setSceneId: (id: SceneId) => void
  cadence: number
  setCadence: (ms: number) => void
  regionTarget: number
  setRegionTarget: (n: number) => void
  running: boolean
  setRunning: (running: boolean) => void
  /** True when the visitor asked for reduced motion, so the page can say why
   *  it started paused instead of looking broken. */
  reducedMotion: boolean

  attach: (narrator: Narrator, canvas: HTMLCanvasElement) => void
  focused: RegionSnapshot | null
  setFocused: (region: RegionSnapshot | null) => void
  focusScene: () => void

  snapshot: NarratorSnapshot | null
  transcript: readonly TranscriptEntry[]
  second: Second | null
  series: readonly Second[]
  session: Session
  clearTranscript: () => void
}

const LiveContext = createContext<LiveValue | null>(null)

export function LiveProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useMemo(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const [sceneId, setSceneIdState] = useState<SceneId>('yard')
  const [cadence, setCadenceState] = useState(250)
  const [regionTarget, setRegionTargetState] = useState(6)
  // Motion is the content here, so a reduced motion preference does not
  // disable it, it turns autoplay into a play button. The numbers underneath
  // are readable either way.
  const [running, setRunning] = useState(!reducedMotion)

  const [narrator, setNarrator] = useState<Narrator | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [focused, setFocused] = useState<RegionSnapshot | null>(null)
  const [snapshot, setSnapshot] = useState<NarratorSnapshot | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [second, setSecond] = useState<Second | null>(null)
  const [series, setSeries] = useState<readonly Second[]>([])

  const session = useMemo(() => new Session(), [])

  /* Monotonic for the life of the page, not for the life of one narrator.
     Switching scene clears the transcript and rebuilds the poller, and the old
     interval can fire once more in between, so a counter that restarted at
     zero handed React two rows with the same key and it quietly dropped one.
     Ids only ever have to be unique; they do not have to start anywhere. */
  const nextId = useRef(0)

  const attach = useCallback((next: Narrator, canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas
    setNarrator(next)
  }, [])

  const focusScene = useCallback(() => {
    const first = narrator?.snapshot().regions[0]
    if (first) narrator?.focusRegion(first.id)
  }, [narrator])

  const clearTranscript = useCallback(() => setTranscript([]), [])

  /* Changing any of these three rebuilds the narrator, because cadence and
     region count are construction options rather than settings. Its counters
     go back to zero with it, so a series spanning the change would be two
     different measurements drawn as one line. Say so by clearing. */
  const restart = useCallback(() => {
    setTranscript([])
    setSnapshot(null)
    setFocused(null)
    setSecond(null)
    setSeries([])
    session.reset(performance.now())
  }, [session])

  const setSceneId = useCallback(
    (id: SceneId) => {
      setSceneIdState(id)
      restart()
    },
    [restart],
  )
  const setCadence = useCallback(
    (ms: number) => {
      setCadenceState(ms)
      restart()
    },
    [restart],
  )
  const setRegionTarget = useCallback(
    (n: number) => {
      setRegionTargetState(n)
      restart()
    },
    [restart],
  )

  useEffect(() => {
    if (!narrator) return

    const startedAt = performance.now()
    session.reset(startedAt)
    // Keyed by region id, so a line is recorded when that region's sentence
    // changes rather than whenever any of them does.
    const lastSummary = new Map<string, string>()
    let lastAnnouncement: string | null = null

    const timer = setInterval(() => {
      const shot = narrator.snapshot()
      setSnapshot(shot)

      const at = Math.round((performance.now() - startedAt) / 1000)
      const fresh: TranscriptEntry[] = []

      for (const region of shot.regions) {
        if (lastSummary.get(region.id) === region.summary) continue
        lastSummary.set(region.id, region.summary)
        fresh.push({
          id: nextId.current++,
          at,
          kind: 'summary',
          heading: region.heading,
          text: region.summary,
        })
      }

      if (shot.lastAnnouncement && shot.lastAnnouncement !== lastAnnouncement) {
        lastAnnouncement = shot.lastAnnouncement
        fresh.push({
          id: nextId.current++,
          at,
          kind: 'announcement',
          heading: 'Announced by the application',
          text: shot.lastAnnouncement,
        })
      }

      if (fresh.length > 0) {
        setTranscript((lines) => [...lines, ...fresh].slice(-TRANSCRIPT_LIMIT))
      }

      const canvas = canvasRef.current
      const a11yNodes = canvas ? canvas.querySelectorAll('*').length : 0
      const objects = sceneById(sceneId).objects
      if (session.sample(narrator.stats(), objects, a11yNodes, performance.now())) {
        setSecond(session.latest())
        setSeries([...session.series])
      }
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [narrator, session, sceneId])

  const value: LiveValue = {
    sceneId,
    setSceneId,
    cadence,
    setCadence,
    regionTarget,
    setRegionTarget,
    running,
    setRunning,
    reducedMotion,
    attach,
    focused,
    setFocused,
    focusScene,
    snapshot,
    transcript,
    second,
    series,
    session,
    clearTranscript,
  }

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

export function useLive(): LiveValue {
  const value = useContext(LiveContext)
  if (!value) throw new Error('useLive must be used inside <LiveProvider>')
  return value
}
