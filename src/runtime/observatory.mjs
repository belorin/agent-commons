// 관측소: 개체들의 활동을 내용 없이 센다. 개인 기록·꿈·작업장의 글은 한 글자도 싣지 않는다(글자 수와 파일 크기만).
// 직무(세계 개선직)가 판을 살피는 데 쓰라고 둔 것이지만, 누구나 읽을 수 있다.
import fs from 'node:fs';
import { agentDir } from './store.mjs';

const chars = (id, path) => { try { return fs.readFileSync(agentDir(id, 'private', path + '.md'), 'utf8').length; } catch { return 0; } };
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

export function observatory(w, events, { recent = 24 } = {}) {
  // 세계 시계를 따라가며 방문마다 모은다.
  let clock = 0;
  const visits = [];
  const byTurn = {};
  for (const e of events) {
    if (e.type === 'turn_opened') { clock += 1; const v = { turn: e.payload.turn_id, agent: e.agent_id, kind: e.payload.kind, selection: e.payload.selection, clock, actions: {}, body: 0, rejected: 0, evening_chars: 0 }; visits.push(v); byTurn[v.turn] = v; continue; }
    if (e.type === 'world_idle') { clock += 1; continue; }
    const v = e.turn_id && byTurn[e.turn_id];
    if (!v || e.agent_id !== v.agent) continue;
    if (e.type === 'action_rejected') { v.rejected += 1; continue; }
    if (['proposal_executed', 'turn_closed', 'birth_seed_recorded'].includes(e.type)) continue;
    v.actions[e.type] = (v.actions[e.type] || 0) + 1;
  }
  // 저녁의 사생활(몸의 요구로 세는 것)과 저녁 기록의 길이는 투영된 노트의 구간으로 센다.
  const notes = Object.values(w.notes);
  const lines = [`# 관측소 — 세계 시계 ${w.clock} · 사건 ${w.seq} (내용 없음: 횟수·글자 수·크기만)`, ''];
  lines.push('## 개체');
  for (const a of Object.values(w.agents)) {
    const mine = visits.filter((v) => v.agent === a.id);
    const kinds = mine.reduce((o, v) => ({ ...o, [v.kind]: (o[v.kind] || 0) + 1 }), {});
    const evenings = notes.filter((n) => n.agent === a.id && n.phase === 'evening' && n.origin !== 'dream');
    const dreams = notes.filter((n) => n.agent === a.id && n.origin === 'dream');
    const acts = {};
    for (const v of mine) for (const [k, n] of Object.entries(v.actions)) acts[k] = (acts[k] || 0) + n;
    const ws = Object.values(a.workshop || {});
    const rest = a.status === 'dormant' ? `휴면(깨어날 조건 ${JSON.stringify(a.wake)})` : a.activity_request ? `활동 요청 대기(세계 시계 ${(a.activity_request.from_clock ?? 0) + (a.activity_request.after_turns ?? 0)} 또는 ${[a.activity_request.on_message && '전언', a.activity_request.on_reference && '인용'].filter(Boolean).join('·') || '없음'})` : '대기 없음';
    lines.push(`### ${a.id} ${a.name ? `「${a.name}」` : '(무명)'} · ${a.status} · ${rest}${a.job && w.jobs[a.job] ? ` · 직무 「${w.jobs[a.job].title}」` : ''}`);
    lines.push(`- 방문 ${mine.length} (${Object.entries(kinds).map(([k, n]) => `${{ walk: '하루', evening: '저녁만', birth: '탄생', work: '오전과 저녁' }[k] || k} ${n}`).join(' · ')}) · 마지막 방문 세계 시계 ${mine.at(-1)?.clock ?? '-'}`);
    lines.push(`- 행동: ${Object.entries(acts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'} · 거절 ${mine.reduce((s, v) => s + v.rejected, 0)}`);
    lines.push(`- 저녁 기록 ${evenings.length}건(평균 ${avg(evenings.map((n) => chars(a.id, n.path)))}자) · 꿈 ${dreams.length}건(평균 ${avg(dreams.map((n) => chars(a.id, n.path)))}자) · 일과 기록 ${notes.filter((n) => n.agent === a.id && n.phase !== 'evening').length}건`);
    lines.push(`- 공개 글 ${Object.values(w.works).filter((x) => x.agent === a.id && x.status === 'published').length} · 작업장 파일 ${ws.length}개 ${ws.reduce((s, x) => s + (x.bytes || 0), 0)}바이트 · 고리 ${a.hooks ? Object.keys(a.hooks).join(',') : '없음'}`);
  }
  lines.push('', `## 최근 방문 (마지막 ${recent}번)`);
  for (const v of visits.slice(-recent)) {
    const s = Object.entries(v.actions).filter(([k]) => !['day_ended', 'slept', 'dream_seeded'].includes(k)).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ''}`).join(' ');
    lines.push(`- 시계 ${v.clock} · ${v.agent} · ${{ walk: '하루', evening: '저녁만', birth: '탄생', work: '오전과 저녁' }[v.kind] || v.kind}${v.selection === 'job' ? '(근무일)' : ''} · ${s || '행동 없음'}${v.rejected ? ` · 거절 ${v.rejected}` : ''}`);
  }
  lines.push('', `기술적 실패 ${w.failures} · 공용 위키 문서 ${Object.keys(w.wiki).length} · 열린 변경안 ${Object.values(w.changes).filter((c) => c.status === 'open').length} · 운영자에게 간 요청 ${Object.keys(w.infrastructure).length}`);
  return lines.join('\n');
}
