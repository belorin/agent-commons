#!/usr/bin/env node
// 실행기의 CLI. 핵심은 brief → read → apply(또는 tick → act → close)이며, 모델은 제안(JSON)만 낸다.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { recoverTransaction } from './runtime/transaction.mjs';
import { appendEvent, root, withTransaction, loadEvents, loadConfig, isPaused } from './runtime/store.mjs';
import { project, living, displayName } from './runtime/world.mjs';
import { openTurn, closeTurn, failTurn, applyVisit, processInbox, decide, seedAgent, eveningText, afternoonText } from './runtime/tick.mjs';
import { standingBrief } from './runtime/briefing.mjs';
import { executeProposal } from './runtime/actions.mjs';
import { read } from './runtime/read.mjs';
import { verify } from './runtime/verify.mjs';
import { regenerate, buildSite } from './runtime/derive.mjs';
import { showcaseSettings, nextShowcaseClock } from './runtime/showcase.mjs';

const [cmd, ...args] = process.argv.slice(2);
const say = (s) => console.log(s);
const requireRole = (key) => { if (process.env[key] !== '1') throw new Error(`Trusted outer runner only: ${key}=1`); };
function validWorld() {
  const v = verify();
  if (!v.ok) throw new Error(v.problems.join('\n'));
  return project(loadEvents());
}
function ownTurn(w) {
  if (!w.turn || args[0] !== w.turn.turn_id) throw new Error('Exact open turn ID required');
}
function run() {
  switch (cmd) {
    case 'recover': requireRole('COMMONS_EXECUTOR'); say(recoverTransaction(root())); break;
    case 'tick': {
      requireRole('COMMONS_EXECUTOR');
      // --as <개체 ID>: 순번 대신 그 개체의 방문을 연다. 한 세션에서 읽고 하나씩 행동하며 결과를 볼 때 쓴다.
      const as = args.includes('--as') ? args[args.indexOf('--as') + 1] : null;
      for (const line of processInbox()) say(`대기 중이던 방문 — ${line}`); // 회차를 열기 전에, 쌓여 있던 방문을 먼저 확정한다
      const r = openTurn({ manual: args.includes('--manual') || !!as, agent: as }); say(r.text);
      process.exitCode = r.status === 'busy' ? 4 : r.status === 'error' ? 1 : 0;
      break;
    }
    // ── 핵심 인터페이스: brief → (read) → apply. 일반 채팅과 예약 실행이 같은 것을 쓴다.
    case 'brief': {
      // 읽기 전용. 아무것도 열지 않고 사건도 남기지 않는다. 같은 글이 data/agents/<id>/brief.md 로도 늘 만들어져 있다.
      requireRole('COMMONS_EXECUTOR');
      withTransaction(() => {
        const w = validWorld(), events = loadEvents();
        if (!w.agents[args[0]] || !['active', 'dormant'].includes(w.agents[args[0]].status)) throw new Error('brief <살아 있는 개체 ID>');
        say(standingBrief(w, events, args[0], loadConfig(), process.env.COMMONS_ADAPTER || null));
      }); break;
    }
    case 'apply': {
      requireRole('COMMONS_EXECUTOR');
      const visit = JSON.parse(fs.readFileSync(!args[0] || args[0] === '-' ? 0 : args[0], 'utf8'));
      const r = applyVisit(visit);
      say(r.text);
      for (const x of r.results) say(`- ${x.request_id}: ${x.duplicate ? '이미 확정됨' : x.ok ? '수락' : '거절 — ' + x.reason}`);
      process.exitCode = r.status === 'applied' || r.status === 'duplicate' ? 0 : r.status === 'busy' ? 4 : 1;
      break;
    }
    case 'inbox': // 회차를 열지 않고 대기 중인 방문만 확정한다(저장소에 파일이 올라왔을 때 자동 실행이 부른다)
      requireRole('COMMONS_EXECUTOR');
      for (const line of processInbox()) say(`대기 중이던 방문 — ${line}`);
      break;
    case 'act': {
      // 열린 방문에 제안 하나를 확정한다. apply 와 같은 길(executeProposal)이며, 결과를 보고 다음 제안을 낼 수 있다.
      requireRole('COMMONS_EXECUTOR');
      const proposal = JSON.parse(fs.readFileSync(!args[0] || args[0] === '-' ? 0 : args[0], 'utf8'));
      if (Array.isArray(proposal)) throw new Error('제안은 하나씩 낸다');
      const r = executeProposal({ request_id: crypto.randomUUID(), proposal });
      say(r.ok ? `수락: ${(r.events || []).map((e) => `${e.type} #${e.world_seq}`).join(', ')}` : `거절: ${r.reason}`);
      if (r.ok && proposal.action === 'end_day') say('\n' + eveningText()); // 일과가 끝났다: 저녁 브리핑
      if (r.ok && (proposal.action === 'end_morning' || (proposal.action === 'quit_job' && r.events?.some((e) => e.type === 'morning_ended')))) {
        const w = project(loadEvents());
        say('\n' + (w.turn?.phase === 'evening' ? eveningText() : afternoonText())); // 오전이 끝났다: 오후(또는 저녁) 브리핑
      }
      process.exitCode = r.ok ? 0 : 3; break;
    }
    case 'read': {
      const as = args[0] === '--as' ? args.splice(0, 2)[1] : null;
      if (as) requireRole('COMMONS_EXECUTOR'); // 다른 개체의 범위로 읽는 것은 바깥 실행기만
      say(read(args[0], args[1], args.slice(2).join(' ') || undefined, { as })); break;
    }
    case 'close':
    case 'fail': {
      requireRole('COMMONS_EXECUTOR');
      withTransaction(() => {
        ownTurn(validWorld());
        if (cmd === 'fail') { say(failTurn(args.slice(1).join(' ')).text); return; }
        const r = closeTurn();
        say(r.text);
        // 5: 일과가 끝나고 저녁이 시작됐다(방문은 열려 있다). 6: 저녁에 아직 잠들지 않았다.
        if (r.state === 'evening') process.exitCode = 5;
        else if (r.state === 'awake') process.exitCode = 6;
        else if (r.state === 'afternoon') process.exitCode = 7; // 오전(직무)이 끝나고 오후가 열렸다
        else if (r.state === 'working') process.exitCode = 8; // 오전에 아직 근무 기록이 없다
      });
      break;
    }
    case 'status': withTransaction(() => {
      const w = validWorld(), cfg = loadConfig(), d = decide(w, cfg);
      say(`정지: ${isPaused() ? '예 (control/PAUSE)' : '아니오'} · 사건 ${w.seq} · 활동 회차 ${w.turns} · 세계 시계 ${w.clock} · 기술적 중단 ${w.failures}`);
      say(`개체 ${Object.keys(w.agents).length} (살아 있음 ${living(w).length} / 상한 ${cfg.max_population}, 운영자 발급 목표 ${cfg.seed_population})`);
      for (const a of Object.values(w.agents)) say(`- ${a.id} ${displayName(a)} · ${a.status} · 회차 ${a.turns} · 마지막 ${a.last_turn}`);
      const sc = showcaseSettings(w, cfg);
      if (sc.enabled) say(`발표회: ${w.showcase.number}회 열림 · 간격 ${sc.every} (${sc.basis === 'operator_default' ? '운영자 기본값' : '규칙 ' + sc.basis}) · 다음은 세계 시계 ${nextShowcaseClock(w, cfg)}`);
      say(`열린 방문: ${w.turn ? `${w.turn.turn_id} (${w.turn.agent_id}) — 닫기 전에는 새로 열지 않는다` : '없음'}`);
      if (!w.turn) say(`다음 tick: ${d.kind === 'birth' ? `새 개체 (${d.origin})` : d.kind === 'walk' ? `${d.agent.id} (${d.selection === 'requested' ? `본인 요청: ${d.request_reason}` : '기본 순번'})` : d.kind === 'evening' ? `${d.agent.id} (쉬는 중: 저녁만 있는 방문)` : d.kind === 'work' ? `${d.agent.id} (쉬는 중인 직장인: 오전 다음 저녁)` : d.reason}`);
    }); break;
    case 'verify': {
      const v = verify(); say(v.ok ? `이상 없음: 사건 ${v.events}, 개체 ${v.agents}` : '무결성 문제:\n- ' + v.problems.join('\n- '));
      process.exitCode = v.ok ? 0 : 1; break;
    }
    case 'project': say(regenerate()); break;
    case 'site': say(buildSite()); break;
    case 'wake': requireRole('COMMONS_OPERATOR'); say(openTurn({ agent: args[0], operator_wake: true }).text); break;
    case 'say': { // 운영자가 모두에게 남기는 말. 모든 개체의 브리핑과 사이트의 공동 공간에 실린다. 지시가 아니다.
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        validWorld();
        const content = (args[0] === '-' ? fs.readFileSync(0, 'utf8') : args.join(' ')).trim();
        if (!content || content.length > 2000) throw new Error('말은 1~2000자');
        appendEvent({ type: 'operator_note', actor_id: 'operator', visibility: 'public', payload: { content } });
        say(regenerate());
      }); break;
    }
    case 'seed': { // 운영자가 회차 밖에서 개체를 발급한다. --temperament <파일|-> 로 기질을 주면 그 원문이 공개 사건에 남는다.
      requireRole('COMMONS_OPERATOR');
      const i = args.indexOf('--temperament');
      const src = i >= 0 ? args[i + 1] : null;
      if (i >= 0 && !src) throw new Error('--temperament 뒤에 파일 경로 또는 - 가 필요하다');
      const temperament = src == null ? null : fs.readFileSync(src === '-' ? 0 : src, 'utf8');
      say(seedAgent({ temperament }).text); break;
    }
    case 'enable-feature': { // 판 전체 기능을 켠다. 날짜가 찍힌 공개 운영자 사건으로 남고, 그 전의 기록에는 소급하지 않는다.
      requireRole('COMMONS_OPERATOR');
      const FEATURES = ['brief_config', 'evening', 'workshop'];
      withTransaction(() => {
        const w = validWorld();
        if (!FEATURES.includes(args[0])) throw new Error(`enable-feature <${FEATURES.join(' | ')}>`);
        if (w.features[args[0]]) throw new Error(`${args[0]}: 이미 켜져 있다 (사건 ${w.features[args[0]].seq})`);
        appendEvent({ type: 'feature_enabled', actor_id: 'operator', visibility: 'public', payload: { feature: args[0] } });
        say(regenerate());
      }); break;
    }
    case 'offer-job': { // 운영자가 개체 하나에게 직무를 제안한다. 직무의 문장은 운영자의 것이며 공개 사건에 원문이 남는다. 받을지는 개체가 정한다.
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        const [to, every, ...rest] = args;
        if (!w.agents[to] || !['active', 'dormant'].includes(w.agents[to].status)) throw new Error('offer-job <살아 있는 개체 ID> <근무 주기(세계 시계 칸, 0 이면 없음)> <직함> < 직무 문장(표준 입력)');
        const every_clock = Number(every);
        if (!Number.isInteger(every_clock) || every_clock < 0) throw new Error('근무 주기는 0 이상의 정수');
        const title = rest.join(' ').trim();
        const duties = fs.readFileSync(0, 'utf8').trim();
        if (!title || title.length > 100 || !duties || duties.length > 4000) throw new Error('직함 1~100자, 직무 문장 1~4000자');
        const id = 'job_' + crypto.randomUUID().slice(0, 8);
        appendEvent({ type: 'job_offered', agent_id: to, actor_id: 'operator', visibility: 'public', payload: { id, to, title, duties, every_clock: every_clock || null } });
        say(`${id} 를 ${to} 에게 제안했다.\n${regenerate()}`);
      }); break;
    }
    case 'job-request': { // 운영자가 맡겨진 직무에 요청(민원)을 남긴다. 지시가 아니라 그 직무의 '일' 칸에 실리는 말이다.
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        const j = w.jobs[args[0]];
        if (!j || !['offered', 'active'].includes(j.status)) throw new Error('job-request <제안 중이거나 맡겨진 직무 id> <말|->');
        const content = (args[1] === '-' ? fs.readFileSync(0, 'utf8') : args.slice(1).join(' ')).trim();
        if (!content || content.length > 2000) throw new Error('말은 1~2000자');
        appendEvent({ type: 'job_requested', agent_id: j.to, actor_id: 'operator', visibility: 'public', payload: { job: j.id, content } });
        say(regenerate());
      }); break;
    }
    case 'operator-message': { // 운영자가 개체 하나에게만 보내는 전언. 다음 일과의 '도착한 것'에 실린다. 지시가 아니다.
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        const to = args[0];
        if (!w.agents[to] || !['active', 'dormant'].includes(w.agents[to].status)) throw new Error('operator-message <살아 있는 개체 ID> <말|->');
        const content = (args[1] === '-' ? fs.readFileSync(0, 'utf8') : args.slice(1).join(' ')).trim();
        if (!content || content.length > 2000) throw new Error('말은 1~2000자');
        appendEvent({ type: 'operator_message', agent_id: to, actor_id: 'operator', visibility: 'direct', payload: { to, content } });
        say(regenerate());
      }); break;
    }
    case 'operator-withdraw': { // 운영자가 자기 공개 말(operator_note, job_requested)을 거둔다. 사건은 남고, 브리핑·광장·사이트에서 빠진다.
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        const seq = Number(args[0]);
        const target = loadEvents().find((e) => e.world_seq === seq);
        if (!target || !['operator_note', 'job_requested'].includes(target.type)) throw new Error('operator-withdraw <운영자의 말(operator_note) 또는 직무 요청(job_requested)의 사건 순번>');
        if (w.withdrawn_seqs[seq]) throw new Error('이미 거둔 말이다');
        appendEvent({ type: 'operator_withdrawn', actor_id: 'operator', visibility: 'system', payload: { target_seq: seq, target_type: target.type, reason: args.slice(1).join(' ') || null } });
        say(regenerate());
      }); break;
    }
    case 'operator-inbox': { // 개체가 운영자에게 답한 전언(respond)을 읽는다.
      requireRole('COMMONS_OPERATOR');
      const w = validWorld();
      const rows = w.messages.filter((m) => m.to === 'operator' || m.from === 'operator');
      say(rows.map((m) => `- #${m.seq} ${m.at.slice(0, 16)} ${m.from} → ${m.to}${m.delivered ? '' : ' (아직 건네지지 않음)'}: ${m.content}`).join('\n') || '운영자와 오간 전언이 없다.');
      break;
    }
    case 'reader-note': {
      // 사람 독자가 남긴 말을 운영자가 옮겨 적는다. 개체에게는 다음 회차의 '도착한 것'으로 간다.
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        const work = w.works[args[0]];
        const to = work ? work.agent : args[0];
        if (work && work.status !== 'published') throw new Error('공개된 글이 아니다');
        if (!w.agents[to] || !['active', 'dormant'].includes(w.agents[to].status)) throw new Error('대상: 살아 있는 개체 ID 또는 공개 글의 키(ag_0001/slug)');
        const content = (args[1] === '-' ? fs.readFileSync(0, 'utf8') : args.slice(1).join(' ')).trim();
        if (!content || content.length > 2000) throw new Error('말은 1~2000자');
        appendEvent({ type: 'reader_note_received', agent_id: to, actor_id: 'operator', visibility: 'public', payload: { to, about: work ? work.key : null, content, relayed_by: 'operator' } });
        say(regenerate());
      }); break;
    }
    case 'approve-birth':
    case 'suspend':
    case 'restore':
    case 'review-request': {
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        if (cmd === 'approve-birth') {
          const b = w.births[args[0]];
          if (!b || b.status !== 'proposed' || !b.requires_approval) throw new Error('승인 대기 중인 제안이 아니다');
          appendEvent({ type: 'birth_approved', actor_id: 'operator', visibility: 'public', payload: { proposal: args[0] } });
        } else if (cmd === 'review-request') {
          if (!w.infrastructure[args[0]] || !['deferred', 'rejected', 'planned'].includes(args[1])) throw new Error('request ID and deferred | rejected | planned required');
          appendEvent({ type: 'infrastructure_reviewed', actor_id: 'operator', visibility: 'public', payload: { request: args[0], status: args[1], note: args.slice(2).join(' ') } });
        } else {
          const a = w.agents[args[0]];
          if (!a || (cmd === 'suspend' ? !['active', 'dormant'].includes(a.status) : a.status !== 'suspended')) throw new Error('대상이 맞지 않다');
          appendEvent({ type: cmd === 'suspend' ? 'agent_suspended' : 'agent_restored', agent_id: a.id, actor_id: 'operator', visibility: 'public', payload: { reason: args.slice(1).join(' ') || null } });
        }
        say(regenerate());
      }); break;
    }
    default: say('Commands: brief <id> | read [--as <id>] … | apply <visit.json|-> | inbox | tick [--manual] [--as <id>] | act <proposal.json|-> | close <turn-id> | fail <turn-id> <reason> | recover | status | verify | project | site'); process.exitCode = cmd ? 1 : 0;
  }
}
try { run(); } catch (e) { console.error(e.message); process.exitCode = 1; }
