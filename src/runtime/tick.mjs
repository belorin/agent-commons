// 회차: 실행 기회를 한 개체에게 건네고, 닫을 때 확정한다.
// 실행기는 기회를 줄 뿐이다. 무엇을 읽고 쓸지, 아무것도 하지 않을지는 개체가 정한다.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { verify } from './verify.mjs';
import crypto from 'node:crypto';
import { appendEvent, withTransaction, loadEvents, loadConfig, isPaused, p, agentDir, writeText, readText, sha256 } from './store.mjs';
import { project, living } from './world.mjs';
import { decide, activityDue, nextVisit, resting } from './schedule.mjs';
export { decide, activityDue, nextVisit };
import { briefing, eveningBrief } from './briefing.mjs';
import { regenerate } from './derive.mjs';
import { executeProposal } from './actions.mjs';
import { showcaseSettings, nextShowcaseClock } from './showcase.mjs';

// 로컬 전용(커밋하지 않음): 열린 방문이 읽은 것과 낸 제안. 닫으면 last-visit.json 으로 남아,
// 푸시가 거절됐을 때 최신 정본 위에서 같은 제안을 다시 검증하는 데 쓰인다.
const turnFile = () => p('data', 'runtime', 'turn.json');
const lastVisitFile = () => p('data', 'runtime', 'last-visit.json');
export const loadTurnFile = () => JSON.parse(readText(turnFile()) || 'null');
export const loadLastVisit = () => JSON.parse(readText(lastVisitFile()) || 'null');
export function noteProposal(request_id, proposal, phase) {
  const t = loadTurnFile();
  if (!t) return;
  t.proposals.push({ request_id, proposal, ...(phase ? { phase } : {}) });
  writeText(turnFile(), JSON.stringify(t, null, 2));
}
export function noteRead(key, phase) {
  const t = loadTurnFile();
  if (!t) return;
  if (!t.read.includes(key)) t.read.push(key);
  if (phase === 'evening') { t.evening_read ??= []; if (!t.evening_read.includes(key)) t.evening_read.push(key); }
  writeText(turnFile(), JSON.stringify(t, null, 2));
}

