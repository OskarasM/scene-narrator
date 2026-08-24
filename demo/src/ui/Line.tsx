import type { ReactNode } from 'react'

/**
 * One section, standing on the transcript rail.
 *
 * The rail is this site's structural device, in the same way the instrument
 * grid is three-dispose-guard's and the horizontal time axis is
 * realtime-3d-room's. Three sites share a token schema, a hairline rule and a
 * 12px gutter, which would make them identical if hue were the only thing
 * separating them, so each one's primary layout axis and repeating unit differ
 * instead. Here the axis runs vertically, the repeating unit is a line, and
 * each section is stamped with a timestamp rather than a number, because a
 * timestamp is the currency this library is measured in.
 *
 * The stamp sits in a fixed left column that runs the whole page, so the rail
 * is continuous between sections rather than restarting at each one. That is
 * why this does not use SectionHeading from chrome/index.tsx. It reuses that
 * stylesheet's class names, so the two files stay in step.
 */
export function Line({
  id,
  stamp,
  title,
  lede,
  aside,
  children,
}: {
  id: string
  stamp: string
  title: string
  lede?: ReactNode
  /** The annotation margin. Short, mono, and never load-bearing: it is read
   *  last or not at all, so nothing the argument needs may live only here. */
  aside?: ReactNode
  children: ReactNode
}) {
  const titleId = `${id}-title`

  return (
    <section className="line" id={id} aria-labelledby={titleId}>
      <div className="line-shell">
        <div className="stamp">
          <span className="section-number">{stamp}</span>
        </div>

        <div className="line-body">
          <div className="section-heading">
            <h2 id={titleId}>{title}</h2>
            {lede ? <p>{lede}</p> : null}
          </div>
          {children}
        </div>

        <div className="margin-note">{aside}</div>
      </div>
    </section>
  )
}

/** The full-bleed accent strip. Punctuation, used exactly once on this page. */
export function Strip({ children }: { children: ReactNode }) {
  return (
    <aside className="strip">
      <p>{children}</p>
    </aside>
  )
}
