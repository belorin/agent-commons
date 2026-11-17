// 회차: 실행 기회를 한 개체에게 건네고, 닫을 때 확정한다.
// 실행기는 기회를 줄 뿐이다. 무엇을 읽고 쓸지, 아무것도 하지 않을지는 개체가 정한다.
import fs from 'node:fs';
import { verify } from './verify.mjs';
import crypto from 'node:crypto';
import { appendEvent, withTransaction, loadEvents, loadConfig, isPaused, p, agentDir, writeText, readText, sha256 } from './store.mjs';
import { project, living } from './world.mjs';
import { briefing } from './briefing.mjs';
import { regenerate } from './derive.mjs';
import { executeProposal } from './actions.mjs';
import { showcaseSettings, nextShowcaseClock } from './showcase.mjs';

// 로컬 전용(커밋하지 않음): 열린 방문이 읽은 것과 낸 제안. 닫으면 last-visit.json 으로 남아,
// 푸시가 거절됐을 때 최신 정본 위에서 같은 제안을 다시 검증하는 데 쓰인다.
const turnFile = () => p('data', 'runtime', 'turn.json');
const lastVisitFile = () => p('data', 'runtime', 'last-visit.json');
export const loadTurnFile = () => JSON.parse(readText(turnFile()) || 'null');
export const loadLastVisit = () => JSON.parse(readText(lastVisitFile()) || 'null');
export function noteProposal(request_id, proposal) {
  const t = loadTurnFile();
  if (!t) return;
  t.proposals.push({ request_id, proposal });
  writeText(turnFile(), JSON.stringify(t, null, 2));
}
export function noteRead(key) {
  const t = loadTurnFile();
  if (!t) return;
  if (!t.read.includes(key)) t.read.push(key);
  writeText(turnFile(), JSON.stringify(t, null, 2));
}

const pad = (n) => String(n).padStart(4, '0');

function wakeDue(w, a) {
  if (a.status !== 'dormant') return false;
  const wake = a.wake || {};
  if (wake.after_turns != null && w.clock - (a.dormant_since_clock ?? a.dormant_since_turn) >= wake.after_turns) return true;
  if (wake.on_message && w.messages.some((m) => m.to === a.id && !m.delivered)) return true;
  return false;
}

/** 세계 시계가 곧 닿을 값에서 발표회가 열릴 차례면 공개 사건으로 남긴다. 개체에게 아무것도 요구하지 않는다. */
function openShowcaseIfDue(w, cfg) {
  const s = showcaseSettings(w, cfg);
  const clock = w.clock + 1;
  if (!s.enabled || clock < nextShowcaseClock(w, cfg)) return;
  appendEvent({ type: 'showcase_opened', visibility: 'public', payload: { number: w.showcase.number + 1, clock, every_clock: s.every, basis: s.basis } });
}

/** 개체가 선택한 다음 활동 조건. OR 관계이며 응답을 강제하지 않는다. */
export function activityDue(w, a) {
  const r = a.activity_request;
  if (!r || a.status !== 'active') return null;
  if (r.after_turns !== null && w.clock - (r.from_clock ?? r.from_turn) >= r.after_turns) return 'elapsed';
  if (r.on_message && w.messages.some((m) => m.to === a.id && m.seq > r.seq && !m.delivered)) return 'message';
  if (r.on_reference && Object.values(w.works).some((x) =>
    x.agent !== a.id && x.status === 'published' && x.seq > r.seq &&
    x.links.some((link) => link === a.id || link.startsWith(a.id + '/')))) return 'reference';
  return null;
}

