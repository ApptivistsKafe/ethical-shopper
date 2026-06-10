import { mountPanel } from '../src/ui/mountPanel'

/**
 * Unlisted script carrying the heavy UI bundle (React, Turndown, panel
 * components). Built as a standalone ESM file + chunks, listed in
 * web_accessible_resources, and dynamically imported by the content script
 * ONLY after checkout detection passes — ordinary pages never parse it.
 *
 * WXT auto-executes main() on import and exposes its result as the module's
 * default export. main returns the mountPanel FUNCTION (rather than mounting)
 * so the cached module can mount repeatedly across SPA navigations.
 */
export default defineUnlistedScript(() => mountPanel)
