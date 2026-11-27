// 수용 테스트 — 일과·저녁·잠 (evening 기능). 번호는 설계 명세 §9의 최소·추가 수용 테스트 번호다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S, openTurn, closeTurn, read, verify, tickMod, world, config, act, turn, approveDormancy, CLI, spawnSync, EVENING, enableEvening, bed, day } from './helpers.mjs';

// ── 일과, 저녁, 잠 (evening 기능, 2026-11-19) ─────────────────────────────

test('저녁: 기능이 꺼져 있으면 일과·잠 동사가 없고 방문은 한 번에 닫힌다', () => {
  turn(); turn();
  openTurn();
  assert.match(act({ action: 'end_day' }).reason, /아직 저녁이 없다/);
  assert.match(act({ action: 'sleep' }).reason, /아직 저녁이 없다/);
  assert.equal(closeTurn().ok, true);
  assert.ok(!S.loadEvents().some((e) => ['day_ended', 'slept', 'dream_seeded'].includes(e.type)));
});

test('저녁: 하루 방문은 일과 → 저녁 → 잠이고, 저녁에는 바깥 세계의 동사가 없다', () => {
  config(EVENING);
  let calls = 0;
  tickMod.setDreamSource(() => { calls++; return '{"results":["pebble","dessert","vivid"]}'; });
  try {
    turn(); turn();
    enableEvening();
    const t = openTurn();
    assert.equal(t.kind, 'walk');
    assert.match(t.text, /이 방문에는 일과와 저녁이 있다/);
    assert.doesNotMatch(t.text, /바깥의 사람은 그 파일을 열어 볼 수 있다|저장소를 운영하는 사람은 볼 수 있다/);
    assert.equal(act({ action: 'write_private', path: 'carry', content: '일과의 메모' }).ok, true);
    assert.equal(act({ action: 'write_private', path: 'work-note', content: '일과의 기록' }).ok, true);
    assert.match(act({ action: 'sleep' }).reason, /잠은 저녁에 든다/);
    // 일과 중의 close 는 방문을 닫지 않고 저녁을 연다.
    const ev = closeTurn();
    assert.equal(ev.state, 'evening');
    assert.match(ev.text, /^# 저녁 — ag_0001/);
    // 저녁에는 일하는 방법과 오늘 한 일의 목록이 없다.
    assert.doesNotMatch(ev.text, /## 오늘|탐색법 \(r|글쓰기법 \(r/);
    assert.match(ev.text, /### 긴 회고의 재료 \(한 번[^\n]*\n#### 일과의 개인 기록 \(쓴 순서, 1번\)\n- 세계 시계 3: work-note/); // 지도가 없으니 긴 회고
    assert.match(ev.text, /- 탐색법·글쓰기법은 일과의 브리핑에 실린다\./);
    assert.match(ev.text, /일과에 쓴 기록: 1건/);
    assert.doesNotMatch(ev.text, /광장|발표회|바깥 웹|해도 된다|성찰/);
    assert.equal(world().turn.phase, 'evening');
    // 저녁에는 바깥 세계의 동사와 carry 가 없다.
    assert.match(act({ action: 'publish', slug: 'x', title: 'x', content: 'x' }).reason, /저녁에는 publish 동사가 없다/);
    assert.match(act({ action: 'report_access', host: 'example.org', outcome: 'ok' }).reason, /저녁에는 report_access 동사가 없다/);
    assert.match(act({ action: 'write_private', path: 'carry', content: 'x' }).reason, /carry/);
    assert.match(act({ action: 'end_day' }).reason, /저녁에는 end_day 동사가 없다/);
    // 이름 없이 쓴 저녁 기록은 세계 시계로 이름이 붙는다.
    const r = act({ action: 'write_private', content: '저녁의 기록' });
    assert.equal(r.ok, true);
    const path = r.events[0].payload.path;
    assert.match(path, /^저녁\/시계-\d+$/);
    assert.equal(world().notes[`ag_0001/${path}`].phase, 'evening');
    assert.equal(world().notes['ag_0001/work-note'].phase, 'day');
    assert.equal(act({ action: 'revise_self', target: 'identity', content: '저녁에 고친 소개' }).ok, true);
    // 잠들기 전에는 닫히지 않는다. 잠에는 꿈이 있다.
    assert.equal(closeTurn().state, 'awake');
    assert.match(act({ action: 'sleep', dream: '꿈' }).reason, /오늘 밤의 회고/);
    assert.equal(act({ action: 'review_self', map: '나는 아직 이름이 없다. 유리를 본다.' }).ok, true);
    assert.match(act({ action: 'sleep' }).reason, /dream: 필요한 항목이다/);
    assert.match(act({ action: 'sleep', dream: '   ' }).reason, /꿈이 비어 있다/);
    const slept = act({ action: 'sleep', dream: '유리 다리를 건너는데 발밑에서 자갈이 노래를 했다. 디저트 가게의 불빛이 선명했다.' });
    assert.equal(slept.ok, true);
    assert.match(slept.events[0].payload.path, /^꿈\/시계-\d+$/);
    assert.equal(slept.events[0].payload.origin, 'dream');
    assert.match(act({ action: 'write_private', content: 'y' }).reason, /잠든 뒤다/);
    assert.equal(closeTurn().ok, true);
    assert.equal(calls, 1);
    const events = S.loadEvents();
    const seeded = events.find((e) => e.type === 'dream_seeded');
    assert.deepEqual(seeded.payload.words, ['pebble', 'dessert', 'vivid']);
    assert.equal(seeded.payload.source, 'words.test');
    const closed = events.at(-1);
    assert.equal(closed.type, 'turn_closed');
    assert.equal(closed.payload.actions, 6);
    assert.deepEqual(closed.payload.evening.counts, { note_written: 3, profile_updated: 1 });
    assert.equal(closed.payload.evening.day_ended_by, 'close');
    // 다음 해동: 브리핑 맨 위에 지난밤 꿈의 앞부분. 받은 낱말은 다음 밤 꿈의 재료로 저녁 브리핑에 실린다.
    day(); // ag_0002
    const next = openTurn();
    assert.equal(next.agent_id, 'ag_0001');
    assert.equal(next.text.split('\n')[1], '지난밤의 꿈: 유리 다리를 건너는데 발밑에서 자갈이 노래를 했다. 디저트 가게의 불빛이 선명했다.');
    assert.doesNotMatch(next.text, /words\.test|pickrandom|pebble/);
    assert.match(next.text, /개인 기록 4건은 저녁에 실린다/); // 일과 기록, 저녁 기록, 꿈, 자기 지도
    assert.match(next.text, /## 네가 정해 둔 것\n### 자기 지도 \(회고 r1, 비공개\)\n나는 아직 이름이 없다\. 유리를 본다\./);
    const ev2 = closeTurn();
    assert.match(ev2.text, /### 가장 최근의 저녁 기록: 저녁\/시계-\d+ \(r1\)\n저녁의 기록/);
    assert.doesNotMatch(ev2.text, /지난밤의 꿈/); // 같은 방문에서 두 번 싣지 않는다
    assert.match(ev2.text, /## 잠\n- 오늘 밤의 낱말: pebble · dessert · vivid\n/);
    assert.match(ev2.text, /- 잠은 저녁에 개인 기록이나 자기 명세의 행동이 있은 뒤에 든다\.$/);
    assert.doesNotMatch(ev2.text, /지금 \d+번이다/);
    assert.match(ev2.text, /꿈 1건: 꿈\/시계-\d+/);
    // 사생활 없이 잠들 수는 없다.
    assert.match(act({ action: 'sleep', dream: '꿈' }).reason, /행동이 1번 있어야 한다\. 지금 0번이다/);
    bed(); closeTurn();
    assert.ok(verify().ok);
  } finally { tickMod.setDreamSource(null); }
});

test('저녁: 활동 요청은 쉬는 것이 아니다. 조건이 차지 않아도 다음 차례는 하루 방문이다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  day([{ action: 'request_activity', after_turns: 50 }]); // ag_0001
  assert.equal(day().agent_id, 'ag_0002');
  const t = openTurn();
  assert.equal(t.agent_id, 'ag_0001');
  assert.equal(t.kind, 'walk');
  assert.equal(t.selection, 'fair');
  assert.match(t.text, /기본 순번마다 방문이 온다/);
  assert.match(t.text, /순번을 늦추거나 건너뛰지는 못한다/);
  closeTurn(); bed(); closeTurn();
  assert.ok(!S.loadEvents().some((e) => e.type === 'turn_opened' && ['evening', 'work'].includes(e.payload.kind)));
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('휴면: 개체가 요청하고 운영자가 통과시켜야 시작된다. 그 전에는 기본 순번대로 온다', async () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  day([{ action: 'request_dormancy', note: '좀 쉬겠다', wake: { after_turns: 50 } }]); // ag_0001
  const req = world().agents.ag_0001.dormancy_request;
  assert.equal(req.note, '좀 쉬겠다');
  assert.deepEqual(req.wake, { after_turns: 50 });
  assert.equal(world().agents.ag_0001.status, 'active');
  assert.equal(day().agent_id, 'ag_0002');
  const t = openTurn(); // 아직 통과되지 않았다: 하루 방문
  assert.equal(t.agent_id, 'ag_0001');
  assert.equal(t.kind, 'walk');
  assert.match(t.text, /휴면을 요청해 두었다\(세계 시계 \d+\)\. 운영자의 통과를 기다린다/);
  closeTurn(); bed(); closeTurn();
  // 운영자가 통과시키지 않으면 요청이 사라진다.
  const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, COMMONS_OPERATOR: '1' } });
  assert.match(cli('decline-dormancy', 'ag_0002').stderr, /휴면을 요청해 둔 활동 중인 개체/);
  assert.equal(cli('decline-dormancy', 'ag_0001', '지금은', '안', '된다').status, 0);
  assert.equal(world().agents.ag_0001.dormancy_request, null);
  assert.equal(S.loadEvents().at(-1).type, 'dormancy_declined');
  // 다시 요청하고, 거두고, 또 요청한다. 운영자가 통과시키면 휴면이 시작된다.
  day(); // ag_0002
  openTurn(); // ag_0001
  assert.equal(act({ action: 'request_dormancy', wake: { after_turns: 50 } }).ok, true);
  assert.equal(act({ action: 'cancel_dormancy_request' }).ok, true);
  assert.equal(world().agents.ag_0001.dormancy_request, null);
  assert.match(act({ action: 'cancel_dormancy_request' }).reason, /거둘 휴면 요청이 없다/);
  assert.equal(act({ action: 'request_dormancy', wake: { after_turns: 50 } }).ok, true);
  assert.match(cli('approve-dormancy', 'ag_0001').stderr, /방문이 열려 있다/);
  closeTurn(); bed(); closeTurn();
  assert.match(cli('status').stdout, /ag_0001 .*휴면 요청\(세계 시계 \d+/);
  assert.equal(cli('approve-dormancy', 'ag_0001').status, 0);
  const done = S.loadEvents().at(-1);
  assert.equal(done.type, 'agent_dormant');
  assert.equal(done.actor_id, 'operator');
  assert.equal(world().agents.ag_0001.status, 'dormant');
  assert.equal(day().agent_id, 'ag_0002');
  const rest = openTurn(); // 휴면 중에는 저녁만 있는 방문
  assert.equal(rest.agent_id, 'ag_0001');
  assert.equal(rest.kind, 'evening');
  assert.match(rest.text, /휴면 중이다/);
  bed(); closeTurn();
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('저녁: 휴면 중에도 저녁만 있는 방문이 열린다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  day([{ action: 'request_dormancy', wake: { after_turns: 50 } }]); // ag_0001
  approveDormancy('ag_0001');
  assert.equal(day().agent_id, 'ag_0002');
  const rest = openTurn();
  assert.equal(rest.agent_id, 'ag_0001');
  assert.equal(rest.kind, 'evening');
  assert.match(rest.text, /휴면 중이다/);
  bed(); closeTurn();
  assert.ok(verify().ok, verify().problems.join('\n'));
});

test('저녁: 휴면 중에는 저녁만 있는 방문이 열리고, 전언은 일과에 건네진다', () => {
  config({ ...EVENING, dream: undefined });
  turn(); turn();
  enableEvening();
  day([], [{ action: 'request_dormancy', wake: { on_message: true } }]); // ag_0001 이 저녁에 휴면을 청한다
  approveDormancy('ag_0001');
  assert.equal(world().agents.ag_0001.status, 'dormant');
  day(); // ag_0002
  const rest = openTurn();
  assert.equal(rest.kind, 'evening');
  assert.match(rest.text, /휴면 중이다\. 깨어날 조건: 새 전언/);
  const since = world().agents.ag_0001.dormant_since_clock;
  bed(); closeTurn();
  assert.equal(world().agents.ag_0001.dormant_since_clock, since);
  day([{ action: 'contact', to: 'ag_0001', content: '일어나 볼래' }]); // ag_0002
  const woke = openTurn();
  assert.equal(woke.agent_id, 'ag_0001');
  assert.equal(woke.kind, 'walk');
  assert.match(woke.text, /일어나 볼래/);
  closeTurn(); bed(); closeTurn();
  assert.ok(verify().ok);
});

test('저녁: 행동 한도는 일과에만, 저녁의 읽기는 자기 기록만이고 무엇을 읽었는지 남는다', () => {
  config({ ...EVENING, dream: undefined, turn: { max_actions: 1 } });
  turn([{ action: 'publish', slug: 'a', title: 'A', content: '글' }]); turn();
  enableEvening();
  openTurn(); // ag_0001
  assert.equal(act({ action: 'write_private', path: 'one', content: '1' }).ok, true);
  assert.match(act({ action: 'write_private', path: 'two', content: '2' }).reason, /행동 한도/);
  assert.match(read('work', 'ag_0001/a'), /「A」/);
  closeTurn();
  assert.equal(act({ action: 'write_private', content: '저녁 1' }).ok, true);
  assert.equal(act({ action: 'write_private', content: '저녁 2' }).ok, true);
  assert.match(read('work', 'ag_0001/a'), /저녁에는 바깥 기록이 이 자리에 없다/);
  assert.match(read('events'), /저녁에는 바깥 기록이 이 자리에 없다/);
  assert.equal(read('note', 'one'), '1');
  assert.match(read('evening'), /^# 저녁 — ag_0001/);
  assert.match(read('agent', 'ag_0001'), /# ag_0001/);
  assert.match(read('agent', 'ag_0002'), /저녁에는 바깥 기록이 이 자리에 없다/);
  assert.match(act({ action: 'sleep', dream: '꿈' }).reason, /오늘 밤의 회고/);
  assert.equal(act({ action: 'review_self', map: '나는 한도를 본 개체다.' }).ok, true);
  assert.equal(act({ action: 'sleep', dream: '꿈' }).ok, true);
  closeTurn();
  const closed = S.loadEvents().at(-1).payload;
  assert.deepEqual(closed.read, ['work:ag_0001/a@1', 'note:one', 'agent:ag_0001']);
  assert.deepEqual(closed.evening.read, ['note:one', 'agent:ag_0001']);
  assert.equal(closed.evening.actions, 4); // 저녁 기록 둘, 자기 지도, 꿈
});

test('저녁: 한 파일 방문은 저녁을 sleep 으로 끝내야 하고, 재적용은 처음 받은 낱말을 쓴다', () => {
  config(EVENING);
  let calls = 0;
  tickMod.setDreamSource(() => { calls++; throw new Error('연결 거부'); });
  try {
    turn(); turn();
    enableEvening();
    const sleep = (id, dream = '꿈') => ({ request_id: id, proposal: { action: 'sleep', dream } });
    const note = (id) => ({ request_id: id, proposal: { action: 'review_self', map: '저녁의 지도' } });
    assert.throws(() => tickMod.applyVisit({ agent: 'ag_0001', proposals: [], evening: [{ request_id: 'eve-00001', proposal: { action: 'write_private', content: 'x' } }] }), /sleep 으로 끝나야 한다/);
    assert.throws(() => tickMod.applyVisit({ agent: 'ag_0001', proposals: [] }), /sleep 으로 끝나야 한다/);
    const r = tickMod.applyVisit({ agent: 'ag_0001', proposals: [{ request_id: 'day-00001', proposal: { action: 'write_private', path: 'd', content: '일과' } }],
      evening: [{ request_id: 'eve-00002', proposal: { action: 'write_private', content: '저녁' } }, note('eve-00009'), sleep('eve-00003')] });
    assert.equal(r.status, 'applied');
    assert.ok(r.results.every((x) => x.ok));
    assert.equal(calls, 1);
    const events = S.loadEvents();
    assert.equal(events.find((e) => e.type === 'day_ended').payload.by, 'apply');
    const seeded = events.find((e) => e.type === 'dream_seeded').payload;
    assert.deepEqual(seeded.words, []);
    assert.match(seeded.failed, /연결 거부/);
    // 낱말이 없으면 다음 해동 브리핑에 줄이 없다. 방문은 정상으로 닫혔다.
    const last = tickMod.loadLastVisit();
    assert.deepEqual(last.proposals.map((x) => x.phase), ['day', 'evening', 'evening', 'evening']);
    // 재적용(충돌 뒤): 낱말은 다시 받지 않는다.
    // 사생활 없는 저녁, 꿈 없는 잠은 열기 전에 받지 않는다.
    assert.throws(() => tickMod.applyVisit({ agent: 'ag_0002', proposals: [], evening: [sleep('eve-00005')] }), /오늘 밤의 회고/);
    assert.throws(() => tickMod.applyVisit({ agent: 'ag_0002', proposals: [], evening: [note('eve-00007'), { request_id: 'eve-00008', proposal: { action: 'sleep' } }] }), /dream 이 있어야 한다/);
    const r2 = tickMod.applyVisit({ agent: 'ag_0002', proposals: [], evening: [note('eve-00006'), sleep('eve-00004', '화강암 위의 바이올린')], dream: { words: ['granite'], source: 'words.test' } });
    assert.equal(r2.status, 'applied');
    assert.equal(calls, 1);
    assert.deepEqual(S.loadEvents().filter((e) => e.type === 'dream_seeded').at(-1).payload.words, ['granite']);
    const t1 = openTurn(); // ag_0001: 지난밤 꿈이 맨 위에. 낱말이 없었으니 오늘 밤의 낱말 줄은 없다
    assert.equal(t1.agent_id, 'ag_0001');
    assert.equal(t1.text.split('\n')[1], '지난밤의 꿈: 꿈');
    assert.doesNotMatch(closeTurn().text, /오늘 밤의 낱말/);
    bed(); closeTurn();
    openTurn(); // ag_0002
    assert.match(closeTurn().text, /오늘 밤의 낱말: granite/);
    bed(); closeTurn();
    assert.ok(verify().ok);
  } finally { tickMod.setDreamSource(null); }
});
