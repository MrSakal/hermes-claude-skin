// The skin's self-updater, bundled into the plugin by scripts/build-updater.mjs.
//
// It watches this repository's GitHub releases and offers the newest one above
// the running build; nothing is installed until the user clicks. A stable build
// (vX.Y.Z) takes stable releases only, a beta build (vX.Y.Z-beta.N) pre-releases
// too, so a beta moves on to the next beta and then to the stable release.
const UPDATE_REPO = 'MrSakal/hermes-claude-skin'
const UPDATE_FEED = `https://api.github.com/repos/${UPDATE_REPO}/releases`
const UPDATE_TAKES_BETAS = /-beta\.\d+$/.test(BUILD_ID)
const UPDATE_INTERVAL_MS = 3_600_000
// The release asset must stay under this (and so must Hermes' text writes).
const UPDATE_LIMIT = 1_000_000
// How long a written update may wait for Hermes to reload it before the
// previous file goes back.
const UPDATE_RELOAD_GRACE_MS = 10_000
// Storage keys and file names are shared with the build that installed this one
// (it writes the receipt this build checks), so they never change.
const UPDATE_RECEIPT_KEY = 'update-pending'
const UPDATE_CACHE_KEY = 'update-cache:' + UPDATE_REPO
const UPDATE_DONE_KEY = 'last-update'
const UPDATE_BACKUP_FILE = 'update-rollback.js'
const UPDATE_STAGED_FILE = 'update-staged.js'
const UPDATE_CSS = `
.claude-update-button{box-sizing:border-box;position:relative;display:flex;align-items:center;gap:4px;width:100%;height:28px;min-width:0;padding:0 8px 0 6px;border:0;border-radius:6px;background:var(--cs-profile-hover,var(--ui-row-hover-background,rgb(128 128 128 / 12%)));color:var(--cs-ink-2,var(--ui-text-secondary,#666));font:inherit;font-size:13px;line-height:20px;text-align:start;cursor:pointer;outline:none}
.claude-update-button[hidden]{display:none!important}
button.claude-update-button:is(:hover,:active){background:var(--cs-rail-active,var(--ui-row-active-background,rgb(128 128 128 / 20%)))}
button.claude-update-button:focus-visible{box-shadow:inset 0 0 0 1px var(--cs-rail,#111),0 0 0 1px var(--ui-accent,#D97757),0 0 6px 1px color-mix(in srgb,var(--ui-accent,#D97757) 60%,transparent)}
.claude-update-title,.claude-update-status-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.claude-update-title{color:var(--cs-ink,var(--ui-text-primary,#171717));font-weight:500}
.claude-update-status-text{color:var(--cs-ink-3,var(--ui-text-tertiary,#737373))}
.claude-update-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.claude-update-arrow{display:grid;flex:none;place-items:center;margin-inline-start:auto;color:var(--cs-ink-3,var(--ui-text-tertiary,#737373))}
button.claude-update-button:hover .claude-update-arrow{color:var(--cs-ink-2,var(--ui-text-secondary,#666))}
.claude-update-arrow svg{display:block;width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}
.claude-update-status{padding-inline-start:2px;cursor:default}
.claude-update-lead{display:grid;flex:none;place-items:center;width:24px;height:24px;color:var(--ui-accent,#D97757)}
.claude-update-spinner{box-sizing:border-box;width:16px;height:16px;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:claude-update-spin .8s linear infinite}
.claude-update-tip{position:fixed;z-index:2147483000;box-sizing:border-box;max-width:280px;padding:4px 8px;border:1px solid var(--cs-edge,var(--ui-stroke-tertiary,#e5e5e5));border-radius:7px;background:var(--cs-raised,var(--ui-editor-surface-background,#fff));box-shadow:0 4px 14px color-mix(in srgb,black 28%,transparent);color:var(--cs-ink,var(--ui-text-primary,#171717));font-size:12px;font-weight:400;line-height:16px;white-space:nowrap;pointer-events:none}
.claude-update-panel{box-sizing:border-box;position:fixed;z-index:10000;overflow:auto;overscroll-behavior:contain;width:320px;max-height:320px;padding:0 18px;border:0;border-radius:10px;background:var(--cs-menu-bg,var(--cs-card,var(--ui-editor-surface-background,#fff)));color:var(--cs-ink,var(--ui-text-primary,#171717));box-shadow:0 0 0 1px var(--cs-menu-edge,var(--ui-stroke-secondary,#e5e5e5)),0 8px 24px var(--cs-menu-shadow,#0000001f),0 2px 6px #00000014;font:13px/19px var(--font-sans,system-ui),sans-serif;scrollbar-width:thin;scrollbar-color:var(--ui-stroke-secondary,#ccc) transparent}
.claude-update-panel[hidden],.claude-update-tip[hidden]{display:none!important}
.claude-update-release{padding-block:16px;border-block-end:1px solid var(--ui-stroke-secondary,#e5e5e5)}
.claude-update-release:last-child{border-block-end:none}
.claude-update-release>header{display:flex;gap:8px;align-items:center;margin-block-end:9px;font-size:11px}
.claude-update-release>header>time{margin-inline-start:auto;font-size:10px;color:var(--ui-text-tertiary,#737373)}
.claude-update-release>header>.claude-update-tag{padding:1px 6px;border-radius:999px;font-size:9px;background:var(--ui-row-hover-background,#f3f3f3)}
.claude-update-release :is(h3,h4){margin:8px 0 4px;font-size:12px;font-weight:600;line-height:18px}
.claude-update-release :is(p,ul){margin-block:5px;color:var(--ui-text-secondary,#666)}
.claude-update-release p{white-space:pre-wrap;overflow-wrap:anywhere}
.claude-update-release ul{padding-inline-start:16px}
.claude-update-release li{margin-block:3px;overflow-wrap:anywhere}
.claude-update-release figure{margin:10px 0}
.claude-update-release figure>img{display:block;max-width:100%;max-height:180px;width:auto;height:auto;margin-inline:auto;border-radius:8px;object-fit:contain}
.claude-update-release>.claude-update-image-fallback{font-size:11px;color:var(--ui-text-tertiary,#737373)}
.claude-update-panel>.claude-update-error{padding-block:16px;white-space:pre-wrap;color:var(--ui-text-primary,#171717)}
@keyframes claude-update-spin{to{transform:rotate(1turn)}}
@media(prefers-reduced-motion:reduce){.claude-update-spinner{animation:none}}
`

