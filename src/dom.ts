/**
 * The DOM writer, and the keyboard model that goes with it.
 *
 * Shape produced, for one region:
 *
 *   <section tabindex="-1" aria-labelledby="...">
 *     <h3>The north of the scene</h3>
 *     <p>5 vehicles, mostly moving, ahead and to your left, nearby</p>
 *   </section>
 *
 * The heading is stable. The paragraph is the only thing rewritten as the scene moves, so
 * an update costs exactly one text write per region whose meaning changed, regardless of
 * how many objects that region contains. The per-object list is created on demand when a
 * region is opened and removed again when it closes, which bounds both the size of the
 * accessibility tree and how much a person has to sit through.
 *
 * Two things here are deliberate and easy to get wrong:
 *
 * 1. Visually hidden means clipped, never `display: none` and never `visibility: hidden`.
 *    Both of those remove the element from the accessibility tree entirely, which would
 *    make this library an elaborate way of doing nothing.
 * 2. The heading level is the author's choice, because a heading structure only works if it
 *    fits the surrounding page. A library that hardcodes <h2> breaks the document outline
 *    of every page that already has one.
 */

import type { Region, RegionSnapshot } from './types.js'

const STYLE_ID = 'scene-narrator-style'

/**
 * Clip-rect hiding. This is the standard visually-hidden recipe rather than anything
 * invented here, and the comment exists because someone will eventually be tempted to
 * "tidy" it into `display: none`.
 */
const STYLE_TEXT = `
.scene-narrator-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
`

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  doc.head.appendChild(style)
}

export interface DomWriterOptions {
  mount: HTMLElement
  label: string
  headingLevel: number
  /** Called when the user moves focus onto a region, or off the last one. */
  onFocusRegion: (id: string | null) => void
  /** Called when the user opens a region and the per-object list has to be built. */
  renderMembers: (id: string) => string[]
}

interface RegionNodes {
  section: HTMLElement
  heading: HTMLElement
  summary: HTMLElement
  list: HTMLElement | null
}

export class DomWriter {
  private readonly doc: Document
  private readonly root: HTMLElement
  private readonly politeChannel: HTMLElement
  private readonly assertiveChannel: HTMLElement
  private readonly regionList: HTMLElement
  private readonly nodes = new Map<string, RegionNodes>()
  private order: string[] = []
  private focusedId: string | null = null

  /** Counts every property write that reaches the DOM. Read by `narrator.stats()`. */
  domWrites = 0

  constructor(private readonly options: DomWriterOptions) {
    this.doc = options.mount.ownerDocument
    ensureStyles(this.doc)

    this.root = this.doc.createElement('div')
    this.root.className = 'scene-narrator scene-narrator-sr-only'
    this.root.setAttribute('role', 'region')

    const headingId = uid('scene-narrator-heading')
    const heading = this.doc.createElement('h' + clampHeading(options.headingLevel))
    heading.id = headingId
    heading.textContent = options.label
    this.root.setAttribute('aria-labelledby', headingId)
    this.root.appendChild(heading)

    const help = this.doc.createElement('p')
    // Spoken once, when the user first reaches the region. It says what the keys do,
    // because a custom keyboard model that is never explained is a custom keyboard model
    // nobody uses.
    help.textContent =
      'Areas of the scene are listed as headings. ' +
      'Move to an area and press Enter to hear what is in it.'
    this.root.appendChild(help)

    this.regionList = this.doc.createElement('div')
    this.root.appendChild(this.regionList)

    this.politeChannel = this.makeLiveChannel('polite')
    this.assertiveChannel = this.makeLiveChannel('assertive')

    options.mount.appendChild(this.root)

    this.root.addEventListener('keydown', this.onKeyDown)
    this.root.addEventListener('focusin', this.onFocusIn)
  }

  private makeLiveChannel(politeness: 'polite' | 'assertive'): HTMLElement {
    const el = this.doc.createElement('div')
    el.setAttribute('aria-live', politeness)
    // Atomic, so a replaced message is read as one thing rather than as a diff against
    // whatever was there before.
    el.setAttribute('aria-atomic', 'true')
    el.className = 'scene-narrator-sr-only'
    this.root.appendChild(el)
    return el
  }

  /**
   * Reconcile the set of regions. Called only when the set of region ids changes, which is
   * rare, not on every update.
   */
  syncRegions(regions: Region[]): void {
    const seen = new Set<string>()
    const childHeadingLevel = clampHeading(this.options.headingLevel + 1)

    for (const region of regions) {
      seen.add(region.id)
      let nodes = this.nodes.get(region.id)
      if (!nodes) {
        const section = this.doc.createElement('section')
        // -1 by default: one tab stop for the whole scene, then arrows between regions.
        // Giving every region its own tab stop would put an unskippable list of tab stops
        // in the middle of the page.
        section.tabIndex = -1
        section.dataset.narratorRegion = region.id

        const headingId = uid('scene-narrator-region')
        const heading = this.doc.createElement('h' + childHeadingLevel)
        heading.id = headingId
        section.setAttribute('aria-labelledby', headingId)

        const summary = this.doc.createElement('p')

        section.appendChild(heading)
        section.appendChild(summary)
        this.regionList.appendChild(section)

        nodes = { section, heading, summary, list: null }
        this.nodes.set(region.id, nodes)
        this.domWrites++
      }
      if (nodes.heading.textContent !== region.heading) {
        nodes.heading.textContent = region.heading
        this.domWrites++
      }
    }

    for (const [id, nodes] of this.nodes) {
      if (seen.has(id)) continue
      nodes.section.remove()
      this.nodes.delete(id)
      if (this.focusedId === id) this.focusedId = null
    }

    this.order = regions.map((r) => r.id)
    this.updateRovingTabIndex()
  }

