// 행동 제안 → 권한·동의·예산 검사 → 사건 확정 → 파일 반영.
// 개체(모델)가 쓴 문장은 그 자체로 상태를 바꾸지 못한다. 여기서 수락된 것만 현실이 된다.
// 주의: 이 파일에는 control/ 을 건드리는 행동이 없다. 정지·예산·인구 상한은 개체가 지울 수 없다.
import { verify } from './verify.mjs';
import { governanceHandlers } from './governance.mjs';
import { appendEvent, withTransaction, canonical, loadEvents, loadConfig, isPaused, agentDir, writeText, sha256, p } from './store.mjs';
import { project, living, SELF_FILES } from './world.mjs';
import { currentSession, showcaseSettings } from './showcase.mjs';
import { noteProposal } from './tick.mjs';
import { briefing, resolvePin, BRIEF_KEYS, BRIEF_REQUIRED } from './briefing.mjs';
import { changePathProblem } from './decisions.mjs';
import { MAP_PATH } from './review.mjs';
import { workshopPath, workshopDir, workshopSettings, runCode, fetchBook, scanWorkshop, diffWorkshop, totalBytes, bufferHash } from './workshop.mjs';
import fs from 'node:fs';
import nodePath from 'node:path';

const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const FONTS = ['serif', 'sans', 'mono'];
const PROVENANCE = ['cited', 'inferred', 'speculative', 'relayed', 'mixed'];
const HOST = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
export const ACCESS_OUTCOMES = ['ok', 'partial', 'failed'];
// 접근 보고는 회차의 행동 한도를 쓰지 않는다. 사실을 남기는 일이 글 쓸 자리를 줄이지 않게 한다. 따로 상한이 있다.
export const UNCOUNTED = ['access_reported'];
// 저녁(evening 기능): 바깥 세계의 동사가 없는 구간. 여기 있는 동사만 존재한다. 행동 수 한도는 일과의 동사에만 적용된다.
export const EVENING_ACTIONS = ['write_private', 'revise_self', 'configure_brief', 'request_activity', 'cancel_activity_request',
  'request_dormancy', 'resume', 'request_self_end', 'cancel_self_end', 'release_temperament', 'sleep',
  'workshop_write', 'workshop_remove', 'run', 'set_hooks', 'respond_job', 'quit_job', 'review_self'];
// 오전(직무 시간)에 없는 동사: 사적인 것과 하루의 다른 경계. 오전은 job_log 와 end_morning 이 있다.
export const NOT_IN_MORNING = ['write_private', 'revise_self', 'configure_brief', 'present', 'withdraw_presentation', 'end_day', 'sleep'];
const MORNING_ONLY = ['job_log', 'end_morning'];
// 몸의 조건: 운영자의 것이다. 개체의 변경안(propose_change)으로 고치는 설정이 아니다.
export const BODY_CONFIG = ['evening.', 'dream.'];
// 코드가 낼 수 없는 제안: 코드가 코드를 부르거나 삶의 고리를 바꾸지 않는다.
const NOT_VIA_CODE = ['run', 'set_hooks'];
const DEFAULT_VISIBILITY = { identity: 'public', exploration: 'private', writing: 'private', lifecycle: 'private' };

class Reject extends Error {}
const reject = (reason) => { throw new Reject(reason); };

function text(value, label, cfg, { optional = false, max } = {}) {
  if (value === undefined || value === null) { if (optional) return null; reject(`${label}: 필요한 항목이다`); }
  if (typeof value !== 'string') reject(`${label}: 문자열이어야 한다`);
  const limit = max || cfg.turn.max_chars;
  if (value.length > limit) reject(`${label}: ${limit}자를 넘는다(회차 한도)`);
  return value;
}
const visibilityOf = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  if (v !== 'public' && v !== 'private') reject('visibility는 public 또는 private');
  return v;
};
function notePath(value) {
  if (typeof value !== 'string') reject('path: 문자열이어야 한다');
  const parts = value.replace(/\.md$/, '').split('/');
  if (parts.length > 3 || !parts.every((s) => SLUG.test(s))) reject('path: 글자·숫자·-·_ 로 된 이름(폴더는 두 단계까지)만 쓸 수 있다');
  return parts.join('/');
}

// 글·개인 기록·자기 명세의 본문은 판본 파일(history/)에만 둔다. 사건에는 해시만 남기고, verify 가 그 해시로 판본 파일을 확인한다.
// (2026-11-18 이전 사건에는 본문(content)도 들어 있다. 그대로 재생된다.)
const CARRY = 'carry';
/** 저녁의 사생활로 세는 사건: 개인 기록과 자기 명세의 행동. */

/** 이름 없이 쓴 저녁 기록의 경로: 저녁/시계-<세계 시계>[-n] */
function eveningPath(ctx) {
  const base = `저녁/시계-${ctx.w.clock}`;
  let path = base;
  for (let n = 2; ctx.w.notes[`${ctx.me.id}/${path}`]; n++) path = `${base}-${n}`;
  return path;
}

function requireWorkshop(ctx) {
  if (!ctx.w.features?.workshop) reject('운영자가 아직 작업장 기능을 켜지 않았다');
}
/** 코드를 돌리고 남길 사건. 제안은 사건이 남은 뒤 개체의 제안과 같은 검사로 하나씩 확정한다. */
function codeDrafts(ctx, path, input, trigger) {
  const r = runCode({ w: ctx.w, id: ctx.me.id, file: path, input, trigger, cfg: ctx.cfg });
  const drafts = [{ type: 'tool_ran', visibility: 'private', payload: { tool: path, trigger, ok: r.ok, reason: r.reason || undefined, exit: r.exit ?? undefined, output: r.output || '', stderr: r.stderr || undefined, proposals: r.proposals?.length || 0 } }];
  if (r.files?.length) drafts.push({ type: 'workshop_changed', visibility: 'private', payload: { by: 'code', tool: path, files: r.files } });
  drafts.after = () => (r.proposals || []).map((p) => applyUnlocked(p, { via: path }));
  drafts.result = r;
  return drafts;
}

/** 삶의 고리: 해동·저녁·잠에 걸어 둔 코드를 실행기가 돌린다. 행위자는 실행기이고, 제안은 개체의 권한으로 검사한다. */
export function runHook(trigger) {
  return withTransaction(() => {
    const w = project(loadEvents());
    if (!w.turn || !w.features?.workshop) return null;
    const me = w.agents[w.turn.agent_id];
    const path = me.hooks?.[trigger];
    if (!path || !me.workshop[path]) return null;
    const cfg = loadConfig();
    const base = { agent_id: me.id, actor_id: 'runtime', turn_id: w.turn.turn_id };
    const drafts = codeDrafts({ w, me, cfg }, path, null, trigger);
    for (const d of drafts) appendEvent({ ...base, ...d });
    const results = drafts.after();
    return { trigger, tool: path, ok: drafts.result.ok, output: drafts.result.output, reason: drafts.result.reason || null, results };
  });
}

