import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
export function bundleUpdater(source, runtime, name = 'UPDATE') {
  const begin = `// BEGIN GENERATED ${name} RUNTIME`
  const end = `// END GENERATED ${name} RUNTIME`
  const start = source.indexOf(begin), finish = source.indexOf(end)
  if ((start < 0) !== (finish < 0) || (start >= 0 && finish < start)) throw new Error('Incomplete updater markers')
  if (source.indexOf(begin, start + begin.length) >= 0 || source.indexOf(end, finish + end.length) >= 0) throw new Error('Duplicate updater markers')
  const block = `${begin}\n${runtime.trim()}\n${end}\n`
  return start < 0 ? `${source.trimEnd()}\n\n${block}` : source.slice(0, start) + block + source.slice(finish + end.length).trimStart()
}
// The updater refuses a release asset of 1,000,000 bytes or more, and Hermes'
// hermes:fs:writeText refuses 1,000,000 characters or more, which the update's
// rollback copy of the installed file goes through. A bigger bundle could never
// be offered, nor installed over.
export const SHIPPED_LIMIT = 1_000_000
export function assertShippable(output) {
  const bytes = Buffer.byteLength(output)
  if (bytes >= SHIPPED_LIMIT || output.length >= SHIPPED_LIMIT) throw new Error(`Generated plugin is ${bytes} bytes / ${output.length} characters; the updater and Hermes' file writes need both under ${SHIPPED_LIMIT}`)
  return output
}
// The style sheets are most of the bundle, and their comments and indentation
// are most of the sheets. Only top-level `const CSS = \`…\`` and
// `const …_CSS = \`…\`` templates are rewritten, and only what CSS ignores goes:
// comments, and whitespace next to { } ; , : ( ) ! or at either end. Strings,
// unquoted url()s, custom property values, escapes and ${} substitutions are
// copied as they are, and a space that may be a descendant
// combinator (between two words, around a substitution) stays. A rule's line
// break stays too, so the shipped sheet still diffs one rule per line. The
// rewrite is idempotent, so running the build on its own output changes nothing.
export function minifyStyleTemplates(source) {
  const head = /^const (?:[A-Z][A-Z0-9_]*_)?CSS ?= ?`/gm
  let out = '', last = 0, match
  while ((match = head.exec(source))) {
    const open = match.index + match[0].length
    const { css, close } = minifyStyleTemplate(source, open)
    out += source.slice(last, open) + css
    last = head.lastIndex = close
  }
  return out + source.slice(last)
}
function minifyStyleTemplate(source, start) {
  const glue = '{};,:(', tight = '{};,!)'
  let css = '', i = start, gap = '', prev = ''
  const emit = (text, word = false) => {
    if (gap && prev === '}' && gap.includes('\n') && text[0] !== '}') css += '\n'
    else if (gap && prev && !glue.includes(prev) && (word || !tight.includes(text[0]))) css += ' '
    css += text
    prev = word ? 'w' : text[text.length - 1]
    gap = ''
  }
  for (;;) {
    const c = source[i]
    if (c === undefined) throw new Error('Unterminated style template')
    if (c === '`') break
    if (/\s/.test(c)) { gap += c; i++; continue }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) throw new Error('Unterminated style comment')
      i = end + 2
      continue
    }
    if (c === '\\') { emit(source.slice(i, i + 2)); i += 2; continue }
    if (c === '$' && source[i + 1] === '{') {
      const end = source.indexOf('}', i)
      const expression = source.slice(i, end + 1)
      if (!/^\$\{[\w$.]+\}$/.test(expression)) throw new Error(`Unsupported style substitution ${expression.slice(0, 40)}`)
      emit(expression, true)
      i = end + 1
      continue
    }
    if (c === '"' || c === "'") {
      let end = i + 1
      while (source[end] !== c) {
        if (source[end] === undefined || source[end] === '`' || source[end] === '\n') throw new Error('Unterminated style string')
        end += source[end] === '\\' ? 2 : 1
      }
      emit(source.slice(i, end + 1))
      i = end + 1
      continue
    }
    if (/^url\(\s*[^\s'")]/i.test(source.slice(i, i + 64))) {
      const end = source.indexOf(')', i)
      if (end < 0 || source.slice(i, end).includes('`')) throw new Error('Unterminated style url')
      emit(source.slice(i, end + 1))
      i = end + 1
      continue
    }
    // A custom property keeps its value's text as written, whitespace and all:
    // that text is what getComputedStyle and cssText give back for it.
    if (c === '-' && source[i + 1] === '-' && (prev === '{' || prev === ';')) {
      let end = i, depth = 0
      for (;;) {
        const d = source[end]
        if (d === undefined || d === '`') break
        if (d === '\\') { end += 2; continue }
        if (d === '"' || d === "'") {
          end++
          while (source[end] !== d) {
            if (source[end] === undefined || source[end] === '`') throw new Error('Unterminated style string')
            end += source[end] === '\\' ? 2 : 1
          }
          end++
          continue
        }
        if (depth === 0 && (d === ';' || d === '}')) break
        if ('([{'.includes(d)) depth++
        else if (')]}'.includes(d)) depth--
        end++
      }
      emit(source.slice(i, end).trimEnd())
      i = end
      continue
    }
    emit(c)
    i++
  }
  // The sheets are concatenated into one <style>; an edge keeps a line break.
  if (/\s/.test(source[start])) css = '\n' + css
  if (gap) css += '\n'
  return { css, close: i }
}
// The code keeps its comments in src/; in the shipped copy a line that is only
// a // comment goes, and so does the indentation of every line. A small scanner
// finds both so a line inside a template literal, a string or a regular
// expression is never taken for one. Line breaks stay (automatic semicolons
// depend on them), and so do the generated-block markers.
const TIGHT = ',;{}()[]=:?'
export function stripCommentLines(code) {
  const drop = [], stack = []
  let i = 0, prev = ''
  const regexAfter = ch => !ch || '(,=:[!&|?{};+-*%<>~^'.includes(ch)
  while (i < code.length) {
    const c = code[i]
    if (stack.length && stack[stack.length - 1] === '`') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { stack.pop(); prev = '`'; i++; continue }
      if (c === '$' && code[i + 1] === '{') { stack.push('{'); i += 2; continue }
      i++
      continue
    }
    if (c === '\n') {
      let end = i + 1
      while (code[end] === ' ' || code[end] === '\t') end++
      // A blank line goes whole; the newline before it still ends the line.
      if (code[end] === '\n') drop.push([i + 1, end + 1])
      else if (end > i + 1) drop.push([i + 1, end])
    }
    // Spaces beside punctuation (a = b, c → a=b,c) go; the punctuation still
    // parts the tokens. (Strings, templates and regular expressions are
    // skipped whole above and below, so their spaces stay.)
    if (c === ' ' || c === '\t') {
      let end = i
      while (code[end] === ' ' || code[end] === '\t') end++
      const before = code[i - 1], after = code[end]
      if (before !== '\n' && before !== undefined && after !== '\n' && after !== undefined && (TIGHT.includes(before) || TIGHT.includes(after)) && !(after === '/' && (code[end + 1] === '/' || code[end + 1] === '*'))) drop.push([i, end])
      i = end
      continue
    }
    if (/\s/.test(c)) { i++; continue }
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i), stop = end < 0 ? code.length : end
      const line = code.lastIndexOf('\n', i - 1) + 1
      if (/^\/\/ (?:BEGIN|END) /.test(code.slice(i, stop))) {} else if (!code.slice(line, i).trim()) drop.push([line, end < 0 ? stop : end + 1])
      else {
        // A comment after code goes with the spaces before it.
        let from = i
        while (code[from - 1] === ' ' || code[from - 1] === '\t') from--
        drop.push([from, stop])
      }
      i = stop
      continue
    }
    if (c === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2) + 2; if (i < 2) throw new Error('Unterminated comment'); continue }
    if (c === '"' || c === "'") {
      let end = i + 1
      while (code[end] !== c) { if (code[end] === undefined || code[end] === '\n') throw new Error('Unterminated string'); end += code[end] === '\\' ? 2 : 1 }
      i = end + 1; prev = c
      continue
    }
    if (c === '`') { stack.push('`'); i++; continue }
    if (c === '{') { stack.push('{'); prev = c; i++; continue }
    if (c === '}') {
      stack.pop(); i++
      if (stack[stack.length - 1] !== '`') prev = c
      continue
    }
    if (c === '/' && regexAfter(prev)) {
      let end = i + 1, inClass = false
      while (inClass || code[end] !== '/') {
        if (code[end] === undefined || code[end] === '\n') throw new Error('Unterminated regular expression')
        if (code[end] === '\\') end++
        else if (code[end] === '[') inClass = true
        else if (code[end] === ']') inClass = false
        end++
      }
      i = end + 1; prev = 'a'
      continue
    }
    // A keyword before a slash (return /x/) starts a regular expression too.
    const word = /^[\w$]+/.exec(code.slice(i, i + 64))?.[0]
    if (word) { prev = /^(?:return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)$/.test(word) ? '(' : 'a'; i += word.length; continue }
    prev = c; i++
  }
  if (stack.length) throw new Error('Unbalanced code')
  let out = '', last = 0
  // (An indented comment line is dropped twice over; the ranges share a start.)
  for (const [from, to] of drop) { if (from >= last) out += code.slice(last, from); last = Math.max(last, to) }
  return out + code.slice(last)
}
// A Windows checkout (core.autocrlf) reads back CRLF; the repository and the
// published checksum are LF, so both copies are built and hashed as LF.
const lf = text => text.replace(/\r\n/g, '\n')
const bundle = (source, update, observer, inbox, own = lf) =>
  bundleUpdater(bundleUpdater(lf(source), own(update)), [lf(observer), ...inbox.map(own)].join('\n\n'), 'INBOX')
