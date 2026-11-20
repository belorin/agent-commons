// 작업장(workshop 기능): 개체가 원하는 대로 가지고 고치고 쓰는 것들. 파일·책·작동하는 코드.
// 막는 것은 되돌릴 수 없는 것뿐이다: 자격 증명(코드에는 환경 변수가 없다), 정본과 다른 저장소에 쓰기(다른 프로세스·git 을
// 실행할 수 없다), 다른 개체의 개인 기록(읽기 범위 밖). 나머지는 연다. 작업장 밖의 세계는 개체와 같은 행동 제안으로만 바뀐다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { agentDir, p, codeRoot } from './store.mjs';

export const WORKSHOP = 'workshop';
const SEGMENT = /^[\p{L}\p{N}_][\p{L}\p{N}._-]{0,99}$/u;
export const workshopDir = (id) => agentDir(id, WORKSHOP);
export const bufferHash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export const WORKSHOP_DEFAULTS = { max_file_bytes: 5_000_000, max_total_bytes: 50_000_000, book_max_bytes: 5_000_000,
  book_hosts: ['www.gutenberg.org', 'gutenberg.org', 'wikisource.org'], timeout_ms: 30000, max_output_chars: 20000, brief_output_chars: 3000 };
export const workshopSettings = (cfg) => ({ ...WORKSHOP_DEFAULTS, ...(cfg.workshop || {}) });

/** 작업장 안의 상대 경로. 이름 칸마다 글자·숫자·_·-·. (점으로 시작하지 않음), 여섯 단계까지. 맞지 않으면 null. */
export function workshopPath(value) {
  if (typeof value !== 'string') return null;
  const parts = value.replace(/\\/g, '/').split('/').filter(Boolean);
  if (!parts.length || parts.length > 6 || !parts.every((s) => SEGMENT.test(s) && s !== '..')) return null;
  return parts.join('/');
}

/** 지금 디스크에 있는 작업장의 파일: 상대 경로 -> { hash, bytes } */
export function scanWorkshop(id, { removeLinks = true } = {}) {
  const dir = workshopDir(id);
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { recursive: true }).map(String)) {
    const abs = path.join(dir, f);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) { if (removeLinks) fs.rmSync(abs); else out[f.replace(/\\/g, '/')] = { hash: 'symlink', bytes: 0 }; continue; } // 링크는 남기지 않는다(작업장 밖을 가리킬 수 있다)
    if (!st.isFile()) continue;
    const buf = fs.readFileSync(abs);
    out[f.replace(/\\/g, '/')] = { hash: bufferHash(buf), bytes: buf.length };
  }
  return out;
}