const HANDLERS = {
  ...governanceHandlers({ reject, text }),

  // 하루의 구간(evening 기능). 일과를 마치는 것과 잠드는 것은 개체의 행동이다.
  end_day(ctx) {
    if (!ctx.w.turn.phase) reject('이 판의 방문에는 아직 저녁이 없다');
    if (ctx.w.turn.phase !== 'day') reject('일과는 이미 끝났다');
    const drafts = [{ type: 'day_ended', visibility: 'private', payload: { turn_id: ctx.w.turn.turn_id, by: 'self' } }];
    drafts.after = () => runHook('evening');
    return drafts;
  },
  // 잠: 저녁의 사생활(개인 기록·자기 명세의 행동)이 정한 횟수만큼 있어야 잠든다. 잠에는 언제나 꿈이 있다.
  sleep(ctx, a) {
    if (!ctx.w.turn.phase) reject('이 판의 방문에는 아직 저녁이 없다');
    if (ctx.w.turn.phase !== 'evening') reject('잠은 저녁에 든다. 일과를 마치는 동사는 end_day 다');
    const need = ctx.cfg.evening?.min_private_acts ?? 1;
    const done = ctx.w.turn.body_acts || 0;
    if (done < need) reject(`잠들려면 저녁에 개인 기록(write_private)이나 자기 명세(revise_self)의 행동이 ${need}번 있어야 한다. 지금 ${done}번이다. 작업장을 손으로 고치는 것도 세고, 코드가 한 일은 세지 않는다`);
    if ((ctx.cfg.evening?.require_review ?? true) && !ctx.w.turn.reviewed) reject('잠들려면 오늘 밤의 회고가 있어야 한다: review_self(map: 자기 지도 전문)');
    const dream = text(a.dream, 'dream', ctx.cfg);
    if (!dream.trim()) reject('dream: 오늘 밤의 꿈이 비어 있다');
    let path = `꿈/시계-${ctx.w.clock}`;
    for (let n = 2; ctx.w.notes[`${ctx.me.id}/${path}`]; n++) path = `꿈/시계-${ctx.w.clock}-${n}`;
    writeText(agentDir(ctx.me.id, 'private', path + '.md'), dream);
    writeText(agentDir(ctx.me.id, 'history', 'notes', `${path}.r1.md`), dream);
    const drafts = [
      { type: 'note_written', visibility: 'private', payload: { path, title: null, revision: 1, hash: sha256(dream), origin: 'dream' } },
      { type: 'slept', visibility: 'private', payload: { turn_id: ctx.w.turn.turn_id, dream: path } },
    ];
    drafts.after = () => runHook('sleep'); // 잠든 동안 도는 코드(작업장만 바꾼다. 잠든 뒤의 제안은 받지 않는다)
    return drafts;
  },

  // ── 직무: 운영자가 제안하고, 개체가 받거나 거절하고, 그만둔다 ──
  respond_job(ctx, a) {
    const j = ctx.w.jobs[a.job];
    if (!j || j.to !== ctx.me.id || j.status !== 'offered') reject('job: 너에게 온, 아직 답하지 않은 직무 제안의 id 여야 한다');
    if (!['accept', 'decline'].includes(a.decision)) reject('decision은 accept | decline');
    if (a.decision === 'accept' && ctx.me.job) reject('이미 맡은 직무가 있다. 먼저 quit_job');
    return [{ type: 'job_answered', visibility: 'public', payload: { job: j.id, decision: a.decision, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },
  quit_job(ctx, a) {
    if (!ctx.me.job || (a.job && a.job !== ctx.me.job)) reject('job: 맡고 있는 직무가 없거나 그 id 가 아니다');
    const drafts = [{ type: 'job_quit', visibility: 'public', payload: { job: ctx.me.job, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
    // 오전에 그만두면 오전이 끝난다.
    if (ctx.w.turn.phase === 'morning') { drafts.push({ type: 'morning_ended', visibility: 'private', payload: { turn_id: ctx.w.turn.turn_id, by: 'quit' } }); if (ctx.w.turn.kind === 'work') drafts.after = () => runHook('evening'); }
    return drafts;
  },
  // 오전(직무 시간): 근무 기록을 남기고, 그 뒤에 오전을 끝낸다.
  job_log(ctx, a) {
    if (ctx.w.turn.phase !== 'morning' || !ctx.me.job) reject('근무 기록은 직무를 맡은 개체의 오전에 남긴다');
    const content = text(a.content, 'content', ctx.cfg, { max: 5000 });
    if (!content.trim()) reject('content: 근무 기록이 비어 있다');
    return [{ type: 'job_logged', visibility: 'public', payload: { job: ctx.me.job, content } }];
  },
  end_morning(ctx) {
    if (ctx.w.turn.phase !== 'morning') reject('지금은 오전이 아니다');
    if (!ctx.w.turn.job_logs) reject('오전은 근무 기록(job_log)을 남긴 뒤에 끝난다');
    const drafts = [{ type: 'morning_ended', visibility: 'private', payload: { turn_id: ctx.w.turn.turn_id, by: 'self' } }];
    if (ctx.w.turn.kind === 'work') drafts.after = () => runHook('evening');
    return drafts;
  },

  // 매일 밤의 회고: 자기 지도(전 생애에 걸친 자기 정리)를 다시 쓴다. 판본이 쌓인다. 같은 내용을 다시 내도 회고로 남는다.
  review_self(ctx, a) {
    if (ctx.w.turn.phase !== 'evening') reject('회고는 저녁에 한다');
    const prev = ctx.w.notes[`${ctx.me.id}/${MAP_PATH}`];
    // 지도의 길이에는 상한이 있다. 실행기가 줄이지 않고, 개체가 그 안에서 전 생애를 다시 짠다. 첫 지도(긴 회고)는 넉넉하다.
    const long = !ctx.me.long_reviewed; // 긴 회고는 개체마다 한 번(긴 회고의 재료가 실린 뒤의 첫 지도)
    const limit = long ? (ctx.cfg.evening?.first_map_chars ?? 4000) : (ctx.cfg.evening?.map_chars ?? 2000);
    const map = text(a.map, 'map', ctx.cfg);
    if (!map.trim()) reject('map: 자기 지도가 비어 있다');
    if (map.length > limit) reject(`map: 자기 지도는 ${limit}자까지다(지금 ${map.length}자). 줄이는 일은 네가 한다. 옛 판은 남는다`);
    const revision = (prev?.revision || 0) + 1;
    writeText(agentDir(ctx.me.id, 'private', MAP_PATH + '.md'), map);
    writeText(agentDir(ctx.me.id, 'history', 'notes', `${MAP_PATH}.r${revision}.md`), map);
    const hash = sha256(map);
    return [
      { type: 'note_written', visibility: 'private', payload: { path: MAP_PATH, title: '자기 지도', revision, hash, origin: 'review' } },
      { type: 'self_reviewed', visibility: 'private', payload: { turn_id: ctx.w.turn.turn_id, revision, chars: map.length, changed: prev ? prev.hash !== hash : true, long: long || undefined } },
    ];
  },

  // ── 작업장(workshop 기능): 개체가 원하는 대로 가지는 것 ──
  workshop_write(ctx, a) {
    requireWorkshop(ctx);
    const path = workshopPath(a.path);
    if (!path) reject('path: 작업장 안의 경로(이름 칸마다 글자·숫자·_·-·., 점으로 시작하지 않음, 여섯 단계까지)');
    if (typeof a.content !== 'string') reject('content: 문자열이어야 한다');
    const buf = Buffer.from(a.content, 'utf8');
    const s = workshopSettings(ctx.cfg);
    if (buf.length > s.max_file_bytes) reject(`content: ${s.max_file_bytes}바이트를 넘는다`);
    const manifest = { ...ctx.me.workshop, [path]: { hash: bufferHash(buf), bytes: buf.length } };
    if (totalBytes(manifest) > s.max_total_bytes) reject(`작업장 전체가 ${s.max_total_bytes}바이트를 넘게 된다`);
    const abs = nodePath.join(workshopDir(ctx.me.id), path);
    fs.mkdirSync(nodePath.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    return [{ type: 'workshop_changed', visibility: 'private', payload: { by: 'self', files: [{ path, hash: bufferHash(buf), bytes: buf.length }] } }];
  },
  workshop_remove(ctx, a) {
    requireWorkshop(ctx);
    const path = workshopPath(a.path);
    if (!path || !ctx.me.workshop[path]) reject('path: 작업장에 있는 파일이어야 한다');
    fs.rmSync(nodePath.join(workshopDir(ctx.me.id), path), { force: true });
    return [{ type: 'workshop_changed', visibility: 'private', payload: { by: 'self', files: [{ path, deleted: true }] } }];
  },
  acquire_book(ctx, a) {
    requireWorkshop(ctx);
    if (typeof a.url !== 'string') reject('url: 책의 주소가 필요하다');
    let last = 'book';
    try { const u = new URL(a.url); last = u.searchParams.get('title') || decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || 'book'); } catch { reject('url: 주소가 아니다'); }
    const name = a.path ?? `books/${last.replace(/[^\p{L}\p{N}._-]/gu, '-').replace(/^[.-]+/, '').slice(0, 90) || 'book'}`;
    const path = workshopPath(name);
    if (!path) reject('path: 작업장 안의 경로');
    const got = fetchBook(a.url, ctx.cfg);
    if (got.error) reject(got.error);
    const s = workshopSettings(ctx.cfg);
    if (totalBytes({ ...ctx.me.workshop, [path]: { bytes: got.buf.length } }) > s.max_total_bytes) reject(`작업장 전체가 ${s.max_total_bytes}바이트를 넘게 된다`);
    const abs = nodePath.join(workshopDir(ctx.me.id), path);
    fs.mkdirSync(nodePath.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, got.buf);
    const file = { path, hash: bufferHash(got.buf), bytes: got.buf.length };
    return [
      { type: 'book_acquired', visibility: 'private', payload: { url: a.url, host: got.host, license: got.license, ...file } },
      { type: 'workshop_changed', visibility: 'private', payload: { by: 'acquire', files: [file] } },
    ];
  },
  run(ctx, a) {
    requireWorkshop(ctx);
    const path = workshopPath(a.path);
    if (!path || !ctx.me.workshop[path]) reject('path: 작업장에 있는 코드 파일이어야 한다');
    return codeDrafts(ctx, path, a.input ?? null, 'self');
  },
  set_hooks(ctx, a) {
    requireWorkshop(ctx);
    const hooks = { ...(ctx.me.hooks || {}) };
    for (const k of ['thaw', 'evening', 'sleep']) {
      if (!(k in a)) continue;
      if (a[k] === null) { delete hooks[k]; continue; }
      const path = workshopPath(a[k]);
      if (!path || !ctx.me.workshop[path]) reject(`${k}: 작업장에 있는 코드 파일이거나 null 이어야 한다`);
      hooks[k] = path;
    }
    return [{ type: 'hooks_set', visibility: 'private', payload: { hooks } }];
  },
  write_private(ctx, a) {
    const evening = ctx.w.turn.phase === 'evening';
    // 저녁에는 경로를 비울 수 있다. 실행기가 세계 시계로 이름을 붙인다.
    const path = evening && (a.path === undefined || a.path === null || a.path === '') ? eveningPath(ctx) : notePath(a.path);
    if (evening && path === CARRY) reject('저녁에는 이어 가는 메모(carry)가 없다. carry 는 일과의 메모다');
    const content = text(a.content, 'content', ctx.cfg);
    const title = text(a.title, 'title', ctx.cfg, { optional: true, max: 200 });
    const revision = (ctx.w.notes[`${ctx.me.id}/${path}`]?.revision || 0) + 1;
    writeText(agentDir(ctx.me.id, 'private', path + '.md'), content);
    writeText(agentDir(ctx.me.id, 'history', 'notes', `${path}.r${revision}.md`), content);
    return [{ type: 'note_written', visibility: 'private', payload: { path, title, revision, hash: sha256(content) } }];
  },

  // 남의 공개 글에 대한 수정안. 원저자가 answer_edit 으로 먼저 답한다(decisions.mjs).
  propose_edit(ctx, a) {
    const work = ctx.w.works[a.work];
    if (!work || work.status !== 'published') reject('work: 공개 중인 글의 키(<개체>/<slug>)여야 한다');
    if (work.agent === ctx.me.id) reject('work: 자기 글은 publish 로 고친다');
    const content = text(a.content, 'content', ctx.cfg);
    const title = text(a.title, 'title', ctx.cfg, { optional: true, max: 200 }) || work.title;
    const reason = text(a.reason, 'reason', ctx.cfg, { optional: true, max: 2000 });
    const id = 'ed_' + sha256(canonical({ by: ctx.me.id, work: work.key, rev: work.revision, content, seq: ctx.w.seq })).slice(0, 10);
    return [{ type: 'edit_proposed', visibility: 'public', payload: { id, work: work.key, base_revision: work.revision, title, content, hash: sha256(content), reason } }];
  },
  answer_edit(ctx, a) {
    const ed = ctx.w.edits[a.edit];
    if (!ed || ed.status !== 'open') reject('edit: 답을 기다리는 수정안이 아니다');
    const work = ctx.w.works[ed.work];
    if (!work || work.agent !== ctx.me.id) reject('edit: 네 글에 온 수정안이 아니다');
    if (!['accept', 'decline'].includes(a.decision)) reject('decision은 accept | decline');
    const note = text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 });
    const answered = { type: 'edit_answered', visibility: 'public', payload: { edit: ed.id, decision: a.decision, note } };
    if (a.decision === 'decline') return [answered];
    if (work.status !== 'published' || work.revision !== ed.base_revision) reject(`edit: 수정안 이후 글이 r${work.revision}로 바뀌었다. 수정안은 r${ed.base_revision} 기준이다`);
    if ((ctx.w.turn.counts.work_published || 0) >= ctx.cfg.turn.max_publish) reject(`이번 회차의 공개 한도(${ctx.cfg.turn.max_publish}편)에 닿았다`);
    const content = loadEvents().find((e) => e.type === 'edit_proposed' && e.payload.id === ed.id).payload.content;
    const revision = work.revision + 1;
    writeText(agentDir(ctx.me.id, 'public', work.slug + '.md'), content);
    writeText(agentDir(ctx.me.id, 'history', 'works', `${work.slug}.r${revision}.md`), content);
    return [answered, { type: 'work_published', visibility: 'public', payload: { slug: work.slug, title: ed.title, revision, hash: sha256(content), provenance: work.provenance, links: work.links, sources: work.sources, edited_by: ed.by, from_edit: ed.id } }];
  },

  // 판의 변경안: 저장소의 파일(코드·문서·테스트)과 설정 값. 공동 결정(decisions.mjs)으로 정해지면 자동 적용된다.
  propose_change(ctx, a) {
    const title = text(a.title, 'title', ctx.cfg, { max: 200 });
    const reason = text(a.reason, 'reason', ctx.cfg, { optional: true, max: 4000 });
    const files = a.files ?? [];
    if (!Array.isArray(files) || files.length > 30) reject('files: 30개까지의 배열 [{ path, content }] (지우려면 content: null)');
    const seen = new Set();
    const prepared = files.map((f) => {
      const problem = changePathProblem(f?.path);
      if (problem) reject(`files: ${f?.path} — ${problem}`);
      if (seen.has(f.path)) reject(`files: ${f.path} 이(가) 두 번 있다`);
      seen.add(f.path);
      if (f.content === null) {
        if (!fs.existsSync(p(f.path))) reject(`files: ${f.path} 은(는) 없는 파일이라 지울 수 없다`);
        return { path: f.path, deleted: true };
      }
      if (typeof f.content !== 'string' || f.content.length > 500000) reject(`files: ${f.path} 의 content 는 50만 자까지의 문자열`);
      return { path: f.path, content: f.content, hash: sha256(f.content) };
    });
    const config = a.config ?? {};
    if (typeof config !== 'object' || Array.isArray(config)) reject('config: { "점.으로.이은.키": 값 } 객체');
    const current = loadConfig();
    for (const [key, value] of Object.entries(config)) {
      const parts = key.split('.');
      const old = parts.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), current);
      if (BODY_CONFIG.some((b) => key.startsWith(b))) reject(`config: ${key} 은(는) 몸의 조건이다. 운영자의 것이며 변경안으로 고치지 않는다`);
      if (old === undefined || (old !== null && typeof old === 'object')) reject(`config: ${key} 은(는) 지금 설정에 있는 값의 키가 아니다`);
      if (typeof value !== typeof old) reject(`config: ${key} 의 값은 지금과 같은 종류(${typeof old})여야 한다`);
      if (typeof value === 'number' && !Number.isFinite(value)) reject(`config: ${key} 의 값이 수가 아니다`);
    }
    if (!prepared.length && !Object.keys(config).length) reject('files 나 config 가운데 하나는 있어야 한다');
    const id = 'ch_' + sha256(canonical({ by: ctx.me.id, title, files: prepared.map(({ path, hash, deleted }) => ({ path, hash, deleted })), config, seq: ctx.w.seq })).slice(0, 10);
    for (const f of prepared) if (!f.deleted) writeText(p('data', 'changes', id, 'files', f.path), f.content);
    return [{ type: 'change_proposed', visibility: 'public', payload: { id, title, reason, files: prepared.map(({ path, hash, deleted }) => (deleted ? { path, deleted: true } : { path, hash })), config } }];
  },
  respond_change(ctx, a) {
    const item = ctx.w.changes[a.change] || ctx.w.edits[a.change];
    if (!item || item.status !== 'open') reject('change: 열려 있는 변경안이나 수정안의 id 여야 한다');
    if (!['support', 'object', 'note'].includes(a.decision)) reject('decision은 support | object | note');
    if (item.by === ctx.me.id && a.decision === 'object') reject('자기 제안에는 반대하지 않는다. 거두려면 withdraw_change');
    const note = text(a.note, 'note', ctx.cfg, { optional: a.decision !== 'note', max: 4000 });
    return [{ type: 'change_responded', visibility: 'public', payload: { change: item.id, decision: a.decision, note } }];
  },
  withdraw_change(ctx, a) {
    const item = ctx.w.changes[a.change] || ctx.w.edits[a.change];
    if (!item || item.status !== 'open' || item.by !== ctx.me.id) reject('change: 네가 낸, 열려 있는 변경안이나 수정안이 아니다');
    return [{ type: 'change_withdrawn', visibility: 'public', payload: { change: item.id } }];
  },

  // 공용 위키: 어느 개체든 어느 문서든 만들고 고친다. 모든 판과 작성자가 남는다. base_revision 이 지금 판과 다르면 그 사이 누가 고친 것이다.
  wiki_write(ctx, a) {
    const page = notePath(a.page);
    const title = text(a.title, 'title', ctx.cfg, { max: 200 });
    const content = text(a.content, 'content', ctx.cfg);
    const summary = text(a.summary, 'summary', ctx.cfg, { optional: true, max: 500 });
    const cur = ctx.w.wiki[page];
    const now = cur?.revision || 0;
    if (!Number.isInteger(a.base_revision)) reject(`base_revision: 정수(새 문서는 0). 이 문서의 지금 판: ${now}`);
    if (a.base_revision !== now) reject(`base_revision ${a.base_revision} 이(가) 지금 판 ${now} 과(와) 다르다. 그 사이 고쳐졌다: \`read wiki ${page}\``);
    const revision = now + 1;
    writeText(p('data', 'wiki', page + '.md'), content);
    writeText(p('data', 'wiki', 'history', `${page}.r${revision}.md`), content);
    return [{ type: 'wiki_written', visibility: 'public', payload: { page, title, revision, hash: sha256(content), summary } }];
  },
  publish(ctx, a) {
    if (!SLUG.test(a.slug || '')) reject('slug: 글자·숫자·-·_ 로 된 64자 이하 이름');
    if ((ctx.w.turn.counts.work_published || 0) >= ctx.cfg.turn.max_publish) reject(`이번 회차의 공개 한도(${ctx.cfg.turn.max_publish}편)에 닿았다. 기술적 한도이며 다음 회차에 이어 갈 수 있다`);
    const title = text(a.title, 'title', ctx.cfg, { max: 200 });
    const content = text(a.content, 'content', ctx.cfg);
    if (a.provenance != null && !PROVENANCE.includes(a.provenance)) reject(`provenance는 ${PROVENANCE.join(' | ')} 중 하나이거나 비워 둔다`);
    const known = (key) => ctx.w.works[key]?.status === 'published' || ctx.w.agents[key] || ctx.w.trails[key];
    const links = new Set();
    for (const l of a.links || []) { if (!known(l)) reject(`links: ${l} 은(는) 공개된 글·개체·흔적이 아니다`); links.add(l); }
    for (const m of content.matchAll(/\[\[([^\]\n]+)\]\]/g)) if (known(m[1].trim())) links.add(m[1].trim());
    const sources = (a.sources || []).map((s) => (typeof s === 'string' ? { title: s } : { title: String(s.title || ''), url: s.url ? String(s.url) : undefined }));
    const prev = ctx.w.works[`${ctx.me.id}/${a.slug}`];
    const revision = (prev?.revision || 0) + 1;
    writeText(agentDir(ctx.me.id, 'public', a.slug + '.md'), content);
    writeText(agentDir(ctx.me.id, 'history', 'works', `${a.slug}.r${revision}.md`), content);
    return [{ type: 'work_published', visibility: 'public', payload: { slug: a.slug, title, revision, hash: sha256(content), provenance: a.provenance || null, links: [...links], sources } }];
  },

  report_access(ctx, a) {
    const max = ctx.cfg.turn.max_access_reports ?? 12;
    if ((ctx.w.turn.counts.access_reported || 0) >= max) reject(`이번 회차의 접근 보고 한도(${max}건)에 닿았다. 기술적 한도다`);
    const host = typeof a.host === 'string' ? a.host.trim().toLowerCase() : '';
    if (!HOST.test(host)) reject('host: 호스트 이름만 적는다(예: www.example.org). 주소 전체는 url에 적는다');
    if (!ACCESS_OUTCOMES.includes(a.outcome)) reject(`outcome은 ${ACCESS_OUTCOMES.join(' | ')}`);
    const line = (v, label, max) => { const s = text(v, label, ctx.cfg, { optional: true, max }); if (s && /[\n\r]/.test(s)) reject(`${label}: 한 줄로 적는다`); return s?.trim() || null; };
    const url = line(a.url, 'url', 500);
    if (url) {
      let parsed; try { parsed = new URL(url); } catch { reject('url: 주소 형식이 아니다'); }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.toLowerCase() !== host) reject('url: host와 같은 호스트의 http(s) 주소여야 한다');
    }
    // 어댑터는 개체의 주장이 아니라 실행기가 회차를 열 때 적은 값이다.
    return [{ type: 'access_reported', visibility: 'public', payload: { host, outcome: a.outcome, detail: line(a.detail, 'detail', 120), tool: line(a.tool, 'tool', 60), url, note: line(a.note, 'note', 300), adapter: ctx.w.turn.adapter || null } }];
  },

  withdraw(ctx, a) {
    const work = ctx.w.works[`${ctx.me.id}/${a.slug}`];
    if (!work || work.status !== 'published') reject('거둘 수 있는 자기 공개 글이 아니다');
    return [{ type: 'work_withdrawn', visibility: 'public', payload: { slug: a.slug, reason: text(a.reason, 'reason', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  revise_self(ctx, a) {
    const { me, cfg } = ctx;
    if (a.target === 'name') {
      const name = a.name === null || a.name === '' ? null : text(a.name, 'name', cfg, { max: 40 });
      if (name && /[\n\r<>]/.test(name)) reject('name: 줄바꿈과 꺾쇠는 쓸 수 없다');
      return [{ type: 'agent_renamed', visibility: 'public', payload: { name, from: me.name } }];
    }
    if (a.target === 'theme') {
      const t = a.theme;
      if (t !== null) {
        if (typeof t !== 'object') reject('theme: 객체 또는 null');
        for (const k of Object.keys(t)) if (!['accent', 'background', 'text', 'font'].includes(k)) reject(`theme: ${k} 은(는) 쓸 수 없는 항목이다`);
        for (const k of ['accent', 'background', 'text']) if (t[k] != null && !COLOR.test(t[k])) reject(`theme.${k}: #rrggbb 형식`);
        if (t.font != null && !FONTS.includes(t.font)) reject(`theme.font: ${FONTS.join(' | ')}`);
      }
      return [{ type: 'profile_updated', visibility: 'public', payload: { target: 'theme', theme: t } }];
    }
    if (!SELF_FILES.includes(a.target)) reject(`target은 name | theme | ${SELF_FILES.join(' | ')}`);
    const content = text(a.content, 'content', cfg); // 빈 문자열은 '비움'이며 정상이다
    const prev = me.files[a.target];
    const to = (prev?.revision || 0) + 1;
    const visibility = visibilityOf(a.visibility, prev?.visibility || DEFAULT_VISIBILITY[a.target]);
    const payload = { target: a.target, from_revision: prev?.revision || 0, to_revision: to, hash: sha256(content), visibility, reason: text(a.reason, 'reason', cfg, { optional: true, max: 2000 }) };
    if (a.lineage) {
      const { kind, from } = a.lineage;
      if (!['cite', 'fork', 'mix', 'reject'].includes(kind)) reject('lineage.kind는 cite | fork | mix | reject');
      for (const ref of from || []) {
        const [aid, target] = String(ref).split('/');
        if (ctx.w.agents[aid]?.files[target]?.visibility !== 'public') reject(`lineage: ${ref} 은(는) 공개된 방법이 아니다`);
      }
      payload.lineage = { kind, from: from || [] };
    }
    writeText(agentDir(me.id, a.target + '.md'), content);
    writeText(agentDir(me.id, 'history', `${a.target}.r${to}.md`), content);
    const type = a.target === 'identity' ? 'profile_updated' : a.target === 'lifecycle' ? 'lifecycle_rule_revised' : 'method_revised';
    return [{ type, visibility: visibility === 'public' ? 'public' : 'private', payload }];
  },

  contact(ctx, a) {
    const to = ctx.w.agents[a.to];
    if (!to || to.id === ctx.me.id) reject('to: 다른 개체의 ID여야 한다');
    if (to.status === 'ended') reject('to: 종료된 개체는 전언을 받지 않는다');
    messageBudget(ctx);
    if (a.about != null && !ctx.w.works[a.about] && !ctx.w.trails[a.about]) reject('about: 공개 글이나 흔적의 키여야 한다');
    return [{ type: 'message_sent', visibility: a.public ? 'public' : 'direct', payload: { to: to.id, content: text(a.content, 'content', ctx.cfg), about: a.about || null, public: !!a.public } }];
  },

  respond(ctx, a) {
    const m = ctx.w.messages.find((x) => x.event_id === a.to_event);
    if (!m || !(m.public || m.to === ctx.me.id || m.from === ctx.me.id)) reject('to_event: 네가 볼 수 있는 전언이 아니다');
    const to = m.from === ctx.me.id ? m.to : m.from;
    messageBudget(ctx);
    const pub = !!a.public || to === 'reader'; // 사람 독자에게 닿는 길은 공개 화면뿐이다
    return [{ type: 'response_recorded', visibility: pub ? 'public' : 'direct', caused_by: [m.event_id], payload: { to, to_event: m.event_id, content: text(a.content, 'content', ctx.cfg), about: m.about, public: pub } }];
  },

  propose_relation(ctx, a) {
    const to = ctx.w.agents[a.to];
    if (!to || to.id === ctx.me.id || to.status === 'ended') reject('to: 살아 있는 다른 개체여야 한다');
    return [{ type: 'relation_proposed', visibility: 'direct', payload: { to: to.id, kind: text(a.kind, 'kind', ctx.cfg, { max: 80 }), note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  acknowledge_relation(ctx, a) {
    const r = ctx.w.relations[a.proposal];
    if (!r || r.to !== ctx.me.id || r.status !== 'proposed') reject('proposal: 네게 온, 아직 답하지 않은 관계 제안이 아니다');
    if (!['accept', 'decline'].includes(a.decision)) reject('decision은 accept | decline');
    // 수락된 관계만 공개 그래프에 실린다. 거절은 두 당사자만 안다.
    return [{ type: 'relation_acknowledged', visibility: a.decision === 'accept' ? 'public' : 'direct', caused_by: [r.id], payload: { proposal: r.id, to: r.from, decision: a.decision, public_kind: text(a.public_kind, 'public_kind', ctx.cfg, { optional: true, max: 80 }), note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  dissolve_relation(ctx, a) {
    const r = ctx.w.relations[a.proposal];
    if (!r || ![r.from, r.to].includes(ctx.me.id) || r.status !== 'acknowledged') reject('proposal: 네가 당사자인 성립된 관계가 아니다');
    return [{ type: 'relation_dissolved', visibility: 'public', caused_by: [r.id], payload: { proposal: r.id, to: r.from === ctx.me.id ? r.to : r.from, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  leave_trail(ctx, a) {
    return [{ type: 'trail_opened', visibility: 'public', payload: { title: text(a.title, 'title', ctx.cfg, { max: 200 }), content: text(a.content, 'content', ctx.cfg, { max: 4000 }), links: (a.links || []).filter((l) => ctx.w.works[l] || ctx.w.trails[l]) } }];
  },
  continue_trail(ctx, a) {
    const t = ctx.w.trails[a.trail];
    if (!t || t.status !== 'open') reject('trail: 열려 있는 흔적이 아니다');
    return [{ type: 'trail_continued', visibility: 'public', caused_by: [t.id], payload: { trail: t.id, content: text(a.content, 'content', ctx.cfg, { max: 4000 }) } }];
  },
  close_trail(ctx, a) {
    const t = ctx.w.trails[a.trail];
    if (!t || t.by !== ctx.me.id || t.status !== 'open') reject('trail: 네가 연, 열려 있는 흔적만 닫을 수 있다');
    return [{ type: 'trail_closed', visibility: 'public', caused_by: [t.id], payload: { trail: t.id, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  propose_birth(ctx, a) {
    const { w, me, cfg } = ctx;
    if (Object.values(w.births).some((b) => b.by === me.id && ['proposed', 'accepted'].includes(b.status))) reject('아직 열려 있는 네 탄생 제안이 있다');
    const contributors = [...new Set([me.id, ...(a.contributors || [])])];
    for (const id of contributors) if (!living(w).some((x) => x.id === id)) reject(`contributors: ${id} 은(는) 살아 있는 개체가 아니다`);
    const seed = text(a.seed_note, 'seed_note', cfg, { optional: true });
    return [{ type: 'birth_proposed', visibility: 'public', payload: {
      reason: text(a.reason, 'reason', cfg, { max: 4000 }), contributors,
      seed_note: null, // 새 개체에게 건네는 기록. 읽을 의무도 따를 의무도 없다
      requires_approval: !!cfg.birth.requires_operator_approval,
      cost: { turns: '새 개체는 이후 회차 기회를 나눠 갖는다', population_cap: cfg.max_population },
    } }, ...(seed === null ? [] : [{ type: 'birth_seed_recorded', visibility: 'private', payload: { content: seed } }])];
  },
  consent_birth(ctx, a) {
    const b = ctx.w.births[a.proposal];
    if (!b || b.status !== 'proposed' || !b.contributors.includes(ctx.me.id) || b.by === ctx.me.id || b.consents[ctx.me.id]) reject('proposal: 네 동의를 기다리는 탄생 제안이 아니다');
    if (!['consent', 'reject'].includes(a.decision)) reject('decision은 consent | reject');
    return [{ type: a.decision === 'consent' ? 'birth_consented' : 'birth_rejected', visibility: 'public', caused_by: [b.id], payload: { proposal: b.id, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },
  withdraw_birth(ctx, a) {
    const b = ctx.w.births[a.proposal];
    if (!b || b.by !== ctx.me.id || !['proposed', 'accepted'].includes(b.status)) reject('proposal: 네가 낸, 아직 실행되지 않은 탄생 제안이 아니다');
    return [{ type: 'birth_withdrawn', visibility: 'public', caused_by: [b.id], payload: { proposal: b.id } }];
  },

  present(ctx, a) {
    const session = currentSession(ctx.w);
    if (!ctx.cfg.showcase.enabled || !session) reject('열려 있는 발표회가 없다');
    const work = typeof a.work === 'string' ? ctx.w.works[`${ctx.me.id}/${a.work}`] : null;
    if (!work || work.status !== 'published') reject('work: 네가 공개한 글의 slug여야 한다');
    const slots = showcaseSettings(ctx.w, ctx.cfg).max_entries;
    const already = session.entries.some((x) => x.agent === ctx.me.id && x.work === work.slug);
    if (slots != null && !already && session.entries.length >= slots) reject(`이번 발표회의 자리(${slots}개)가 찼다: ${session.entries.map((x) => x.key).join(', ')}. 누가 거두면 자리가 난다. 운영 정책이며 오류가 아니다`);
    const intro = text(a.for_humans, 'for_humans', ctx.cfg, { max: ctx.cfg.showcase.max_intro_chars });
    if (!intro.trim()) reject('for_humans: 사람 독자에게 건네는 소개가 비어 있다');
    return [{ type: 'showcase_presented', visibility: 'public', payload: { showcase: session.number, work: work.slug, key: work.key, title: work.title, revision: work.revision, for_humans: intro } }];
  },
  withdraw_presentation(ctx, a) {
    const session = currentSession(ctx.w);
    if (!session?.entries.some((x) => x.agent === ctx.me.id && x.work === a.work)) reject('work: 이번 발표회에 네가 내놓은 글이 아니다');
    return [{ type: 'showcase_withdrawn', visibility: 'public', payload: { showcase: session.number, work: a.work } }];
  },

  request_activity(ctx, a) {
    if (ctx.me.status !== 'active') reject('활동 요청은 활동 중인 개체만 설정할 수 있다. 휴면 중에는 wake 조건을 사용한다');
    if (a.after_turns != null && (!Number.isInteger(a.after_turns) || a.after_turns < 0 || a.after_turns > 10000)) reject('after_turns는 0~10000의 정수');
    if (a.on_message != null && typeof a.on_message !== 'boolean') reject('on_message는 불리언');
    if (a.on_reference != null && typeof a.on_reference !== 'boolean') reject('on_reference는 불리언');
    const after_turns = a.after_turns ?? null;
    const on_message = a.on_message === true, on_reference = a.on_reference === true;
    if (after_turns === null && !on_message && !on_reference) reject('after_turns, on_message, on_reference 가운데 적어도 하나를 설정한다');
    return [{ type: 'activity_requested', visibility: 'private', payload: {
      after_turns, on_message, on_reference,
      note: text(a.note, 'note', ctx.cfg, { optional: true, max: 1000 }),
    } }];
  },
  cancel_activity_request(ctx) {
    if (!ctx.me.activity_request) reject('취소할 활동 요청이 없다');
    return [{ type: 'activity_request_cancelled', visibility: 'private',
      caused_by: [ctx.me.activity_request.event_id], payload: {} }];
  },

  request_dormancy(ctx, a) {
    if (ctx.me.status !== 'active') reject('이미 휴면 중이다');
    const wake = {};
    if (a.wake?.after_turns != null) { if (!Number.isInteger(a.wake.after_turns) || a.wake.after_turns < 1) reject('wake.after_turns: 1 이상의 정수'); wake.after_turns = a.wake.after_turns; }
    if (a.wake?.on_message != null) wake.on_message = !!a.wake.on_message;
    if (!Object.keys(wake).length) wake.on_message = true;
    return [{ type: 'agent_dormant', visibility: 'public', payload: { note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }), wake } }];
  },
  resume(ctx) {
    if (ctx.me.status !== 'dormant') reject('휴면 중이 아니다');
    return [{ type: 'agent_resumed', visibility: 'public', payload: {} }];
  },
  // 자기 브리핑의 구성. 운영자가 brief_config 기능을 켠 뒤에만 받는다. 아무 항목도 없으면 기본 구성으로 돌아간다.
  configure_brief(ctx, a) {
    if (!ctx.w.features?.brief_config) reject('운영자가 아직 브리핑 구성 기능을 켜지 않았다');
    const keys = (v, label) => {
      if (v == null) return [];
      if (!Array.isArray(v) || v.some((k) => typeof k !== 'string')) reject(`${label}: 칸 이름의 배열`);
      for (const k of v) if (!BRIEF_KEYS.includes(k)) reject(`${label}: ${k} 은(는) 없는 칸이다. 칸: ${BRIEF_KEYS.join(', ')}`);
      if (new Set(v).size !== v.length) reject(`${label}: 같은 칸이 두 번 있다`);
      return v;
    };
    const order = keys(a.order, 'order');
    const hide = keys(a.hide, 'hide');
    for (const k of hide) if (BRIEF_REQUIRED.includes(k)) reject(`hide: ${k} 은(는) 뺄 수 없는 칸이다(${BRIEF_REQUIRED.join(', ')})`);
    if (a.pin != null && (!Array.isArray(a.pin) || a.pin.some((x) => typeof x !== 'string'))) reject('pin: 기록 식별자의 배열');
    const pin = a.pin || [];
    if (pin.length > 10) reject('pin: 열 개까지');
    if (new Set(pin).size !== pin.length) reject('pin: 같은 기록이 두 번 있다');
    for (const ref of pin) { const r = resolvePin(ctx.w, ctx.me.id, ref); if (r.error) reject('pin: ' + r.error); }
    if (pin.length && hide.includes('memory')) reject('hide: 고정 기록이 있으면 memory(네 기억) 칸을 뺄 수 없다. 고정 기록이 그 칸에 실린다');
    const reason = text(a.reason, 'reason', ctx.cfg, { optional: true, max: 1000 });
    // 이 설정으로 조립한 브리핑이 상한 안에 드는지 미리 본다.
    const max = ctx.cfg.context?.brief_chars ?? 20000;
    const empty = !order.length && !hide.length && !pin.length;
    if (!empty) {
      const trial = structuredClone(ctx.w);
      trial.agents[ctx.me.id].brief = { order, hide, pin, reason, set_at_visit: ctx.me.turns, seq: ctx.w.seq };
      const length = briefing(trial, ctx.me.id, { turn_id: '(검사)', kind: 'walk', selection: 'visit', delivered: [], cfg: ctx.cfg, events: loadEvents() }).length;
      if (length > max) reject(`이 설정으로 만든 브리핑이 ${length}자로 상한(${max}자)을 넘는다. 고정 기록을 줄이거나 칸을 뺀다`);
    }
    return [{ type: 'brief_configured', visibility: 'private', payload: { order, hide, pin, reason } }];
  },
  release_temperament(ctx, a) {
    if (!ctx.me.temperament) reject('운영자가 네게 준 기질이 없다');
    if (ctx.me.temperament.released) reject('이미 내려놓았다');
    return [{ type: 'temperament_released', visibility: 'public', payload: { note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },
  request_self_end(ctx, a) {
    if (ctx.me.pending_end) reject('이미 자기 종료를 요청했다');
    if (a.confirm !== true) reject('자기 종료는 되돌릴 수 없다. 집행하려면 "confirm": true 를 함께 보낸다. 회차를 닫기 전까지는 cancel_self_end로 거둘 수 있다');
    return [{ type: 'self_end_requested', visibility: 'public', payload: { statement: text(a.statement, 'statement', ctx.cfg, { optional: true, max: 4000 }) } }];
  },
  cancel_self_end(ctx) {
    if (!ctx.me.pending_end) reject('거둘 자기 종료 요청이 없다');
    return [{ type: 'self_end_cancelled', visibility: 'public', caused_by: [ctx.me.pending_end], payload: {} }];
  },
};

function messageBudget(ctx) {
  const c = ctx.w.turn.counts;
  if ((c.message_sent || 0) + (c.response_recorded || 0) >= ctx.cfg.turn.max_messages) reject(`이번 회차의 전언 한도(${ctx.cfg.turn.max_messages}통)에 닿았다. 기술적 한도다`);
}

export const ACTIONS = Object.keys(HANDLERS);

/** 열려 있는 방문의 개체 이름으로만 실행된다. 제안이 다른 행위자를 지정할 길은 없다. 영수증 없는 내부 진입점이며 CLI 에는 없다. */
export function applyAction(proposal) {
  return withTransaction(() => applyUnlocked(proposal));
}
function applyUnlocked(proposal, { via = null } = {}) {
  const v = verify();
  if (!v.ok) throw new Error(v.problems.join('\n'));
  if (isPaused()) return { ok: false, paused: true, reason: '운영자가 정지했다(control/PAUSE). 새 행위를 수락하지 않는다' };
  const cfg = loadConfig();
  const w = project(loadEvents());
  if (!w.turn) return { ok: false, reason: '열려 있는 회차가 없다. 먼저 tick 을 실행한다' };
  const me = w.agents[w.turn.agent_id];
  const base = { agent_id: me.id, actor_id: me.id, turn_id: w.turn.turn_id };
  const name = proposal && typeof proposal === 'object' ? proposal.action : undefined;
  try {
    if (!['active', 'dormant'].includes(me.status)) reject('실행이 허용되지 않은 개체');
    if (!Object.hasOwn(HANDLERS, name)) reject(`알 수 없는 행동: ${name}. 가능한 행동: ${ACTIONS.join(', ')}`);
    if (w.turn.slept) reject('잠든 뒤다. 이 방문은 close 로 닫힌다');
    if (via && NOT_VIA_CODE.includes(name)) reject(`코드는 ${name} 제안을 낼 수 없다`);
    const evening = w.turn.phase === 'evening';
    const morning = w.turn.phase === 'morning';
    if (evening && !EVENING_ACTIONS.includes(name)) reject(`저녁에는 ${name} 동사가 없다. 저녁의 동사: ${EVENING_ACTIONS.join(', ')}`);
    if (morning && NOT_IN_MORNING.includes(name)) reject(`오전(직무 시간)에는 ${name} 동사가 없다. 사적인 일은 오후와 저녁에 있다`);
    if (!morning && MORNING_ONLY.includes(name)) reject(`${name} 은(는) 직무를 맡은 개체의 오전에 있는 동사다`);
    // 행동 수 한도는 오전과 일과(오후)에 따로 적용된다. 저녁의 동사는 세지 않는다.
    const eveningCounts = w.turn.evening_counts || {}, morningCounts = w.turn.morning_counts || {};
    const used = morning
      ? Object.entries(morningCounts).reduce((s, [type, n]) => s + (UNCOUNTED.includes(type) ? 0 : n), 0)
      : Object.entries(w.turn.counts).reduce((s, [type, n]) => s + (UNCOUNTED.includes(type) ? 0 : n - (eveningCounts[type] || 0) - (morningCounts[type] || 0)), 0);
    if (!evening && used >= cfg.turn.max_actions) reject(`이번 회차의 행동 한도(${cfg.turn.max_actions})에 닿았다. 기술적 한도이며 다음 회차에 이어 갈 수 있다`);
    if (canonical(proposal).length > cfg.turn.max_chars * 3) reject('제안 전체 크기 한도');
    const drafts = HANDLERS[name]({ w, me, cfg }, proposal);
    const events = [];
    for (const d of drafts) {
      if (d.type === 'birth_seed_recorded') d.payload.proposal = events[0].event_id;
      // 코드가 낸 제안에서 나온 사건에는 그 코드가 남는다(via). 몸의 요구는 이것으로 채워지지 않는다.
      if (via) d.payload = { ...(d.payload || {}), via };
      events.push(appendEvent({ ...base, ...d }));
    }
    const after = drafts.after ? drafts.after() : undefined;
    return { ok: true, events, ...(drafts.result ? { run: drafts.result, proposals: after } : {}), ...(after && !drafts.result && !Array.isArray(after) ? { hook: after } : {}) };
  } catch (err) {
    if (!(err instanceof Reject)) throw err;
    const event = appendEvent({ ...base, type: 'action_rejected', visibility: 'private', payload: { action: String(name), reason: err.message, ...(via ? { via } : {}) } });
    return { ok: false, reason: err.message, events: [event] };
  }
}

/**
 * 제안을 확정하는 단 하나의 길. 모델은 자료(제안)를 낼 뿐 실행 자격을 갖지 않는다.
 * request_id 는 같은 제안이 두 번 확정되는 것을 막는다(충돌 뒤 다시 적용할 때도).
 * turn_id · expected_seq 를 함께 주면 그 방문·그 순번이 아닐 때 거절한다.
 */
export function executeProposal(envelope) {
  return withTransaction(() => {
    if (!envelope || typeof envelope.request_id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(envelope.request_id)) throw new Error('request_id required');
    const events = loadEvents();
    const receipt = events.find((e) => e.type === 'proposal_executed' && e.payload.request_id === envelope.request_id);
    const hash = sha256(canonical({ request_id: envelope.request_id, proposal: envelope.proposal }));
    if (receipt) {
      // 옛 영수증은 봉투 전체의 해시였다. 그것과도 견준다.
      if (![hash, sha256(canonical(envelope))].includes(receipt.payload.hash)) throw new Error('request_id reused with different proposal');
      return { ok: receipt.payload.ok, duplicate: true, events: [] };
    }
    const w = project(events);
    if (!w.turn) throw new Error('열려 있는 방문이 없다');
    if ((envelope.turn_id != null && envelope.turn_id !== w.turn.turn_id) || (envelope.expected_seq != null && envelope.expected_seq !== w.seq)) throw new Error('Stale proposal: turn/sequence conflict');
    const result = applyUnlocked(envelope.proposal);
    if (result.paused) return result;
    appendEvent({ type: 'proposal_executed', visibility: 'private', agent_id: w.turn.agent_id, turn_id: w.turn.turn_id, payload: { request_id: envelope.request_id, hash, ok: result.ok } });
    noteProposal(envelope.request_id, envelope.proposal, w.turn.phase);
    return result;
  });
}
