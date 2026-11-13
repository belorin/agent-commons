// Single-writer transactions. A durable redo journal survives process termination.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
let active = null;
export const stagedText = (file) => active?.writes.get(file);
export function stageText(file, text) {
  if (!active) return false;
  active.writes.set(file, text);
  return true;
}
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
function atomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid;
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  const dir = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
function paths(root) {
  return { lock: path.join(root, 'data/runtime/writer.lock'), journal: path.join(root, 'data/runtime/transaction.json') };
}
function replay(root, journal) {
  const entries = JSON.parse(fs.readFileSync(journal, 'utf8'));
  for (const e of entries) {
    const file = path.resolve(root, e.path);
    if (!file.startsWith(root + path.sep) || digest(e.text) !== e.hash) throw new Error('Invalid recovery journal');
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current !== e.text && (current === null ? null : digest(current)) !== e.before) throw new Error('Recovery conflict: ' + e.path);
  }
  for (const e of entries) atomic(path.join(root, e.path), e.text);
  fs.rmSync(journal);
}
export function transaction(root, fn) {
  if (active) return fn();
  const { lock, journal } = paths(root);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); } catch { throw new Error('Writer busy or interrupted; use recover after the writer stops'); }
  fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd);
  try {
    if (fs.existsSync(journal)) throw new Error('Interrupted transaction; use recover');
    active = { writes: new Map() };
    const result = fn();
    const entries = [...active.writes].map(([file, text]) => ({ path: path.relative(root, file), text, hash: digest(text), before: fs.existsSync(file) ? digest(fs.readFileSync(file, 'utf8')) : null }));
    active = null;
    if (entries.length) { atomic(journal, JSON.stringify(entries)); replay(root, journal); }
    return result;
  } finally { active = null; fs.rmSync(lock, { force: true }); }
}
export function recoverTransaction(root) {
  const { lock, journal } = paths(root);
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    if (!Number.isInteger(pid) || pid < 1) throw new Error('Invalid writer lock; inspect manually');
    let alive = true;
    try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; else throw e; }
    if (alive) throw new Error('Writer still running; recovery refused');
    fs.rmSync(lock);
  }
  // Exclusively hold the same lock during recovery.
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const fd = fs.openSync(lock, 'wx', 0o600);
  fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd);
  try { if (fs.existsSync(journal)) replay(root, journal); } finally { fs.rmSync(lock, { force: true }); }
  return 'Interrupted writes recovered; verify before resuming the same turn.';
}
