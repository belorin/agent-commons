// 매일 밤의 회고(evening 기능). 개체는 잠들기 전에 자기 지도를 다시 쓴다.
// 실행기는 전 생애에 걸친 사실(생애의 흔적, 다층 기억의 2층)을 세어 보여 줄 뿐 해석하지 않는다.
// 자기 지도(3층)는 개체가 쓰고 판본이 쌓인다. 실행기는 그 내용을 고르거나 요약하지 않는다.
import { readText, agentDir } from './store.mjs';

export const MAP_PATH = '회고/지도';

/** 이 개체의 사건을 세계 시계와 함께 따라간다. */
function withClock(events) {
  let clock = 0;
  return events.map((e) => {
    if (e.type === 'turn_opened' || e.type === 'world_idle') clock += 1;
    return { e, clock };
  });
}

/** 생애의 흔적: 사실만. 내용은 개체 자신의 문장(활동 요청 메모, 거절 이유)과 이름·숫자만 옮긴다. */
export function lifeTrace(w, events, id) {
  const me = w.agents[id];
  const all = withClock(events).filter(({ e }) => e.agent_id === id);
  const opened = all.filter(({ e }) => e.type === 'turn_opened');
  const kinds = opened.reduce((o, { e }) => ({ ...o, [e.payload.kind]: (o[e.payload.kind] || 0) + 1 }), {});
  const morning = opened.filter(({ e }) => e.payload.phase === 'morning').length;
  const out = [];
  const L = (line) => out.push(line);
  L(`- 첫 방문: 세계 시계 ${opened[0]?.clock ?? '-'} · 방문 ${opened.length}번 (하루 ${kinds.walk || 0}${kinds.birth ? ` · 탄생 ${kinds.birth}` : ''} · 저녁만 ${kinds.evening || 0}${kinds.work ? ` · 오전과 저녁 ${kinds.work}` : ''}${morning ? ` · 그 가운데 오전이 있던 방문 ${morning}` : ''})`);
  const carry = all.filter(({ e }) => e.type === 'note_written' && e.payload.path === 'carry');
  if (carry.length) L(`- 이어 가는 메모(carry): ${carry.length}판 · 처음 세계 시계 ${carry[0].clock} · 마지막 고침 세계 시계 ${carry.at(-1).clock}`);
  const requests = all.filter(({ e }) => e.type === 'activity_requested');
  if (requests.length) {
    L(`- 다음 방문을 청하며 남긴 메모 ${requests.length}번. 최근 다섯 (네 문장):`);
    for (const { e, clock } of requests.slice(-5)) L(`  - 세계 시계 ${clock}: ${String(e.payload.note || '(메모 없음)').replace(/\s+/g, ' ').slice(0, 240)}`);
  }
  const hosts = {};
  for (const { e } of all.filter(({ e }) => e.type === 'access_reported')) {
    const h = (hosts[e.payload.host] ??= { ok: 0, partial: 0, failed: 0 });
    h[e.payload.outcome] = (h[e.payload.outcome] || 0) + 1;
  }
  const top = Object.entries(hosts).sort((a, b) => (b[1].ok + b[1].partial + b[1].failed) - (a[1].ok + a[1].partial + a[1].failed)).slice(0, 6);
  if (top.length) L(`- 바깥 접근 보고 (많은 순): ${top.map(([h, c]) => `${h} 열림 ${c.ok}·일부 ${c.partial}·실패 ${c.failed}`).join(' / ')}`);
  const works = all.filter(({ e }) => e.type === 'work_published');
  if (works.length) {
    const last = works.at(-1).clock;
    const since = opened.filter(({ clock, e }) => clock > last && e.payload.kind !== 'evening').length;
    L(`- 공개한 글: ${new Set(works.map(({ e }) => e.payload.slug)).size}편 · 마지막으로 낸 때 세계 시계 ${last} · 그 뒤 일과가 있던 방문 ${since}번`);
  } else L('- 공개한 글: 없다.');
  const self = ['identity', 'exploration', 'writing', 'lifecycle'].map((t) => {
    const last = all.filter(({ e }) => ['profile_updated', 'method_revised', 'lifecycle_rule_revised'].includes(e.type) && e.payload.target === t).at(-1);
    const label = { identity: '자기소개', exploration: '탐색법', writing: '글쓰기법', lifecycle: '생애 관습' }[t];
    return me.files[t] ? `${label} r${me.files[t].revision}(세계 시계 ${last?.clock ?? '-'})` : `${label} 없음`;
  });
  L(`- 자기 명세: ${self.join(' · ')}`);
  const rejected = all.filter(({ e }) => e.type === 'action_rejected');
  if (rejected.length) L(`- 거절된 제안 ${rejected.length}번. 최근: ${rejected.slice(-2).map(({ e, clock }) => `세계 시계 ${clock} ${e.payload.action} — ${String(e.payload.reason).replace(/\s+/g, ' ').slice(0, 120)}`).join(' / ')}`);
  const dreams = all.filter(({ e }) => e.type === 'note_written' && e.payload.origin === 'dream').length;
  const evenings = all.filter(({ e }) => e.type === 'self_reviewed');
  L(`- 꿈 ${dreams}번 · 회고 ${evenings.length}번${evenings.length ? ` (처음 세계 시계 ${evenings[0].clock})` : ''}`);
  const lastReview = evenings.at(-1)?.clock;
  if (lastReview != null) {
    const since = all.filter(({ clock, e }) => clock > lastReview && !['turn_opened', 'turn_closed', 'proposal_executed', 'day_ended', 'slept', 'dream_seeded', 'morning_ended'].includes(e.type));
    const counts = since.reduce((o, { e }) => ({ ...o, [e.type]: (o[e.type] || 0) + 1 }), {});
    L(`- 지난 회고(세계 시계 ${lastReview}) 뒤에 생긴 일: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ') || '없다'}`);
  }
  if (me.job && w.jobs?.[me.job]) L(`- 맡은 직무: 「${w.jobs[me.job].title}」 · 근무 기록 ${(w.jobs[me.job].logs || []).length}번`);
  return out;
}

