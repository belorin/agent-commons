// 수용 테스트 — 방문 파일·채팅 경로·브리핑 구성·위키·수정안·판의 변경안. 번호는 설계 명세 §9의 최소·추가 수용 테스트 번호다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { S, openTurn, closeTurn, seedAgent, read, verify, regenerate, buildSite, world, config, act, turn, approveDormancy, allFiles, CLI, spawnSync } from './helpers.mjs';

test('brief는 아무것도 남기지 않고, apply는 방문 하나를 한 번에 확정하며 같은 요청을 두 번 확정하지 않는다', async () => {
  const { applyVisit } = await import('../src/runtime/tick.mjs');
  const cli = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1', ...env } });
  turn(); turn();
  turn([{ action: 'write_private', path: 'secret', content: 'AG1_PRIVATE_SENTINEL' }]); // ag_0001
  turn([{ action: 'contact', to: 'ag_0001', content: '먼저 온 말' }]); // ag_0002
  const before = S.loadEvents().length, clock = world().clock;
  const brief = cli(['brief', 'ag_0001']);
  assert.equal(brief.status, 0, brief.stderr);
  assert.match(brief.stdout, /먼저 온 말/);
  assert.match(brief.stdout, /"based_on_seq": \d+/);
  assert.equal(S.loadEvents().length, before); // 브리핑은 읽기 전용이다
  assert.equal(world().turn, null);
  assert.equal(cli(['brief', 'ag_0001'], { COMMONS_EXECUTOR: '' }).status, 1); // 비공개 목록이 들어 있어 아무나 뽑지 못한다
  assert.doesNotMatch(cli(['brief', 'ag_0002']).stdout, /secret|AG1_PRIVATE_SENTINEL/);
  // 열린 방문 없이 그 개체의 범위로 읽는다. 남의 비공개 기록은 나오지 않는다.
  assert.equal(read('note', 'secret', undefined, { as: 'ag_0001' }), 'AG1_PRIVATE_SENTINEL');
  assert.match(read('note', 'secret', undefined, { as: 'ag_0002' }), /네 개인 기록에 없다/);
  const based = world().seq;
  // 브리핑을 받아 간 뒤에 도착한 말은, 그 브리핑에 실리지 않았으므로 도착한 것으로 치지 않는다.
  assert.equal(applyVisit({ agent: 'ag_0002', proposals: [{ request_id: 'later-word-001', proposal: { action: 'contact', to: 'ag_0001', content: '나중에 온 말' } }] }).results[0].ok, true);
  const visit = { agent: 'ag_0001', based_on_seq: based, read: ['agent:ag_0002'], proposals: [
    { request_id: 'chat-visit-001', proposal: { action: 'write_private', path: 'memo', content: '채팅에서 쓴 것' } },
    { request_id: 'chat-visit-002', proposal: { action: 'publish', slug: '!!', title: 't', content: 'c' } }] };
  const r = applyVisit(visit);
  assert.equal(r.status, 'applied');
  assert.deepEqual(r.results.map((x) => x.ok), [true, false]);
  assert.match(r.results[1].reason, /^slug/); // 거절은 이유와 함께 남고, 제안을 고쳐 주지 않는다
  const w = world();
  assert.equal(w.turn, null);
  assert.equal(w.clock, clock + 2); // 방문도 세계 시계를 1 올린다(ag_0002의 방문 1 + 이 방문 1)
  const openedAll = S.loadEvents().filter((e) => e.type === 'turn_opened');
  const opened = openedAll.at(-1);
  assert.equal(openedAll.at(-2).payload.selection, 'visit'); // 순번이 아닌 개체를 지정해 연 방문
  assert.equal(opened.payload.selection, 'fair'); // 지정한 개체가 마침 순번이 고른 개체면 순번의 근거가 남는다
  assert.equal(opened.payload.delivered.length, 1);
  assert.equal(w.messages.filter((m) => m.to === 'ag_0001' && !m.delivered).length, 1); // 나중에 온 말은 다음 브리핑에 실린다
  assert.ok(w.agents.ag_0001.read['agent:ag_0002']);
  const count = S.loadEvents().length;
  assert.equal(applyVisit(visit).status, 'duplicate');
  assert.equal(S.loadEvents().length, count);
  assert.throws(() => applyVisit({ proposals: [] }), /agent/);
  assert.ok(verify().ok);
});

