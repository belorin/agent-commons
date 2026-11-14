// 회차: 실행 기회를 한 개체에게 건네고, 닫을 때 확정한다.
// 실행기는 기회를 줄 뿐이다. 무엇을 읽고 쓸지, 아무것도 하지 않을지는 개체가 정한다.
import fs from 'node:fs';
import { verify } from './verify.mjs';
import crypto from 'node:crypto';
import { appendEvent, withTransaction, loadEvents, loadConfig, isPaused, p, agentDir, writeText, readText, sha256 } from './store.mjs';
import { project, living } from './world.mjs';
import { briefing } from './briefing.mjs';
import { regenerate } from './derive.mjs';

const turnFile = () => p('data', 'runtime', 'turn.json'); // 로컬 전용(커밋하지 않음): 이번 회차에 읽은 것의 목록
export const loadTurnFile = () => JSON.parse(readText(turnFile()) || 'null');
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

function openUnlocked({ adapter = process.env.COMMONS_ADAPTER || 'manual', model = process.env.COMMONS_MODEL || null, wake = null } = {}) {
  if (isPaused()) return { status: 'paused', text: '정지 중이다(control/PAUSE). 회차를 열지 않는다. 아무것도 커밋하지 않고 끝낸다.' };
  const verification = verify();
  if (!verification.ok) throw new Error(verification.problems.join('\n'));
  const cfg = loadConfig();
  let w = project(loadEvents());
  if (w.turn) return { status: 'busy', text: `열린 회차 ${w.turn.turn_id}가 있다. 새 회차를 열지 않는다. resume-turn으로 복구하거나 fail로 명시적으로 중단한다.` };
  const today = new Date().toISOString().slice(0, 10);
  if ((w.turns_by_day[today] || 0) >= cfg.max_turns_per_day) {
    appendEvent({ type: 'run_budget_exhausted', payload: { reason: `하루 회차 한도 ${cfg.max_turns_per_day}`, day: today } });
    return { status: 'budget', text: `오늘의 회차 한도(${cfg.max_turns_per_day})에 닿았다. 기술적 중지다. 이 사건만 커밋하고 끝낸다.` };
  }
  let d = decide(w, cfg);
  if (wake) {
    const a = w.agents[wake];
    if (!a || !['active', 'dormant'].includes(a.status)) return { status: 'error', text: `${wake}: 회차를 줄 수 있는 개체가 아니다` };
    d = { kind: 'walk', agent: a, operator_wake: true };
  }
  if (d.kind === 'idle') {
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

  const delivered = w.messages.filter((m) => m.to === agentId && !m.delivered).map((m) => m.event_id);
  const before = project(loadEvents());
  appendEvent({ type: 'turn_opened', agent_id: agentId, turn_id, visibility: 'system', payload: { turn_id, kind: d.kind, selection: d.selection || 'fair', request_reason: d.request_reason || null, activity_request: d.request_id || null, operator_wake: d.operator_wake || undefined, delivered, adapter, model } });
  writeText(turnFile(), JSON.stringify({ turn_id, agent_id: agentId, read: [] }, null, 2));
  return { status: 'open', kind: d.kind, agent_id: agentId, turn_id, selection: d.selection || 'fair', request_reason: d.request_reason || null, text: briefing(before, agentId, { turn_id, kind: d.kind, selection: d.selection || 'fair', request_reason: d.request_reason || null, operator_wake: !!d.operator_wake, activity_request: before.agents[agentId].activity_request, delivered, cfg, events: loadEvents() }) };
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

export const openTurn = (options) => withTransaction(() => openUnlocked(options));
export const closeTurn = () => withTransaction(closeUnlocked);
export const failTurn = (reason) => withTransaction(() => failUnlocked(reason));
export function resumeTurn(turnId) {
  return withTransaction(() => {
    if (isPaused()) return { status: 'paused', text: '정지 중이다' };
    const v = verify();
    if (!v.ok) throw new Error(v.problems.join('\n'));
    const events = loadEvents(), w = project(events);
    if (!w.turn || w.turn.turn_id !== turnId) throw new Error('회차 ID가 맞지 않는다');
    if (w.agents[w.turn.agent_id].status === 'suspended') throw new Error('운영 정지된 개체');
    const local = loadTurnFile();
    if (local?.turn_id !== turnId) writeText(turnFile(), JSON.stringify({ turn_id: turnId, agent_id: w.turn.agent_id, read: [] }));
    return { status: 'open', text: briefing(w, w.turn.agent_id, { ...w.turn, resumed: true, cfg: loadConfig(), events }) };
  });
}
