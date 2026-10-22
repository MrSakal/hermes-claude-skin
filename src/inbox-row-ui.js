// Plugin-owned DOM chrome, transcribed from desktop sidebar/chrome.tsx,
// row-geometry.ts, session-row.tsx and ui/row-button.tsx. These are not imports
// or instances of the private SidebarSessionRow / SessionActionsMenu components.
// Parent installs this scoped fallback CSS once and owns all menu/action logic.
const CLAUDE_INBOX_ROW_UI_CSS = `
[data-claude-inbox-row-ui] { box-sizing:border-box; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:stretch; min-height:1.625rem; padding-right:.5rem; border-radius:.375rem; position:relative; }
[data-claude-inbox-row-ui]:hover { background:var(--ui-row-hover-background,transparent); }
[data-claude-inbox-row-ui][data-active='true'] { background:var(--ui-row-active-background,transparent); }
[data-claude-inbox-row-ui] > [data-slot='row-button'] { box-sizing:border-box; display:flex; height:100%; min-width:0; align-items:center; align-self:stretch; gap:.375rem; padding:.125rem .5rem; border:0; background:transparent; text-align:left; color:inherit; font:inherit; cursor:pointer; z-index:0; }
[data-claude-inbox-row-ui] [data-claude-inbox-lead] { display:grid; width:.875rem; height:.875rem; flex-shrink:0; place-items:center; overflow:hidden; position:relative; }
[data-claude-inbox-row-ui] [data-claude-inbox-work-dot] { box-sizing:border-box; width:6px; height:6px; border-radius:50%; background:var(--ui-text-quaternary,currentColor); color:var(--ui-text-quaternary,currentColor); opacity:0; }
[data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot] { background:var(--ui-text-primary,currentColor); opacity:1; }
[data-claude-inbox-row-ui][data-work-state='completed'] [data-claude-inbox-work-dot] { background:var(--ui-success,var(--ui-text-quaternary,currentColor)); opacity:1; }
/* Plugin-owned transcription of the installed host's private arc-border arc-row:
   styles.css:1111-1157,1202-1231,1246-1261,1274-1277. The installed SDK has
   no RunningBorder export; native session-row.tsx paints an aria-hidden span.
   Keep the native masked 300% gradient and diagonal translation, not rotation. */
[data-claude-inbox-row-ui] > [data-claude-inbox-running-arc] {
  --claude-inbox-arc-c0:color-mix(in srgb,var(--dt-foreground,var(--ui-text-primary,currentColor)) 0%,transparent);
  --claude-inbox-arc-c1:var(--dt-midground,var(--ui-text-primary,currentColor));
  --claude-inbox-arc-c2:color-mix(in srgb,var(--claude-inbox-arc-c1) 45%,transparent);
  --claude-inbox-arc-angle:160deg; --claude-inbox-arc-width:.078125rem;
  --claude-inbox-arc-standoff:0rem; --claude-inbox-arc-duration:2.23s;
  box-sizing:border-box; pointer-events:none; position:absolute; overflow:hidden;
  border-radius:inherit;
  inset:calc(var(--claude-inbox-arc-standoff) * -1); padding:var(--claude-inbox-arc-width);
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude; opacity:0;
}
:root:is(.dark,[data-hermes-mode='dark']) [data-claude-inbox-row-ui] > [data-claude-inbox-running-arc] { --claude-inbox-arc-c1:var(--dt-foreground,var(--ui-text-primary,currentColor)); }
[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc] { opacity:1; }
[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]::before {
  content:''; position:absolute; top:0; left:0; width:300%; height:300%;
  background:linear-gradient(var(--claude-inbox-arc-angle),transparent 0%,var(--claude-inbox-arc-c0) 15%,var(--claude-inbox-arc-c1) 20%,var(--claude-inbox-arc-c2) 25%,transparent 35%,transparent 40%,var(--claude-inbox-arc-c0) 55%,var(--claude-inbox-arc-c1) 60%,var(--claude-inbox-arc-c2) 65%,transparent 75%,transparent 80%,var(--claude-inbox-arc-c0) 95%,var(--claude-inbox-arc-c1) 100%);
  will-change:transform; animation:claude-inbox-row-contour var(--claude-inbox-arc-duration) linear infinite;
}
@keyframes claude-inbox-row-contour { 0% { transform:translate(-10%,-10%); } 100% { transform:translate(-50%,-50%); } }
[data-claude-inbox-row-ui] [data-claude-inbox-title-wrap] { min-width:0; flex:1; align-self:center; }
[data-claude-inbox-row-ui] [data-claude-inbox-label] { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.8125rem; line-height:1.35; font-weight:400; color:var(--ui-text-secondary,inherit); }
[data-claude-inbox-row-ui]:is(:hover,:focus-within,[data-active='true']) [data-claude-inbox-label] { color:var(--ui-text-primary,inherit); }
[data-claude-inbox-row-ui] > [data-row-actions] { display:flex; flex-shrink:0; align-items:center; align-self:stretch; }
[data-claude-inbox-row-ui] > [data-row-actions] > button { box-sizing:border-box; display:inline-flex; width:1.5rem; height:1.5rem; flex-shrink:0; align-items:center; justify-content:center; padding:0; border:0; border-radius:4px; background:transparent; color:var(--ui-text-secondary,inherit); font:inherit; cursor:pointer; opacity:0; pointer-events:none; transition:opacity 100ms; }
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > button { opacity:1; pointer-events:auto; }
[data-claude-inbox-row-ui] > [data-row-actions] > button:hover { background:var(--chrome-action-hover,var(--ui-control-hover-background,transparent)); color:var(--ui-text-primary,inherit); }
[data-claude-inbox-row-ui] button:focus-visible { outline:1px solid var(--ui-accent,currentColor); outline-offset:-1px; }
[data-claude-inbox-row-ui] button:disabled { cursor:default; }
[data-claude-inbox-row-ui] > [data-row-actions] > button:disabled { pointer-events:none; }
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > button:disabled { opacity:.5; }
[data-claude-inbox-row-ui] > [data-row-actions] > [data-claude-inbox-settle] { opacity:1; pointer-events:auto; }
[data-claude-inbox-row-ui] > [data-row-actions] > [data-claude-inbox-settle]:disabled,
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > [data-claude-inbox-settle]:disabled { opacity:0; visibility:hidden; pointer-events:none; transition:none; }
[data-claude-inbox-row-ui] svg { display:block; width:.75rem; height:.75rem; pointer-events:none; flex-shrink:0; }
@media (prefers-reduced-motion:reduce) {
  [data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]::before { animation:none; }
  [data-claude-inbox-row-ui] > [data-row-actions] > button { transition:none; }
}
`;