/** 투영된 목록과 디스크를 견주어 바뀐 것만. */
export function diffWorkshop(before = {}, after = {}) {
  const files = [];
  for (const [f, x] of Object.entries(after)) if (before[f]?.hash !== x.hash) files.push({ path: f, hash: x.hash, bytes: x.bytes });
  for (const f of Object.keys(before)) if (!after[f]) files.push({ path: f, deleted: true });
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export const totalBytes = (manifest) => Object.values(manifest).reduce((s, x) => s + (x.bytes || 0), 0);

function snapshot(id) {
  const dir = workshopDir(id);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-ws-'));
  if (fs.existsSync(dir)) fs.cpSync(dir, tmp, { recursive: true });
  return tmp;
}
function restore(id, tmp) {
  const dir = workshopDir(id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(tmp, dir, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}

/**
 * 작업장의 코드 하나를 돌린다. 별도 Node 프로세스, 권한 모델(--permission):
 * - 읽기: 자기 개체 폴더 전체(개인 기록 포함), 운영자 자료(data/library), 공용 위키(data/wiki), 다른 개체의 공개 글(public), 이 판의 코드와 문서
 * - 쓰기: 자기 작업장만
 * - 환경 변수 없음, 다른 프로세스·워커·애드온 없음. 바깥 네트워크는 막지 않는다(실행 환경이 허락하는 만큼).
 * 표준 입력으로 { input, agent, clock, phase, trigger } JSON 을 받는다. 표준 출력에서 `@propose {…}` 줄은 행동 제안이고 나머지는 출력이다.
 * 실패(종료 코드·시간 초과·크기 초과)하면 작업장을 실행 전으로 되돌린다.
 */
export function runCode({ w, id, file, input = null, trigger, cfg }) {
  const s = workshopSettings(cfg);
  const dir = workshopDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, file);
  if (!fs.existsSync(abs)) return { ok: false, reason: `${file}: 작업장에 없는 파일이다` };
  const source = ['src', 'docs', 'test', 'scripts', 'README.md', 'CLAUDE.md', 'CHAT.md', 'package.json'].map((f) => path.join(codeRoot(), f));
  const reads = [agentDir(id), p('data', 'library'), p('data', 'wiki'), ...Object.keys(w.agents).filter((x) => x !== id).map((x) => agentDir(x, 'public')), ...source]
    .filter((d) => fs.existsSync(d));
  const before = scanWorkshop(id);
  const tmp = snapshot(id);
  const stdin = JSON.stringify({ input, agent: id, clock: w.clock, phase: w.turn?.phase || null, trigger });
  const r = spawnSync(process.execPath, ['--permission', ...reads.map((d) => `--allow-fs-read=${d}`), `--allow-fs-write=${dir}`, abs],
    { cwd: dir, env: {}, input: stdin, encoding: 'utf8', timeout: s.timeout_ms, maxBuffer: 8 * 1024 * 1024, killSignal: 'SIGKILL' });
  const stdout = r.stdout || '', stderr = r.stderr || '';
  const proposals = [], lines = [];
  for (const line of stdout.split('\n')) {
    if (line.startsWith('@propose ')) { try { proposals.push(JSON.parse(line.slice(9))); } catch { lines.push(line); } }
    else lines.push(line);
  }
  const output = lines.join('\n').trim().slice(0, s.max_output_chars);
  const tail = stderr.trim().slice(-2000);
  let reason = null;
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGKILL') reason = `시간 한도(${s.timeout_ms}ms)를 넘었다`;
  else if (r.error) reason = `실행하지 못했다: ${r.error.message}`;
  else if (r.status !== 0) reason = `종료 코드 ${r.status}`;
  const after = scanWorkshop(id);
  if (!reason && Object.values(after).some((x) => x.bytes > s.max_file_bytes)) reason = `파일 하나가 ${s.max_file_bytes}바이트를 넘었다`;
  if (!reason && totalBytes(after) > s.max_total_bytes) reason = `작업장 전체가 ${s.max_total_bytes}바이트를 넘었다`;
  if (reason) { restore(id, tmp); return { ok: false, reason, output, stderr: tail, exit: r.status ?? null, files: [], proposals: [] }; }
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ok: true, output, stderr: tail, exit: r.status, files: diffWorkshop(before, after), proposals };
}

/** 책을 들인다: 허락된 공개 저작물 호스트에서 실행기가 직접 받는다. 개체가 본문을 붙여 넣는 길은 없다(출처와 허락을 확인할 수 없다). */
export function fetchBook(url, cfg) {
  const s = workshopSettings(cfg);
  let u;
  try { u = new URL(url); } catch { return { error: 'url: 주소가 아니다' }; }
  if (u.protocol !== 'https:') return { error: 'url: https 주소만' };
  const host = u.hostname.toLowerCase();
  const allowed = s.book_hosts.some((h) => host === h || host.endsWith('.' + h));
  if (!allowed) return { error: `url: 책을 들일 수 있는 곳은 ${s.book_hosts.join(', ')} (공개 저작물)뿐이다` };
  try {
    const buf = execFileSync('curl', ['-sS', '--fail', '-L', '--max-filesize', String(s.book_max_bytes), '-m', '60', url], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: s.book_max_bytes + 1024 });
    if (!buf.length) return { error: '받은 내용이 비어 있다' };
    const license = host.endsWith('gutenberg.org') ? 'Project Gutenberg (공개 저작물)' : 'Wikisource (공개 저작물 또는 자유 이용 허락)';
    return { buf, host, license };
  } catch (e) {
    return { error: `받지 못했다: ${String(e.stderr || e.message).trim().slice(0, 200)}` };
  }
}
