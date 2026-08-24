import { ArrowIcon } from '../chrome'
import { REPO_URL } from '../site'

/**
 * The closing band. The same shape as the one on three-dispose-guard, because
 * the three sites end the same way even though nothing else about them looks
 * alike: a kicker, one sentence, one link out.
 */
export function CtaBand() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="cta-shell">
        <p className="cta-kicker">Listen to it yourself</p>
        <h2 id="cta-title">Every sentence on this page was written by the library.</h2>
        <a className="button button-accent" href={REPO_URL}>
          Read the full guide <ArrowIcon />
        </a>
      </div>
    </section>
  )
}
