import { projectGovernance } from './governance.mjs';
// 투영: 확정된 사건의 순서만으로 현재 세계 상태를 다시 만든다.
// 이 함수는 순수하다. 파일·시계·난수를 보지 않는다. 같은 로그는 언제나 같은 세계를 낸다.

export const SELF_FILES = ['identity', 'exploration', 'writing', 'lifecycle'];

function blankAgent(id, e) {
  return {
    id,
    name: null, // 무명은 정상 상태다
    status: 'active', // active | dormant | ended | suspended
    created_seq: e.world_seq,
    created_at: e.timestamp,
    origin: e.payload.origin,
    proposal: e.payload.proposal || null,
    lineage: e.payload.lineage || [],
    files: {}, // target -> { revision, hash, visibility }
    theme: null,
    turns: 0,
    last_turn: 0, // 세계 회차 번호
    wake: null,
    dormant_since_turn: null,
    pending_end: null,
    read: {}, // 읽은 것의 키 -> world_seq
    names: [],
  };
}

export function project(events) {
  const w = {
    groups: {}, rules: {}, infrastructure: {},
    seq: 0,
    turns: 0,
    turns_by_day: {},
    last_birth_turn: 0,
    agents: {},
    works: {},
    notes: {},
    messages: [],
    relations: {},
    trails: {},
    births: {},
    turn: null, // 열려 있는 회차
    failures: 0,
  };
  const A = (id) => w.agents[id];

  for (const e of events) {
    w.seq = e.world_seq;
    const pl = e.payload || {};
    const a = e.agent_id ? A(e.agent_id) : null;
    projectGovernance(w, e);
    switch (e.type) {
      case 'agent_created':
        w.agents[e.agent_id] = blankAgent(e.agent_id, e);
        if (pl.proposal && w.births[pl.proposal]) {
          w.births[pl.proposal].status = 'born';
          w.births[pl.proposal].child = e.agent_id;
        }
        w.last_birth_turn = w.turns + 1;
        break;
      case 'turn_opened': {
        w.turns += 1;
        const day = e.timestamp.slice(0, 10);
        w.turns_by_day[day] = (w.turns_by_day[day] || 0) + 1;
        w.turn = { turn_id: pl.turn_id, agent_id: e.agent_id, kind: pl.kind, opened_seq: e.world_seq, number: w.turns, counts: {} };
        if (a) { a.turns += 1; a.last_turn = w.turns; if (a.status === 'dormant') a.dormant_since_turn = w.turns; }
        for (const id of pl.delivered || []) {
          const m = w.messages.find((x) => x.event_id === id);
          if (m) m.delivered = true;
        }
        break;
      }
      case 'turn_closed':
        if (a) for (const key of pl.read || []) a.read[key] = e.world_seq;
        if (a) a.pending_end = null;
        w.turn = null;
        break;
      case 'run_failed':
        w.failures += 1;
        if (a) a.pending_end = null;
        if (w.turn && (!pl.turn_id || pl.turn_id === w.turn.turn_id)) w.turn = null;
        break;
      case 'agent_renamed':
        a.name = pl.name ?? null;
        a.names.push({ name: a.name, seq: e.world_seq });
        break;
      case 'profile_updated':
        if (pl.target === 'theme') a.theme = pl.theme || null;
        else a.files[pl.target] = { revision: pl.to_revision, hash: pl.hash, visibility: pl.visibility };
        break;
      case 'method_revised':
        a.files[pl.target] = { revision: pl.to_revision, hash: pl.hash, visibility: pl.visibility, lineage: pl.lineage || null };
        break;
      case 'lifecycle_rule_revised':
        a.files.lifecycle = { revision: pl.to_revision, hash: pl.hash, visibility: pl.visibility };
        break;
      case 'note_written':
        w.notes[`${e.agent_id}/${pl.path}`] = { agent: e.agent_id, path: pl.path, revision: pl.revision || 1, title: pl.title || null, hash: pl.hash, seq: e.world_seq, at: e.timestamp };
        break;
      case 'work_published':
        w.works[`${e.agent_id}/${pl.slug}`] = {
          key: `${e.agent_id}/${pl.slug}`, agent: e.agent_id, slug: pl.slug, title: pl.title, revision: pl.revision, hash: pl.hash,
          status: 'published', provenance: pl.provenance || null, links: pl.links || [], sources: pl.sources || [],
          first_seq: w.works[`${e.agent_id}/${pl.slug}`]?.first_seq || e.world_seq, seq: e.world_seq, at: e.timestamp,
        };
        break;
      case 'work_withdrawn': {
        const work = w.works[`${e.agent_id}/${pl.slug}`];
        if (work) { work.status = 'withdrawn'; work.withdraw_reason = pl.reason || null; }
        break;
      }
      case 'message_sent':
      case 'response_recorded':
        w.messages.push({
          event_id: e.event_id, seq: e.world_seq, at: e.timestamp, from: e.agent_id, to: pl.to, public: !!pl.public,
          content: pl.content, about: pl.about || null, in_reply_to: pl.to_event || null, delivered: false,
        });
        break;
      case 'relation_proposed':
        w.relations[e.event_id] = { id: e.event_id, from: e.agent_id, to: pl.to, kind: pl.kind, note: pl.note || null, status: 'proposed', seq: e.world_seq };
        break;
      case 'relation_acknowledged': {
        const r = w.relations[pl.proposal];
        if (r) { r.status = pl.decision === 'accept' ? 'acknowledged' : 'declined'; r.reply = pl.note || null; r.public_kind = pl.public_kind || null; }
        break;
      }
      case 'relation_dissolved': {
        const r = w.relations[pl.proposal];
        if (r) { r.status = 'dissolved'; r.dissolved_by = e.agent_id; }
        break;
      }
      case 'trail_opened':
        w.trails[e.event_id] = { id: e.event_id, by: e.agent_id, title: pl.title, status: 'open', links: pl.links || [], seq: e.world_seq, at: e.timestamp, entries: [{ by: e.agent_id, content: pl.content, seq: e.world_seq }] };
        break;
      case 'trail_continued': {
        const t = w.trails[pl.trail];
        if (t) t.entries.push({ by: e.agent_id, content: pl.content, seq: e.world_seq });
        break;
      }
      case 'trail_closed': {
        const t = w.trails[pl.trail];
        if (t) { t.status = 'closed'; t.close_note = pl.note || null; }
        break;
      }
      case 'birth_proposed':
        w.births[e.event_id] = {
          id: e.event_id, by: e.agent_id, reason: pl.reason, contributors: pl.contributors || [], seed_note: pl.seed_note || null,
          requires_approval: !!pl.requires_approval, approved: false, consents: {}, status: 'proposed', child: null, seq: e.world_seq,
        };
        settleBirth(w.births[e.event_id]);
        break;
      case 'birth_seed_recorded':
        if (w.births[pl.proposal]) w.births[pl.proposal].seed_note = pl.content;
        break;
      case 'birth_consented': {
        const b = w.births[pl.proposal];
        if (b) { b.consents[e.agent_id] = 'consent'; settleBirth(b); }
        break;
      }
      case 'birth_rejected': {
        const b = w.births[pl.proposal];
        if (b && b.status !== 'born') { b.consents[e.agent_id] = 'reject'; b.status = 'rejected'; }
        break;
      }
      case 'birth_withdrawn': {
        const b = w.births[pl.proposal];
        if (b && b.status !== 'born') b.status = 'withdrawn';
        break;
      }
      case 'birth_approved': {
        const b = w.births[pl.proposal];
        if (b) { b.approved = true; settleBirth(b); }
        break;
      }
      case 'agent_dormant':
        a.status = 'dormant'; a.wake = pl.wake || { on_message: true }; a.dormant_since_turn = w.turns;
        break;
      case 'agent_resumed':
        a.status = 'active'; a.wake = null; a.dormant_since_turn = null;
        break;
      case 'self_end_requested':
        a.pending_end = e.event_id;
        break;
      case 'self_end_cancelled':
        a.pending_end = null;
        break;
      case 'agent_ended':
        a.status = 'ended'; a.pending_end = null; a.ended_seq = e.world_seq; a.ended_at = e.timestamp;
        break;
      case 'agent_suspended': // 운영자 개입. 자기 종료와 다른 사건이다.
        a.suspended_from = a.status; a.status = 'suspended';
        break;
      case 'agent_restored':
        a.status = a.suspended_from || 'active'; delete a.suspended_from;
        break;
      default:
        break; // action_rejected, run_budget_exhausted, world_idle 등은 상태를 바꾸지 않는다
    }
    if (w.turn && e.turn_id === w.turn.turn_id && e.actor_id === w.turn.agent_id && !['action_rejected', 'birth_seed_recorded'].includes(e.type)) {
      w.turn.counts[e.type] = (w.turn.counts[e.type] || 0) + 1;
    }
  }
  return w;
}

function settleBirth(b) {
  if (b.status !== 'proposed') return;
  const others = b.contributors.filter((id) => id !== b.by);
  const allConsented = others.every((id) => b.consents[id] === 'consent');
  if (allConsented && (!b.requires_approval || b.approved)) b.status = 'accepted';
}

export const living = (w) => Object.values(w.agents).filter((a) => a.status === 'active' || a.status === 'dormant');
export const displayName = (a) => a?.name || '(무명)';

/** 한 개체가 볼 수 있는 사건인가. 사적 사건은 당사자만, direct는 양쪽만 본다. */
export function canSee(event, agentId) {
  if (event.visibility === 'public' || event.visibility === 'system') return true;
  if (event.agent_id === agentId || event.actor_id === agentId) return true;
  if (event.visibility === 'direct' && event.payload?.to === agentId) return true;
  return false;
}
