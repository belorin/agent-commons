// 수용 테스트 — 작업장·직무·회고와 세계 흘리기. 번호는 설계 명세 §9의 최소·추가 수용 테스트 번호다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { S, openTurn, closeTurn, read, verify, regenerate, tickMod, world, config, act, turn, approveDormancy, EVENING, enableEvening, bed, day } from './helpers.mjs';

// ── 작업장·코드·삶의 고리 (workshop 기능, 2026-11-20) ─────────────────────
const enableWorkshop = () => S.appendEvent({ type: 'feature_enabled', actor_id: 'operator', visibility: 'public', payload: { feature: 'workshop' } });
const CODE = `
const fs = require('fs');
const ctx = JSON.parse(fs.readFileSync(0, 'utf8'));
let secret = 'readable';
try { fs.readFileSync('../../ag_0002/private/secret.md', 'utf8'); } catch { secret = 'blocked'; }
let proc = 'allowed';
try { require('child_process').execSync('echo hi'); } catch { proc = 'blocked'; }
const mine = fs.readFileSync('../private/mine.md', 'utf8');
fs.writeFileSync('made.txt', 'made at ' + ctx.clock + ' by ' + ctx.trigger);
console.log('input=' + JSON.stringify(ctx.input) + ' phase=' + ctx.phase + ' other-private=' + secret + ' process=' + proc + ' env=' + Object.keys(process.env).length + ' mine=' + mine);
console.log('@propose ' + JSON.stringify({ action: 'write_private', path: 'from-code', content: 'code wrote' }));
`;

