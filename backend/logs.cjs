// ================================================================ REALM LOGS
// Two dependency-free, append-only JSON-lines logs for the realm server.
//
//   audit.log  Security and accountability record: who did what, to what, from where, and
//              whether it succeeded. Every entry carries `prev` and `hash` (SHA-256 over the
//              previous hash plus the entry), so an edited or deleted line breaks the chain and
//              `verify()` reports where. Written synchronously so an event is on disk before the
//              response is sent.
//   debug.log  Operational diagnostics with levels (error > warn > info > debug). Request
//              timings, server errors with stack traces, storage problems. Also echoed to the
//              console. Buffered writes; flushed on exit.
//
// Both files rotate by size (file.log -> file.log.1 -> ... -> file.log.N) and redact secrets
// (passwords, tokens, hashes, salts) before anything is written.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const SECRET_KEYS = /^(password|oldpassword|newpassword|token|authorization|hash|salt|secret|cookie)$/i;
const GENESIS = '0'.repeat(64);

// ---------------------------------------------------------------- redaction
function redact(value, depth = 0) {
  if (value == null || typeof value !== 'object') return typeof value === 'string' ? redactString(value) : value;
  if (depth > 6) return '[depth]';
  if (value instanceof Error) return { name: value.name, message: value.message, code: value.code, stack: value.stack };
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
  return out;
}
// tokens travel in ?token= on the event stream; 64-hex strings anywhere are treated as secrets
function redactString(s) {
  return s.replace(/([?&]token=)[^&\s]*/gi, '$1[redacted]').replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]').replace(/\b[0-9a-f]{64}\b/gi, '[redacted]');
}