  /** One text write. This is the whole per-update cost when nothing structural changed. */
  writeSummary(id: string, summary: string): void {
    const nodes = this.nodes.get(id)
    if (!nodes) return
    if (nodes.summary.textContent === summary) return
    nodes.summary.textContent = summary
    this.domWrites++
  }

  announce(message: string, assertive: boolean): void {
    const channel = assertive ? this.assertiveChannel : this.politeChannel
    // Assigning the same string twice is not re-announced by screen readers, so a repeated
    // message needs the node cleared first. This is a real behaviour of live regions and
    // not a workaround for anything.
    if (channel.textContent === message) channel.textContent = ''
    channel.textContent = message
    this.domWrites++
  }

  private updateRovingTabIndex(): void {
    const focusTarget = this.focusedId ?? this.order[0]
    for (const [id, nodes] of this.nodes) {
      const next = id === focusTarget ? 0 : -1
      if (nodes.section.tabIndex !== next) {
        nodes.section.tabIndex = next
        this.domWrites++
      }
    }
  }

  private onFocusIn = (event: FocusEvent): void => {
    const section = (event.target as HTMLElement | null)?.closest?.('[data-narrator-region]') as
      | HTMLElement
      | null
    const id = section?.dataset.narratorRegion ?? null
    if (id === this.focusedId) return
    this.focusedId = id
    this.updateRovingTabIndex()
    this.options.onFocusRegion(id)
  }

  /**
   * Arrow keys move between regions, Enter opens one, Escape closes it.
   *
   * Worth knowing if you have not used a screen reader: NVDA has two modes. In browse mode
   * it intercepts the arrow keys to read the document, so these handlers never fire, and
   * the user navigates by heading with H instead. That is exactly why the region headings
   * are real headings and why nothing essential is arrow-key-only. In focus mode, which the
   * user enters with NVDA+space or by tabbing to a control, these handlers do fire.
   *
   * A component can work in one mode and be broken in the other, so both are tested.
   */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.order.length === 0) return
    const current = this.focusedId ? this.order.indexOf(this.focusedId) : -1

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        this.moveFocus(current + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        this.moveFocus(current <= 0 ? this.order.length - 1 : current - 1)
        break
      case 'Home':
        this.moveFocus(0)
        break
      case 'End':
        this.moveFocus(this.order.length - 1)
        break
      case 'Enter':
      case ' ':
        if (this.focusedId) this.toggleRegion(this.focusedId)
        break
      case 'Escape':
        if (this.focusedId) this.closeRegion(this.focusedId)
        return
      default:
        return
    }
    // Only reached for keys handled above, so ordinary typing and screen reader shortcuts
    // are left alone.
    event.preventDefault()
  }

  private moveFocus(index: number): void {
    const id = this.order[(index + this.order.length) % this.order.length]
    this.nodes.get(id)?.section.focus()
  }

  private toggleRegion(id: string): void {
    const nodes = this.nodes.get(id)
    if (!nodes) return
    if (nodes.list) this.closeRegion(id)
    else this.openRegion(id)
  }

  /**
   * Detail on demand. The per-object nodes exist only while a region is open, so the
   * accessibility tree holds a handful of nodes rather than one per object in the scene.
   */
  openRegion(id: string): void {
    const nodes = this.nodes.get(id)
    if (!nodes || nodes.list) return
    const list = this.doc.createElement('ul')
    for (const line of this.options.renderMembers(id)) {
      const item = this.doc.createElement('li')
      item.textContent = line
      list.appendChild(item)
    }
    nodes.section.appendChild(list)
    nodes.list = list
    this.domWrites++
    this.announce('Opened. ' + list.childElementCount + ' items.', false)
  }

  closeRegion(id: string): void {
    const nodes = this.nodes.get(id)
    if (!nodes?.list) return
    nodes.list.remove()
    nodes.list = null
    this.domWrites++
  }

  focusRegion(id: string): void {
    this.nodes.get(id)?.section.focus()
  }

  isOpen(id: string): boolean {
    return this.nodes.get(id)?.list !== null && this.nodes.get(id)?.list !== undefined
  }

  snapshotRegion(id: string): Pick<RegionSnapshot, 'heading' | 'summary'> | null {
    const nodes = this.nodes.get(id)
    if (!nodes) return null
    return { heading: nodes.heading.textContent ?? '', summary: nodes.summary.textContent ?? '' }
  }

  get lastAnnouncement(): string | null {
    return this.politeChannel.textContent || null
  }

  dispose(): void {
    this.root.removeEventListener('keydown', this.onKeyDown)
    this.root.removeEventListener('focusin', this.onFocusIn)
    this.root.remove()
    this.nodes.clear()
  }
}

let counter = 0
function uid(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

function clampHeading(level: number): number {
  return Math.min(6, Math.max(1, Math.round(level)))
}
