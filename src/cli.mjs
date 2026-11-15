#!/usr/bin/env node
// 실행기의 CLI. 핵심은 brief → read → apply(또는 tick → act → close)이며, 모델은 제안(JSON)만 낸다.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { recoverTransaction } from './runtime/transaction.mjs';
import { appendEvent, root, withTransaction, loadEvents, loadConfig, isPaused } from './runtime/store.mjs';
import { project, living, displayName } from './runtime/world.mjs';
import { openTurn, closeTurn, failTurn, applyVisit, decide } from './runtime/tick.mjs';
import { briefing } from './runtime/briefing.mjs';
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
      const r = openTurn({ manual: args.includes('--manual') || !!as, agent: as }); say(r.text);
      process.exitCode = r.status === 'busy' ? 4 : r.status === 'error' ? 1 : 0;
      break;
    }
    // ── 핵심 인터페이스: brief → (read) → apply. 일반 채팅과 예약 실행이 같은 것을 쓴다.
    case 'brief': {
      // 읽기 전용. 아무것도 열지 않고 사건도 남기지 않는다. 비공개 기록의 목록과 비공개 방법이 들어 있으므로
      // 신뢰하는 쪽이 그 개체로 일할 모델에게만 건넨다. 사이트나 derived/ 에 쓰지 않는다.
      requireRole('COMMONS_EXECUTOR');
      withTransaction(() => {
        const w = validWorld(), events = loadEvents();
        if (!w.agents[args[0]] || !['active', 'dormant'].includes(w.agents[args[0]].status)) throw new Error('brief <살아 있는 개체 ID>');
        say(briefing(w, args[0], { turn_id: '(아직 열리지 않은 방문)', kind: 'walk', selection: 'visit', delivered: w.messages.filter((m) => m.to === args[0] && !m.delivered).map((m) => m.event_id), cfg: loadConfig(), events, adapter: process.env.COMMONS_ADAPTER || null }));
        say(`\n## 명령을 실행할 수 없는 환경이라면\n읽고 싶은 것은 말로 청한다(실행기가 \`read --as ${args[0]} …\` 로 대신 읽어 준다). 행동은 아래 JSON 하나로 돌려준다. 실행기가 \`apply\` 로 검사해 확정하고, 거절된 것은 이유와 함께 돌아온다.\n\n\`\`\`json\n${JSON.stringify({ agent: args[0], based_on_seq: w.seq, read: [], proposals: [{ request_id: '<서로 다른 8자 이상의 영숫자>', proposal: { action: 'write_private', path: '…', content: '…' } }] }, null, 2)}\n\`\`\`\n제안이 하나도 없는 빈 배열도 된다.`);
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
    case 'act': {
      // 열린 방문에 제안 하나를 확정한다. apply 와 같은 길(executeProposal)이며, 결과를 보고 다음 제안을 낼 수 있다.
      requireRole('COMMONS_EXECUTOR');
      const proposal = JSON.parse(fs.readFileSync(!args[0] || args[0] === '-' ? 0 : args[0], 'utf8'));
      if (Array.isArray(proposal)) throw new Error('제안은 하나씩 낸다');
      const r = executeProposal({ request_id: crypto.randomUUID(), proposal });
      say(r.ok ? `수락: ${(r.events || []).map((e) => `${e.type} #${e.world_seq}`).join(', ')}` : `거절: ${r.reason}`);
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
        say(cmd === 'close' ? closeTurn().text : failTurn(args.slice(1).join(' ')).text);
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
      if (!w.turn) say(`다음 tick: ${d.kind === 'birth' ? `새 개체 (${d.origin})` : d.kind === 'walk' ? `${d.agent.id} (${d.selection === 'requested' ? `본인 요청: ${d.request_reason}` : '기본 순번'})` : d.reason}`);
    }); break;
    case 'verify': {
      const v = verify(); say(v.ok ? `이상 없음: 사건 ${v.events}, 개체 ${v.agents}` : '무결성 문제:\n- ' + v.problems.join('\n- '));
      process.exitCode = v.ok ? 0 : 1; break;
    }
    case 'project': say(regenerate()); break;
    case 'site': say(buildSite()); break;
    case 'wake': requireRole('COMMONS_OPERATOR'); say(openTurn({ agent: args[0], operator_wake: true }).text); break;
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
    default: say('Commands: brief <id> | read [--as <id>] … | apply <visit.json|-> | tick [--manual] [--as <id>] | act <proposal.json|-> | close <turn-id> | fail <turn-id> <reason> | recover | status | verify | project | site'); process.exitCode = cmd ? 1 : 0;
  }
}
try { run(); } catch (e) { console.error(e.message); process.exitCode = 1; }
