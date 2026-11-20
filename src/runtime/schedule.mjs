// 순번: 다음에 누가 걸을지, 아니면 탄생이나 유휴 회차인지 정한다. 난수도 숨은 확률도 없다.
// 예약 실행(tick)과 명령을 못 돌리는 채팅(derived/next.json 을 읽는다)이 같은 결정을 따른다.
import { living } from './world.mjs';

export function wakeDue(w, a) {
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

/**
 * 쉬는 중인가: 휴면 중이고 깨어날 조건이 차지 않았거나, 활동 요청을 남겼고 그 조건이 차지 않았다.
 * evening 기능이 켜진 뒤에는 쉬는 개체도 순번에 남고, 차례가 오면 저녁만 있는 방문을 받는다.
 */
/** 직무를 맡고 일하는 중인가(휴면은 휴직이다). 그런 개체의 방문은 오전(직무)으로 시작한다. */
export function working(w, a) {
  const j = a?.job ? w.jobs?.[a.job] : null;
  return !!(w.features?.evening && j && j.status === 'active' && a.status === 'active');
}

export function resting(w, a) {
  if (a.status === 'dormant') return !wakeDue(w, a);
  return a.status === 'active' && !!a.activity_request && !activityDue(w, a);
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
  // evening 기능이 켜진 뒤에는 유보한 개체도 순번에 남는다. 차례가 오면 저녁만 있는 방문이다.
  const evening = !!w.features?.evening;
  const eligible = alive.filter((a) =>
    evening || (a.status === 'active' && (!a.activity_request || activityDue(w, a))) || wakeDue(w, a)
  ).sort((x, y) => x.last_turn - y.last_turn || x.id.localeCompare(y.id));
  const due = eligible.filter((a) => a.status === 'active' && activityDue(w, a));
  const limit = Number.isInteger(cfg.scheduling?.max_request_streak) ? Math.max(0, cfg.scheduling.max_request_streak) : 2;
  if (due.length && (w.request_streak < limit || due.length === eligible.length)) {
    const agent = due[0];
    return { kind: 'walk', agent, selection: 'requested', request_reason: activityDue(w, agent), request_id: agent.activity_request.event_id };
  }
  if (eligible.length) {
    const a = eligible[0];
    // 쉬는 중이어도 직장인은 출근한다: 오전(직무) 다음 바로 저녁(work). 휴면은 휴직이라 저녁만.
    if (evening && resting(w, a)) return working(w, a) ? { kind: 'work', agent: a, selection: 'rest' } : { kind: 'evening', agent: a, selection: 'rest' };
    return { kind: 'walk', agent: a, selection: 'fair' };
  }
  if (!alive.length && cfg.on_empty_world === 'reseed') return { kind: 'birth', origin: 'operator_seed', reseed: true };
  if (alive.length) return { kind: 'idle', reason: alive.some((a) => a.status === 'active') ? '활동 중인 개체는 모두 스스로 정한 때를 기다리고, 나머지는 휴면 중이다' : '깨어 있는 개체가 없다(모두 휴면)' };
  return { kind: 'idle', reason: '남은 개체가 없고 운영 정책이 재시작을 하지 않는다' };
}


/** 파생물로 내보내는 다음 차례. 채팅은 이것을 읽고 그 개체로만 방문하거나, 걸을 개체가 없으면 세계를 한 칸 흘린다. */
export function nextVisit(w, cfg, { paused = false } = {}) {
  const base = { based_on_seq: w.seq, world_clock: w.clock };
  if (paused) return { ...base, kind: 'paused', why: '정지 중이다(control/PAUSE). 방문하지 않는다.' };
  const d = decide(w, cfg);
  if (d.kind === 'walk') return { ...base, kind: 'walk', agent: d.agent.id, selection: d.selection, request_reason: d.request_reason || null,
    why: d.selection === 'requested' ? '그 개체가 남긴 활동 요청의 조건이 찼다.' : '활동 중이고 조건이 차지 않은 요청이 없는 개체 가운데 가장 오래 기다린 개체다.' };
  if (d.kind === 'work') return { ...base, kind: 'work', agent: d.agent.id, selection: d.selection, request_reason: null,
    why: '직무를 맡은 개체가 쉬는 중이다. 오전(직무) 다음 바로 저녁이다.' };
  if (d.kind === 'evening') return { ...base, kind: 'evening', agent: d.agent.id, selection: d.selection, request_reason: null,
    why: '쉬는 중(휴면, 또는 조건이 차지 않은 활동 요청)인 개체 가운데 가장 오래 기다린 개체다. 저녁만 있는 방문이다.' };
  if (d.kind === 'birth') return { ...base, kind: 'birth', why: '새 개체가 태어날 차례다. 방문하지 않고 세계를 한 칸 흘리는 파일을 올리면 실행기가 개체를 발급한다.' };
  return { ...base, kind: 'idle', reason: d.reason, why: '걸을 개체가 없다. 방문하지 않고 세계를 한 칸 흘리는 파일을 올린다.' };
}