// A tag as numbers that sort the way releases do: major, minor, patch, then the
// beta number, with a stable release after all of its betas. Anything else is
// not a release of ours.
function releaseRank(tag) {
  const parts = /^v(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(typeof tag === 'string' ? tag : '')
  if (!parts) return null
  return [Number(parts[1]), Number(parts[2]), Number(parts[3]), parts[4] === undefined ? Number.MAX_SAFE_INTEGER : Number(parts[4])]
}
function isNewerRelease(tag, than) {
  const a = releaseRank(tag), b = releaseRank(than)
  if (!a || !b) return false
  const at = a.findIndex((part, index) => part !== b[index])
  return at >= 0 && a[at] > b[at]
}

// The plugin file a release offers, or null when the release is not one this
// build may install: a draft, a beta on a stable build, a tag we do not know,
// or no plugin.js with GitHub's own SHA-256 and a size we accept.
function releasePlugin(release) {
  if (!release || release.draft || !releaseRank(release.tag_name)) return null
  if (release.prerelease && !UPDATE_TAKES_BETAS) return null
  const file = Array.isArray(release.assets) ? release.assets.find(asset => asset?.name === 'plugin.js') : null
  const sha256 = /^sha256:([0-9a-f]{64})$/.exec(file?.digest || '')?.[1]
  if (!sha256 || !Number.isInteger(file.id) || file.url !== `${UPDATE_FEED}/assets/${file.id}`) return null
  if (!(file.size > 0 && file.size < UPDATE_LIMIT)) return null
  return { url: file.url, size: file.size, sha256 }
}

async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  let hex = ''
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0')
  return hex
}

// What a plugin source says it is: the value of its top-level `const NAME = '…'`.
function declaredConstant(source, name) {
  // The shipped build drops the spaces around `=`; the source keeps them.
  const line = new RegExp(`^const ${name} ?= ?'([^'\\n]+)'`, 'm').exec(source)
  return line ? line[1] : null
}