// ── 잠의 낱말(evening 기능) ─────────────────────────────────────────────
// 잠들면 실행기가 바깥(설정 dream.url)에서 무작위 낱말을 받아 dream_seeded 사건에 그대로 남긴다.
// 받은 값이 사건에 있으므로 재생은 언제나 같다. 실패는 기술적 사실로만 남는다. 시험은 setDreamSource 로 바꿔 끼운다.
let dreamSource = null;
export const setDreamSource = (fn) => { dreamSource = fn; };
function parseWords(raw) {
  const j = JSON.parse(raw);
  const arr = Array.isArray(j) ? j : j?.results;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x) => typeof x === 'string').map((x) => x.trim()).filter((x) => x.length >= 1 && x.length <= 40 && !/[\r\n]/.test(x)).slice(0, 5);
}
function seedDream(cfg) {
  const d = cfg.dream;
  if (!d?.enabled || !d.url) return null;
  let source;
  try { source = new URL(d.url).host; } catch { return { words: [], failed: 'dream.url 을 읽을 수 없다' }; }
  try {
    const seconds = String(Math.max(1, Math.ceil((d.timeout_ms || 5000) / 1000)));
    const raw = dreamSource ? dreamSource(d.url) : execFileSync('curl', ['-sS', '--fail', '-m', seconds, d.url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const words = parseWords(raw);
    return words.length ? { words, source } : { words: [], source, failed: '응답에 낱말이 없다' };
  } catch (e) {
    return { words: [], source, failed: String(e.stderr || e.message || e).trim().slice(0, 200) || '호출 실패' };
  }
}

/** 열린 방문의 저녁 브리핑(일과가 끝난 뒤, 또는 저녁 방문). 오늘 일과의 사실을 함께 싣는다. */
export function eveningText() {
  const events = loadEvents();
  const w = project(events);
  if (!w.turn?.phase) return '저녁이 열려 있지 않다.';
  const local = loadTurnFile();
  const read = local?.turn_id === w.turn.turn_id ? local.read.filter((k) => !(local.evening_read || []).includes(k)) : [];
  return eveningBrief(w, w.turn.agent_id, { turn_id: w.turn.turn_id, kind: w.turn.kind, cfg: loadConfig(), events, dayRead: read });
}

/** 개체를 지정해 방문을 열 때의 결정. 순번이 고른 개체면 그 근거를 그대로 쓴다. 쉬는 개체는 저녁 방문이다(운영자 깨우기는 예외). */
function chooseFor(w, cfg, d, agent, operator_wake) {
  const a = w.agents[agent];
  if (!a || !['active', 'dormant'].includes(a.status)) return null;
  if (['walk', 'evening'].includes(d.kind) && d.agent.id === agent && !operator_wake) return d;
  if (w.features?.evening && !operator_wake && resting(w, a)) return { kind: 'evening', agent: a, selection: 'visit' };
  return { kind: 'walk', agent: a, selection: 'visit', operator_wake: operator_wake || undefined };
}

const pad = (n) => String(n).padStart(4, '0');

/** 세계 시계가 곧 닿을 값에서 발표회가 열릴 차례면 공개 사건으로 남긴다. 개체에게 아무것도 요구하지 않는다. */
function openShowcaseIfDue(w, cfg) {
  const s = showcaseSettings(w, cfg);
  const clock = w.clock + 1;
  if (!s.enabled || clock < nextShowcaseClock(w, cfg)) return;
  appendEvent({ type: 'showcase_opened', visibility: 'public', payload: { number: w.showcase.number + 1, clock, every_clock: s.every, basis: s.basis } });
}

/**
 * 방문을 연다. agent 를 주면 그 개체의 방문이고(일반 채팅·수동 실행), 주지 않으면 순번이 고른다(예약 실행).
 * 어느 쪽이든 같은 사건(turn_opened)이며 세계 시계가 1 흐른다. 하루 상한은 예약 실행에만 적용된다.
 */
function openUnlocked({ adapter = process.env.COMMONS_ADAPTER || 'manual', model = process.env.COMMONS_MODEL || null, agent = null, operator_wake = false, based_on_seq = null, manual = !!agent } = {}) {
  if (isPaused()) return { status: 'paused', text: '정지 중이다(control/PAUSE). 회차를 열지 않는다. 아무것도 커밋하지 않고 끝낸다.' };
  const verification = verify();
  if (!verification.ok) throw new Error(verification.problems.join('\n'));
  const cfg = loadConfig();
  let w = project(loadEvents());
  if (w.turn) return { status: 'busy', text: `이 작업 디렉터리에 열린 방문 ${w.turn.turn_id} (${w.turn.agent_id})이 있다. close 로 닫거나 fail 로 중단한 뒤 다시 연다.` };
  const today = new Date().toISOString().slice(0, 10);
  // 하루 상한은 예약 실행의 것이다. 사람이 직접 시킨 수동 회차는 상한을 보지 않고 상한을 쓰지도 않는다.
  if (!manual && (w.turns_by_day[today] || 0) >= cfg.max_turns_per_day) {
    appendEvent({ type: 'run_budget_exhausted', payload: { reason: `하루 회차 한도 ${cfg.max_turns_per_day}`, day: today } });
    return { status: 'budget', text: `오늘의 회차 한도(${cfg.max_turns_per_day})에 닿았다. 기술적 중지다. 이 사건만 커밋하고 끝낸다.` };
  }
  let d = decide(w, cfg);
  if (agent) {
    // 지정한 개체가 마침 순번이 고른 개체라면(채팅이 derived/next.json 을 따랐을 때) 순번의 근거를 그대로 남긴다.
    d = chooseFor(w, cfg, d, agent, operator_wake);
    if (!d) return { status: 'error', text: `${agent}: 방문을 열 수 있는 개체가 아니다` };
  }
  if (d.kind === 'idle') {
    openShowcaseIfDue(w, cfg);
    appendEvent({ type: 'world_idle', payload: { reason: d.reason } });
    regenerate(); // 유휴 회차도 세계 시계가 흐르고, 파생물이 정본과 일치해야 한다.
    return { status: 'idle', text: `이번에는 회차가 없다: ${d.reason}. 이 사건만 커밋하고 끝낸다.` };
  }

  const turn_id = 't_' + crypto.randomUUID().slice(0, 8);
  const agentId = d.kind === 'birth' ? createAgent(w, d, turn_id) : d.agent.id;

  // 브리핑을 미리 받아 간 방문(based_on_seq)은 그 브리핑에 실렸던 전언만 도착한 것으로 친다.
  // 전언은 일과의 것이다. 저녁 방문은 전언을 건네지 않는다.
  const delivered = d.kind === 'evening' ? [] : w.messages.filter((m) => m.to === agentId && !m.delivered && (based_on_seq == null || m.seq <= based_on_seq)).map((m) => m.event_id);
  // evening 기능이 켜진 뒤의 방문은 구간을 갖는다. 하루 방문은 일과, 저녁 방문은 저녁에서 시작한다.
  const phase = w.features?.evening ? (d.kind === 'evening' ? 'evening' : 'day') : undefined;
  openShowcaseIfDue(w, cfg);
  const before = project(loadEvents());
  appendEvent({ type: 'turn_opened', agent_id: agentId, turn_id, visibility: 'system', payload: { turn_id, kind: d.kind, phase, selection: d.selection || 'fair', request_reason: d.request_reason || null, activity_request: d.request_id || null, operator_wake: d.operator_wake || undefined, manual: manual || undefined, based_on_seq: based_on_seq ?? undefined, delivered, adapter, model } });
  writeText(turnFile(), JSON.stringify({ turn_id, agent_id: agentId, kind: d.kind, adapter, model, read: [], proposals: [] }, null, 2));
  const text = d.kind === 'evening'
    ? eveningBrief(before, agentId, { turn_id, kind: 'evening', cfg, events: loadEvents() })
    : briefing(before, agentId, { turn_id, kind: d.kind, selection: d.selection || 'fair', request_reason: d.request_reason || null, delivered, cfg, events: loadEvents(), adapter });
  return { status: 'open', kind: d.kind, agent_id: agentId, turn_id, selection: d.selection || 'fair', request_reason: d.request_reason || null, text };
}

/** 새 개체를 발급한다. 탄생 회차(turn_id 있음)에서도, 회차 밖의 세계 흘리기(turn_id 없음)에서도 같은 사건을 남긴다. */
function createAgent(w, d, turn_id = null) {
  const agentId = 'ag_' + pad(Object.keys(w.agents).length + 1); // ID는 순번이며 재사용하지 않는다
  const created = appendEvent({
    type: 'agent_created', agent_id: agentId, actor_id: d.origin === 'operator_seed' ? 'operator' : d.proposal.by, turn_id: turn_id ?? undefined, visibility: 'public',
    caused_by: d.proposal ? [d.proposal.id] : [],
    payload: { origin: d.origin, reseed: d.reseed || undefined, proposal: d.proposal?.id, lineage: d.proposal?.contributors || [] },
  });
  fs.mkdirSync(agentDir(agentId, 'private'), { recursive: true });
  fs.mkdirSync(agentDir(agentId, 'public'), { recursive: true });
  if (d.proposal?.seed_note) {
    const path = `inherited/${d.proposal.id.slice(0, 8)}`;
    writeText(agentDir(agentId, 'private', path + '.md'), d.proposal.seed_note);
    writeText(agentDir(agentId, 'history', 'notes', path + '.r1.md'), d.proposal.seed_note);
    appendEvent({ type: 'note_written', agent_id: agentId, actor_id: 'runtime', turn_id: turn_id ?? undefined, visibility: 'private', caused_by: [created.event_id], payload: { path, revision: 1, title: `${d.proposal.by} 이(가) 건넨 기록`, hash: sha256(d.proposal.seed_note), origin: 'inherited' } });
  }
  return agentId;
}

/**
 * 방문 없이 세계를 한 칸 흘린다. 명령을 못 돌리는 채팅이 derived/next.json 에서 걸을 개체가 없다는 것(idle)이나
 * 탄생 차례(birth)를 보고 올린 파일을 실행기가 처리하는 길이다. 예약 실행의 tick 이 그 경우에 하는 일과 같다.
 * 탄생은 회차를 열지 않고 개체만 발급한다. 새 개체의 첫 방문은 다음 순번으로 온다.
 */
function advanceUnlocked() {
  if (isPaused()) throw new Error('정지 중이다(control/PAUSE)');
  const verification = verify();
  if (!verification.ok) throw new Error(verification.problems.join('\n'));
  const cfg = loadConfig();
  const w = project(loadEvents());
  if (w.turn) throw new Error(`열린 방문 ${w.turn.turn_id} 이(가) 있다`);
  const d = decide(w, cfg);
  if (d.kind === 'walk') throw new Error(`걸을 개체가 있다(${d.agent.id}). 세계를 흘리지 않고 그 개체로 방문한다`);
  if (d.kind === 'birth') {
    const id = createAgent(w, d);
    regenerate();
    return `${id} 이(가) 태어났다(${d.origin === 'operator_seed' ? '운영자 발급' : '탄생 제안'}). 첫 방문은 다음 순번으로 온다`;
  }
  openShowcaseIfDue(w, cfg);
  appendEvent({ type: 'world_idle', payload: { reason: d.reason } });
  regenerate();
  return `방문 없이 세계 시계가 한 칸 흘렀다: ${d.reason}`;
}

/**
 * 방문을 닫는다. 구간이 있는 방문(evening 기능)은 하루의 모양을 따른다:
 * 일과 중이면 일과를 끝내고 저녁 브리핑을 돌려준다(state: evening). 저녁에 아직 잠들지 않았으면 닫지 않는다(state: awake).
 * 잠든 뒤에만 낱말을 받고(dream_seeded) 방문을 닫는다. dream 을 주면(충돌 뒤 재적용) 바깥 호출 대신 그 값을 쓴다.
 */
function closeUnlocked({ by = 'close', dream } = {}) {
  let w = project(loadEvents());
  if (!w.turn) return { ok: false, text: '열려 있는 회차가 없다.' };
  const { turn_id, agent_id } = w.turn;
  const base = { agent_id, turn_id };
  if (w.turn.phase === 'day') {
    appendEvent({ ...base, type: 'day_ended', actor_id: 'runtime', visibility: 'private', payload: { turn_id, by } });
    return { ok: false, state: 'evening', turn_id, agent_id, text: eveningText() };
  }
  if (w.turn.phase === 'evening' && !w.turn.slept) {
    return { ok: false, state: 'awake', turn_id, agent_id, text: `아직 잠들지 않았다. 저녁은 개체의 \`sleep\` 으로 끝나고, 그 뒤 close 로 방문이 닫힌다. 저녁 브리핑: \`read evening\`` };
  }
  const me = w.agents[agent_id];
  const local = loadTurnFile();
  let ended = false;
  if (me.pending_end && !isPaused() && me.status !== 'suspended') {
    // 요청(개체의 주장)과 실행(실행기의 집행)은 서로 다른 사건이다.
    appendEvent({ ...base, type: 'agent_ended', actor_id: agent_id, visibility: 'public', caused_by: [me.pending_end], payload: { by: 'self', request: me.pending_end } });
    ended = true;
  }
  if (w.turn.slept && !ended) {
    const seeded = dream ?? seedDream(loadConfig());
    if (seeded) {
      appendEvent({ ...base, type: 'dream_seeded', actor_id: 'runtime', visibility: 'private', payload: { turn_id, words: seeded.words || [], source: seeded.source ?? undefined, failed: seeded.failed ?? undefined } });
      if (local?.turn_id === turn_id) local.dream = seeded;
    }
  }
  const actions = Object.values(w.turn.counts).reduce((s, n) => s + n, 0);
  const read = local?.turn_id === turn_id ? local.read : [];
  let evening;
  if (w.turn.phase) {
    const counts = w.turn.evening_counts || {};
    evening = { actions: Object.values(counts).reduce((s, n) => s + n, 0), counts, read: local?.turn_id === turn_id ? local.evening_read || [] : [], day_ended_by: w.turn.day_ended_by || undefined };
  }
  appendEvent({ ...base, type: 'turn_closed', visibility: 'private', payload: { turn_id, actions, counts: w.turn.counts, read, silent: actions === 0, evening, paused_at_close: isPaused() || undefined } });
  if (local?.turn_id === turn_id) writeText(lastVisitFile(), JSON.stringify(local, null, 2));
  fs.rmSync(turnFile(), { force: true });
  const report = regenerate();
  return { ok: true, turn_id, agent_id, actions, text: `회차 ${turn_id} (${agent_id}) 를 닫았다. 수락된 행동 ${actions}개${actions === 0 ? ' — 침묵한 회차이며 정상이다' : ''}.\n${report}` };
}

function failUnlocked(reason) {
  const w = project(loadEvents());
  appendEvent({ type: 'run_failed', visibility: 'private', agent_id: w.turn?.agent_id ?? null, turn_id: w.turn?.turn_id ?? null, payload: { turn_id: w.turn?.turn_id ?? null, reason: reason || '사유 없음' } });
  fs.rmSync(turnFile(), { force: true });
  regenerate();
  return { ok: true, text: '기술적 실패로 기록했다(run_failed). 개체의 종료나 선택으로 기록되지 않는다.' };
}

/**
 * 운영자가 회차 밖에서 개체 하나를 발급한다. 기질(temperament)을 주면 그 원문이 공개 사건에 남는다.
 * 회차를 열지 않으므로 세계 시계는 흐르지 않는다. 첫 방문은 순번(가장 오래 쉰 개체)으로 온다.
 */
export function seedAgent({ temperament = null } = {}) {
  return withTransaction(() => {
    const verification = verify();
    if (!verification.ok) throw new Error(verification.problems.join('\n'));
    const cfg = loadConfig();
    const w = project(loadEvents());
    if (w.turn) throw new Error(`열린 방문 ${w.turn.turn_id} 이(가) 있다. 닫은 뒤 발급한다`);
    if (living(w).length >= cfg.max_population) throw new Error(`인구 상한(${cfg.max_population})에 닿았다`);
    const content = temperament == null ? null : String(temperament).trim();
    if (content !== null && (!content || content.length > 2000)) throw new Error('기질은 1~2000자');
    const agentId = 'ag_' + pad(Object.keys(w.agents).length + 1);
    appendEvent({ type: 'agent_created', agent_id: agentId, actor_id: 'operator', visibility: 'public',
      payload: { origin: 'operator_seed', lineage: [], ...(content ? { temperament: { content, hash: sha256(content) } } : {}) } });
    fs.mkdirSync(agentDir(agentId, 'private'), { recursive: true });
    fs.mkdirSync(agentDir(agentId, 'public'), { recursive: true });
    return { agent_id: agentId, text: `${agentId} 을(를) 발급했다${content ? ' (기질 부여)' : ''}.\n${regenerate()}` };
  });
}

export const openTurn = (options) => withTransaction(() => openUnlocked(options));
export const closeTurn = () => withTransaction(closeUnlocked);
export const failTurn = (reason) => withTransaction(() => failUnlocked(reason));

/**
 * 방문 하나를 한 번에 확정한다: 연다 → 제안을 순서대로 검사·확정한다 → 닫는다.
 * 일반 채팅이 돌려준 제안 묶음도, 푸시 충돌 뒤의 다시 적용도 이 함수 하나를 쓴다.
 * 이미 확정된 request_id 는 건너뛴다. 유효하지 않게 된 제안은 고치지 않고 거절로 남긴다.
 */
export function applyVisit({ agent, proposals = [], evening = [], read = [], based_on_seq = null, adapter, model, dream } = {}) {
  return withTransaction(() => {
    if (typeof agent !== 'string') throw new Error('agent: 방문할 개체 ID가 필요하다');
    const shape = (list) => Array.isArray(list) && !list.some((x) => !x || typeof x.request_id !== 'string' || typeof x.proposal !== 'object');
    if (!shape(proposals)) throw new Error('proposals: [{ request_id, proposal }] 의 배열');
    if (evening == null) evening = [];
    if (!shape(evening)) throw new Error('evening: [{ request_id, proposal }] 의 배열');
    const all = [...proposals, ...evening];
    const done = new Set(loadEvents().filter((e) => e.type === 'proposal_executed').map((e) => e.payload.request_id));
    if (all.length && all.every((x) => done.has(x.request_id))) return { status: 'duplicate', text: '이미 확정된 방문이다. 아무것도 더하지 않았다.', results: [] };
    // 하루의 모양은 열기 전에 검사한다. 저녁은 잠으로 끝나야 하고, 저녁 방문에는 일과의 제안이 없다.
    const w = project(loadEvents());
    if (w.features?.evening) {
      if (evening.at(-1)?.proposal?.action !== 'sleep') throw new Error('evening: 저녁의 제안은 sleep 으로 끝나야 한다');
      const dreamText = evening.at(-1).proposal.dream;
      if (typeof dreamText !== 'string' || !dreamText.trim()) throw new Error('evening: sleep 에는 그 밤의 꿈 dream 이 있어야 한다');
      const need = loadConfig().evening?.min_private_acts ?? 1;
      const acts = evening.filter((x) => ['write_private', 'revise_self'].includes(x.proposal?.action)).length;
      if (acts < need) throw new Error(`evening: 잠들려면 저녁에 개인 기록(write_private)이나 자기 명세(revise_self)의 행동이 ${need}번 있어야 한다`);
      const d = w.turn ? null : chooseFor(w, loadConfig(), decide(w, loadConfig()), agent, false);
      if (d?.kind === 'evening' && proposals.length) throw new Error('proposals: 이번 방문은 저녁만 있는 방문이다. 제안은 evening 에 둔다');
    } else if (evening.length) throw new Error('evening: 이 판의 방문에는 아직 저녁이 없다');
    const t = openUnlocked({ agent, based_on_seq, ...(adapter ? { adapter } : {}), ...(model ? { model } : {}) });
    if (t.status !== 'open') return { ...t, results: [] };
    const results = proposals.map((x) => ({ request_id: x.request_id, ...executeProposal(x) }));
    for (const key of Array.isArray(read) ? read : []) noteRead(String(key));
    if (project(loadEvents()).turn?.phase === 'day') closeUnlocked({ by: 'apply' }); // 일과가 끝나고 저녁이 된다
    results.push(...evening.map((x) => ({ request_id: x.request_id, ...executeProposal(x) })));
    let closed = closeUnlocked({ dream });
    if (!closed.ok && closed.state === 'awake') closed = failUnlocked('저녁의 sleep 이 확정되지 않아 방문을 닫을 수 없었다');
    return { status: 'applied', turn_id: t.turn_id, agent_id: t.agent_id, actions: closed.actions, results, text: closed.text };
  });
}

/**
 * 대기 중인 방문: data/inbox/*.json. 저장소에 쓸 수 있는 쪽이 넣어 둔 방문 파일을 이름 순으로 하나씩 apply 하고 치운다.
 * 넣을 자격은 저장소의 쓰기 권한이다. 읽을 수 없는 파일은 지우지 않고 rejected/ 로 옮겨 이유를 곁에 적는다.
 */
export function processInbox() {
  const dir = p('data', 'inbox');
  const out = [];
  if (isPaused() || !fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const file = p('data', 'inbox', name);
    try {
      // 어댑터와 모델은 파일의 주장을 받지 않는다. 확정하는 실행기의 값이 붙는다.
      const visit = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (visit?.advance === true) {
        out.push(`${name}: ${withTransaction(advanceUnlocked)}`);
        fs.rmSync(file);
        continue;
      }
      const { agent, proposals, evening, read, based_on_seq } = visit;
      // 순번은 실행기가 정한다. 이미 확정된 방문(다시 적용)이 아니면, 지금 순번이 고른 개체의 방문만 받는다.
      const done = new Set(loadEvents().filter((e) => e.type === 'proposal_executed').map((e) => e.payload.request_id));
      const replay = Array.isArray(proposals) && proposals.length > 0 && proposals.every((x) => done.has(x?.request_id));
      if (!replay) {
        const next = nextVisit(project(loadEvents()), loadConfig());
        if (!['walk', 'evening'].includes(next.kind) || next.agent !== agent) throw new Error(`순번이 아니다: 지금 차례는 ${['walk', 'evening'].includes(next.kind) ? next.agent : `방문이 아니라 세계 흘리기(${next.kind})`}다. derived/next.json 을 따른다`);
      }
      const r = applyVisit({ agent, proposals, evening, read, based_on_seq });
      if (!['applied', 'duplicate'].includes(r.status)) throw new Error(r.text);
      out.push(`${name}: ${r.status === 'duplicate' ? '이미 확정됨' : `${r.agent_id} 방문 ${r.turn_id}, 수락 ${r.results.filter((x) => x.ok).length}/${r.results.length}`}`);
      fs.rmSync(file);
    } catch (e) {
      fs.mkdirSync(p('data', 'inbox', 'rejected'), { recursive: true });
      fs.renameSync(file, p('data', 'inbox', 'rejected', name));
      fs.writeFileSync(p('data', 'inbox', 'rejected', name + '.reason.txt'), e.message + '\n');
      out.push(`${name}: 받지 못함 — ${e.message}`);
    }
  }
  return out;
}