function createClaudeInboxRowUI({ document: doc, onOpen, onMenu, onSnooze }) {
  if (!doc || typeof doc.createElement !== 'function') throw new TypeError('document is required');
  const make = (tag, className, marker) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (marker) node.setAttribute(marker, '');
    return node;
  };
  const row = make('div', 'min-h-[1.625rem] pr-2 grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-md group row-hover relative', 'data-claude-inbox-row-ui');
  const go = make('button', 'pl-2 pr-2 gap-1.5 flex h-full min-w-0 items-center self-stretch py-0.5 bg-transparent text-left z-0', 'data-claude-inbox-open');
  go.type = 'button';
  go.setAttribute('data-slot', 'row-button');
  const lead = make('span', 'grid size-3.5 shrink-0 place-items-center overflow-hidden', 'data-claude-inbox-lead');
  lead.setAttribute('aria-hidden', 'true');
  const workDot = make('span', '', 'data-claude-inbox-work-dot');
  const runningArc = make('span', '', 'data-claude-inbox-running-arc');
  runningArc.setAttribute('aria-hidden', 'true');
  lead.append(workDot);
  const wrap = make('span', 'min-w-0 flex-1 self-center', 'data-claude-inbox-title-wrap');
  const label = make('span', 'min-w-0 truncate text-[0.8125rem] text-(--ui-text-secondary) leading-[1.35] hover-marquee block font-normal group-hover:text-foreground group-data-[working=true]:text-foreground/90', 'data-claude-inbox-label');
  const text = make('span', 'hover-marquee-inner');
  label.append(text); wrap.append(label); go.append(lead, wrap);
  const actions = make('div', 'flex shrink-0 items-center self-stretch', 'data-row-actions');
  const glyphButton = (marker, name, paths) => {
    const button = make('button', 'inline-flex shrink-0 cursor-pointer items-center justify-center size-6 rounded-[4px] text-(--ui-text-secondary) bg-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100', marker);
    button.type = 'button';
    button.setAttribute('data-slot', 'button');
    button.setAttribute('data-size', 'icon-xs');
    button.setAttribute('data-variant', 'ghost');
    button.setAttribute('aria-label', name); button.title = name;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.25'); svg.setAttribute('stroke-linecap', 'round');
    for (const d of paths) {
      const path = doc.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path);
    }
    button.append(svg); return button;
  };
  const menu = glyphButton('data-claude-inbox-menu', 'Inbox row options', ['M3 8h.01M8 8h.01M13 8h.01']);
  menu.firstChild.setAttribute('stroke-width', '2.5');
  menu.setAttribute('aria-haspopup', 'menu'); menu.setAttribute('aria-expanded', 'false');
  const clock = glyphButton('data-claude-inbox-snooze', 'Snooze', ['M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5', 'M8 4.5V8l2.5 1.5']);
  actions.append(menu, clock); row.append(go, actions, runningArc);
  // Do not let plugin-owned clicks/presses enter an ancestor's native gestures.
  // Preserve the actual event and its defaults/modifiers for parent callbacks.
  row.addEventListener('pointerdown', event => event.stopPropagation());
  for (const [button, callback] of [[go, onOpen], [menu, onMenu], [clock, onSnooze]]) {
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (!button.disabled && typeof callback === 'function') callback(event);
    });
  }
  // The action remains the same button/callback and disabled ledger. Only
  // callers opting in get a Settle check rather than the generic options menu.
  let settleAction = false;
  let menuTitle = null;
  const workStates = new Set(['working', 'completed', 'reading', 'unknown', 'idle']);
  const update = (state = {}) => {
    if ('title' in state) { text.textContent = String(state.title ?? ''); go.title = text.textContent; }
    if ('selected' in state) {
      row.classList.toggle('bg-(--ui-row-active-background)', Boolean(state.selected));
      row.setAttribute('data-active', String(Boolean(state.selected)));
      // The shipped skin paints aria-current; keep it on the shell, not the
      // transparent body, so selection does not create a second inset band.
      if (state.selected) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
    }
    if ('disabled' in state) { go.disabled = Boolean(state.disabled); clock.disabled = Boolean(state.disabled); }
    if ('menuDisabled' in state || 'disabled' in state) {
      if ('menuDisabled' in state) menu.dataset.menuDisabled = String(Boolean(state.menuDisabled));
      menu.disabled = go.disabled || menu.dataset.menuDisabled === 'true';
    }
    if ('workState' in state) {
      // Rendering consumes an explicit state; it never guesses completion from
      // inactivity, selection or a missing runtime slice.
      row.setAttribute('data-work-state', workStates.has(state.workState) ? state.workState : 'unknown');
    }
    if ('settleAction' in state) {
      settleAction = Boolean(state.settleAction);
      // Only Inbox opts into Snooze-left / Settle-right. Generic options keep
      // their original order. Move a sibling only on mode changes so ordinary
      // keyed updates cannot detach controls or disturb their keyboard focus.
      const firstAction = settleAction ? clock : menu;
      if (actions.firstElementChild !== firstAction) actions.insertBefore(firstAction, actions.firstChild);
      menu.toggleAttribute('data-claude-inbox-settle', settleAction);
      menu.firstChild.firstChild.setAttribute('d', settleAction ? 'M3.5 8.5l3 3 6-7' : 'M3 8h.01M8 8h.01M13 8h.01');
      menu.firstChild.setAttribute('stroke-width', settleAction ? '1.25' : '2.5');
      if (settleAction) {
        menu.removeAttribute('aria-haspopup'); menu.removeAttribute('aria-expanded');
      } else {
        menu.setAttribute('aria-haspopup', 'menu'); menu.setAttribute('aria-expanded', 'false');
      }
    }
    if ('menuTitle' in state) menuTitle = state.menuTitle == null ? null : String(state.menuTitle);
    if ('menuTitle' in state || 'settleAction' in state) {
      const name = menuTitle ?? (settleAction ? 'Settle' : 'Inbox row options');
      menu.title = name; menu.setAttribute('aria-label', name);
    }
  };
  update({ title: '', selected: false, disabled: false, menuDisabled: false, workState: 'idle' });
  return { row, go, label, lead, actions, menu, clock, update };
}

globalThis.CLAUDE_INBOX_ROW_UI_CSS = CLAUDE_INBOX_ROW_UI_CSS;
globalThis.createClaudeInboxRowUI = createClaudeInboxRowUI;
