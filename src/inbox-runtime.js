// Standalone block: bundled by the parent plugin. No imports or network access.
const CLAUDE_INBOX_STORE = 'inbox-state-v1';


function claudeInboxScope(scope) {
  if (!scope || typeof scope.profile !== 'string' || !scope.profile) return null;
  if (typeof scope.connectionId !== 'string') return null;
  return { connectionId: scope.connectionId, profile: scope.profile };
}

function claudeInboxId(session) {
  const id = typeof session === 'string' ? session : session?.id ?? session?.session_id;
  return typeof id === 'string' && id ? id : null;
}

function claudeInboxOwnedBy(scope, session) {
  return !!scope && (!session?.profile || session.profile === scope.profile) &&
    (session?._connection_id == null || session._connection_id === scope.connectionId) &&
    (session?.connectionId == null || session.connectionId === scope.connectionId) &&
    (session?.connection_id == null || session.connection_id === scope.connectionId);
}

function claudeInboxKey(scope, durableId) {
  const valid = claudeInboxScope(scope);
  const id = claudeInboxId(durableId);
  return valid && id ? JSON.stringify([valid.connectionId, valid.profile, id]) : null;
}

function claudeInboxWorkStatus(value) {
  const status = typeof value === 'string' ? value : value?.status ?? value?.state;
  if (status === 'resuming') return 'reading';
  if (value === true || value?.busy === true) return 'work';
  if (value === false) return 'idle';
  if (['starting', 'running', 'working', 'streaming', 'waiting', 'needs-input', 'queued'].includes(status)) return 'work';
  if (['idle', 'resuming', 'completed', 'done', 'stopped'].includes(status)) return status === 'resuming' ? 'reading' : 'idle';
  return 'unknown';
}