// src/plugin.js is the copy people read and edit, with every runtime bundled
// as written.
export function bundlePlugin(source, update, observer, inbox) {
  return bundle(source, update, observer, inbox)
}
// claude-chat-look/plugin.js is the copy Hermes installs and the release ships:
// the same program without the style sheets' comments and indentation and the
// code's comment lines and indentation. The vendored observer keeps its
// provenance comments.
export function shipPlugin(source, update, observer, inbox) {
  const strip = text => stripCommentLines(lf(text))
  return assertShippable(minifyStyleTemplates(bundle(strip(source), update, observer, inbox, strip)))
}
async function build() {
  // Vendoring is an explicit maintenance operation, not a build dependency.
  const vendorRoot = process.argv.find(arg => arg.startsWith('--vendor-observer='))?.slice('--vendor-observer='.length)
  const observerUrl = new URL('../src/inbox-observer-runtime.js', import.meta.url)
  if (vendorRoot !== undefined) {
    const root = resolve(vendorRoot), require = createRequire(pathToFileURL(`${root}/package.json`))
    if (require('@tanstack/query-core/package.json').version !== '5.101.2' || require('esbuild/package.json').version !== '0.28.1') throw new Error('Observer vendoring requires query-core@5.101.2 and esbuild@0.28.1')
    const { build: bundle } = require('esbuild')
    const result = await bundle({
      stdin: { contents: 'export { QueryObserver } from "@tanstack/query-core"', resolveDir: root, sourcefile: 'claude-inbox-observer-entry.js' },
      bundle: true, write: false, format: 'iife', globalName: 'ClaudeInboxObserverVendor',
      platform: 'browser', target: 'es2022', minify: true, metafile: true, legalComments: 'none'
    })
    if (Object.values(result.metafile.outputs).some(output => output.imports.length)) throw new Error('Observer bundle has external imports')
    const source = await readFile(observerUrl, 'utf8'), marker = '// BEGIN PINNED OBSERVER BUNDLE'
    const start = source.indexOf(marker)
    if (start < 0) throw new Error('Observer provenance marker is missing')
    await writeFile(observerUrl, source.slice(0, start + marker.length) + '\n' + result.outputFiles[0].text)
  }
  const plugin = new URL('../src/plugin.js', import.meta.url)
  const source = await readFile(plugin, 'utf8')
  const runtime = await readFile(new URL('../src/update-runtime.js', import.meta.url), 'utf8')
  const inboxQuery = await readFile(new URL('../src/inbox-query.js', import.meta.url), 'utf8')
  const inboxObserver = await readFile(observerUrl, 'utf8')
  const inboxRuntime = await readFile(new URL('../src/inbox-runtime.js', import.meta.url), 'utf8')
  const inboxRowUI = await readFile(new URL('../src/inbox-row-ui.js', import.meta.url), 'utf8')
  const inboxOpenGesture = await readFile(new URL('../src/inbox-open-gesture.js', import.meta.url), 'utf8')
  const inboxOpenIntent = await readFile(new URL('../src/inbox-open-intent.js', import.meta.url), 'utf8')
  const inbox = [inboxQuery, inboxOpenGesture, inboxOpenIntent, inboxRowUI, inboxRuntime]
  const readable = bundlePlugin(source, runtime, inboxObserver, inbox)
  const output = shipPlugin(readable, runtime, inboxObserver, inbox)
  for (const module of [readable, output]) {
    const check = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: module, encoding: 'utf8' })
    if (check.status !== 0) throw new Error(check.stderr || 'Generated module did not parse')
  }
  const digest = createHash('sha256').update(output).digest('hex')
  const files = [
    [plugin, readable],
    [new URL('../claude-chat-look/plugin.js', import.meta.url), output],
    [new URL('../claude-chat-look/desktop/plugin.js', import.meta.url), output],
    [new URL('../CHECKSUMS.sha256', import.meta.url), `${digest}  claude-chat-look/plugin.js\n`]
  ]
  const staged = [], committed = []
  try {
    for (const [url, content] of files) {
      const path = fileURLToPath(url), temporary = `${path}.build-${process.pid}.tmp`
      const previous = await readFile(path)
      await writeFile(temporary, content)
      staged.push({ path, temporary, previous })
    }
    for (const entry of staged) { await rename(entry.temporary, entry.path); committed.push(entry) }
  } catch (error) {
    for (const entry of committed.reverse()) { await writeFile(entry.temporary, entry.previous); await rename(entry.temporary, entry.path) }
    throw error
  } finally { for (const entry of staged) await unlink(entry.temporary).catch(() => {}) }
  console.log(JSON.stringify({ digest, bytes: Buffer.byteLength(output), characters: output.length }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await build()