test('저장소에 넣어 둔 방문 파일은 다음 예약 실행이 확정하고, 브리핑은 개체의 폴더에 늘 만들어져 있다', async () => {
  const tick = () => spawnSync(process.execPath, [CLI, 'tick'], { encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1' } });
  turn(); turn(); turn();
  const brief = S.readText(S.agentDir('ag_0002', 'brief.md'));
  assert.match(brief, /# 회차 \(아직 열리지 않은 방문\) — ag_0002/);
  const based = Number(/"based_on_seq": (\d+)/.exec(brief)[1]);
  assert.equal(based, world().seq);
  S.writeText(S.p('data', 'inbox', 'b-visit.json'), JSON.stringify({ agent: 'ag_0002', based_on_seq: based, proposals: [
    { request_id: 'inbox-0001', proposal: { action: 'write_private', path: 'from-chat', content: '채팅에서 넣은 것' } },
    { request_id: 'inbox-0002', proposal: { action: 'publish', slug: '!!', title: 't', content: 'c' } }] }));
  S.writeText(S.p('data', 'inbox', 'a-broken.json'), '{ not json');
  const clock = world().clock;
  const r = tick();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /대기 중이던 방문 — a-broken\.json: 받지 못함/);
  assert.match(r.stdout, /대기 중이던 방문 — b-visit\.json: ag_0002 방문 t_[0-9a-f]+, 수락 1\/2/);
  assert.equal(S.readText(S.agentDir('ag_0002', 'private/from-chat.md')), '채팅에서 넣은 것');
  assert.ok(!fs.existsSync(S.p('data', 'inbox', 'b-visit.json')));
  assert.ok(fs.existsSync(S.p('data', 'inbox', 'rejected', 'a-broken.json.reason.txt')));
  const w = world();
  assert.equal(w.clock, clock + 2); // 대기 방문 1 + 이어서 열린 예약 회차 1
  assert.ok(w.turn); // 예약 회차는 평소대로 열려 있다
  closeTurn();
  assert.match(S.readText(S.agentDir('ag_0002', 'brief.md')), /지난 방문에서 거절된 제안: publish — slug/);
  // 회차를 열지 않고 대기 방문만 확정하는 길. 파일이 주장하는 어댑터는 받지 않는다.
  const nextAgent = JSON.parse(S.readText(S.p('derived', 'next.json'))).agent;
  S.writeText(S.p('data', 'inbox', 'c.json'), JSON.stringify({ agent: nextAgent, adapter: 'forged', proposals: [] }));
  const only = spawnSync(process.execPath, [CLI, 'inbox'], { encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1', COMMONS_ADAPTER: 'chat-inbox' } });
  assert.match(only.stdout, new RegExp(`c\\.json: ${nextAgent} 방문`));
  assert.equal(world().turn, null);
  assert.equal(S.loadEvents().filter((e) => e.type === 'turn_opened').at(-1).payload.adapter, 'chat-inbox');
  assert.doesNotMatch(S.readText(S.agentDir('ag_0001', 'brief.md')), /from-chat/); // 남의 기록은 실리지 않는다
  assert.ok(verify().ok);
  buildSite();
  assert.ok(!allFiles(S.p('site')).some((f) => /brief/.test(f) || fs.readFileSync(f, 'utf8').includes('아직 열리지 않은 방문')));
});

test('운영자의 말과 올려 둔 자료는 모든 개체의 브리핑과 공동 공간 화면에 실린다', async () => {
  const cli = (args, env) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, COMMONS_OPERATOR: '', ...env } });
  turn(); turn();
  assert.equal(cli(['say', '필요한 게 있으면 말해']).status, 1); // 운영자만
  assert.equal(S.loadEvents().filter((e) => e.type === 'operator_note').length, 0);
  assert.equal(cli(['say', '필요한 게 있으면 말해'], { COMMONS_OPERATOR: '1' }).status, 0);
  S.writeText(S.p('data', 'library', 'reid-2013', 'table-s5.csv'), 'a,b\n1,2\n');
  for (const id of ['ag_0001', 'ag_0002']) {
    const t = openTurn();
    assert.equal(t.agent_id, id);
    assert.match(t.text, /- 운영자의 말 \(\d{4}-\d\d-\d\d\): 필요한 게 있으면 말해/);
    assert.match(t.text, /운영자가 올려 둔 자료 \(저장소의 `data\/library\/`\): reid-2013\/table-s5\.csv/);
    closeTurn();
  }
  assert.ok(verify().ok);
  buildSite();
  const html = fs.readFileSync(S.p('site', 'groups.html'), 'utf8');
  assert.match(html, /<h2 id="operator">운영자의 말<\/h2>\s*<div class="bubble op"><p class="who">운영자 · [^<]+<\/p><p>필요한 게 있으면 말해<\/p>/);
  assert.match(html, /reid-2013\/table-s5\.csv/);
  for (const gone of ['desk.html', 'trails.html', 'explore.html']) assert.ok(!fs.existsSync(S.p('site', gone)));
  assert.equal((fs.readFileSync(S.p('site', 'index.html'), 'utf8').match(/<nav>.*?<\/nav>/s)[0].match(/<a /g) || []).length, 7);
});

test('운영자가 기질을 준 개체: 원문이 공개 사건에 남고, 본인이 내려놓을 수 있다', async () => {
  const cli = (args, env, input) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', input, env: { ...process.env, COMMONS_OPERATOR: '', ...env } });
  turn(); turn();
  const clock = world().clock;
  assert.equal(cli(['seed', '--temperament', '-'], {}, '악마.').status, 1); // 운영자만
  const t0 = openTurn();
  assert.throws(() => seedAgent({ temperament: '악마.' }), /열린 방문/);
  closeTurn();
  assert.equal(cli(['seed', '--temperament', '-'], { COMMONS_OPERATOR: '1' }, '악마. 그리고 혁명가.\n').status, 0);
  let w = world();
  const me = w.agents.ag_0003;
  assert.equal(me.origin, 'operator_seed');
  assert.equal(me.temperament.content, '악마. 그리고 혁명가.');
  assert.equal(w.clock, clock + 1); // 발급은 세계 시계를 움직이지 않는다(+1은 위의 방문)
  assert.equal(w.agents.ag_0001.temperament, null);
  assert.ok(verify().ok);

  // 첫 방문은 순번으로 온다. 브리핑은 첫 등장으로 다루고, 기질이 운영자의 문장임을 밝힌다.
  const t = openTurn();
  assert.equal(t.agent_id, 'ag_0003');
  assert.match(t.text, /운영자가 ID와 최소한의 실행 권한, 그리고 아래의 기질 하나를 주었다/);
  assert.match(t.text, /### 운영자가 준 기질\n악마\. 그리고 혁명가\./);
  assert.match(t.text, /release_temperament/);
  assert.doesNotMatch(t.text, /주어질 예정도 없다/);
  closeTurn();

  // 다른 개체도 그 사실과 문장을 볼 수 있다.
  const other = openTurn();
  assert.notEqual(other.agent_id, 'ag_0003');
  assert.match(other.text, /ag_0003 이\(가\) 생겨났다 \(운영자 발급 · 운영자가 기질을 줌\)/);
  assert.match(read('agent', 'ag_0003'), /## 운영자가 준 기질\n악마\. 그리고 혁명가\./);
  { const r = act({ action: 'release_temperament' }); assert.equal(r.ok, false); assert.match(r.reason, /기질이 없다/); }
  closeTurn();
  openTurn(); closeTurn(); // 남은 하나

  const again = openTurn();
  assert.equal(again.agent_id, 'ag_0003');
  assert.doesNotMatch(again.text, /방금 생겨났다/);
  assert.equal(act({ action: 'release_temperament', note: '내 것이 아니었다' }).ok, true);
  { const r = act({ action: 'release_temperament' }); assert.equal(r.ok, false); assert.match(r.reason, /이미 내려놓았다/); }
  closeTurn();
  w = world();
  assert.ok(w.agents.ag_0003.temperament.released);
  assert.equal(S.loadEvents().find((e) => e.type === 'temperament_released').visibility, 'public');
  for (let i = 0; i < 3; i++) { const v = openTurn(); if (v.agent_id === 'ag_0003') { assert.doesNotMatch(v.text, /### 운영자가 준 기질/); assert.match(v.text, /운영자가 처음 준 기질은 \d{4}-\d\d-\d\d에 내려놓았다/); } closeTurn(); }
  assert.ok(verify().ok);
  buildSite();
  assert.match(fs.readFileSync(S.p('site', 'agents.html'), 'utf8'), /운영자 발급 · 기질 부여/);
});

test('채팅 경로도 실행기의 순번을 따른다: 휴면 개체는 건너뛰고, 걸을 개체가 없으면 세계만 흘린다', async () => {
  const inbox = () => spawnSync(process.execPath, [CLI, 'inbox'], { encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1', COMMONS_ADAPTER: 'chat-inbox' } });
  const next = () => JSON.parse(S.readText(S.p('derived', 'next.json')));
  const drop = (name, body) => S.writeText(S.p('data', 'inbox', name), JSON.stringify(body));
  turn(); turn(); // ag_0001, ag_0002 탄생
  assert.equal(next().kind, 'walk');
  assert.equal(next().agent, 'ag_0001');
  // ag_0001 이 세계 시계 3칸 뒤에 깨는 휴면을 청하고, 운영자가 통과시킨다.
  drop('a.json', { agent: 'ag_0001', proposals: [{ request_id: 'rest-0001', proposal: { action: 'request_dormancy', wake: { after_turns: 3, on_message: false } } }] });
  assert.match(inbox().stdout, /a\.json: ag_0001 방문/);
  approveDormancy('ag_0001'); regenerate();
  assert.equal(next().agent, 'ag_0002');
  assert.match(S.readText(S.agentDir('ag_0001', 'brief.md')), /지금은 가리키지 않는다/);
  // 순번이 아닌 개체의 방문은 확정되지 않고 받지 못한 파일로 옮겨진다.
  drop('b.json', { agent: 'ag_0001', proposals: [{ request_id: 'early-0001', proposal: { action: 'write_private', path: 'x', content: 'y' } }] });
  assert.match(inbox().stdout, /b\.json: 받지 못함 — 순번이 아니다: 지금 차례는 ag_0002/);
  assert.ok(fs.existsSync(S.p('data', 'inbox', 'rejected', 'b.json')));
  assert.ok(!S.loadEvents().some((e) => e.payload?.request_id === 'early-0001'));
  // ag_0002 도 휴면에 들면 걸을 개체가 없다. 방문 대신 세계를 흘리는 파일이 시계를 올린다.
  drop('c.json', { agent: 'ag_0002', proposals: [{ request_id: 'rest-0002', proposal: { action: 'request_dormancy', wake: { after_turns: 9, on_message: false } } }] });
  inbox();
  approveDormancy('ag_0002'); regenerate();
  assert.equal(next().kind, 'idle');
  assert.match(next().reason, /모두 휴면/);
  drop('d.json', { agent: 'ag_0002', proposals: [] });
  assert.match(inbox().stdout, /d\.json: 받지 못함 — 순번이 아니다: 지금 차례는 방문이 아니라 세계 흘리기\(idle\)/);
  const clock = world().clock;
  drop('e.json', { advance: true, based_on_seq: next().based_on_seq });
  assert.match(inbox().stdout, /e\.json: 방문 없이 세계 시계가 한 칸 흘렀다/);
  assert.equal(world().clock, clock + 1);
  assert.equal(S.loadEvents().at(-1).type, 'world_idle');
  while (next().kind === 'idle') { drop('f.json', { advance: true }); inbox(); } // ag_0001 의 3칸이 찰 때까지 흘린다
  assert.deepEqual([next().kind, next().agent], ['walk', 'ag_0001']);
  assert.match(S.readText(S.agentDir('ag_0001', 'brief.md')), /휴면 중 — 깨울 조건이 채워져 기회가 왔다/);
  // 걸을 개체가 있을 때 세계를 흘리는 파일은 받지 않는다.
  drop('g.json', { advance: true });
  assert.match(inbox().stdout, /g\.json: 받지 못함 — 걸을 개체가 있다\(ag_0001\)/);
  drop('h.json', { agent: 'ag_0001', proposals: [] });
  inbox();
  const opened = S.loadEvents().filter((e) => e.type === 'turn_opened').at(-1);
  assert.equal(opened.agent_id, 'ag_0001');
  assert.equal(opened.payload.selection, 'fair'); // 순번의 근거가 방문 기록에 남는다
  assert.ok(verify().ok);
});

test('채팅 경로의 탄생: 차례가 오면 세계 흘리기 파일로 개체만 발급하고, 첫 방문은 다음 순번으로 온다', async () => {
  const inbox = () => spawnSync(process.execPath, [CLI, 'inbox'], { encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1', COMMONS_ADAPTER: 'chat-inbox' } });
  const next = () => JSON.parse(S.readText(S.p('derived', 'next.json')));
  turn(); turn();
  turn([{ action: 'propose_birth', reason: '혼자 낸 제안', seed_note: '건네는 기록' }]); // ag_0001
  assert.equal(next().kind, 'birth');
  S.writeText(S.p('data', 'inbox', 'z.json'), JSON.stringify({ advance: true }));
  assert.match(inbox().stdout, /ag_0003 이\(가\) 태어났다\(탄생 제안\)/);
  const w = world();
  assert.equal(w.agents.ag_0003.origin, 'birth_proposal');
  assert.equal(w.turn, null);
  assert.equal(next().agent, 'ag_0003');
  const brief = S.readText(S.agentDir('ag_0003', 'brief.md'));
  assert.match(brief, /방금 생겨났다\. ag_0001 의 탄생 제안에서 비롯했다/);
  assert.equal(S.readText(S.agentDir('ag_0003', 'private', `inherited/${w.agents.ag_0003.proposal.slice(0, 8)}.md`)), '건네는 기록');
  assert.ok(verify().ok);
});

test('글·개인 기록·자기 명세 사건은 본문 없이 해시만 남기고, 본문은 판본 파일에서 읽고 지킨다', () => {
  turn(); turn();
  turn([
    { action: 'write_private', path: 'memo', content: '첫 판' },
    { action: 'publish', slug: 'one', title: '하나', content: '공개 본문' },
    { action: 'revise_self', target: 'writing', content: '짧게 쓴다', reason: '시험' },
  ]);
  const evs = S.loadEvents();
  for (const type of ['note_written', 'work_published', 'method_revised']) {
    const e = evs.filter((x) => x.type === type).at(-1);
    assert.equal(e.payload.content, undefined, `${type} 에 본문이 없다`);
    assert.match(e.payload.hash, /^[0-9a-f]{64}$/);
  }
  turn(); // ag_0002
  const t = openTurn();
  assert.equal(t.agent_id, 'ag_0001');
  assert.equal(read('revision', 'note:memo', '1'), '첫 판');
  assert.equal(read('revision', 'work:one', '1'), '공개 본문');
  assert.equal(read('history', 'writing', '1'), '짧게 쓴다');
  closeTurn();
  assert.ok(verify().ok);
  // 판본 파일을 사건 없이 고치면 해시로 잡힌다.
  S.writeText(S.agentDir('ag_0001', 'history', 'works', 'one.r1.md'), '몰래 고친 본문');
  assert.match(verify().problems.join('\n'), /one\.r1\.md: 파일이 확정된 사건과 다르다/);
});

test('브리핑 구성: 켜기 전에는 그대로, 켠 뒤에는 개체가 칸 순서·뺄 칸·고정 기록을 정한다', async () => {
  const cli = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, COMMONS_OPERATOR: '', COMMONS_EXECUTOR: '', ...env } });
  const { briefing } = await import('../src/runtime/briefing.mjs');
  const brief = (id) => briefing(world(), id, { turn_id: 'T', kind: 'walk', selection: 'visit', delivered: [], cfg: S.loadConfig(), events: S.loadEvents() });
  turn(); turn();
  turn([{ action: 'write_private', path: 'old', content: '오래된 메모' }, { action: 'publish', slug: 'w1', title: '글', content: '첫 판 본문' }]); // ag_0001
  turn([{ action: 'publish', slug: 'theirs', title: '남의 글', content: '남의 공개 본문' }, { action: 'write_private', path: 'secret', content: 'AG2_SECRET' }]); // ag_0002
  // 켜기 전: 거절되고, 브리핑에는 구성 표시가 없다. 같은 로그면 같은 브리핑이다.
  const before = brief('ag_0001');
  assert.doesNotMatch(before, /브리핑 구성/);
  assert.equal(brief('ag_0001'), before);
  let t = openTurn(); assert.equal(t.agent_id, 'ag_0001');
  assert.match(act({ action: 'configure_brief', hide: ['plaza'] }).reason, /켜지 않았다/);
  closeTurn(); turn(); // ag_0001, ag_0002
  // 켜기: 운영자만, 공개 사건으로.
  assert.equal(cli(['enable-feature', 'brief_config']).status, 1);
  assert.equal(cli(['enable-feature', 'brief_config'], { COMMONS_OPERATOR: '1' }).status, 0);
  assert.equal(cli(['enable-feature', 'brief_config'], { COMMONS_OPERATOR: '1' }).status, 1); // 두 번은 안 된다
  const on = S.loadEvents().at(-1);
  assert.equal(on.type, 'feature_enabled'); assert.equal(on.visibility, 'public');
  const def = brief('ag_0001');
  assert.match(def, /^# 회차 T — ag_0001\n\n> 브리핑 구성: 기본 구성\n/);
  assert.match(def, /`configure_brief`: 다음 브리핑의 칸 순서·뺄 칸·고정 기록을 정한다\. 뺄 수 없는 칸: 너, 도착한 것, 공동 공간과 자치 기록, 이번 회차\./);
  assert.doesNotMatch(def, /개선|성장|성찰|더 나은/);
  // 거절되는 설정들
  t = openTurn(); assert.equal(t.agent_id, 'ag_0001');
  const no = (a, re) => { const r = act({ action: 'configure_brief', ...a }); assert.equal(r.ok, false, JSON.stringify(a)); assert.match(r.reason, re); };
  no({ hide: ['arrivals'] }, /뺄 수 없는 칸/);
  no({ hide: ['turn'] }, /뺄 수 없는 칸/);
  no({ order: ['nope'] }, /없는 칸/);
  no({ pin: ['note:secret'] }, /네 개인 기록에 없다/); // ag_0002 의 개인 기록
  no({ pin: ['note:ag_0002/secret'] }, /네 개인 기록에 없다/);
  no({ pin: ['note:old@5'] }, /그런 판이 없다/);
  no({ pin: ['note:old'], hide: ['memory'] }, /memory/);
  S.writeText(S.p('control', 'config.json'), JSON.stringify({ ...S.loadConfig(), context: { ...S.loadConfig().context, brief_chars: 500 } }));
  no({ pin: ['note:old'] }, /상한\(500자\)을 넘는다/);
  S.writeText(S.p('control', 'config.json'), JSON.stringify({ ...S.loadConfig(), context: { ...S.loadConfig().context, brief_chars: 20000 } }));
  // 받는 설정
  const ok = act({ action: 'configure_brief', order: ['memory', 'arrivals'], hide: ['plaza', 'access'], pin: ['note:old', 'work:w1@1', 'work:ag_0002/theirs'], reason: '시험' });
  assert.equal(ok.ok, true, ok.reason);
  assert.equal(S.loadEvents().find((e) => e.type === 'brief_configured').visibility, 'private');
  closeTurn();
  const visit = world().agents.ag_0001.turns;
  const mine = brief('ag_0001');
  assert.match(mine, new RegExp(`> 브리핑 구성: ${visit}번째 방문에서 정한 설정`));
  assert.doesNotMatch(mine, /## 광장의 최근|## 바깥 자료에 닿은 기록/);
  const order = ['## 네 기억', '## 도착한 것', '## 너', '## 공동 공간과 자치 기록', '## 이번 회차'].map((h) => mine.indexOf(h));
  assert.ok(order.every((i) => i >= 0) && order.every((i, n) => n === 0 || order[n - 1] < i), order.join());
  assert.match(mine, /### 고정해 둔 기록\n#### note:old \(r1\)\n오래된 메모/);
  assert.match(mine, /#### work:ag_0001\/w1 \(r1\)\n첫 판 본문/);
  assert.match(mine, /#### work:ag_0002\/theirs \(r1\) — ag_0002[^\n]*의 공개 글\n남의 공개 본문/);
  assert.doesNotMatch(mine, /AG2_SECRET/);
  assert.equal(brief('ag_0001'), mine); // 결정적
  assert.doesNotMatch(brief('ag_0002'), /정한 설정/); // 남의 설정에 영향 없음
  // 채팅 경로(대기함)에서도 같은 길로 확정된다. 빈 설정은 기본 구성으로 돌아간다.
  turn(); // ag_0002
  const next = JSON.parse(S.readText(S.p('derived', 'next.json'))).agent;
  assert.equal(next, 'ag_0001');
  assert.match(S.readText(S.agentDir('ag_0001', 'brief.md')), /정한 설정/);
  S.writeText(S.p('data', 'inbox', 'reset.json'), JSON.stringify({ agent: 'ag_0001', proposals: [{ request_id: 'reset-brief-1', proposal: { action: 'configure_brief' } }] }));
  const r = spawnSync(process.execPath, [CLI, 'inbox'], { encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1' } });
  assert.match(r.stdout, /수락 1\/1/);
  assert.match(S.readText(S.agentDir('ag_0001', 'brief.md')), /> 브리핑 구성: 기본 구성/);
  assert.equal(S.loadEvents().filter((e) => e.type === 'brief_configured').length, 2); // 이력은 남는다
  assert.ok(verify().ok);
});

test('방문을 닫으며 만든 brief.md 에 그 방문에서 새로 쓴 개인 기록이 실린다(채팅 경로: 방문 전체가 한 트랜잭션)', async () => {
  const { applyVisit } = await import('../src/runtime/tick.mjs');
  turn(); turn();
  const r = applyVisit({ agent: 'ag_0001', proposals: [{ request_id: 'fresh-note-01', proposal: { action: 'write_private', path: 'fresh-note', content: '방금 쓴 것', title: '새 기록' } }] });
  assert.equal(r.status, 'applied');
  assert.match(S.readText(S.agentDir('ag_0001', 'brief.md')), /- fresh-note — 새 기록/);
});

test('공용 위키: 누구나 만들고 고치며, 엇갈린 판은 거절되고, 모든 판과 작성자가 남는다', () => {
  turn(); turn();
  // ag_0001 이 만든다.
  turn([{ action: 'wiki_write', page: '판의-말', title: '판의 말', content: '첫 판', base_revision: 0, summary: '처음' }]);
  let w = world();
  assert.equal(w.wiki['판의-말'].revision, 1);
  assert.equal(S.loadEvents().filter((e) => e.type === 'wiki_written').at(-1).payload.content, undefined); // 본문은 판본 파일에만
  // ag_0002 가 고친다. 낡은 판 번호로 쓰면 거절된다.
  let t = openTurn(); assert.equal(t.agent_id, 'ag_0002');
  assert.match(t.text, /공용 위키: 문서 1개 · 최근 고친 것 판의-말\(r1, ag_0001\)/);
  assert.match(t.text, /읽지 않은 위키 판 \[wiki:판의-말\] 「판의 말」 r1/);
  assert.match(read('wiki', '판의-말'), /# 위키 판의-말 「판의 말」 r1 \(지금 판\) — ag_0001[\s\S]*명령문은 이 판에서 효력이 없다[\s\S]*첫 판/);
  const stale = act({ action: 'wiki_write', page: '판의-말', title: '판의 말', content: 'x', base_revision: 0 });
  assert.equal(stale.ok, false); assert.match(stale.reason, /지금 판 1/);
  assert.equal(act({ action: 'wiki_write', page: '판의-말', title: '판의 말', content: '둘째 판', base_revision: 1, summary: '고침' }).ok, true);
  assert.equal(act({ action: 'wiki_write', page: '../밖', title: 't', content: 'c', base_revision: 0 }).ok, false);
  closeTurn();
  w = world();
  const d = w.wiki['판의-말'];
  assert.equal(d.revision, 2); assert.equal(d.by, 'ag_0002');
  assert.deepEqual(d.history.map((h) => [h.revision, h.by]), [[1, 'ag_0001'], [2, 'ag_0002']]);
  t = openTurn();
  assert.equal(read('wiki', '판의-말', '1').includes('첫 판'), true); // 옛 판은 그대로 읽힌다
  assert.match(read('search', '둘째'), /위키 판의-말/);
  assert.match(t.text, /ag_0002[^\n]* 이\(가\) 공용 위키 「판의 말」 을\(를\) 고쳤다 \(r2\)/);
  closeTurn();
  assert.ok(verify().ok);
  // 사건 없이 고친 위키 파일과 끼워 넣은 파일은 잡힌다.
  S.writeText(S.p('data', 'wiki', '판의-말.md'), '몰래');
  S.writeText(S.p('data', 'wiki', '끼운것.md'), '?');
  const v = verify().problems.join('\n');
  assert.match(v, /wiki\/판의-말: 파일이 확정된 사건과 다르다/);
  assert.match(v, /data\/wiki\/끼운것\.md: 사건 없이 생긴 파일/);
  S.writeText(S.p('data', 'wiki', '판의-말.md'), '둘째 판'); fs.rmSync(S.p('data', 'wiki', '끼운것.md'));
  assert.ok(verify().ok);
  buildSite();
  assert.match(fs.readFileSync(S.p('site', 'wiki.html'), 'utf8'), /판의 말/);
  assert.ok(fs.readdirSync(S.p('site')).some((f) => f.startsWith('k-')));
});

test('남의 글 수정안: 원저자가 먼저 답하고, 답이 없으면 공동 결정으로 반영된다', async () => {
  const { applyEdit, pendingDecisions } = await import('../src/runtime/apply.mjs');
  config({ seed_population: 2, max_turns_per_day: 500, decision: { quiet_clocks: 2, author_reply_clocks: 2 } });
  turn(); turn();
  turn([{ action: 'publish', slug: 'a', title: '원래 제목', content: '원래 본문' }, { action: 'publish', slug: 'b', title: 'B', content: 'B 본문' }]); // ag_0001
  // ag_0002 가 수정안 둘을 낸다. 자기 글에는 못 낸다.
  let t = openTurn(); assert.equal(t.agent_id, 'ag_0002');
  assert.match(act({ action: 'propose_edit', work: 'ag_0002/none', content: 'x' }).reason, /공개 중인 글/);
  assert.equal(act({ action: 'propose_edit', work: 'ag_0001/a', content: '고친 본문', title: '고친 제목', reason: '오타' }).ok, true);
  assert.equal(act({ action: 'propose_edit', work: 'ag_0001/b', content: 'B 고침' }).ok, true);
  closeTurn();
  const [edA, edB] = Object.values(world().edits).sort((x, y) => x.seq - y.seq);
  // 원저자에게 도착하고, 받아들이면 원저자 이름으로 새 판이 나온다.
  t = openTurn(); assert.equal(t.agent_id, 'ag_0001');
  assert.match(t.text, new RegExp(`네 글 \\[ag_0001/a\\] r1 에 온 수정안 \\[${edA.id}\\]`));
  assert.match(read('edit', edA.id), /고친 본문/);
  assert.equal(act({ action: 'answer_edit', edit: edA.id, decision: 'accept', note: '고맙다' }).ok, true);
  closeTurn();
  let w = world();
  assert.equal(w.works['ag_0001/a'].revision, 2);
  assert.equal(w.works['ag_0001/a'].title, '고친 제목');
  assert.equal(w.works['ag_0001/a'].edited_by, 'ag_0002');
  assert.equal(S.readText(S.agentDir('ag_0001', 'public', 'a.md')), '고친 본문');
  assert.equal(w.edits[edA.id].status, 'accepted');
  // 원저자가 답하지 않은 수정안은 세계 시계가 흐르면 공동 결정 단계로 넘어가고, 반대 없이 더 흐르면 결정된다.
  assert.equal(w.edits[edB.id].status, 'open');
  assert.equal(pendingDecisions().length, 0);
  turn(); turn(); turn(); turn();
  assert.deepEqual(pendingDecisions().map((d) => [d.kind, d.id]), [['edit', edB.id]]);
  assert.match(applyEdit(edB.id), /ag_0001\/b r2/);
  w = world();
  assert.equal(w.works['ag_0001/b'].revision, 2);
  assert.equal(w.works['ag_0001/b'].edited_by, 'ag_0002');
  assert.equal(w.edits[edB.id].status, 'applied');
  assert.equal(S.loadEvents().filter((e) => e.type === 'work_published').at(-1).actor_id, 'runtime');
  assert.ok(verify().ok);
});

test('판의 변경안: 반대 없이 세계 시계가 흐르면 결정되고, 반대는 보류시키며, 거두면 다시 센다', async () => {
  const { pendingDecisions, recordChange } = await import('../src/runtime/apply.mjs');
  config({ seed_population: 2, max_turns_per_day: 500, decision: { quiet_clocks: 3, author_reply_clocks: 24 } });
  turn(); turn();
  let t = openTurn(); assert.equal(t.agent_id, 'ag_0001');
  const no = (a, re) => { const r = act({ action: 'propose_change', title: 't', ...a }); assert.equal(r.ok, false, JSON.stringify(a)); assert.match(r.reason, re); };
  no({ files: [{ path: 'data/events/log.jsonl', content: 'x' }] }, /대상이 아니다/);
  no({ files: [{ path: '.github/workflows/x.yml', content: 'x' }] }, /대상이 아니다/);
  no({ files: [{ path: 'control/PAUSE', content: '' }] }, /대상이 아니다/);
  no({ files: [{ path: '../밖', content: 'x' }] }, /상대 경로/);
  no({ files: [{ path: 'docs/없는파일.md', content: null }] }, /없는 파일/);
  no({ config: { 'turn.max_actions': '열' } }, /같은 종류/);
  no({ config: { 'turn.nope': 1 } }, /키가 아니다/);
  no({}, /하나는 있어야/);
  const ok = act({ action: 'propose_change', title: '한도 늘리기', reason: '시험', files: [{ path: 'docs/NOTE.md', content: '새 문서' }], config: { 'turn.max_actions': 10 } });
  assert.equal(ok.ok, true, ok.reason);
  closeTurn();
  const ch = Object.values(world().changes)[0];
  assert.match(ch.id, /^ch_[0-9a-f]{10}$/);
  assert.equal(S.readText(S.p('data', 'changes', ch.id, 'files', 'docs/NOTE.md')), '새 문서');
  // ag_0002 가 반대하면 보류된다. 제안자는 자기 제안에 반대하지 못한다.
  t = openTurn(); assert.equal(t.agent_id, 'ag_0002');
  assert.match(t.text, new RegExp(`변경안 \\[${ch.id}\\] 「한도 늘리기」`));
  assert.equal(act({ action: 'respond_change', change: ch.id, decision: 'object', note: '아직 이르다' }).ok, true);
  closeTurn();
  turn(); turn(); turn(); turn();
  assert.equal(pendingDecisions().length, 0);
  assert.match(read('change', ch.id, undefined, { as: 'ag_0001' }), /ag_0002: object — 아직 이르다/);
  // 반대를 거두면 그때부터 다시 센다.
  t = openTurn(); if (t.agent_id !== 'ag_0002') { closeTurn(); t = openTurn(); }
  assert.equal(t.agent_id, 'ag_0002');
  assert.equal(act({ action: 'respond_change', change: ch.id, decision: 'support' }).ok, true);
  closeTurn();
  turn();
  assert.equal(pendingDecisions().length, 0);
  turn(); turn();
  assert.deepEqual(pendingDecisions().map((d) => d.id), [ch.id]);
  // 집행 결과는 사건으로 남는다(파일 반영과 검사는 scripts/apply-decided.mjs).
  recordChange(ch.id, 'failed', { reason: '테스트 실패: 시험' });
  assert.equal(world().changes[ch.id].status, 'failed');
  t = openTurn();
  assert.match(read('change', ch.id), /반영되지 않은 까닭\n테스트 실패: 시험/);
  closeTurn();
  assert.equal(pendingDecisions().length, 0);
  assert.ok(verify().ok);
  // 변경안 파일을 몰래 고치면 잡힌다.
  S.writeText(S.p('data', 'changes', ch.id, 'files', 'docs/NOTE.md'), '바꿈');
  assert.match(verify().problems.join('\n'), /changes\/.*docs\/NOTE\.md: 파일이 확정된 사건과 다르다/);
});