function createClaudeInboxModel(storage, { restoreAttention } = {}) {
  let state = { version: 1, records: {}, aliases: {} };
  let error = null;
  const listeners = new Set();
  const expired = new Map();
  const validTimestamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
  const notify = event => { for (const fn of listeners) { try { fn(event); } catch { /* A view subscriber cannot undo a saved model transaction. */ } } };
  const validKey = key => {
    try { const p = JSON.parse(key); return Array.isArray(p) && p.length === 3 && typeof p[0] === 'string' && p.slice(1).every(v => typeof v === 'string' && v); }
    catch { return false; }
  };
  // Every Hermes window with a sidebar shares this storage. The saved state is
  // read again before each write, so a write never puts back an older copy over
  // another window's Settle or Snooze.
  const read = () => {
    const raw = storage?.get?.(CLAUDE_INBOX_STORE);
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (saved == null) return null;
    const next = { version: 1, records: {}, aliases: {} };
    if (saved.version !== 1 || !saved.records || !saved.aliases) throw Error('Invalid Inbox state');
    for (const [key, record] of Object.entries(saved.records)) {
      if (!validKey(key) || !record || typeof record !== 'object') continue;
      const watermarks = {};
      for (const [id, count] of Object.entries(record.watermarks || {})) {
        if (id && Number.isSafeInteger(count) && count >= 0) Object.defineProperty(watermarks, id, { value: count, enumerable: true, writable: true, configurable: true });
      }
      next.records[key] = {
        settledAt: Number.isFinite(record.settledAt) && record.settledAt > 0 ? record.settledAt : null, watermarks,
        snoozeUntil: validTimestamp(record.snoozeUntil) ? record.snoozeUntil : null,
        snoozedAt: validTimestamp(record.snoozedAt) ? record.snoozedAt : validTimestamp(record.snoozeUntil) ? 1 : null,
        ...(record.manualSettled === true ? { manualSettled: true } : {})
      };
    }
    for (const [alias, root] of Object.entries(saved.aliases)) {
      if (!validKey(alias) || !validKey(root)) continue;
      const a = JSON.parse(alias), r = JSON.parse(root);
      if (a[0] === r[0] && a[1] === r[1] && next.records[root]) next.aliases[alias] = root;
    }
    return next;
  };
  try { state = read() || state; }
  catch { error = 'Inbox state could not be read. Settle and Snooze are unavailable until storage recovers.'; }
  // A store that cannot be read now keeps this window's last good copy.
  const refresh = () => { try { state = read() || state; } catch { /* kept */ } };

  const putCount = (record, id, count) => {
    const previous = Object.prototype.hasOwnProperty.call(record.watermarks, id) ? record.watermarks[id] : 0;
    Object.defineProperty(record.watermarks, id, { value: Math.max(previous, count), enumerable: true, writable: true, configurable: true });
  };
  const accept = (scope, session) => {
    if (!claudeInboxKey(scope, session)) return false;
    if (typeof session !== 'object' || !session) return true;
    return claudeInboxOwnedBy(scope, session);
  };
  const rootKey = (draft, scope, session) => {
    if (!accept(scope, session)) return null;
    const own = claudeInboxKey(scope, session);
    const declared = typeof session === 'object' ? claudeInboxKey(scope, session._lineage_root_id) : null;
    return draft.aliases[declared] || declared || draft.aliases[own] || own;
  };
  const associate = (draft, scope, session) => {
    const key = rootKey(draft, scope, session);
    if (!key) return null;
    const own = claudeInboxKey(scope, session);
    const ids = [claudeInboxId(session), ...(Array.isArray(session?._lineage_ids) ? session._lineage_ids : [])];
    if (session?._lineage_root_id) ids.push(session._lineage_root_id);
    const record = draft.records[key] || { settledAt: null, watermarks: {}, snoozeUntil: null, snoozedAt: null };
    // A lineage discovered after settling retains its prior durable record.
    for (const id of ids) {
      const alias = claudeInboxKey(scope, id);
      if (!alias) continue;
      const priorKey = draft.aliases[alias] || alias;
      const prior = draft.records[priorKey];
      if (prior && prior !== record) {
        record.settledAt = Math.max(record.settledAt || 0, prior.settledAt || 0) || null;
        if (prior.settledAt && prior.manualSettled === true) record.manualSettled = true;
        // Keep the most recent explicit duration/cancellation when lineage arrives late.
        if ((prior.snoozedAt || 0) > (record.snoozedAt || 0) ||
            (prior.snoozedAt && prior.snoozedAt === record.snoozedAt && !prior.snoozeUntil)) {
          record.snoozeUntil = prior.snoozeUntil; record.snoozedAt = prior.snoozedAt;
        }
        for (const [pid, count] of Object.entries(prior.watermarks)) putCount(record, pid, count);
        for (const [a, target] of Object.entries(draft.aliases)) if (target === priorKey) draft.aliases[a] = key;
        delete draft.records[priorKey];
      }
      draft.aliases[alias] = key;
    }
    draft.aliases[own] = key;
    draft.records[key] = record;
    return { key, record, id: claudeInboxId(session) };
  };
  const snoozeTime = draft => {
    // Millisecond ordering keeps two rapid decisions unambiguous during late lineage
    // discovery, even when the system clock moves backwards between those decisions.
    let at = Date.now();
    for (const record of Object.values(draft.records)) at = Math.max(at, (record.snoozedAt || 0) + 1);
    return Math.min(at, 8640000000000000);
  };
  const transaction = (change, event) => {
    refresh();
    const draft = JSON.parse(JSON.stringify(state));
    const result = change(draft);
    if (result === false) return false;
    if (JSON.stringify(draft) === JSON.stringify(state)) {
      // A repeated manual decision still fences earlier queued work, even
      // when it saves identical bytes within the same clock millisecond.
      if (event) notify(event);
      return result;
    }
    try {
      if (typeof storage?.set !== 'function') throw Error('Storage unavailable');
      storage.set(CLAUDE_INBOX_STORE, draft);
      // The desktop SDK can silently swallow quota/permission errors. A write is
      // committed only after an exact structural readback, including string stores.
      const saved = storage.get?.(CLAUDE_INBOX_STORE);
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
      if (canonical(parsed) !== canonical(draft)) throw Error('Inbox storage readback failed');
      state = draft;
      error = null;
      notify(event);
      return result;
    } catch {
      error = 'Inbox state could not be saved. No Inbox changes were applied.';
      notify();
      return false;
    }
  };
  return {
    key: (scope, session) => rootKey(state, scope, session),
    isSettled(scope, session) { const key = rootKey(state, scope, session); return !!(key && state.records[key]?.settledAt); },
    isManualSettled(scope, session) { const key = rootKey(state, scope, session); return !!(key && state.records[key]?.settledAt && state.records[key].manualSettled === true); },
    snoozedUntil(scope, session) { const key = rootKey(state, scope, session); return key && state.records[key]?.snoozeUntil || null; },
    isSnoozed(scope, session, now = Date.now()) {
      const key = rootKey(state, scope, session);
      return !!(key && state.records[key]?.snoozeUntil > now);
    },
    snooze(scope, session, until) {
      if (!validTimestamp(until) || until <= Date.now()) return false;
      return transaction(draft => {
        const item = associate(draft, scope, session);
        if (!item) return false;
        item.record.snoozeUntil = until; item.record.snoozedAt = snoozeTime(draft);
        return true;
      });
    },
    cancelSnooze(scope, session) {
      const restoreKey = rootKey(state, scope, session);
      if (state.records[restoreKey]?.snoozeUntil && restoreAttention?.(scope, session) === false) { notify(); return false; }
      return transaction(draft => {
        const key = rootKey(draft, scope, session);
        if (!key) return false;
        if (draft.records[key]?.snoozeUntil) {
          draft.records[key].snoozeUntil = null; draft.records[key].snoozedAt = snoozeTime(draft);
        }
        return true;
      });
    },
    nextSnoozeDeadline(now = Date.now()) {
      let next = null;
      for (const record of Object.values(state.records)) {
        if (record.snoozeUntil > now && (next === null || record.snoozeUntil < next)) next = record.snoozeUntil;
      }
      return next;
    },
    // Runtime-owned timers call this on expiry/resume. No persistence write is needed:
    // isSnoozed always reads the wall clock, and subscribe wakes native React badges.
    expireSnoozes(now = Date.now()) {
      let changed = false;
      for (const [key, record] of Object.entries(state.records)) {
        const token = JSON.stringify([record.snoozedAt, record.snoozeUntil]);
        if (record.snoozeUntil && record.snoozeUntil <= now && expired.get(key) !== token) {
          expired.set(key, token); changed = true;
        }
      }
      if (changed) notify();
      return changed;
    },
    settle(scope, session, options = {}) {
      return transaction(draft => {
        const item = associate(draft, scope, session);
        if (!item) return false;
        const count = session?.message_count;
        if (Number.isSafeInteger(count) && count >= 0) putCount(item.record, item.id, count);
        item.record.settledAt = Date.now();
        if (options.manual === true) item.record.manualSettled = true;
        else delete item.record.manualSettled;
        return true;
      }, options.manual === true ? { type: 'manual-settle', scope, session } : undefined);
    },
    unsettle(scope, session) {
      const restoreKey = rootKey(state, scope, session);
      if (state.records[restoreKey]?.settledAt && restoreAttention?.(scope, session) === false) { notify(); return false; }
      return transaction(draft => {
        const key = rootKey(draft, scope, session);
        if (!key) return false;
        if (draft.records[key]) { draft.records[key].settledAt = null; delete draft.records[key].manualSettled; }
        return true;
      });
    },
    reopen(scope, session) {
      if (restoreAttention?.(scope, session) === false) { notify(); return false; }
      return transaction(draft => {
        const item = associate(draft, scope, session);
        if (!item) return false;
        item.record.settledAt = null; delete item.record.manualSettled;
        if (item.record.snoozeUntil) {
          item.record.snoozeUntil = null; item.record.snoozedAt = snoozeTime(draft);
        }
        return true;
      });
    },
    ingest(scope, sessions = [], options = {}) {
      if (!claudeInboxScope(scope)) return false;
      return transaction(draft => {
        for (const session of sessions) {
          const item = associate(draft, scope, session);
          if (!item) continue;
          const count = session?.message_count;
          if (Number.isSafeInteger(count) && count >= 0) {
            const previous = Object.prototype.hasOwnProperty.call(item.record.watermarks, item.id) ? item.record.watermarks[item.id] : undefined;
            if (previous !== undefined && count > previous && item.record.manualSettled !== true) item.record.settledAt = null;
            putCount(item.record, item.id, count);
          }
        }
        for (const session of options.liveSessions || []) {
          if (!accept(scope, session) || claudeInboxWorkStatus(session) !== 'work') continue;
          const item = associate(draft, scope, session);
          if (item && item.record.manualSettled !== true) item.record.settledAt = null;
        }
        return true;
      });
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get error() { return error; }
  };
}

// Current routing and immutable creation surfaces may differ after a resume.
// Unknown/new source kinds require an explicit compatibility review, not a guess.
function claudeInboxSource(session) {
  if (!session || typeof session !== 'object') return 'unknown';
  const source = session.source, created = session.created_source;
  if (source === 'cron' || created === 'cron') return 'cron';
  const known = ['desktop', 'tui', 'cli', 'web', 'local', 'api', 'api_server', 'tool', 'subagent', 'kanban',
    'telegram', 'discord', 'whatsapp', 'whatsapp_cloud', 'slack', 'signal', 'mattermost', 'matrix',
    'homeassistant', 'email', 'sms', 'dingtalk', 'webhook', 'msgraph_webhook', 'feishu', 'wecom',
    'wecom_callback', 'weixin', 'bluebubbles', 'qqbot', 'yuanbao', 'relay',
    'line', 'teams', 'ntfy', 'simplex', 'irc', 'a2a', 'raft', 'buzz', 'photon', 'google_chat'];
  if (!known.includes(source) || created != null && !known.includes(created)) return 'unknown';
  return 'noncron';
}

// v1 admissions mixed creation/open/work and cannot certify which happened.
// Keep that store untouched as a backup; v2 starts with verified work only.
// User Settle/Snooze records and aliases live in their unchanged separate store.
function createClaudeInboxAdmission(storage, model) {
  const storeKey = 'inbox-admission-v2';
  let state = { version: 2, admitted: {}, blocked: {} }, error = null, readable = false;
  const pendingAdmissions = new Map(), blocked = new Set(), sources = new Map();
  const scopeKey = scope => { const valid = claudeInboxScope(scope); return valid ? JSON.stringify([valid.connectionId, valid.profile]) : null; };
  const validKey = (key, length) => {
    try { const tuple = JSON.parse(key); return Array.isArray(tuple) && tuple.length === length && typeof tuple[0] === 'string' && tuple.slice(1).every(v => typeof v === 'string' && v); }
    catch { return false; }
  };
  const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
  const load = () => {
    try {
      if (typeof storage?.get !== 'function') throw Error('Storage unavailable');
      const raw = storage.get(storeKey), saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (saved != null) {
        const objectMap = value => value && typeof value === 'object' && !Array.isArray(value);
        if (saved.version !== 2 || !objectMap(saved.admitted) || !objectMap(saved.blocked)) throw Error('Invalid Inbox admission');
        for (const records of [saved.admitted, saved.blocked]) {
          for (const [key, value] of Object.entries(records)) if (!validKey(key, 3) || value !== true) throw Error('Invalid Inbox admission');
        }
        state = JSON.parse(JSON.stringify(saved));
        Object.keys(state.blocked).forEach(key => blocked.add(key));
      }
      readable = true; error = null; return true;
    } catch {
      readable = false; error = 'Inbox admission could not be read. Historical chats remain excluded until storage recovers.'; return false;
    }
  };
  load();
  const ids = session => [...new Set([claudeInboxId(session), session?._lineage_root_id,
    ...(Array.isArray(session?._lineage_ids) ? session._lineage_ids : [])].filter(id => typeof id === 'string' && id))];
  const keys = (scope, session) => [...new Set([...ids(session).map(id => claudeInboxKey(scope, id)), model?.key(scope, session)].filter(Boolean))];
  const allowed = (scope, session) => {
    if (!scopeKey(scope) || !claudeInboxOwnedBy(scope, session)) return false;
    const rowKeys = keys(scope, session);
    if (!rowKeys.length || rowKeys.some(key => blocked.has(key) || state.blocked[key])) return false;
    // Strings and captured Undo identities use known, already verified work.
    // A full metadata row cannot borrow a previous safe classification.
    if (session && typeof session === 'object' && Object.hasOwn(session, 'source')) {
      if (claudeInboxSource(session) !== 'noncron') return false;
    } else if (session && typeof session === 'object' && Object.keys(session).some(key =>
      !['id', 'session_id', 'profile', 'connectionId', 'connection_id', '_connection_id', '_lineage_root_id', '_lineage_ids'].includes(key))) return false;
    return !rowKeys.some(key => sources.has(key) && sources.get(key) !== 'noncron');
  };
  const eligible = (draft, scope, session) => allowed(scope, session) && keys(scope, session).some(key => draft.admitted[key] === true);
  const recordSessionIds = (scope, records) => {
    if (!readable || !scopeKey(scope)) return [];
    const owner = scopeKey(scope), ids = new Map();
    for (const key of Object.keys(records)) {
      const tuple = JSON.parse(key);
      if (JSON.stringify(tuple.slice(0, 2)) === owner) ids.set(model?.key(scope, tuple[2]) || key, tuple[2]);
    }
    return [...ids.values()];
  };
  return {
    cutoff: () => null,
    isEligible: (scope, session) => readable && eligible(state, scope, session),
    restore: (scope, session) => readable && eligible(state, scope, session),
    explicitSessionIds() { return []; },
    admittedSessionIds(scope) { return recordSessionIds(scope, state.admitted).filter(id => allowed(scope, id)); },
    observe(scope, sessions = [], options = {}) {
      const owner = scopeKey(scope);
      if (!owner) return false;
      if (!pendingAdmissions.has(owner)) pendingAdmissions.set(owner, new Set());
      const pending = pendingAdmissions.get(owner), working = new Set();
      // Classify the complete snapshot before admitting anything. Cron taint
      // follows only supported lineage/aliases, including late discovery.
      const rows = sessions.filter(session => claudeInboxId(session) && claudeInboxOwnedBy(scope, session));
      const classifications = new Map(), provenance = new Map();
      for (const session of rows) {
        const source = claudeInboxSource(session);
        for (const key of keys(scope, session)) {
          const prior = classifications.get(key);
          const conflict = prior === 'noncron' && source === 'noncron' && provenance.get(key) !== session.source;
          classifications.set(key, prior === 'cron' || source === 'cron' ? 'cron' : conflict || prior && prior !== source ? 'unknown' : source);
          if (!provenance.has(key)) provenance.set(key, session.source);
        }
      }
      classifications.forEach((source, key) => { sources.set(key, source); if (source === 'cron') blocked.add(key); });
      let changed;
      do {
        changed = false;
        for (const session of rows) {
          const rowKeys = keys(scope, session);
          if (rowKeys.some(key => blocked.has(key))) for (const key of rowKeys) if (!blocked.has(key)) { blocked.add(key); changed = true; }
        }
      } while (changed);
      for (const session of options.workingSessions || []) if (allowed(scope, session) && claudeInboxSource(session) === 'noncron') keys(scope, session).forEach(key => working.add(key));
      for (const live of options.liveSessions || []) {
        if (!claudeInboxOwnedBy(scope, live) || claudeInboxWorkStatus(live) !== 'work') continue;
        const liveIds = [...ids(live), live.session_key, live.stored_session_id].filter(Boolean);
        // Do not invent a durable chat from a transient runtime ID.
        for (const row of rows) if (allowed(scope, row) && claudeInboxSource(row) === 'noncron' && ids(row).some(id => liveIds.includes(id))) keys(scope, row).forEach(key => working.add(key));
      }
      // Keep verified work intent pending across a failed save and subsequent
      // idle refresh. It is still excluded until a durable readback succeeds.
      working.forEach(key => pending.add(key));
      // Re-read first: another Hermes window may have admitted or blocked
      // threads since, and this draft replaces the whole saved value.
      if (!load()) return false;
      const draft = JSON.parse(JSON.stringify(state));
      for (const session of rows) {
        if (!allowed(scope, session) || claudeInboxSource(session) !== 'noncron') continue;
        const rowKeys = keys(scope, session);
        if (eligible(draft, scope, session) || rowKeys.some(key => working.has(key))) {
          for (const key of rowKeys) { draft.admitted[key] = true; pending.add(key); }
        }
      }
      for (const key of pending) if (!blocked.has(key) && sources.get(key) === 'noncron') draft.admitted[key] = true;
      for (const key of blocked) { draft.blocked[key] = true; delete draft.admitted[key]; pending.delete(key); }
      if (canonical(draft) === canonical(state) && !error) { pending.clear(); return true; }
      try {
        if (typeof storage?.set !== 'function') throw Error('Storage unavailable');
        storage.set(storeKey, draft);
        const raw = storage.get(storeKey), saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (canonical(saved) !== canonical(draft)) throw Error('Inbox admission readback failed');
        state = draft; pending.clear(); error = null; return true;
      } catch {
        error = 'Inbox admission could not be saved. New admissions were not applied; existing attention is preserved.'; return false;
      }
    },
    get error() { return error; }
  };
}

function installClaudeInboxRuntime({ storage, host, document: doc = document, window: win = window }) {
  // Hot reload replaces only this DOM adapter, never the host's native children.
  const registryKey = '__claudeInboxRuntimeDispose';
  doc[registryKey]?.();
  let admission;
  const model = createClaudeInboxModel(storage, {
    restoreAttention: (scope, session) => admission.restore(scope, session)
  });
  admission = createClaudeInboxAdmission(storage, model);
  let on = false;
  try { on = storage?.get?.('inbox', 'off') === 'on'; } catch { /* Fail closed until the parent supplies a mode. */ }
  let disposed = false, raf = null, island = null, style = null, container = null, toasts = null;
  let deadlineTimer = null, armingDeadline = false, snoozePopup = null;
  const rowBindings = new Map();
  const settleNotices = new Map();
  const activityByKey = new Map();
  const timerHost = win.setTimeout ? win : doc.defaultView;
  const clearDeadline = () => { if (deadlineTimer !== null) timerHost.clearTimeout(deadlineTimer); deadlineTimer = null; };
  const refreshDeadline = () => {
    if (armingDeadline) return;
    armingDeadline = true;
    try {
      clearDeadline();
      if (disposed || !on) return;
      model.expireSnoozes();
      const next = model.nextSnoozeDeadline();
      if (next !== null) deadlineTimer = timerHost.setTimeout(() => {
        deadlineTimer = null; refreshDeadline(); requestRender();
      }, Math.max(1, Math.min(2147483647, next - Date.now())));
    } finally { armingDeadline = false; }
  };
  let inboxOpen = true, signature = null, currentScope = null;
  let input = { sessions: [], liveSessions: [], liveStatusKnown: false, loading: true };
  const badgeBindings = new Map();
  const settledBadgeBindings = new Map();
  const externalBindings = new Map();
  const own = 'data-claude-inbox-owned';
  const owns = node => node?.nodeType === 1 ? !!node.closest(`[${own}]`) : !!node?.parentElement?.closest(`[${own}]`);
  const setAttr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); };
  const visibleSessions = () => {
    const rows = new Map();
    for (const session of input.sessions) {
      if (!claudeInboxId(session) || session.archived || session.hidden || !claudeInboxOwnedBy(currentScope, session)) continue;
      const key = model.key(currentScope, session);
      if (!rows.has(key)) rows.set(key, session);
    }
    return [...rows.values()];
  };
  const inboxSessions = () => visibleSessions().filter(session => admission.isEligible(currentScope, session));
  const findSession = id => visibleSessions().find(s => claudeInboxId(s) === id || s._lineage_root_id === id || s._lineage_ids?.includes(id));
  const durableAliases = session => new Set([claudeInboxId(session), session?._lineage_root_id, ...(session?._lineage_ids || [])].filter(Boolean));
  const liveMatches = (session, live) => {
    const ids = durableAliases(session);
    if (Object.hasOwn(live, '_claudeInboxCanonicalId')) return typeof live._claudeInboxCanonicalId === 'string' && ids.has(live._claudeInboxCanonicalId);
    const stored = [live.session_key, live.stored_session_id, live._lineage_root_id, ...(live._lineage_ids || [])].filter(Boolean);
    // Legacy authorized fixtures may omit stored fields. Once present, they
    // identify the lineage; equality with a runtime ID is never a relationship.
    if (stored.length) return stored.some(id => ids.has(id));
    return [live.id, live.session_id].some(id => ids.has(id));
  };
  const eventSession = event => {
    if (Object.hasOwn(event, 'canonicalSessionId')) return typeof event.canonicalSessionId === 'string' && event.canonicalSessionId
      ? findSession(event.canonicalSessionId) : null;
    const id = event.session_id || event.id || event.session_key;
    return findSession(id) || visibleSessions().find(session => runtimeAliases(session).has(id));
  };
  const runtimeAliases = session => {
    const aliases = durableAliases(session);
    for (const live of input.liveSessions || []) {
      if (!claudeInboxOwnedBy(currentScope, live) || !liveMatches(session, live)) continue;
      const runtimeId = live.session_id || live.id;
      if (runtimeId) aliases.add(runtimeId);
    }
    return aliases;
  };
  const safety = (session, admissionCheck = false) => {
    let unresolved = input.liveStatusKnown !== true;
    let reading = false;
    for (const live of input.liveSessions || []) {
      if (!claudeInboxOwnedBy(currentScope, live)) continue;
      if (!liveMatches(session, live)) continue;
      const status = claudeInboxWorkStatus(live);
      if (status === 'work') return 'work';
      if (status === 'unknown') unresolved = true;
      if (status === 'reading') reading = true;
    }
    for (const id of admissionCheck && input.busyOwnerKnown === false ? [] : durableAliases(session)) {
      const busy = input.busyBySession instanceof Map ? input.busyBySession.get(id) : input.busyBySession?.[id];
      if (busy === undefined) continue;
      const status = claudeInboxWorkStatus(busy);
      if (status === 'work') return 'work';
      if (status === 'unknown') unresolved = true;
      if (status === 'reading') reading = true;
    }
    return unresolved ? 'unknown' : reading ? 'reading' : 'idle';
  };
  const freshChildSnapshot = snapshot => {
    if (typeof snapshot?.session_id !== 'string' || !snapshot.session_id || !Number.isFinite(snapshot.at) || snapshot.at <= 0 ||
        !Array.isArray(snapshot.childIds) || snapshot.childIds.some(id => typeof id !== 'string' || !id)) return null;
    const session = findSession(snapshot.session_id);
    if (!session) return null;
    const key = model.key(currentScope, session), previous = activityByKey.get(key);
    if (snapshot.at <= (previous?.childEventAt || 0) || snapshot.at <= (previous?.childSnapshotAt || 0)) return null;
    const childIds = snapshot.childIds.filter(id => !previous?.terminalChildren?.has(id) &&
      (!previous?.terminalChildrenOverflow || previous.children?.has(id) || previous.pendingChildren?.has(id)));
    return { session, key, previous, childIds };
  };
  const reconcileAdmission = () => {
    const sessions = visibleSessions(), working = input.loading || input.error || input.liveStatusKnown !== true ? [] : sessions.filter(session => safety(session, true) === 'work');
    const childWorking = input.loading || input.error || input.liveStatusKnown !== true ? [] : (input.childSnapshots || [])
      .map(freshChildSnapshot).filter(fresh => fresh?.childIds.length).map(fresh => fresh.session);
    // Rendering deduplicates lineage rows, never their source evidence. A late
    // cron ancestor/alias must taint the whole thread whichever row comes first.
    admission.observe(currentScope, input.sessions, { workingSessions: [...working, ...childWorking] });
    // Child proof admits work, not a new attention decision. Parent work keeps
    // its existing ingestion rules; child snapshots never clear Settle/Snooze.
    model.ingest(currentScope, sessions, { liveSessions: working.map(session => ({ ...session, status: 'working' })) });
  };
  const reconcileActivity = () => {
    if (input.loading || input.error) return;
    for (const session of inboxSessions()) {
      const key = model.key(currentScope, session), previous = activityByKey.get(key);
      const status = safety(session, true), newer = Number.isFinite(input.liveStatusAt) && input.liveStatusAt > (previous?.at || 0);
      // A terminal frame precedes backend cleanup. A late working snapshot
      // cannot cancel that receipt; a new positive work event can.
      if (status === 'work' && !previous?.parentFinished && !['completed', 'read'].includes(previous?.phase) && (!previous || newer)) {
        activityByKey.set(key, { ...previous, phase: 'working', at: input.liveStatusAt || Date.now(), children: previous?.children || new Set() });
      } else if (status === 'idle' && previous?.phase === 'working' && newer) {
        activityByKey.set(key, { ...previous, phase: session.unread === true ? 'completed' : 'unknown', at: input.liveStatusAt });
      }
    }
  };
  const reconcileChildActivity = () => {
    if (input.loading || input.error || input.liveStatusKnown !== true) return;
    for (const snapshot of input.childSnapshots || []) {
      // Request-start ordering fences in-flight reads against child lifecycle
      // events. Parent snapshots and attention decisions have separate clocks.
      const fresh = freshChildSnapshot(snapshot);
      if (!fresh) continue;
      const { key, previous, childIds } = fresh;
      // Native rosters omit queued spawns until registration. A fresh empty
      // roster cannot cancel that proved intent; start/complete can release it.
      const pendingChildren = new Set([...(previous?.pendingChildren || [])].filter(id => !childIds.includes(id)));
      activityByKey.set(key, { ...previous, phase: previous?.phase || 'unknown', at: previous?.at || 0,
        children: new Set([...childIds, ...pendingChildren]), pendingChildren, childSnapshotAt: snapshot.at });
    }
  };
  const viewedReply = session => {
    const owner = claudeInboxScope(host.state?.focusedSessionOwner?.get?.());
    const stored = host.state?.focusedStoredSessionId?.get?.();
    const runtime = host.state?.focusedSessionId?.get?.();
    if (!owner || !stored || !runtime || JSON.stringify(owner) !== JSON.stringify(currentScope) ||
        !runtimeAliases(session).has(stored) || doc.visibilityState !== 'visible' || !doc.hasFocus()) return false;
    const anchors = new Set([...runtimeAliases(session)].map(id => `session-tile:${id}`));
    if (host.state?.activeSessionId?.get?.() === runtime &&
        host.state?.connectionId?.get?.() === owner.connectionId && host.state?.profile?.get?.() === owner.profile) anchors.add('workspace');
    for (const surface of doc.querySelectorAll('[data-chat-surface][data-session-anchor]')) {
      if (!anchors.has(surface.getAttribute('data-session-anchor')) ||
          surface.closest('[data-pane-hidden], [inert], [aria-hidden="true"], [data-session-switching]')) continue;
      const viewport = surface.querySelector('[data-slot="aui_thread-viewport"]');
      if (!viewport || viewport.getAttribute('data-following') !== 'true') continue;
      const pair = [...viewport.querySelectorAll('[data-slot="aui_turn-pair"]')].at(-1);
      // Native footers belong to the last text reply, not a trailing tool-only bubble.
      const reply = pair && [...pair.querySelectorAll('[data-slot="aui_assistant-message-root"]')]
        .filter(root => root.closest('[data-slot="aui_turn-pair"]') === pair && root.querySelector('[data-slot="aui_msg-actions"]')).at(-1);
      if (!reply) continue;
      const bounds = viewport.getBoundingClientRect(), end = reply.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0 && end.width > 0 && end.height > 0 &&
          end.bottom > bounds.top && end.bottom <= bounds.bottom + 1 && end.right > bounds.left && end.left < bounds.right) return true;
    }
    return false;
  };
  const workState = session => {
    if (input.loading || input.error || input.liveStatusKnown !== true) return 'unknown';
    const key = model.key(currentScope, session), status = safety(session, true), activity = activityByKey.get(key);
    if (status === 'unknown') return 'unknown';
    if (activity?.children.size) return 'working';
    if (status === 'reading') return 'reading';
    if (activity?.phase === 'working') return 'working';
    if (activity?.phase === 'read') return 'idle';
    if (activity?.phase === 'unknown' && activity.parentFinished) return 'unknown';
    if (activity?.phase === 'completed' || status === 'idle' && session.unread === true) {
      if (!viewedReply(session)) return 'completed';
      // Reading acknowledges this reply's paint only. It never settles,
      // snoozes or admits a thread, and fresh work resets the receipt.
      activityByKey.set(key, { ...activity, phase: 'read', at: activity?.at || Date.now(), children: activity?.children || new Set() });
      return 'idle';
    }
    if (status === 'work' && !activity?.parentFinished) return 'working';
    if (activity?.phase === 'unknown') return 'unknown';
    // Native unread marks a completed reply. Merely idle/busy:false does not.
    return session.unread === true ? 'completed' : 'idle';
  };
  const requestRender = () => {
    if (!disposed && raf === null) raf = win.requestAnimationFrame(() => { raf = null; render(); });
  };
  const button = (label, handler) => {
    const el = doc.createElement('button');
    el.type = 'button'; el.textContent = label; el.addEventListener('click', handler);
    return el;
  };
  const stop = event => { event.preventDefault(); event.stopPropagation(); };
  // Hermes takes an open that names a route for a cross-connection one and an
  // open that names a profile for a cross-profile one; both switch its sidebar
  // to All profiles and save that. A thread of the active connection and
  // profile opens the way a native row does, naming neither.
  const routeOptions = () => {
    const connection = String(host.state?.connectionId?.get?.() || host.activeConnectionId?.() || '');
    if (connection !== currentScope.connectionId) return { profile: currentScope.profile, route: { ...currentScope } };
    return String(host.state?.profile?.get?.() || 'default') === currentScope.profile ? {} : { profile: currentScope.profile };
  };
  const open = session => { if (!disposed && on && currentScope && claudeInboxOwnedBy(currentScope, session)) host.openSession?.(claudeInboxId(session), routeOptions()); };
  const active = session => {
    const stored = host.state?.focusedStoredSessionId?.get?.();
    const id = stored || host.state?.activeSessionId?.get?.();
    const focusedOwner = host.state?.focusedSessionOwner?.get?.();
    if (focusedOwner != null) {
      const owner = claudeInboxScope(focusedOwner);
      if (!owner || owner.profile !== currentScope.profile || owner.connectionId !== currentScope.connectionId) return false;
    } else {
      const profile = host.state?.focusedSessionProfile?.get?.() || host.state?.profile?.get?.();
      const connection = host.state?.connectionId?.get?.();
      if (profile && profile !== currentScope.profile || typeof connection === 'string' && connection !== currentScope.connectionId) return false;
    }
    return !!id && runtimeAliases(session).has(id);
  };
  const removeFromInbox = (session, save) => {
    const isCurrent = active(session);
    const all = inboxSessions();
    const index = all.findIndex(s => model.key(currentScope, s) === model.key(currentScope, session));
    const following = [...all.slice(index + 1), ...all.slice(0, Math.max(0, index))];
    const candidates = following.filter(s => model.key(currentScope, s) !== model.key(currentScope, session) && !model.isSettled(currentScope, s) && !model.isSnoozed(currentScope, s));
    if (!save()) return false;
    if (isCurrent) {
      if (candidates.length) open(candidates[0]);
      else host.newChat?.({ ...currentScope });
    }
    requestRender();
    return true;
  };
  const sameScope = scope => JSON.stringify(claudeInboxScope(scope)) === JSON.stringify(currentScope);
  const clearSettleNotice = item => {
    if (settleNotices.get(item.key) !== item) return;
    timerHost.clearTimeout(item.timer); settleNotices.delete(item.key);
  };
  const clearSettleNotices = () => { for (const item of settleNotices.values()) clearSettleNotice(item); };
  const undoSettle = item => {
    if (disposed || !on || !sameScope(item.scope) || settleNotices.get(item.key) !== item) return false;
    // Check the deadline in the handler too: sleeping/throttled timers confer no
    // extra time. The captured owner and durable identity never follow new focus.
    if (Date.now() >= item.until) { clearSettleNotice(item); requestRender(); return false; }
    if (!model.unsettle(item.scope, item.session)) { requestRender(); return false; }
    clearSettleNotice(item); requestRender(); return true;
  };
  const settle = session => {
    if (disposed || !on || !currentScope || !claudeInboxOwnedBy(currentScope, session)) return false;
    const fresh = findSession(claudeInboxId(session));
    if (!fresh || claudeInboxId(fresh) !== claudeInboxId(session) || !admission.isEligible(currentScope, fresh) ||
        model.isSettled(currentScope, fresh) || model.isSnoozed(currentScope, fresh)) return false;
    const scope = { ...currentScope };
    const result = removeFromInbox(fresh, () => {
      if (!model.settle(scope, fresh, { manual: true })) return false;
      const key = model.key(scope, fresh);
      clearSettleNotices();
      const captured = { id: claudeInboxId(fresh), ...scope };
      if (fresh._lineage_root_id) captured._lineage_root_id = fresh._lineage_root_id;
      if (Array.isArray(fresh._lineage_ids)) captured._lineage_ids = [...fresh._lineage_ids];
      // Claude's toasts stay at least 6s and name what changed.
      const title = typeof fresh.title === 'string' && fresh.title ? fresh.title : 'Untitled thread';
      const item = { key, scope, session: captured, title, until: Date.now() + 6000, timer: null };
      settleNotices.set(key, item);
      item.timer = timerHost.setTimeout(() => { clearSettleNotice(item); requestRender(); }, 6000);
      return true;
    });
    if (result) render();
    return result;
  };
  const snooze = (session, until, scope = currentScope) => {
    if (disposed || !on || !currentScope || !sameScope(scope) || input.loading || input.error ||
        !claudeInboxOwnedBy(currentScope, session) || model.isSettled(currentScope, session)) return false;
    const fresh = findSession(claudeInboxId(session));
    return fresh ? removeFromInbox(fresh, () => model.snooze(currentScope, fresh, until)) : false;
  };
  const cancelSnooze = (session, scope = currentScope) => {
    if (disposed || !on || !currentScope || !sameScope(scope)) return false;
    return model.cancelSnooze(currentScope, session);
  };
  const closeSnoozePopup = (restoreFocus = true) => {
    const item = snoozePopup;
    if (!item) return;
    snoozePopup = null; item.element.remove();
    item.anchor.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', item.outside, true);
    doc.removeEventListener('keydown', item.keydown, true);
    win.removeEventListener?.('resize', item.position);
    doc.removeEventListener('scroll', item.position, true);
    if (restoreFocus && item.anchor.isConnected) item.anchor.focus();
  };
  const rowSession = row => {
    const binding = rowBindings.get(row.getAttribute('data-claude-inbox-key'));
    return !disposed && on && binding?.row === row && row.isConnected && sameScope(binding.scope) ? findSession(binding.id) : null;
  };
  const showSnoozePopup = (session, anchor, event) => {
    if (disposed || !on || !currentScope || input.loading || input.error) return;
    if (snoozePopup?.anchor === anchor) {
      const pointer = event?.detail > 0;
      closeSnoozePopup(!pointer);
      if (pointer && doc.activeElement === anchor) anchor.blur();
      return;
    }
    closeSnoozePopup(false);
    const element = doc.createElement('div');
    element.setAttribute(own, 'popup'); element.setAttribute('data-claude-inbox-snooze-popup', '');
    element.setAttribute('role', 'menu'); element.setAttribute('aria-label', 'Snooze thread');
    const item = { element, anchor, id: claudeInboxId(session), scope: { ...currentScope } };
    snoozePopup = item; anchor.setAttribute('aria-expanded', 'true');
    const choose = duration => {
      if (snoozePopup !== item || !sameScope(item.scope) || disposed || !on) return;
      const fresh = findSession(item.id);
      if (fresh && snooze(fresh, Date.now() + duration, item.scope)) closeSnoozePopup(false);
      // A failed save keeps this exact menu open. Errors paint in the Inbox,
      // never as extra menu options, fields or a footer.
      else requestRender();
    };
    const controls = [];
    for (const [label, duration] of [['15 min', 900000], ['30 min', 1800000], ['1 hour', 3600000], ['3 hours', 10800000], ['1 day', 86400000]]) {
      const option = button(label, event => { stop(event); choose(duration); });
      option.setAttribute('role', 'menuitem'); option.tabIndex = -1;
      option.addEventListener('pointermove', () => {
        if (snoozePopup === item && doc.activeElement !== option) option.focus({ preventScroll: true });
      });
      controls.push(option); element.appendChild(option);
    }
    item.position = () => {
      const rect = anchor.getBoundingClientRect();
      const view = doc.defaultView;
      element.style.maxWidth = `${Math.max(0, view.innerWidth - 16)}px`;
      const width = element.getBoundingClientRect().width;
      element.style.left = `${Math.max(8, Math.min(rect.right - width, view.innerWidth - width - 8))}px`;
      const height = element.getBoundingClientRect().height;
      element.style.top = `${Math.max(8, Math.min(rect.bottom + 4, view.innerHeight - height - 8))}px`;
    };
    item.outside = event => { if (!element.contains(event.target) && !anchor.contains(event.target)) closeSnoozePopup(false); };
    item.keydown = event => {
      // Dismissal never cancels the host's original event or steals an outside
      // click. Only menu-owned navigation/activation consumes a key.
      if (event.key === 'Escape') { closeSnoozePopup(element.contains(doc.activeElement)); return; }
      if (!element.contains(event.target)) return;
      if (event.key === 'Tab') { closeSnoozePopup(false); return; }
      const index = controls.indexOf(doc.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        stop(event);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 :
          (Math.max(0, index) + (event.key === 'ArrowDown' ? 1 : controls.length - 1)) % controls.length;
        controls[next].focus();
      } else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) {
        stop(event); if (!event.repeat) controls[index].click();
      }
    };
    doc.body.appendChild(element); item.position();
    doc.addEventListener('pointerdown', item.outside, true); doc.addEventListener('keydown', item.keydown, true);
    win.addEventListener?.('resize', item.position); doc.addEventListener('scroll', item.position, true);
    element.querySelector('button')?.focus();
  };
  const cleanupDOM = () => {
    closeSnoozePopup(false); clearSettleNotices(); rowBindings.clear();
    island?.remove(); island = null; signature = null; container = null;
    toasts?.remove(); toasts = null;
    style?.remove(); style = null;
    for (const badge of badgeBindings.values()) badge.remove();
    badgeBindings.clear();
    for (const badge of settledBadgeBindings.values()) badge.remove();
    settledBadgeBindings.clear();
  };
  const nativeHeaderTemplate = root => {
    // Copy only a native header button and its wrapper, never rows, actions,
    // React ownership, or native listeners. Structural matching is locale-safe.
    let wrapper, header;
    for (const section of root.children) {
      if (owns(section) || !section.matches('[data-slot="sidebar-group"]')) continue;
      const candidate = [...section.children].find(el => el.classList.contains('group/section'));
      const source = [...(candidate?.children || [])].find(el => el.matches('button') && el.classList.contains('group/section-label'));
      if (!source?.querySelector('.dither') || !source.querySelector('.codicon-chevron-right') || !source.querySelector('.dither').parentElement.querySelector('.truncate')) continue;
      wrapper = candidate.cloneNode(false); header = source.cloneNode(true); break;
    }
    if (!header) {
      // Exact installed SidebarSectionHeader / SidebarPanelLabel / DisclosureCaret
      // shape, until native Pinned or Sessions mounts. Its classes inherit host fonts.
      wrapper = doc.createElement('div');
      wrapper.className = 'group/section flex shrink-0 items-center justify-between gap-1 pb-1 pt-1.5';
      header = doc.createElement('button');
      header.className = 'group/section-label flex w-fit min-w-0 items-center gap-1 bg-transparent text-left leading-none';
      const label = doc.createElement('span');
      label.className = 'flex min-w-0 items-center gap-2 pl-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary)';
      const dot = doc.createElement('span'); dot.setAttribute('aria-hidden', 'true'); dot.className = 'dither inline-block size-2 shrink-0 rounded-[1px]';
      const text = doc.createElement('span'); text.className = 'min-w-0 truncate leading-none';
      label.append(dot, text);
      const caret = doc.createElement('i'); caret.setAttribute('aria-hidden', 'true'); caret.style.fontSize = '0.75rem';
      caret.className = 'codicon codicon-chevron-right shrink-0 duration-150 text-(--ui-text-tertiary) opacity-0 transition group-hover/section-label:opacity-100';
      header.append(label, caret);
    }
    wrapper.appendChild(header);
    for (const node of [wrapper, ...wrapper.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (/^on/i.test(attr.name) || attr.name === 'id' || attr.name.startsWith('data-claude-inbox-') || ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-expanded', 'title'].includes(attr.name)) node.removeAttribute(attr.name);
      }
    }
    header.type = 'button'; header.removeAttribute('disabled');
    header.querySelector('.dither').parentElement.querySelector('.truncate').textContent = 'Inbox';
    header.querySelector('.codicon-chevron-right').classList.remove('rotate-90');
    return { wrapper, header, fingerprint: wrapper.outerHTML };
  };
  const ensureStyle = () => {
    if (style?.isConnected) return;
    style = doc.createElement('style'); style.setAttribute(own, 'style');
    style.textContent = CLAUDE_INBOX_ROW_UI_CSS + `
/* Native Sessions keeps a growing, minimum-height viewport even when closed.
   Allocate the remaining height to Inbox; cap native lists without moving or
   rewriting their React-owned nodes. Removing the island restores the host. */
html[data-claude-chat-look='true'] [data-sessions-mode]:has(> [data-claude-inbox-owned='island']) { overflow:hidden; }
html[data-claude-chat-look='true'] [data-sessions-mode]:has(> [data-claude-inbox-owned='island']) > [data-slot='sidebar-group']:not([data-claude-inbox-owned]) { flex:0 1 auto!important; min-height:0!important; max-height:35%; overflow:hidden; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] + [data-slot='sidebar-group'] { margin-top:auto; }
html[data-claude-chat-look='true'] [data-sessions-mode]:has(> [data-claude-inbox-owned='island']) > [data-slot='sidebar-group']:not([data-claude-inbox-owned]) > [data-slot='sidebar-group-content'] { min-height:0; overflow-y:auto; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] { flex:1 1 0; min-height:3.5rem; color:var(--ui-text-primary); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'][data-claude-inbox-expanded='false'] { flex:0 0 auto; min-height:0; padding-bottom:0; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] > [data-slot='sidebar-group-content'] { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] > [data-slot='sidebar-group-content'][hidden] { display:none!important; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)) { color:inherit; background:transparent; border:0; cursor:pointer; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)):not([data-claude-inbox-header]):hover { background:var(--ui-control-hover-background); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)):focus-visible { outline:1px solid var(--ui-accent); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)):disabled { color:var(--ui-text-quaternary); cursor:default; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge'] { display:inline-flex; font-size:10px; padding:1px 4px; color:var(--ui-text-tertiary); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge'] .claude-inbox-unsettle { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:hover .claude-inbox-settled,
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:focus-within .claude-inbox-settled { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:hover .claude-inbox-unsettle,
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:focus-within .claude-inbox-unsettle { display:inline; }
html[data-claude-chat-look='true'] [data-claude-inbox-status] { padding:6px 8px; font-size:11px; color:var(--ui-text-tertiary); }
/* Settle's Undo: Claude's toast ("Unpinned {name}" + Undo), bottom right where
   the skin raises Hermes' own toasts above the composer; no progress bar. */
html[data-claude-chat-look='true'] [data-claude-inbox-owned='toasts'] { position:fixed; right:16px; bottom:96px; z-index:var(--z-modal-popover, 140); display:flex; flex-direction:column; gap:8px; width:min(360px, calc(100vw - 32px)); pointer-events:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] { box-sizing:border-box; display:flex; align-items:center; gap:8px; padding:12px 8px 12px 12px; border-radius:10px; background:var(--claude-menu-background, var(--ui-bg-elevated)); box-shadow:0 0 0 1px var(--claude-menu-border, var(--ui-stroke-secondary)), 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 32%)); color:var(--claude-color-text, var(--ui-text-primary)); font:13px/19px var(--font-sans, system-ui); pointer-events:auto; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] > span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button { flex:none; height:24px; padding:0 8px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-weight:500; cursor:pointer; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button:hover { background:var(--claude-menu-hover, var(--ui-control-hover-background)); }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button:focus-visible { outline:1px solid var(--ui-accent); }
/* Claude's compact session list: 28px rows 2px apart on the sidebar's hover
   fill, titles secondary until selected and fading out rather than cut with an
   ellipsis (the controls have their own column, so the fade ends at its edge),
   6px controls muted until hovered. */
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] { --claude-sidebar-hover:var(--claude-account-hover, var(--ui-row-hover-background)); min-height:3.75rem; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] { min-height:28px; height:28px; margin-bottom:2px; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] [data-claude-inbox-label] { line-height:20px; text-overflow:clip; -webkit-mask-image:linear-gradient(to right, #000 calc(100% - 24px), transparent); mask-image:linear-gradient(to right, #000 calc(100% - 24px), transparent); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui].row-hover:not([data-active='true']) [data-claude-inbox-label][class*='text-[0.8125rem]'] { color:var(--claude-sidebar-text, var(--claude-color-text-secondary, var(--ui-text-secondary))) !important; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] > [data-row-actions] > button { border-radius:6px; color:var(--claude-color-text-tertiary, var(--ui-text-tertiary)); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] > [data-row-actions] > button:hover { background:color-mix(in srgb, var(--claude-color-text, var(--ui-text-primary)) 7.5%, transparent); color:var(--claude-color-text, var(--ui-text-primary)); }
/* Running is Claude's muted dot blinking (no ring round the row), every dot in
   step; finished-unseen is the accent dot. */
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] > [data-claude-inbox-running-arc] { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot] { background:var(--claude-color-text-tertiary, var(--ui-text-tertiary)); animation:claude-inbox-dot-blink 1.2s ease-in-out infinite; animation-delay:var(--claude-inbox-dot-phase, 0ms); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui][data-work-state='completed'] [data-claude-inbox-work-dot] { background:var(--ui-accent, var(--ui-success)); }
@keyframes claude-inbox-dot-blink { 0%, 100% { opacity:.3; } 50% { opacity:1; } }
@media(prefers-reduced-motion:reduce) { html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot] { animation:none; } }
/* Snooze menu: Claude's menu (10px corners, 4px gutter, ring and shadow, 24px
   rows of 13px type). */
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] { position:fixed; z-index:var(--z-modal-popover, 140); box-sizing:border-box; display:flex; flex-direction:column; min-width:128px; max-height:calc(100vh - 16px); overflow:auto; padding:4px; border:0; border-radius:10px; background:var(--claude-menu-background, var(--ui-bg-elevated)); backdrop-filter:none; box-shadow:0 0 0 1px var(--claude-menu-border, var(--ui-stroke-secondary)), 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 32%)), 0 2px 6px rgb(0 0 0 / 20%); color:var(--claude-color-text, var(--ui-text-primary)); font:13px/19px var(--font-sans, system-ui); }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] button { box-sizing:border-box; height:24px; padding:2.5px 8px; border-radius:6px; font:inherit; line-height:19px; text-align:left; white-space:nowrap; }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] button:is(:hover,:focus) { background:var(--claude-menu-hover, var(--ui-control-active-background)); color:var(--claude-color-text, var(--ui-text-primary)); }
`;
    (doc.head || doc.documentElement).appendChild(style);
  };
  const nativeSession = row => {
    const bound = externalBindings.get(row);
    return bound && bound.scope.connectionId === currentScope.connectionId && bound.scope.profile === currentScope.profile &&
      admission.isEligible(currentScope, bound.session) ? bound.session : null;
  };
  const renderBadges = root => {
    // Explicit opt-in bindings only. The shipping parent uses SESSION_ROW_AREAS;
    // do not infer identity from native labels, DOM order or conversation anchors.
    const rows = new Set(externalBindings.keys());
    for (const [row, badge] of settledBadgeBindings) {
      const session = rows.has(row) && row.isConnected && root.contains(row) && nativeSession(row);
      if (!session || !model.isSettled(currentScope, session) || !model.isSnoozed(currentScope, session)) { badge.remove(); settledBadgeBindings.delete(row); }
    }
    for (const [row, badge] of badgeBindings) {
      const session = rows.has(row) && row.isConnected && root.contains(row) && nativeSession(row);
      if (!session || !model.isSettled(currentScope, session) && !model.isSnoozed(currentScope, session)) { badge.remove(); badgeBindings.delete(row); }
    }
    for (const row of rows) {
      if (!root.contains(row) || owns(row)) continue;
      const session = nativeSession(row);
      const snoozed = session && model.isSnoozed(currentScope, session);
      if (!session || !model.isSettled(currentScope, session) && !snoozed) continue;
      let badge = badgeBindings.get(row);
      if (!badge?.isConnected) {
        badge?.remove();
        const scope = { ...currentScope };
        badge = button('', event => {
          stop(event);
          if (disposed || !on || !sameScope(scope)) return;
          const fresh = nativeSession(row);
          if (fresh) {
            if (model.isSnoozed(currentScope, fresh)) cancelSnooze(fresh, scope);
            else model.unsettle(currentScope, fresh);
          }
        });
        badge.setAttribute(own, 'badge');
        const label = doc.createElement('span'); label.className = 'claude-inbox-settled';
        const action = doc.createElement('span'); action.className = 'claude-inbox-unsettle';
        badge.append(label, action);
        const target = row.querySelector('[data-row-actions]') || row;
        // Never nest a button inside a native button; use an explicit sibling slot.
        if (target.closest('button')) continue;
        target.appendChild(badge); badgeBindings.set(row, badge);
      }
      const label = badge.querySelector('.claude-inbox-settled'), action = badge.querySelector('.claude-inbox-unsettle');
      const name = snoozed ? 'Wake now' : 'Un-settle', text = snoozed ? 'Snoozed' : 'Settled';
      if (label.textContent !== text) label.textContent = text;
      if (action.textContent !== name) action.textContent = name;
      setAttr(badge, 'aria-label', name);
      const title = snoozed ? `Snoozed until ${new Date(model.snoozedUntil(currentScope, session)).toLocaleString()}. Wake now` : name;
      if (badge.title !== title) badge.title = title;
      // Both states remain independently reversible, including while snoozed.
      if (snoozed && model.isSettled(currentScope, session)) {
        let settledBadge = settledBadgeBindings.get(row);
        if (!settledBadge?.isConnected) {
          settledBadge?.remove();
          const scope = { ...currentScope };
          settledBadge = button('', event => {
            stop(event);
            if (disposed || !on || !sameScope(scope)) return;
            const fresh = nativeSession(row); if (fresh) model.unsettle(currentScope, fresh);
          });
          settledBadge.setAttribute(own, 'badge'); settledBadge.setAttribute('aria-label', 'Un-settle'); settledBadge.title = 'Un-settle';
          const label = doc.createElement('span'); label.className = 'claude-inbox-settled'; label.textContent = 'Settled';
          const action = doc.createElement('span'); action.className = 'claude-inbox-unsettle'; action.textContent = 'Un-settle';
          settledBadge.append(label, action); badge.parentElement.appendChild(settledBadge); settledBadgeBindings.set(row, settledBadge);
        }
      }
    }
  };
  function render() {
    if (disposed) return;
    if (!on || !currentScope) { cleanupDOM(); return; }
    const root = doc.querySelector('[data-sessions-mode]');
    if (!root) { if (container) cleanupDOM(); return; }
    if (container !== root || !island?.isConnected) {
      cleanupDOM(); container = root; ensureStyle();
      island = doc.createElement('div'); island.setAttribute(own, 'island');
      island.setAttribute('data-slot', 'sidebar-group'); island.setAttribute('data-sidebar', 'group');
      island.className = 'relative flex w-full min-w-0 min-h-0 flex-col p-0 pb-1';
      const first = [...root.children].find(el => el.matches('[data-slot="sidebar-group"]'));
      root.insertBefore(island, first || root.firstChild);
    }
    setAttr(island, 'aria-busy', input.loading === true);
    const headerTemplate = nativeHeaderTemplate(root);
    for (const item of settleNotices.values()) {
      if (Date.now() >= item.until || !model.isManualSettled(item.scope, item.session)) clearSettleNotice(item);
    }
    const sessions = inboxSessions().filter(s => !model.isSettled(currentScope, s) && !model.isSnoozed(currentScope, s));
    const shown = sessions;
    const nextSignature = JSON.stringify([currentScope, inboxOpen, input.loading, !!input.error, model.error, admission.error, headerTemplate.fingerprint,
      [...settleNotices.values()].map(item => [item.key, item.until]), sessions.length, shown.map(s => [model.key(currentScope, s), claudeInboxId(s), s.title, safety(s), workState(s), active(s), activityByKey.get(model.key(currentScope, s))?.children.size || 0])]);
    if (signature !== nextSignature) {
      signature = nextSignature;
      setAttr(island, 'data-claude-inbox-expanded', inboxOpen);
      const focusedElement = island.contains(doc.activeElement) ? doc.activeElement : null;
      const focusedHeader = focusedElement?.hasAttribute('data-claude-inbox-header');
      const oldHeader = island.querySelector('[data-claude-inbox-header]');
      const scrollTop = island.querySelector('[data-slot="sidebar-group-content"]')?.scrollTop || 0;
      const reuseHeader = oldHeader?.__claudeInboxTemplate === headerTemplate.fingerprint;
      const header = reuseHeader ? oldHeader : headerTemplate.header;
      const wrapper = reuseHeader ? oldHeader.parentElement : headerTemplate.wrapper;
      if (!reuseHeader) {
        header.__claudeInboxTemplate = headerTemplate.fingerprint;
        const toggle = event => {
          if (disposed || !on || !header.isConnected || !island.contains(header)) return;
          stop(event); inboxOpen = !inboxOpen; requestRender();
        };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { stop(event); if (!event.repeat) toggle(event); }
        });
      }
      header.setAttribute('aria-expanded', String(inboxOpen)); header.setAttribute('data-claude-inbox-header', '');
      header.querySelector('.codicon-chevron-right').classList.toggle('rotate-90', inboxOpen);
      // Selection/title updates must not detach working rows and restart their
      // CSS animation. Keep their content owner mounted between projections.
      if (!reuseHeader) oldHeader?.parentElement?.remove();
      if (wrapper.parentElement !== island) island.insertBefore(wrapper, island.firstChild);
      let content = island.querySelector('[data-slot="sidebar-group-content"]');
      if (!content) {
        content = doc.createElement('div'); content.setAttribute('data-slot', 'sidebar-group-content'); content.className = 'w-full text-sm scrollbar-fade';
        island.appendChild(content);
      }
      content.hidden = !inboxOpen;
      for (const child of [...content.children]) if (!child.hasAttribute('data-claude-inbox-row')) child.remove();
      const status = text => { const el = doc.createElement('div'); el.setAttribute('data-claude-inbox-status', ''); el.setAttribute('role', 'status'); el.textContent = text; content.appendChild(el); };
      if (input.error) {
        status('Inbox could not be loaded. Refresh Sessions to retry.');
        if (typeof input.retry === 'function') content.appendChild(button('Retry Inbox', () => input.retry()));
      }

      if (model.error) status(model.error);
      if (admission.error) status(admission.error);
      if (!input.loading && !input.error && !model.error && !admission.error && !sessions.length) status('Inbox is clear. Settled and snoozed threads remain in Sessions and Pinned.');
      const kept = new Set();
      let cursor = content.firstChild;
      for (const session of shown) {
        const key = model.key(currentScope, session);
        if (kept.has(key)) continue;
        kept.add(key);
        let binding = rowBindings.get(key);
        if (!binding) {
          const ui = createClaudeInboxRowUI({
            document: doc,
            onOpen: () => { const fresh = rowSession(ui.row); if (fresh) open(fresh); },
            onMenu: event => { stop(event); const fresh = rowSession(ui.row); if (fresh) settle(fresh); },
            onSnooze: event => { stop(event); const fresh = rowSession(ui.row); if (fresh) showSnoozePopup(fresh, ui.clock, event); }
          });
          ui.row.setAttribute('data-claude-inbox-key', key);

          ui.clock.setAttribute('aria-haspopup', 'menu'); ui.clock.setAttribute('aria-expanded', 'false');
          binding = { ...ui, action: ui.menu }; rowBindings.set(key, binding);
        }
        binding.id = claudeInboxId(session); binding.scope = { ...currentScope };
        const { row, clock, action } = binding;
        setAttr(row, 'data-claude-inbox-row', binding.id);
        setAttr(row, 'data-claude-inbox-active-children', activityByKey.get(key)?.children.size || 0);
        const title = typeof session.title === 'string' && session.title ? session.title : 'Untitled thread';
        binding.update({
          title, selected: active(session), settleAction: true, workState: workState(session),
          menuDisabled: false,
          menuTitle: 'Remove from Inbox only. Work continues.'
        });
        setAttr(action, 'aria-label', `Settle ${title}`); setAttr(clock, 'aria-label', `Snooze ${title}`);
        // Opening stays enabled as before; Snooze does not depend on work status.
        clock.disabled = !!input.loading || !!input.error; clock.title = 'Hide from Inbox for a chosen duration. Work continues.';
        if (row !== cursor) {
          if (row.isConnected && row.parentElement === content && typeof content.moveBefore === 'function') content.moveBefore(row, cursor);
          else content.insertBefore(row, cursor);
        }
        cursor = row.nextSibling;
      }
      // Settle's Undo is Claude's toast, in the page's corner rather than in
      // the list; it belongs to this island and goes with it.
      if (settleNotices.size && !toasts?.isConnected) {
        toasts = doc.createElement('div'); toasts.setAttribute(own, 'toasts');
        doc.body.appendChild(toasts);
      }
      toasts?.replaceChildren();
      for (const item of settleNotices.values()) {
        const notice = doc.createElement('div');
        notice.setAttribute('data-claude-inbox-settle-notice', claudeInboxId(item.session)); notice.setAttribute('role', 'status');
        const label = doc.createElement('span'); label.textContent = `Settled ${item.title}`;
        const undo = button('Undo', event => { stop(event); if (undo.isConnected && toasts?.contains(undo) && island?.isConnected) undoSettle(item); });
        notice.append(label, undo); toasts.appendChild(notice);
      }
      if (!settleNotices.size && toasts) { toasts.remove(); toasts = null; }
      for (const [key, binding] of rowBindings) if (!kept.has(key)) { binding.row.remove(); rowBindings.delete(key); }
      if (snoozePopup && !snoozePopup.anchor.isConnected) closeSnoozePopup(false);

      content.scrollTop = scrollTop;
      if (focusedElement?.isConnected) focusedElement.focus({ preventScroll: true });
      else if (focusedHeader) header.focus();
      if (snoozePopup) snoozePopup.position();
    }
    renderBadges(root);
  }
  const observer = new win.MutationObserver(records => {
    if (records.some(record => {
      if (owns(record.target)) return false;
      if (record.type === 'attributes' && ['class', 'style'].includes(record.attributeName)) {
        return record.target.closest?.('[data-slot="sidebar-group"]')?.parentElement === container &&
          (record.target.classList.contains('group/section') || !!record.target.closest?.('button.group\\/section-label'));
      }
      if (record.type === 'attributes') return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => !owns(node));
    })) requestRender();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sessions-mode', 'aria-expanded', 'class', 'style', 'data-following', 'data-session-anchor', 'data-session-switching', 'data-pane-hidden'] });
  const offModel = model.subscribe(() => { refreshDeadline(); requestRender(); });
  const resume = () => { if (!disposed && on) { refreshDeadline(); requestRender(); } };
  doc.addEventListener('visibilitychange', resume);
  doc.addEventListener('scroll', resume, true);
  win.addEventListener?.('focus', resume);
  const offActive = ['activeSessionId', 'focusedStoredSessionId', 'focusedSessionOwner', 'focusedSessionProfile', 'profile', 'connectionId'].map(name => host.state?.[name]?.subscribe?.(requestRender)).filter(Boolean);
  const api = {
    model, admission, snooze, cancelSnooze,
    opened() {
      // Native navigation and metadata discovery are not attention decisions.
      return false;
    },
    update(next) {
      if (disposed) return;
      const scope = claudeInboxScope(next.scope);
      if (JSON.stringify(scope) !== JSON.stringify(currentScope)) { cleanupDOM(); activityByKey.clear(); inboxOpen = true; }
      currentScope = scope;
      input = { ...next, sessions: Array.isArray(next.sessions) ? next.sessions : [], liveSessions: Array.isArray(next.liveSessions) ? next.liveSessions : [],
        childSnapshots: Array.isArray(next.childSnapshots) ? next.childSnapshots : [], liveStatusKnown: next.liveStatusKnown ?? Array.isArray(next.liveSessions) };
      if (scope && on) { reconcileAdmission(); reconcileActivity(); reconcileChildActivity(); }
      refreshDeadline(); requestRender();
    },
    // Positive work/input events only. Callers must supply authoritative scope and ID.
    // Background reads/resuming and explicit UI opens do nothing.
    reactivate(event) {
      if (disposed || !on || !currentScope || !event || !claudeInboxOwnedBy(currentScope, event) || JSON.stringify(claudeInboxScope(event.scope)) !== JSON.stringify(currentScope)) return false;
      if (!['work', 'input', 'busy'].includes(event.type) && claudeInboxWorkStatus(event) !== 'work') return false;
      const session = eventSession(event);
      if (!session || input.loading || input.error || input.liveStatusKnown !== true ||
          !admission.observe(currentScope, input.sessions, { workingSessions: [session] }) || !admission.isEligible(currentScope, session)) { requestRender(); return false; }
      if (model.isManualSettled(currentScope, session) && !model.unsettle(currentScope, session)) { requestRender(); return false; }
      const key = model.key(currentScope, session), previous = activityByKey.get(key);
      activityByKey.set(key, { ...previous, phase: 'working', parentFinished: false, at: Date.now(), children: previous?.children || new Set() });
      const result = model.ingest(currentScope, [session], { liveSessions: [{ ...session, status: 'working' }] });
      requestRender(); return result;
    },
    activity(event) {
      if (disposed || !on || !currentScope || !event || event.replayed || !claudeInboxOwnedBy(currentScope, event) ||
          !sameScope({ connectionId: event.connectionId, profile: event.profile })) return false;
      const session = eventSession(event);
      if (!session) return false;
      if (['message.start', 'tool.start'].includes(event.type)) {
        if (event.type === 'tool.start' && model.isManualSettled(currentScope, session)) return false;
        return api.reactivate({ type: 'work', scope: currentScope, session_id: claudeInboxId(session), canonicalSessionId: claudeInboxId(session) });
      }
      const key = model.key(currentScope, session), previous = activityByKey.get(key);
      if (event.type === 'message.complete' && previous?.phase === 'read') return false;
      const activity = { ...previous, phase: previous?.phase || 'unknown', at: previous?.at || 0,
        children: new Set(previous?.children || []), pendingChildren: new Set(previous?.pendingChildren || []),
        terminalChildren: new Set(previous?.terminalChildren || []) };
      if (['subagent.spawn_requested', 'subagent.start', 'subagent.complete'].includes(event.type)) {
        const child = event.payload?.subagent_id;
        if (typeof child !== 'string' || !child) return false;
        if (event.type === 'subagent.complete') {
          if (activity.terminalChildren.has(child) && !activity.children.has(child) && !activity.pendingChildren.has(child)) return true;
          activity.children.delete(child); activity.pendingChildren.delete(child);
          // Native completion is emitted before registry removal. Even a newer
          // roster cannot revive this ID; only another proved spawn/start can.
          // Cap per-thread terminal IDs without evicting safety evidence: on
          // overflow, snapshots may sustain known children but not add IDs.
          if (activity.terminalChildren.size < 256) activity.terminalChildren.add(child);
          else activity.terminalChildrenOverflow = true;
        } else {
          activity.terminalChildren.delete(child);
          if (event.type === 'subagent.spawn_requested') activity.pendingChildren.add(child);
          else activity.pendingChildren.delete(child);
          activity.children.add(child);
        }
        activity.childEventAt = Date.now();
      } else if (event.type === 'message.complete') {
        activity.phase = activity.children.size ? 'unknown' : event.payload?.status === 'complete' && !event.payload.error ? 'completed' : 'unknown';
        activity.parentFinished = true; activity.at = Date.now();
      } else if (event.type === 'error') { activity.phase = 'unknown'; activity.parentFinished = true; activity.at = Date.now(); }
      else return false;
      activityByKey.set(key, activity);
      requestRender(); return true;
    },
    // Parent row-slot integration can bind an exact element without guessing React identity.
    // The row must be outside the Inbox island, inside the native sessions container.
    bindNativeRow(row, session, scope = currentScope) {
      const valid = claudeInboxScope(scope);
      if (disposed || !row || !valid || !claudeInboxId(session)) return () => {};
      const binding = { session, scope: valid }; externalBindings.set(row, binding); requestRender();
      return () => { if (externalBindings.get(row) === binding) { externalBindings.delete(row); badgeBindings.get(row)?.remove(); badgeBindings.delete(row); settledBadgeBindings.get(row)?.remove(); settledBadgeBindings.delete(row); requestRender(); } };
    },
    setMode(value) {
      if (disposed) return false;
      // Parent owns the string-valued preference and any persistence errors.
      on = !!value;
      if (!on) cleanupDOM();
      else if (currentScope) reconcileAdmission();
      refreshDeadline(); requestRender(); return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; clearDeadline(); observer.disconnect(); offModel(); offActive.forEach(fn => fn());
      doc.removeEventListener('visibilitychange', resume); doc.removeEventListener('scroll', resume, true); win.removeEventListener?.('focus', resume);
      if (raf !== null) win.cancelAnimationFrame(raf);
      cleanupDOM(); externalBindings.clear(); activityByKey.clear();
      if (doc[registryKey] === api.dispose) delete doc[registryKey];
    }
  };
  doc[registryKey] = api.dispose;
  refreshDeadline(); requestRender();
  return api;
}