// ---------------------------------------------------------------- rotation
function rotate(file, keep) {
  for (let i = keep - 1; i >= 1; i--) { try { fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`); } catch (e) { /* gap */ } }
  try { fs.renameSync(file, `${file}.1`); } catch (e) { /* nothing to rotate */ }
}
const sizeOf = file => { try { return fs.statSync(file).size; } catch (e) { return 0; } };
// newest-last list of existing files: file.log.N ... file.log.1, file.log
const generations = (file, keep) => { const out = []; for (let i = keep; i >= 1; i--) if (fs.existsSync(`${file}.${i}`)) out.push(`${file}.${i}`); if (fs.existsSync(file)) out.push(file); return out; };
function readLines(files) {
  const out = [];
  for (const f of files) {
    let text = ''; try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    for (const line of text.split('\n')) if (line) out.push({ file: path.basename(f), line });
  }
  return out;
}

// ---------------------------------------------------------------- debug log
function createDebugLog({ dir, level = 'info', echo = true, maxBytes = 5 * 1024 * 1024, keep = 5, file = 'debug.log' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  let threshold = LEVELS[level] ?? LEVELS.info, buf = [], size = sizeOf(target);
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(''); buf = [];
    try {
      if (size + Buffer.byteLength(text) > maxBytes && size > 0) { rotate(target, keep); size = 0; }
      fs.appendFileSync(target, text); size += Buffer.byteLength(text);
    } catch (e) { if (echo) process.stderr.write(`[log] cannot write ${target}: ${e.message}\n`); }
  };
  const timer = setInterval(flush, 500); timer.unref();
  function write(lvl, msg, fields) {
    if (LEVELS[lvl] > threshold) return;
    const entry = { at: new Date().toISOString(), level: lvl, msg: redactString(String(msg)) };
    if (fields !== undefined) Object.assign(entry, redact(fields instanceof Error ? { err: fields } : fields));
    buf.push(JSON.stringify(entry) + '\n');
    if (lvl === 'error') flush(); // errors land on disk immediately
    if (echo) {
      const extra = fields === undefined ? '' : ' ' + JSON.stringify(redact(fields instanceof Error ? { err: fields.message } : fields), (k, v) => k === 'stack' ? undefined : v);
      (lvl === 'error' || lvl === 'warn' ? process.stderr : process.stdout).write(`${entry.at} ${lvl.toUpperCase().padEnd(5)} ${entry.msg}${extra}\n`);
    }
  }
  return {
    file: target,
    get level() { return Object.keys(LEVELS).find(k => LEVELS[k] === threshold); },
    setLevel(l) { if (l in LEVELS) threshold = LEVELS[l]; },
    enabled: lvl => LEVELS[lvl] <= threshold,
    error: (m, f) => write('error', m, f), warn: (m, f) => write('warn', m, f),
    info: (m, f) => write('info', m, f), debug: (m, f) => write('debug', m, f),
    flush,
    // newest first; filter by minimum level and text
    tail({ limit = 200, level: min = 'debug', q = '' } = {}) {
      flush();
      const cap = LEVELS[min] ?? LEVELS.debug, needle = String(q).toLowerCase(), out = [];
      const lines = readLines(generations(target, keep));
      for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
        let e; try { e = JSON.parse(lines[i].line); } catch (err) { continue; }
        if ((LEVELS[e.level] ?? 3) > cap) continue;
        if (needle && !lines[i].line.toLowerCase().includes(needle)) continue;
        out.push(e);
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------- audit log
function createAuditLog({ dir, maxBytes = 10 * 1024 * 1024, keep = 20, file = 'audit.log', onError } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  // resume the chain from the newest entry on disk
  let prev = GENESIS, seq = 0, size = sizeOf(target);
  {
    const lines = readLines(generations(target, keep));
    for (let i = lines.length - 1; i >= 0; i--) { try { const e = JSON.parse(lines[i].line); prev = e.hash; seq = e.seq; break; } catch (err) { /* skip torn line */ } }
  }
  const digest = (p, body) => crypto.createHash('sha256').update(p).update(JSON.stringify(body)).digest('hex');

  // event: { action, actor?, actorId?, target?, ip?, outcome?, details?, reqId?, at? }
  function record(event) {
    const body = {
      seq: seq + 1, at: event.at || Date.now(), action: String(event.action),
      actor: event.actor == null ? null : String(event.actor), actorId: event.actorId || null,
      target: event.target == null ? null : String(event.target), ip: event.ip || null,
      outcome: event.outcome || 'success',
    };
    if (event.details !== undefined) body.details = redact(event.details);
    if (event.reqId) body.reqId = event.reqId;
    body.prev = prev;
    const entry = { ...body, hash: digest(prev, body) }, line = JSON.stringify(entry) + '\n';
    try {
      if (size > 0 && size + Buffer.byteLength(line) > maxBytes) { rotate(target, keep); size = 0; }
      fs.appendFileSync(target, line); size += Buffer.byteLength(line);
      prev = entry.hash; seq = entry.seq;
    } catch (e) { if (onError) onError(e, entry); }
    return entry;
  }
  // newest first. action matches exactly or by prefix ("auth." or "auth.*")
  function query({ limit = 100, action = '', actor = '', target: tgt = '', outcome = '', since = 0, ip = '' } = {}) {
    const pre = String(action).replace(/\*$/, ''), lowActor = String(actor).toLowerCase(), lowTgt = String(tgt).toLowerCase(), out = [];
    const lines = readLines(generations(target, keep));
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      let e; try { e = JSON.parse(lines[i].line); } catch (err) { continue; }
      if (since && e.at < since) break;
      if (pre && !(e.action === pre || (pre.endsWith('.') && e.action.startsWith(pre)) || e.action.startsWith(pre + '.'))) continue;
      if (lowActor && String(e.actor || '').toLowerCase() !== lowActor && e.actorId !== actor) continue;
      if (lowTgt && String(e.target || '').toLowerCase() !== lowTgt) continue;
      if (outcome && e.outcome !== outcome) continue;
      if (ip && e.ip !== ip) continue;
      out.push(e);
    }
    return out;
  }
  // walk every generation oldest -> newest; report the first broken link
  function verify() {
    const lines = readLines(generations(target, keep));
    let p = null, s = null, checked = 0;
    for (const { file: f, line } of lines) {
      let e; try { e = JSON.parse(line); } catch (err) { return { ok: false, checked, file: f, error: 'unreadable line' }; }
      const { hash, ...body } = e;
      if (p !== null && e.prev !== p) return { ok: false, checked, file: f, seq: e.seq, error: 'chain broken: an entry before this one was removed or changed' };
      if (s !== null && e.seq !== s + 1) return { ok: false, checked, file: f, seq: e.seq, error: `sequence gap after ${s}` };
      if (digest(e.prev, body) !== hash) return { ok: false, checked, file: f, seq: e.seq, error: 'entry was modified' };
      p = hash; s = e.seq; checked++;
    }
    // oldest generations may have rotated away; the chain is still checked from the oldest kept entry
    return { ok: true, checked, head: p || GENESIS, lastSeq: s || 0 };
  }
  return { file: target, record, query, verify, get seq() { return seq; } };
}

module.exports = { createDebugLog, createAuditLog, redact, redactString, LEVELS };