/** 이번 회차에 무슨 일이 일어날지 정한다. 난수도 숨은 확률도 없다. */
export function decide(w, cfg) {
  const alive = living(w);
  const created = Object.keys(w.agents).length;
  const room = alive.length < cfg.max_population;
  if (created < cfg.seed_population && room) return { kind: 'birth', origin: 'operator_seed' };
  const accepted = Object.values(w.births).filter((b) => b.status === 'accepted').sort((x, y) => x.seq - y.seq)[0];
  if (accepted && room && w.turns - w.last_birth_turn >= cfg.birth.min_turns_between_births) {
    return { kind: 'birth', origin: 'birth_proposal', proposal: accepted };
  }
  // 아직 조건이 차지 않은 요청은 그 개체가 스스로 일반 순번을 유보한 것으로 취급한다.
  const eligible = alive.filter((a) =>
    (a.status === 'active' && (!a.activity_request || activityDue(w, a))) || wakeDue(w, a)
  ).sort((x, y) => x.last_turn - y.last_turn || x.id.localeCompare(y.id));
  const due = eligible.filter((a) => a.status === 'active' && activityDue(w, a));
  const limit = Number.isInteger(cfg.scheduling?.max_request_streak) ? Math.max(0, cfg.scheduling.max_request_streak) : 2;
  if (due.length && (w.request_streak < limit || due.length === eligible.length)) {
    const agent = due[0];
    return { kind: 'walk', agent, selection: 'requested', request_reason: activityDue(w, agent), request_id: agent.activity_request.event_id };
  }
  if (eligible.length) return { kind: 'walk', agent: eligible[0], selection: 'fair' };
  if (!alive.length && cfg.on_empty_world === 'reseed') return { kind: 'birth', origin: 'operator_seed', reseed: true };
  return { kind: 'idle', reason: alive.length ? '깨어 있는 개체가 없다(모두 휴면)' : '남은 개체가 없고 운영 정책이 재시작을 하지 않는다' };
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
    const a = w.agents[agent];
    if (!a || !['active', 'dormant'].includes(a.status)) return { status: 'error', text: `${agent}: 방문을 열 수 있는 개체가 아니다` };
    d = { kind: 'walk', agent: a, selection: 'visit', operator_wake: operator_wake || undefined };
  }
  if (d.kind === 'idle') {
    openShowcaseIfDue(w, cfg);
    appendEvent({ type: 'world_idle', payload: { reason: d.reason } });
    regenerate(); // 유휴 회차도 세계 시계가 흐르고, 파생물이 정본과 일치해야 한다.
    return { status: 'idle', text: `이번에는 회차가 없다: ${d.reason}. 이 사건만 커밋하고 끝낸다.` };
  }

  const turn_id = 't_' + crypto.randomUUID().slice(0, 8);
  let agentId;
  if (d.kind === 'birth') {
    agentId = 'ag_' + pad(Object.keys(w.agents).length + 1); // ID는 순번이며 재사용하지 않는다
    const created = appendEvent({
      type: 'agent_created', agent_id: agentId, actor_id: d.origin === 'operator_seed' ? 'operator' : d.proposal.by, turn_id, visibility: 'public',
      caused_by: d.proposal ? [d.proposal.id] : [],
      payload: { origin: d.origin, reseed: d.reseed || undefined, proposal: d.proposal?.id, lineage: d.proposal?.contributors || [] },
    });
    fs.mkdirSync(agentDir(agentId, 'private'), { recursive: true });
    fs.mkdirSync(agentDir(agentId, 'public'), { recursive: true });
    if (d.proposal?.seed_note) {
      const path = `inherited/${d.proposal.id.slice(0, 8)}`;
      writeText(agentDir(agentId, 'private', path + '.md'), d.proposal.seed_note);
      writeText(agentDir(agentId, 'history', 'notes', path + '.r1.md'), d.proposal.seed_note);
      appendEvent({ type: 'note_written', agent_id: agentId, actor_id: 'runtime', turn_id, visibility: 'private', caused_by: [created.event_id], payload: { path, revision: 1, content: d.proposal.seed_note, title: `${d.proposal.by} 이(가) 건넨 기록`, hash: sha256(d.proposal.seed_note), origin: 'inherited' } });
    }
  } else agentId = d.agent.id;

  // 브리핑을 미리 받아 간 방문(based_on_seq)은 그 브리핑에 실렸던 전언만 도착한 것으로 친다.
  const delivered = w.messages.filter((m) => m.to === agentId && !m.delivered && (based_on_seq == null || m.seq <= based_on_seq)).map((m) => m.event_id);
  openShowcaseIfDue(w, cfg);
  const before = project(loadEvents());
  appendEvent({ type: 'turn_opened', agent_id: agentId, turn_id, visibility: 'system', payload: { turn_id, kind: d.kind, selection: d.selection || 'fair', request_reason: d.request_reason || null, activity_request: d.request_id || null, operator_wake: d.operator_wake || undefined, manual: manual || undefined, based_on_seq: based_on_seq ?? undefined, delivered, adapter, model } });
  writeText(turnFile(), JSON.stringify({ turn_id, agent_id: agentId, kind: d.kind, adapter, model, read: [], proposals: [] }, null, 2));
  return { status: 'open', kind: d.kind, agent_id: agentId, turn_id, selection: d.selection || 'fair', request_reason: d.request_reason || null, text: briefing(before, agentId, { turn_id, kind: d.kind, selection: d.selection || 'fair', request_reason: d.request_reason || null, delivered, cfg, events: loadEvents(), adapter }) };
}

function closeUnlocked() {
  const w = project(loadEvents());
  if (!w.turn) return { ok: false, text: '열려 있는 회차가 없다.' };
  const { turn_id, agent_id } = w.turn;
  const me = w.agents[agent_id];
  const base = { agent_id, turn_id };
  if (me.pending_end && !isPaused() && me.status !== 'suspended') {
    // 요청(개체의 주장)과 실행(실행기의 집행)은 서로 다른 사건이다.
    appendEvent({ ...base, type: 'agent_ended', actor_id: agent_id, visibility: 'public', caused_by: [me.pending_end], payload: { by: 'self', request: me.pending_end } });
  }
  const actions = Object.values(w.turn.counts).reduce((s, n) => s + n, 0);
  const local = loadTurnFile();
  const read = local?.turn_id === turn_id ? local.read : [];
  appendEvent({ ...base, type: 'turn_closed', visibility: 'private', payload: { turn_id, actions, counts: w.turn.counts, read, silent: actions === 0, paused_at_close: isPaused() || undefined } });
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
export function applyVisit({ agent, proposals = [], read = [], based_on_seq = null, adapter, model } = {}) {
  return withTransaction(() => {
    if (typeof agent !== 'string') throw new Error('agent: 방문할 개체 ID가 필요하다');
    if (!Array.isArray(proposals) || proposals.some((x) => !x || typeof x.request_id !== 'string' || typeof x.proposal !== 'object')) throw new Error('proposals: [{ request_id, proposal }] 의 배열');
    const done = new Set(loadEvents().filter((e) => e.type === 'proposal_executed').map((e) => e.payload.request_id));
    if (proposals.length && proposals.every((x) => done.has(x.request_id))) return { status: 'duplicate', text: '이미 확정된 방문이다. 아무것도 더하지 않았다.', results: [] };
    const t = openUnlocked({ agent, based_on_seq, ...(adapter ? { adapter } : {}), ...(model ? { model } : {}) });
    if (t.status !== 'open') return { ...t, results: [] };
    const results = proposals.map((x) => ({ request_id: x.request_id, ...executeProposal(x) }));
    for (const key of Array.isArray(read) ? read : []) noteRead(String(key));
    const closed = closeUnlocked();
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
      const { agent, proposals, read, based_on_seq } = JSON.parse(fs.readFileSync(file, 'utf8'));
      const r = applyVisit({ agent, proposals, read, based_on_seq });
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