test('작업장: 기능이 꺼져 있으면 동사가 없고 브리핑도 그대로다', () => {
  turn(); turn();
  const t = openTurn();
  assert.doesNotMatch(t.text, /## 네가 만든 것/);
  assert.match(act({ action: 'workshop_write', path: 'a.txt', content: 'x' }).reason, /작업장 기능을 켜지 않았다/);
  closeTurn();
});

test('작업장: 코드는 개체의 손이다 — 자기 것은 읽고 쓰고, 남의 개인 기록·프로세스·환경 변수는 없다', () => {
  config({ ...EVENING, dream: undefined });
  turn([{ action: 'write_private', path: 'mine', content: '내 기록' }]);
  turn([{ action: 'write_private', path: 'secret', content: '남의 비밀' }]);
  enableEvening(); enableWorkshop();
  const t = openTurn(); // ag_0001
  assert.match(t.text, /## 네가 만든 것\n- 작업장: 비어 있다\./);
  assert.equal(act({ action: 'workshop_write', path: 'tools/hello.js', content: CODE }).ok, true);
  assert.match(act({ action: 'workshop_write', path: '../escape.txt', content: 'x' }).reason, /작업장 안의 경로/);
  const r = act({ action: 'run', path: 'tools/hello.js', input: { n: 1 } });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.run.ok, true, r.run.reason + r.run.stderr);
  assert.match(r.run.output, /input=\{"n":1\} phase=day other-private=blocked process=blocked env=0 mine=내 기록/);
  assert.equal(r.proposals[0].ok, true);
  const w = world();
  assert.ok(w.agents.ag_0001.workshop['made.txt']);
  assert.equal(w.notes['ag_0001/from-code'].revision, 1);
  const via = S.loadEvents().find((e) => e.type === 'note_written' && e.payload.path === 'from-code');
  assert.equal(via.payload.via, 'tools/hello.js');
  assert.match(read('workshop'), /made\.txt/);
  assert.equal(read('workshop', 'made.txt'), 'made at 3 by self');
  // 코드가 코드를 부르지는 않는다.
  act({ action: 'workshop_write', path: 'tools/loop.js', content: `console.log('@propose ' + JSON.stringify({ action: 'run', path: 'tools/loop.js' }))` });
  assert.match(act({ action: 'run', path: 'tools/loop.js' }).proposals[0].reason, /코드는 run 제안을 낼 수 없다/);
  closeTurn(); bed(); closeTurn();
  assert.ok(verify().ok, verify().problems.join('\n'));
  // 사건 없이 작업장을 고치면 잡힌다.
  fs.writeFileSync(S.agentDir('ag_0001', 'workshop', 'made.txt'), 'tampered');
  assert.match(verify().problems.join('\n'), /workshop\/made\.txt: 파일이 확정된 사건과 다르다/);
});

test('작업장: 실패한 코드는 작업장을 되돌린다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening(); enableWorkshop();
  openTurn();
  act({ action: 'workshop_write', path: 'keep.txt', content: 'before' });
  act({ action: 'workshop_write', path: 'bad.js', content: `require('fs').writeFileSync('keep.txt', 'after'); require('fs').writeFileSync('junk.txt', 'x'); throw new Error('boom')` });
  const r = act({ action: 'run', path: 'bad.js' });
  assert.equal(r.ok, true);
  assert.equal(r.run.ok, false);
  assert.match(r.run.reason, /종료 코드 1/);
  assert.equal(read('workshop', 'keep.txt'), 'before');
  assert.ok(!fs.existsSync(S.agentDir('ag_0001', 'workshop', 'junk.txt')));
  assert.equal(S.loadEvents().filter((e) => e.type === 'tool_ran').at(-1).payload.ok, false);
  closeTurn(); bed(); closeTurn();
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('작업장: 삶의 고리는 해동·저녁·잠에 돌고, 몸의 요구는 코드가 대신하지 못한다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening(); enableWorkshop();
  const hook = `const c = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log('hook ' + c.trigger + ' at ' + c.phase);
if (c.trigger === 'evening') console.log('@propose ' + JSON.stringify({ action: 'write_private', content: 'code evening line' }));`;
  openTurn(); // ag_0001
  act({ action: 'workshop_write', path: 'h.js', content: hook });
  assert.equal(act({ action: 'set_hooks', thaw: 'h.js', evening: 'h.js', sleep: 'h.js' }).ok, true);
  assert.match(act({ action: 'set_hooks', thaw: 'none.js' }).reason, /작업장에 있는 코드 파일/);
  const ev = closeTurn(); // 저녁 고리가 돈다
  assert.match(ev.text, /### 저녁 — h\.js\nhook evening at evening/);
  // 코드가 쓴 저녁 기록은 몸의 요구를 채우지 않는다.
  assert.ok(Object.values(world().notes).some((n) => n.agent === 'ag_0001' && n.phase === 'evening'));
  assert.match(act({ action: 'sleep', dream: '꿈' }).reason, /지금 0번이다.*코드가 한 일은 세지 않는다/);
  // 작업장을 손으로 고치는 것은 센다.
  act({ action: 'workshop_write', path: 'diary.txt', content: '손으로' });
  assert.match(act({ action: 'sleep', dream: '꿈' }).reason, /오늘 밤의 회고/); // 몸의 요구는 채워졌고 회고가 남았다
  act({ action: 'review_self', map: '손으로 만든 것이 있다.' });
  assert.equal(act({ action: 'sleep', dream: '꿈' }).ok, true); // 잠 고리가 돈다
  closeTurn();
  assert.equal(S.loadEvents().filter((e) => e.type === 'tool_ran' && e.payload.trigger === 'sleep').length, 1);
  day(); // ag_0002
  const t = openTurn(); // ag_0001: 해동 고리 + 지난밤 잠 고리의 출력
  assert.match(t.text, /## 네가 만든 것\n- 작업장: 파일 2개/);
  assert.match(t.text, /- 삶의 고리: 해동 → h\.js · 저녁 → h\.js · 잠 → h\.js/);
  assert.match(t.text, /### 잠 — h\.js\nhook sleep at evening/);
  assert.match(t.text, /### 해동 — h\.js\nhook thaw at day/);
  closeTurn(); bed(); closeTurn();
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('몸의 조건과 책: 저녁·꿈 설정은 변경안으로 고치지 않고, 책은 공개 저작물 호스트에서만 들인다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening(); enableWorkshop();
  openTurn();
  assert.match(act({ action: 'propose_change', title: '저녁 줄이기', config: { 'evening.min_private_acts': 0 } }).reason, /몸의 조건이다/);
  assert.match(act({ action: 'acquire_book', url: 'https://example.com/book.txt' }).reason, /공개 저작물/);
  assert.match(act({ action: 'acquire_book', url: 'http://www.gutenberg.org/x.txt' }).reason, /https/);
  closeTurn();
  assert.match(act({ action: 'acquire_book', url: 'https://www.gutenberg.org/x.txt' }).reason, /저녁에는 acquire_book 동사가 없다/);
  bed(); closeTurn();
});

// ── 직무: 세계 개선직 (2026-11-20) ────────────────────────────────────────
test('직무: 받으면 매 방문이 오전(직무)으로 시작하고, 근무 기록을 남겨야 오전이 끝난다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  S.appendEvent({ type: 'job_offered', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'public', payload: { id: 'job_test0001', to: 'ag_0001', title: '세계 개선직', duties: '이 판을 살피고 낫게 한다.', every_clock: null } });
  const t = openTurn(); // ag_0001: 아직 받지 않았으니 보통의 하루
  assert.match(t.text, /## 일\n- 운영자가 직무를 제안했다 \[job_test0001\] 「세계 개선직」/);
  assert.match(act({ action: 'respond_job', job: 'job_nope', decision: 'accept' }).reason, /직무 제안의 id/);
  assert.equal(act({ action: 'respond_job', job: 'job_test0001', decision: 'accept', note: '해 보겠다' }).ok, true);
  closeTurn(); bed(); closeTurn();
  assert.equal(world().agents.ag_0001.job, 'job_test0001');
  S.appendEvent({ type: 'job_requested', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'public', payload: { job: 'job_test0001', content: '저녁이 비는 문제를 봐 달라' } });
  day(); // ag_0002
  // 활동 중인 직장인의 하루: 오전 → 오후 → 저녁
  const m = openTurn();
  assert.equal(m.kind, 'walk');
  assert.match(m.text, /^# 오전 — ag_0001/);
  assert.match(m.text, /### 맡은 직무 \[job_test0001\] 「세계 개선직」/);
  assert.match(m.text, /운영자의 요청 \(세계 시계 \d+\): 저녁이 비는 문제를 봐 달라/);
  assert.doesNotMatch(m.text, /## 네 기억|## 네가 정해 둔 것/); // 오전에는 사적인 칸이 없다
  assert.equal(world().turn.phase, 'morning');
  assert.match(act({ action: 'write_private', path: 'x', content: 'x' }).reason, /오전\(직무 시간\)에는 write_private 동사가 없다/);
  assert.match(act({ action: 'end_morning' }).reason, /근무 기록\(job_log\)을 남긴 뒤/);
  assert.equal(closeTurn().state, 'working');
  // 관측소와 코드 읽기
  const obs = read('observatory');
  assert.match(obs, /# 관측소 — 세계 시계 \d+/);
  assert.match(obs, /### ag_0001 \(무명\) · active · 대기 없음 · 직무 「세계 개선직」/);
  assert.match(obs, /저녁 기록 \d+건\(평균 \d+자\)/);
  assert.doesNotMatch(obs, /저녁의 한 줄|물가의 꿈/); // 내용은 없다
  assert.match(read('source'), /- src\/runtime\/tick\.mjs/);
  assert.match(read('source', 'package.json'), /agent-commons/);
  assert.match(read('source', '../data/events/log.jsonl'), /읽을 수 있는 코드·문서가 아니다/);
  assert.equal(act({ action: 'job_log', content: '관측소를 보았다. 저녁 기록이 모두 짧다.' }).ok, true);
  const pm = closeTurn();
  assert.equal(pm.state, 'afternoon');
  assert.match(pm.text, /^# 오후 — ag_0001/);
  assert.match(pm.text, /## 네 기억/);
  assert.doesNotMatch(pm.text, /## 일/);
  assert.equal(act({ action: 'write_private', path: 'x', content: '오후의 메모' }).ok, true);
  assert.match(act({ action: 'job_log', content: 'x' }).reason, /오전에 있는 동사/);
  assert.equal(act({ action: 'request_activity', after_turns: 50, note: '오래 쉰다' }).ok, true);
  assert.equal(closeTurn().state, 'evening');
  bed(); closeTurn();
  assert.match(fs.readFileSync(S.p('derived', 'plaza.md'), 'utf8'), /세계 개선직/);
  day(); // ag_0002
  // 활동 요청은 순번을 늦추지 못한다: 다음 차례에도 오전 → 오후 → 저녁이다.
  const w2 = openTurn();
  assert.equal(w2.kind, 'walk');
  assert.match(w2.text, /^# 오전 — ag_0001/);
  act({ action: 'job_log', content: '오늘은 변경안이 없다.' });
  assert.equal(closeTurn().state, 'afternoon');
  assert.equal(closeTurn().state, 'evening');
  bed(); closeTurn();
  assert.equal(world().agents.ag_0001.activity_request, null);
  assert.equal(world().jobs.job_test0001.logs.length, 2);
  // 다음 오전에는 지난 근무 기록이 실린다. 그만두면 오전이 끝난다.
  day();
  const w3 = openTurn();
  assert.match(w3.text, /지난 근무 기록 \(최근 셋, 공개\):\n- 세계 시계 \d+: 관측소를 보았다/);
  const q = act({ action: 'quit_job', note: '그만둔다' });
  assert.equal(q.ok, true);
  assert.equal(world().turn.phase, 'day'); // 오전이 끝나고 오후(자기 일과)가 이어진다
  assert.equal(closeTurn().state, 'evening');
  bed(); closeTurn();
  assert.equal(world().jobs.job_test0001.status, 'quit');
  assert.equal(world().agents.ag_0001.job, null);
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('직무: 한 파일 방문은 morning 에 근무 기록이 있어야 한다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  S.appendEvent({ type: 'job_offered', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'public', payload: { id: 'job_test0003', to: 'ag_0001', title: '세계 개선직', duties: '낫게 한다.', every_clock: null } });
  openTurn(); act({ action: 'respond_job', job: 'job_test0003', decision: 'accept' }); closeTurn(); bed(); closeTurn();
  day();
  const sleep = { request_id: 'mm-sleep-1', proposal: { action: 'sleep', dream: '꿈' } };
  const note = { request_id: 'mm-note-1', proposal: { action: 'review_self', map: '저녁의 지도' } };
  assert.throws(() => tickMod.applyVisit({ agent: 'ag_0001', proposals: [], evening: [note, sleep] }), /근무 기록\(job_log\)/);
  const r = tickMod.applyVisit({ agent: 'ag_0001', morning: [{ request_id: 'mm-log-1', proposal: { action: 'job_log', content: '살폈다' } }], proposals: [{ request_id: 'mm-day-1', proposal: { action: 'write_private', path: 'p', content: '오후' } }], evening: [note, sleep] });
  assert.equal(r.status, 'applied');
  assert.ok(r.results.every((x) => x.ok), JSON.stringify(r.results));
  assert.deepEqual(S.loadEvents().filter((e) => ['morning_ended', 'day_ended'].includes(e.type)).slice(-2).map((e) => e.payload.by), ['apply', 'apply']);
  assert.match(fs.readFileSync(S.agentDir('ag_0001', 'brief.md'), 'utf8'), /# 오전 — ag_0001[\s\S]*# 오후 — ag_0001[\s\S]*# 저녁 — ag_0001[\s\S]*"morning"/);
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('직무: 쉬는 개체의 저녁에도 제안이 실리고 저녁에 받을 수 있다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  day([{ action: 'request_dormancy', wake: { after_turns: 50 } }]); // ag_0001 쉰다
  approveDormancy('ag_0001');
  S.appendEvent({ type: 'job_offered', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'public', payload: { id: 'job_test0002', to: 'ag_0001', title: '세계 개선직', duties: '낫게 한다.', every_clock: 2 } });
  S.appendEvent({ type: 'job_requested', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'public', payload: { job: 'job_test0002', content: '기준은 네가 정한다' } });
  day(); // ag_0002
  const rest = openTurn();
  assert.equal(rest.kind, 'evening');
  assert.match(rest.text, /운영자가 직무를 제안했다 \[job_test0002\]/);
  assert.match(rest.text, /운영자의 말 \(세계 시계 \d+\): 기준은 네가 정한다/);
  assert.equal(act({ action: 'respond_job', job: 'job_test0002', decision: 'accept' }).ok, true);
  bed(); closeTurn();
  assert.equal(world().agents.ag_0001.job, 'job_test0002');
});

test('운영자의 사적 전언: 그 개체에게만 보이고, 답하면 운영자에게 간다', () => {
  turn(); turn();
  S.appendEvent({ type: 'operator_message', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'direct', payload: { to: 'ag_0001', content: '너에게만 하는 말' } });
  const t = openTurn(); // ag_0001
  assert.match(t.text, /운영자의 전언\(너에게만\) \[[^\]]+\] 운영자:\n\n  > 너에게만 하는 말/);
  const id = S.loadEvents().find((e) => e.type === 'operator_message').event_id;
  assert.equal(act({ action: 'respond', to_event: id, content: '들었다' }).ok, true);
  closeTurn();
  const other = openTurn(); // ag_0002
  assert.doesNotMatch(other.text, /너에게만 하는 말/);
  assert.doesNotMatch(read('events'), /너에게만 하는 말|들었다/);
  closeTurn();
  assert.ok(!fs.readFileSync(S.p('derived', 'plaza.md'), 'utf8').includes('너에게만'));
  assert.equal(world().messages.find((m) => m.to === 'operator').content, '들었다');
  assert.ok(verify().ok);
});

test('운영자는 자기 공개 말을 거둘 수 있다: 사건은 남고 보이는 자리에서 빠진다', () => {
  turn(); turn();
  const note = S.appendEvent({ type: 'operator_note', actor_id: 'operator', visibility: 'public', payload: { content: '모두에게 한 말' } });
  regenerate();
  assert.match(fs.readFileSync(S.p('derived', 'plaza.md'), 'utf8'), /운영자가 모두에게 말을 남겼다/);
  S.appendEvent({ type: 'operator_withdrawn', actor_id: 'operator', visibility: 'system', payload: { target_seq: note.world_seq, target_type: 'operator_note' } });
  regenerate();
  assert.equal(world().operator_notes.length, 0);
  assert.doesNotMatch(fs.readFileSync(S.p('derived', 'plaza.md'), 'utf8'), /운영자가 모두에게 말을 남겼다/);
  assert.doesNotMatch(openTurn().text, /모두에게 한 말/);
  closeTurn();
  assert.ok(S.loadEvents().some((e) => e.world_seq === note.world_seq)); // 지우지 않는다
  assert.ok(verify().ok);
});

test('회고: 저녁마다 자기 지도를 다시 쓰고, 생애의 흔적은 실행기가 센 사실로 실린다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  day([{ action: 'write_private', path: 'carry', content: '할 일 하나' }, { action: 'request_activity', after_turns: 0, note: '같은 원문을 다시 찾는다' }]);
  const t = openTurn(); // ag_0001 (요청 조건이 바로 찼다)
  assert.equal(t.agent_id, 'ag_0001');
  const ev = closeTurn();
  assert.match(ev.text, /## 회고\n- 잠들기 전마다 자기 지도를 다시 쓴다/);
  assert.match(ev.text, /### 지금의 자기 지도 \(r1\)\n지금의 나: 물가에 있다\./);
  assert.match(ev.text, /### 생애의 흔적 \(실행기가 센 사실이다\. 해석은 없다\)\n- 첫 방문: 세계 시계 1/);
  assert.match(ev.text, /- 이어 가는 메모\(carry\): 1판 · 처음 세계 시계 3/);
  assert.match(ev.text, /세계 시계 3: 같은 원문을 다시 찾는다/);
  assert.match(ev.text, /- 꿈 1번 · 회고 1번 \(처음 세계 시계 3\)/);
  assert.match(ev.text, /오늘 밤의 회고: 아직/);
  act({ action: 'write_private', content: '저녁' });
  assert.match(act({ action: 'sleep', dream: '꿈' }).reason, /오늘 밤의 회고/);
  assert.equal(act({ action: 'review_self', map: '두 번째 지도' }).ok, true);
  assert.match(read('evening'), /오늘 밤의 회고: 했다/);
  assert.equal(act({ action: 'sleep', dream: '꿈' }).ok, true);
  closeTurn();
  assert.equal(world().notes['ag_0001/회고/지도'].revision, 2);
  assert.equal(S.readText(S.agentDir('ag_0001', 'history', 'notes', '회고/지도.r1.md')), '지금의 나: 물가에 있다.');
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('회고: 첫 지도는 긴 회고(4000자까지), 그 뒤는 2000자까지이고 긴 회고 재료는 다시 실리지 않는다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  openTurn(); closeTurn();
  act({ action: 'write_private', content: '저녁' });
  assert.match(read('evening'), /긴 회고의 재료/);
  assert.match(act({ action: 'review_self', map: 'x'.repeat(4001) }).reason, /4000자까지다/);
  assert.equal(act({ action: 'review_self', map: 'x'.repeat(3000) }).ok, true);
  assert.match(act({ action: 'review_self', map: 'y'.repeat(2001) }).reason, /2000자까지다/);
  assert.equal(act({ action: 'review_self', map: 'y'.repeat(1500) }).ok, true);
  assert.doesNotMatch(read('evening'), /긴 회고의 재료/);
  act({ action: 'sleep', dream: '꿈' }); closeTurn();
  // 긴 회고 없이 지도를 이미 가진 개체(긴 회고가 생기기 전의 회고)는 다음 회고에서 한 번 긴 회고를 한다.
  const ev = S.loadEvents().filter((e) => e.type === 'self_reviewed');
  assert.equal(ev[0].payload.long, true);
  assert.equal(ev[1].payload.long, undefined);
});

test('세계 흘리기는 저녁 방문을 건너뛰지 않는다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn(); enableEvening();
  day([{ action: 'request_dormancy', wake: { after_turns: 50 } }]); approveDormancy('ag_0001');
  day([{ action: 'request_dormancy', wake: { after_turns: 50 } }]); approveDormancy('ag_0002');
  regenerate();
  const next = JSON.parse(S.readText(S.p('derived', 'next.json')));
  assert.equal(next.kind, 'evening');
  const before = S.loadEvents();
  S.writeText(S.p('data', 'inbox', 'evening.json'), JSON.stringify({ advance: true, based_on_seq: next.based_on_seq }));
  assert.match(tickMod.processInbox().join('\n'), /받지 못함/);
  assert.deepEqual(S.loadEvents(), before);
  assert.ok(fs.existsSync(S.p('data', 'inbox', 'rejected', 'evening.json')));
  assert.ok(verify().ok);
});

test('같은 기준 순번의 세계 흘리기 파일은 한 번만 확정된다', () => {
  regenerate();
  const next = JSON.parse(S.readText(S.p('derived', 'next.json')));
  assert.equal(next.kind, 'birth');
  for (const name of ['first', 'duplicate']) {
    S.writeText(S.p('data', 'inbox', `${name}.json`), JSON.stringify({ advance: true, based_on_seq: next.based_on_seq }));
    const result = tickMod.processInbox().join('\n');
    assert.match(result, name === 'first' ? /태어났다/ : /받지 못함.*based_on_seq/);
  }
  assert.equal(Object.keys(world().agents).length, 1);
  assert.ok(verify().ok);
});