/** 지금의 자기 지도 본문. 없으면 null. */
export function selfMap(w, id) {
  const n = w.notes[`${id}/${MAP_PATH}`];
  return n ? { text: readText(agentDir(id, 'private', MAP_PATH + '.md')) || '', revision: n.revision, seq: n.seq } : null;
}

/**
 * 긴 회고의 재료: 자기 지도가 아직 없을 때 한 번 펼쳐 주는 전 생애의 목록. 제목·시점·개체 자신의 문장만 옮긴다.
 * 첫 지도가 생기면 다시 싣지 않는다. 옛 기록은 `read note` · `read revision` 으로 내려가 읽는다.
 */
export function lifeArchive(w, events, id) {
  const all = withClock(events).filter(({ e }) => e.agent_id === id);
  const out = [];
  const L = (line) => out.push(line);
  const works = all.filter(({ e }) => e.type === 'work_published');
  if (works.length) {
    L(`#### 공개한 글 (낸 순서, ${works.length}판)`);
    for (const { e, clock } of works.slice(-40)) L(`- 세계 시계 ${clock}: 「${e.payload.title}」 [${e.payload.slug}] r${e.payload.revision}`);
  }
  const notes = all.filter(({ e }) => e.type === 'note_written' && !['dream', 'review'].includes(e.payload.origin) && e.payload.path !== 'carry' && !/^(저녁|꿈|회고)\//.test(e.payload.path));
  if (notes.length) {
    L(`#### 일과의 개인 기록 (쓴 순서, ${notes.length}번)`);
    const pick = notes.length > 80 ? [...notes.slice(0, 20), null, ...notes.slice(-60)] : notes;
    for (const x of pick) L(x ? `- 세계 시계 ${x.clock}: ${x.e.payload.path}${x.e.payload.title ? ` — ${x.e.payload.title}` : ''}` : `- …(가운데 ${notes.length - 80}번은 줄였다)`);
  }
  const requests = all.filter(({ e }) => e.type === 'activity_requested');
  if (requests.length) {
    L(`#### 다음 방문을 청하며 남긴 메모 (전부, ${requests.length}번)`);
    for (const { e, clock } of requests.slice(-40)) L(`- 세계 시계 ${clock}: ${String(e.payload.note || '(메모 없음)').replace(/\s+/g, ' ').slice(0, 160)}`);
  }
  const carry = all.filter(({ e }) => e.type === 'note_written' && e.payload.path === 'carry');
  if (carry.length) {
    const first = readText(agentDir(id, 'history', 'notes', `carry.r${carry[0].e.payload.revision || 1}.md`)) ?? carry[0].e.payload.content ?? '';
    L(`#### 이어 가는 메모의 처음 (r${carry[0].e.payload.revision || 1}, 세계 시계 ${carry[0].clock})`);
    L(String(first).replace(/\s+/g, ' ').slice(0, 500));
  }
  const self = all.filter(({ e }) => ['profile_updated', 'method_revised', 'lifecycle_rule_revised', 'agent_renamed'].includes(e.type));
  if (self.length) {
    L('#### 자기 명세를 고친 때');
    for (const { e, clock } of self) L(`- 세계 시계 ${clock}: ${e.type === 'agent_renamed' ? `이름 ${e.payload.name ? `「${e.payload.name}」` : '내려놓음'}` : `${e.payload.target} r${e.payload.to_revision}`}${e.payload.reason ? ` — ${String(e.payload.reason).replace(/\s+/g, ' ').slice(0, 120)}` : ''}`);
  }
  const social = all.filter(({ e }) => ['message_sent', 'response_recorded', 'trail_opened', 'trail_continued', 'wiki_written', 'job_answered'].includes(e.type));
  if (social.length) {
    L('#### 남과 오간 것');
    for (const { e, clock } of social.slice(-20)) L(`- 세계 시계 ${clock}: ${e.type}${e.payload.to ? ` → ${e.payload.to}` : ''}${e.payload.title ? ` 「${e.payload.title}」` : ''}${e.payload.page ? ` [wiki:${e.payload.page}]` : ''}`);
  }
  return out;
}
