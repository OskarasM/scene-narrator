import { SiteFooter, SiteHeader } from './chrome'
import { LiveProvider } from './live'
import { Strip } from './ui/Line'
import { CtaBand } from './ui/Cta'
import { Stage } from './sections/Stage'
import { Silence } from './sections/Silence'
import { Transcript } from './sections/Transcript'
import { Cost } from './sections/Cost'
import { Nvda } from './sections/Nvda'
import { Use } from './sections/Use'
import { Limits } from './sections/Limits'
import { BRAND, NAV, REPO_URL, SIBLING_SITES } from './site'

/**
 * The page, in the order somebody meets it.
 *
 * The scene is first and the explanation follows, because the argument this
 * library makes is one you have to hear before you will care how it works.
 * Everything after the scene reads perfectly well with no WebGL context at
 * all: the two sections that make measured claims quote committed recordings,
 * so an employer opening this on a machine with hardware acceleration off
 * still sees the whole case.
 */
export default function App() {
  return (
    <LiveProvider>
      <SiteHeader name={BRAND} nav={NAV} sourceUrl={REPO_URL} />

      <main id="main">
        <Stage />
        <Silence />
        <Strip>Words, not coordinates.</Strip>
        <Transcript />
        <Cost />
        <Nvda />
        <Use />
        <Limits />
        <CtaBand />
      </main>

      <SiteFooter
        name={BRAND}
        blurb="An accessibility layer for moving 3D scenes. MIT licensed."
        links={SIBLING_SITES}
      />
    </LiveProvider>
  )
}