// The folder this plugin lives in, from the one Hermes reports for desktop
// plugins. Anything that is not an absolute path ending in desktop-plugins, or
// that steps up a level, is refused rather than written into.
function updatePluginFolder(reported) {
  const path = typeof reported === 'string' ? reported.replace(/\\/g, '/').replace(/\/+$/, '') : ''
  const segments = path.split('/')
  const sound = /^(?:[A-Za-z]:)?\//.test(path) && segments[segments.length - 1] === 'desktop-plugins'
    && !segments.includes('.') && !segments.includes('..') && !/[\u0000-\u001f]/.test(path)
  if (!sound) throw new Error('Hermes reported an unexpected plugin folder.')
  return `${path}/${ID}`
}

// Release notes are drawn, never injected: a line starting with # is a heading,
// one starting with - or * a list item, and an image (Markdown or <img>) a
// figure, if it comes from this repository's GitHub files. Everything else is
// text. The images wait in data-update-image until the notes are opened.
function releaseImageURL(raw) {
  let url
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
  const path = url.pathname.toLowerCase(), repo = `/${UPDATE_REPO.toLowerCase()}/`
  if (url.hostname === 'github.com') return path.startsWith(`${repo}releases/download/`) || path.startsWith('/user-attachments/assets/') ? url.href : null
  if (url.hostname === 'raw.githubusercontent.com') return path.startsWith(repo) ? url.href : null
  return url.hostname === 'user-images.githubusercontent.com' ? url.href : null
}
// Character references in an <img> attribute, decoded by the browser itself: a
// textarea's contents are text, so nothing in them can become an element.
function decodeReferences(text) {
  const box = document.createElement('textarea')
  box.innerHTML = String(text ?? '')
  return box.value
}
function noteImage(src, alt) {
  const label = decodeReferences(alt)
  const url = releaseImageURL(decodeReferences(src).trim())
  const fallback = Object.assign(document.createElement('p'), { className: 'claude-update-image-fallback', textContent: label || 'Image unavailable' })
  if (!url) return fallback
  const figure = document.createElement('figure'), image = document.createElement('img')
  image.alt = label
  Object.assign(image, { loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' })
  image.dataset.updateImage = url
  image.addEventListener('error', () => figure.replaceWith(fallback), { once: true })
  figure.appendChild(image)
  return figure
}
function revealNoteImages(container) {
  for (const image of container.querySelectorAll('img[data-update-image]')) {
    image.src = image.dataset.updateImage
    delete image.dataset.updateImage
  }
}
const NOTE_IMAGE = /!\[([^\]\n]*)\]\(\s*<?([^\s<>)]+)>?(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)|<img\b((?:[^"'<>]|"[^"]*"|'[^']*')*)\/?>/gi
function imgAttribute(attributes, name) {
  const found = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>=\`]+))`, 'i').exec(attributes)
  return found ? found[1] ?? found[2] ?? found[3] : ''
}
function renderReleaseNotes(container, body) {
  let list = null
  const text = raw => {
    const line = raw.trim().replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
    if (!line) { list = null; return }
    const item = /^[-*]\s+(.*)$/.exec(line)
    if (item) {
      if (!list) list = container.appendChild(document.createElement('ul'))
      list.appendChild(document.createElement('li')).textContent = item[1]
      return
    }
    list = null
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    container.appendChild(document.createElement(heading ? 'h4' : 'p')).textContent = heading ? heading[1] : line
  }
  for (const line of String(body ?? '').split(/\r?\n/)) {
    let from = 0
    for (const found of line.matchAll(NOTE_IMAGE)) {
      const before = line.slice(from, found.index)
      // A bullet that holds only an image is the image.
      if (!/^\s*[-*]\s*$/.test(before)) text(before)
      const [src, alt] = found[3] === undefined ? [found[2], found[1]] : [imgAttribute(found[3], 'src'), imgAttribute(found[3], 'alt')]
      container.appendChild(noteImage(src, alt))
      list = null
      from = found.index + found[0].length
    }
    text(line.slice(from))
  }
}

// storage is the plugin's store, native Hermes' desktop bridge (folder, read,
// write) and request a fetch; the last two are swapped out in tests.
function createSkinUpdater(storage, native = globalThis.window?.hermesDesktop, request = globalThis.fetch?.bind(globalThis)) {
  const capable = Boolean(native) && typeof native.desktopPluginsRoot === 'function' && typeof native.readPluginSource === 'function' && typeof native.writeTextFile === 'function'
  // What the strip draws: the phase, the releases shown and the one on offer.
  const state = { phase: 'idle', target: null, releases: [], hasMore: false, page: 1, progress: 0, error: '' }
  const cache = storage?.get?.(UPDATE_CACHE_KEY, null) ?? null
  const views = new Set(), timers = new Set(), stop = new AbortController()
  let folder = null, ready = null, installing = false, fetchingMore = false, disposed = false, unwatch = () => {}

  const later = (run, ms) => {
    const timer = setTimeout(() => { timers.delete(timer); if (!disposed) run() }, ms)
    timers.add(timer)
  }
  // Lets the strip paint its new state before the next step blocks.
  const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 40))
  const busy = () => state.phase === 'downloading' || state.phase === 'applying' || state.phase === 'awaiting-reload'
  const redraw = () => { if (!disposed) for (const view of views) view.paint() }
  const enter = (phase, error = '') => { if (disposed) return; state.phase = phase; state.error = error; redraw() }

  const file = name => `${folder}/${name}`
  async function read(path) {
    const result = await native.readPluginSource(path)
    if (typeof result?.text !== 'string' || result.truncated) throw new Error('The local plugin could not be read completely.')
    return result.text
  }
  // Writes a file and reads it back; a write that does not read back the same
  // did not happen.
  async function writeExactly(path, text, failure) {
    await native.writeTextFile(path, text)
    if (await read(path) !== text) throw new Error(failure)
  }

  // Puts the file the receipt names back as the plugin, after checking that the
  // backup is still exactly that file.
  async function rollBack(receipt) {
    if (!receipt || receipt.repository !== UPDATE_REPO || !/^[0-9a-f]{64}$/.test(receipt.fromDigest || '')) throw new Error('The update receipt is missing.')
    const backup = await read(file(UPDATE_BACKUP_FILE))
    if (await sha256Hex(backup) !== receipt.fromDigest || declaredConstant(backup, 'BUILD_ID') !== receipt.fromVersion) throw new Error('The backup could not be verified.')
    await writeExactly(file('plugin.js'), backup, 'The restored plugin could not be verified.')
    storage.remove(UPDATE_RECEIPT_KEY)
  }
  // An update that never came up: once its grace period is over, the previous
  // build goes back, unless the receipt changed in the meantime.
  function rollBackAfterGrace(receipt, said) {
    enter('awaiting-reload')
    const waited = Date.now() - receipt.startedAt
    later(async () => {
      const current = storage.get(UPDATE_RECEIPT_KEY, null)
      if (current?.startedAt !== receipt.startedAt || current.digest !== receipt.digest) return
      try { await rollBack(current); enter('error', said.restored) }
      catch { enter('error', said.kept) }
    }, Math.max(0, UPDATE_RELOAD_GRACE_MS - waited))
  }

  // Finds the plugin folder and settles a receipt left by an update: this build
  // is its target and verifies, or it is put back.
  function initialize() {
    if (!capable) return Promise.reject(new Error('This Hermes Desktop version does not support local plugin updates.'))
    ready ||= (async () => {
      folder = updatePluginFolder(await native.desktopPluginsRoot())
      const receipt = storage.get(UPDATE_RECEIPT_KEY, null)
      if (receipt?.repository !== UPDATE_REPO) return
      if (receipt.targetVersion === BUILD_ID) {
        const running = await read(file('plugin.js')), digest = await sha256Hex(running)
        if (digest === receipt.digest && declaredConstant(running, 'BUILD_ID') === BUILD_ID) {
          storage.remove(UPDATE_RECEIPT_KEY)
          storage.set(UPDATE_DONE_KEY, { version: BUILD_ID, digest, verifiedAt: Date.now() })
          enter('done')
          return
        }
      }
      if (Number.isFinite(receipt.startedAt)) rollBackAfterGrace(receipt, {
        restored: 'The interrupted update was rolled back. Click to retry.',
        kept: 'The update is incomplete. Its receipt and backup were kept.'
      })
    })()
    return ready
  }

  async function github(url, accept) {
    await initialize()
    if (url !== UPDATE_FEED && !url.startsWith(`${UPDATE_FEED}?`) && !url.startsWith(`${UPDATE_FEED}/assets/`)) throw new Error('Unexpected update source.')
    const response = await request(url, {
      headers: { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
      credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([stop.signal, AbortSignal.timeout(20_000)])
    })
    if (response.ok) return response
    throw new Error(response.status === 403 || response.status === 429 ? 'GitHub is limiting requests for now. Try again later.' : `GitHub answered ${response.status}.`)
  }
  async function releasePage(page) {
    const list = await (await github(`${UPDATE_FEED}?per_page=10&page=${page}`, 'application/vnd.github+json')).json()
    if (!Array.isArray(list)) throw new Error('GitHub sent an unexpected release list.')
    return list
  }
  const shown = release => release && !release.draft && (UPDATE_TAKES_BETAS || !release.prerelease)

  async function firstPage() {
    const entry = { releases: await releasePage(1), checkedAt: Date.now() }
    storage.set(UPDATE_CACHE_KEY, entry)
    return entry
  }
  function accept(entry) {
    if (disposed || !entry) return
    state.releases = entry.releases.filter(shown)
    state.page = 1; state.hasMore = entry.releases.length === 10
    let best = null
    for (const release of state.releases) if (releasePlugin(release) && isNewerRelease(release.tag_name, BUILD_ID) && (!best || isNewerRelease(release.tag_name, best.tag_name))) best = release
    state.target = best
    if (busy() || state.phase === 'error') redraw()
    else enter(best ? 'available' : 'idle')
  }
  async function more() {
    if (disposed || fetchingMore || !state.hasMore) return
    fetchingMore = true
    try {
      const list = await releasePage(state.page + 1), known = new Set(state.releases.map(release => release.id))
      state.releases = state.releases.concat(list.filter(release => shown(release) && !known.has(release.id)))
      state.page++; state.hasMore = list.length === 10
      redraw()
    } catch { /* The notes already shown stay; scrolling again retries. */ }
    finally { fetchingMore = false }
  }

  // The asset, read as a stream so that a file over the limit is cut off
  // rather than held whole, and checked against the release's size and digest.
  async function download(plugin) {
    const response = await github(plugin.url, 'application/octet-stream')
    const reader = response.body?.getReader?.()
    if (!reader) throw new Error('This Hermes version cannot stream the download.')
    const chunks = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > plugin.size || received >= UPDATE_LIMIT) { await reader.cancel(); throw new Error('The download is larger than the release says.') }
      chunks.push(value)
      state.progress = received / plugin.size; redraw()
    }
    if (received !== plugin.size) throw new Error('The download is incomplete.')
    const bytes = new Uint8Array(received)
    let at = 0
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
    if (await sha256Hex(bytes) !== plugin.sha256) throw new Error('The download does not match the release checksum.')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }

  async function install() {
    if (installing || !state.target || (state.phase !== 'available' && state.phase !== 'error')) return
    const release = state.target, plugin = releasePlugin(release)
    if (!plugin) return
    installing = true
    let previous = null, replaced = false
    try {
      state.progress = 0; enter('downloading')
      const source = await download(plugin)
      if (declaredConstant(source, 'ID') !== ID || declaredConstant(source, 'BUILD_ID') !== release.tag_name) throw new Error('The download is not this release of Claude Skin.')
      state.progress = 1; redraw()
      await yieldFrame()
      if (disposed) return
      enter('applying')
      previous = await read(file('plugin.js'))
      if (declaredConstant(previous, 'BUILD_ID') !== BUILD_ID) throw new Error('The installed skin changed on disk. Reload it, then update.')
      await writeExactly(file(UPDATE_BACKUP_FILE), previous, 'The backup could not be verified.')
      await writeExactly(file(UPDATE_STAGED_FILE), source, 'The staged update could not be verified.')
      storage.set(UPDATE_RECEIPT_KEY, {
        repository: UPDATE_REPO, fromVersion: BUILD_ID, fromDigest: await sha256Hex(previous),
        targetVersion: release.tag_name, digest: plugin.sha256, startedAt: Date.now()
      })
      await yieldFrame()
      replaced = true
      await writeExactly(file('plugin.js'), source, 'The installed update could not be verified.')
      if (disposed) return
      // Hermes reloads a changed plugin, which ends this build; the new one
      // verifies itself. If this build is still here when the grace period
      // ends, the reload did not happen.
      enter('awaiting-reload')
      later(async () => {
        if (state.phase !== 'awaiting-reload') return
        try { await rollBack(storage.get(UPDATE_RECEIPT_KEY, null)); enter('error', 'Hermes did not reload the update, so the previous version was put back.') }
        catch { enter('error', 'Hermes did not reload the update. Its receipt and backup were kept.') }
        installing = false
      }, UPDATE_RELOAD_GRACE_MS)
    } catch (error) {
      if (disposed) return
      let message = error?.message || 'The update could not be installed.'
      if (replaced) {
        try { await rollBack(storage.get(UPDATE_RECEIPT_KEY, null)) }
        catch { message += ' The previous version could not be verified back in place; its receipt and backup were kept.' }
      } else storage.remove(UPDATE_RECEIPT_KEY)
      installing = false
      enter('error', `${message}\nClick the update button to retry.`)
    }
  }

  // Checks now unless the cached list is fresh, then every hour, and again when
  // Hermes comes back into focus or online with a list older than an hour.
  function start() {
    if (!capable || disposed) return () => {}
    if (cache) accept(cache)
    let checkedAt = cache?.checkedAt || 0, checking = false
    const check = async () => {
      if (checking || disposed) return
      checking = true
      try { const entry = await firstPage(); checkedAt = entry.checkedAt; accept(entry) }
      catch { /* Offline or rate limited: the next check tries again. */ }
      finally { checking = false }
    }
    const checkIfStale = () => { if (Date.now() - checkedAt >= UPDATE_INTERVAL_MS) void check() }
    void initialize().catch(() => {}).then(checkIfStale)
    const hourly = setInterval(check, UPDATE_INTERVAL_MS)
    window.addEventListener('focus', checkIfStale); window.addEventListener('online', checkIfStale)
    unwatch = () => { clearInterval(hourly); window.removeEventListener('focus', checkIfStale); window.removeEventListener('online', checkIfStale) }
    return unwatch
  }

  // Claude's update strip at the foot of the sidebar: a button while there is
  // something to do (title, then an arrow), a status line while it works. The
  // version is its tooltip; the release notes open from its context menu.
  function mount(anchor) {
    const button = document.createElement('button'), status = document.createElement('div'), panel = document.createElement('section'), tip = document.createElement('div')
    button.className = 'claude-update-button'; button.type = 'button'; button.dataset.claudeUpdate = 'true'
    // Only this fixed markup goes through innerHTML; release text never does.
    button.innerHTML = '<span class="claude-update-title"></span><span class="claude-update-sr"></span><span class="claude-update-arrow" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h10m-4-4 4 4-4 4"/></svg></span>'
    status.className = 'claude-update-button claude-update-status'; status.setAttribute('role', 'status'); status.hidden = true
    status.innerHTML = '<span class="claude-update-lead" aria-hidden="true"><span class="claude-update-spinner"></span></span><span class="claude-update-status-text"></span>'
    panel.className = 'claude-update-panel'; panel.hidden = true; panel.tabIndex = 0; panel.setAttribute('aria-label', 'Claude Skin releases')
    // (The strip's own text already says it to a screen reader.)
    tip.className = 'claude-update-tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true')
    anchor.dataset.claudeUpdateAnchor = 'true'; anchor.append(button, status); document.body.append(panel, tip)
    let tipTimer, drawnPhase, drawnReleases, drawnError, open = false
    const place = () => {
      if (!open) return
      const strip = button.getBoundingClientRect(), width = Math.min(320, innerWidth - 24)
      panel.style.width = `${width}px`; panel.style.maxHeight = `${Math.max(80, Math.min(320, strip.top - 24))}px`
      panel.style.left = `${Math.max(12, Math.min(strip.left, innerWidth - width - 12))}px`
      panel.style.top = `${Math.max(12, strip.top - panel.getBoundingClientRect().height - 8)}px`
    }
    const hideTip = () => { clearTimeout(tipTimer); tip.hidden = true }
    // Above the strip, 4px off, after Claude's tooltip delay.
    const showTip = () => {
      hideTip()
      tipTimer = setTimeout(() => {
        if (open || button.hidden || !button.isConnected || !button.checkVisibility()) return
        tip.hidden = false
        const strip = button.getBoundingClientRect(), box = tip.getBoundingClientRect()
        tip.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - box.width - 8, strip.left + strip.width / 2 - box.width / 2)))}px`
        tip.style.top = `${Math.round(Math.max(8, strip.top - box.height - 4))}px`
      }, 300)
    }
    const close = () => { open = false; panel.hidden = true; button.setAttribute('aria-expanded', 'false') }
    const openNotes = () => {
      if ((state.phase !== 'available' && state.phase !== 'error') || !button.checkVisibility()) return
      hideTip(); open = true; panel.hidden = false; button.setAttribute('aria-expanded', 'true')
      revealNoteImages(panel); place(); panel.focus({ preventScroll: true })
    }
    button.addEventListener('pointerenter', showTip); button.addEventListener('pointerleave', hideTip)
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) showTip() }); button.addEventListener('blur', hideTip)
    button.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); openNotes() })
    const outside = event => { if (!anchor.contains(event.target) && !panel.contains(event.target)) close() }
    const escape = event => { if (event.key === 'Escape') { hideTip(); if (open) { close(); if (button.isConnected) button.focus() } } }
    button.addEventListener('pointerdown', event => { event.stopPropagation(); hideTip() })
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); hideTip(); close(); void install() })
    panel.addEventListener('scroll', () => { if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 40) void more() })
    window.addEventListener('resize', place); document.addEventListener('scroll', place, true); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    const panelSize = new ResizeObserver(place)
    panelSize.observe(panel)
    const view = { paint() {
      const phase = state.phase, tag = state.target?.tag_name || ''
      const working = busy(), offered = phase === 'available' || phase === 'error'
      // Done or idle: no strip, as on Claude's after the relaunch. (Whoever
      // places the anchor shows it while it carries this mark.)
      if (anchor.hasAttribute('data-claude-update-visible') !== (working || offered)) anchor.toggleAttribute('data-claude-update-visible', working || offered)
      if (button.hidden !== !offered) button.hidden = !offered
      if (status.hidden !== !working) status.hidden = !working
      if (!offered) { close(); hideTip() }
      if (drawnPhase !== phase || button.dataset.version !== tag) {
        drawnPhase = phase; button.dataset.phase = phase; status.dataset.phase = phase; button.dataset.version = tag
        // Claude's words; the skin reloads in place rather than relaunching,
        // so a failed install offers just "Retry update".
        const failed = phase === 'error'
        button.querySelector('.claude-update-title').textContent = failed ? 'Retry update' : 'Update available'
        button.querySelector('.claude-update-sr').textContent = (failed ? ' The last update didn’t complete. ' : ' ') + tag
        tip.textContent = (failed ? 'Update didn’t complete' : 'Update available') + (tag ? ` · ${tag}` : '')
        status.lastChild.textContent = phase === 'downloading' ? 'Downloading update...' : 'Installing update...'
      }
      if (drawnReleases !== state.releases || drawnError !== state.error) {
        drawnReleases = state.releases; drawnError = state.error
        const scrolled = panel.scrollTop
        panel.replaceChildren()
        if (state.error) { const error = panel.appendChild(document.createElement('p')); error.className = 'claude-update-error'; error.textContent = state.error }
        for (const release of state.releases) {
          const article = panel.appendChild(document.createElement('article')), header = article.appendChild(document.createElement('header'))
          article.className = 'claude-update-release'
          header.appendChild(document.createElement('strong')).textContent = release.tag_name
          if (release.tag_name === state.target?.tag_name) { const badge = header.appendChild(document.createElement('span')); badge.className = 'claude-update-tag'; badge.textContent = 'Available' }
          const published = new Date(release.published_at)
          if (Number.isFinite(published.getTime())) header.appendChild(document.createElement('time')).textContent = published.toLocaleDateString('en', { month: 'short', day: 'numeric' })
          if (release.name && release.name !== release.tag_name) article.appendChild(document.createElement('h3')).textContent = release.name
          renderReleaseNotes(article, release.body)
        }
        if (open) revealNoteImages(panel)
        panel.scrollTop = scrolled; place()
      }
    } }
    views.add(view); view.paint()
    return () => {
      views.delete(view); close(); hideTip(); panelSize.disconnect()
      panel.remove(); tip.remove(); button.remove(); status.remove()
      delete anchor.dataset.claudeUpdateAnchor; anchor.removeAttribute('data-claude-update-visible')
      window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape)
    }
  }

  return {
    capable, state, cache, initialize, firstPage, accept, install, mount, start,
    dispose() { disposed = true; unwatch(); stop.abort(); for (const timer of timers) clearTimeout(timer); timers.clear() }
  }
}
