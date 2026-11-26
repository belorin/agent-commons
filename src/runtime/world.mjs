import { projectGovernance } from './governance.mjs';
// 투영: 확정된 사건의 순서만으로 현재 세계 상태를 다시 만든다.
// 이 함수는 순수하다. 파일·시계·난수를 보지 않는다. 같은 로그는 언제나 같은 세계를 낸다.

export const SELF_FILES = ['identity', 'exploration', 'writing', 'lifecycle'];
/** 하루의 경계를 나타내는 사건. 행동 수로 세지 않는다. */
export const PHASE_EVENTS = ['day_ended', 'slept', 'dream_seeded', 'morning_ended', 'self_reviewed'];
/** 몸의 요구(잠들기 전의 사적 행동)로 세는 사건. 개체가 직접 한 것만 센다: 코드가 낸 제안(via)이나 코드가 바꾼 작업장은 대신해 주지 못한다. */
export const BODY_ACTS = ['note_written', 'profile_updated', 'method_revised', 'lifecycle_rule_revised', 'agent_renamed', 'workshop_changed'];
export const isBodyAct = (e) => BODY_ACTS.includes(e.type) && !e.payload?.via && !(e.type === 'workshop_changed' && e.payload?.by !== 'self') && e.payload?.origin !== 'dream';

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
    // 운영자가 발급할 때 준 기질(있을 때만). 공개 사건에 원문이 남는다. 개체가 내려놓으면 released 가 찬다.
    temperament: e.payload.temperament ? { content: e.payload.temperament.content, hash: e.payload.temperament.hash, released: null } : null,
    files: {}, // target -> { revision, hash, visibility }
    theme: null,
    turns: 0,
    last_turn: 0, // 세계 회차 번호
    activity_request: null, // 조건이 차면 기본 순번보다 먼저 오게 하는 요청
    dormancy_request: null, // 운영자의 통과를 기다리는 휴면 요청 { event_id, seq, clock, note, wake }
    wake: null,
    dormant_since_turn: null,
    dormant_since_clock: null,
    pending_end: null,
    adapters: {}, // 이 개체의 회차를 돌린 실행 환경 -> 횟수
    brief: null, // 개체가 정한 자기 브리핑 구성(가장 최근 설정). 없으면 기본 구성
    read: {}, // 읽은 것의 키 -> world_seq
    names: [],
    last_opened_seq: 0, // 이 개체의 마지막 turn_opened 순번
    dream: null, // 다음 밤 꿈의 낱말: 방문을 닫을 때 받는다 { words, seq, turn_id } (evening 기능)
    last_dream: null, // 마지막 밤의 꿈(개인 기록 경로) { path, seq }
    workshop: {}, // 작업장의 파일: 상대 경로 -> { hash, bytes } (workshop 기능)
    hooks: null, // 삶의 고리에 걸어 둔 코드 { thaw, evening, sleep }
    hook_outputs: {}, // 고리마다 마지막 실행 { tool, ok, output, reason, seq, clock }
    last_review: null, // 마지막 밤의 회고 { revision, seq, clock }
    job: null, // 맡은 직무의 id (운영자가 제안하고 개체가 받은 것)
    last_day_clock: null, // 마지막으로 일과가 있었던 방문의 세계 시계
  };
}

export function project(events) {
  const w = {
    groups: {}, rules: {}, infrastructure: {},
    // 발표회: 간격을 바꾼 규칙(없으면 운영자 기본값), 열린 회와 내놓은 글
    showcase: { revision: 0, every: null, rule: null, number: 0, last_clock: null, sessions: {} },
    seq: 0,
    turns: 0,
    clock: 0, // 예약 실행 기회: 실제 회차 + 아무도 움직이지 않은 유휴 회차
    turns_by_day: {},
    last_birth_turn: 0,
    request_streak: 0, // 연속 요청 우선 회차 수
    agents: {},
    works: {},
    notes: {},
    messages: [],
    relations: {},
    trails: {},
    births: {},
    operator_notes: [], // 운영자가 모두에게 남긴 말
    withdrawn_seqs: {}, // 운영자가 거둔 자기 말(사건 순번 -> true). 사건은 남고 보이는 자리에서만 빠진다
    features: {}, // 운영자가 켠 판 전체 기능 -> { seq, at }
    changes: {}, // 판의 변경안: id -> { id, by, title, reason, files, config, clock, seq, at, status, responses, reset_clock, result }
    edits: {}, // 남의 공개 글 수정안: id -> { id, by, work, base_revision, title, reason, clock, seq, at, status, responses, reset_clock, answer }
    wiki: {}, // 공용 위키: 문서 경로 -> { page, title, revision, hash, by, at, seq, history: [{ revision, by, at, seq, summary }] }
    access: [], // 개체가 보고한 바깥 자료 접근 결과(사실 기록, 금지 목록이 아니다)
    jobs: {}, // 직무: id -> { id, to, title, duties, every_clock, status(offered|active|declined|quit), seq, at, answer, requests: [] }
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
        w.clock += 1;
        const day = e.timestamp.slice(0, 10);
        if (!pl.manual) w.turns_by_day[day] = (w.turns_by_day[day] || 0) + 1; // 수동 회차는 예약 실행의 하루 상한에 세지 않는다
        w.turn = { turn_id: pl.turn_id, agent_id: e.agent_id, kind: pl.kind, selection: pl.selection || 'fair', request_reason: pl.request_reason || null, adapter: pl.adapter || null, opened_seq: e.world_seq, number: w.turns, counts: {},
          // evening 기능이 켜진 뒤의 방문만 구간을 가진다. 하루 방문은 일과에서, 저녁 방문은 저녁에서 시작한다.
          ...(pl.phase ? { phase: pl.phase, evening_counts: {}, body_acts: 0, day_ended_by: null, slept: false, morning_counts: {}, job_logs: 0, morning_ended_by: null } : {}) };
        w.request_streak = pl.selection === 'requested' ? w.request_streak + 1 : 0;
        // 저녁 방문과 근무일(직무)은 쉬는 상태(활동 요청, 휴면과 그 기준 시계)를 건드리지 않는다.
        const rest = pl.kind === 'evening' || pl.kind === 'work';
        if (a && pl.kind !== 'evening') a.last_day_clock = w.clock;
        if (a) { a.turns += 1; a.last_turn = w.turns; a.last_opened_seq = e.world_seq; if (!rest) a.activity_request = null; if (pl.adapter) a.adapters[pl.adapter] = (a.adapters[pl.adapter] || 0) + 1; if (a.status === 'dormant' && !rest) { a.dormant_since_turn = w.turns; a.dormant_since_clock = w.clock; } }
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
      case 'world_idle':
        w.clock += 1;
        break;
      case 'morning_ended':
        // 오전(직무)이 끝났다. 쉬는 중인 직장인의 방문(work)은 오후 없이 저녁으로, 아니면 오후(자기 일과)로.
        if (w.turn?.phase === 'morning' && w.turn.turn_id === pl.turn_id) { w.turn.phase = w.turn.kind === 'work' ? 'evening' : 'day'; w.turn.morning_ended_by = pl.by || null; }
        break;
      case 'job_logged': {
        const j = w.jobs[pl.job];
        if (j) (j.logs ??= []).push({ content: pl.content, seq: e.world_seq, at: e.timestamp, clock: w.clock });
        if (w.turn && e.turn_id === w.turn.turn_id) w.turn.job_logs += 1;
        break;
      }
      case 'day_ended':
        if (w.turn?.phase && w.turn.turn_id === pl.turn_id) { w.turn.phase = 'evening'; w.turn.day_ended_by = pl.by || null; }
        break;
      case 'self_reviewed':
        if (w.turn?.phase && w.turn.turn_id === pl.turn_id) w.turn.reviewed = true;
        if (a) { a.last_review = { revision: pl.revision, seq: e.world_seq, clock: w.clock }; if (pl.long) a.long_reviewed = true; }
        break;
      case 'slept':
        if (w.turn?.phase && w.turn.turn_id === pl.turn_id) w.turn.slept = true;
        if (a && pl.dream) a.last_dream = { path: pl.dream, seq: e.world_seq };
        break;
      case 'workshop_changed':
        if (a) for (const f of pl.files || []) { if (f.deleted) delete a.workshop[f.path]; else a.workshop[f.path] = { hash: f.hash, bytes: f.bytes }; }
        break;
      case 'job_offered':
        w.jobs[pl.id] = { id: pl.id, to: pl.to, title: pl.title, duties: pl.duties, every_clock: pl.every_clock ?? null, status: 'offered', seq: e.world_seq, at: e.timestamp, answer: null, requests: [], logs: [] };
        break;
      case 'job_answered': {
        const j = w.jobs[pl.job];
        if (j && j.status === 'offered') { j.status = pl.decision === 'accept' ? 'active' : 'declined'; j.answer = { decision: pl.decision, note: pl.note || null, seq: e.world_seq, clock: w.clock }; if (a && j.status === 'active') a.job = j.id; }
        break;
      }
      case 'job_quit': {
        const j = w.jobs[pl.job];
        if (j) { j.status = 'quit'; j.quit = { note: pl.note || null, seq: e.world_seq, clock: w.clock }; }
        if (a && a.job === pl.job) a.job = null;
        break;
      }
      case 'job_requested': {
        const j = w.jobs[pl.job];
        if (j) j.requests.push({ content: pl.content, seq: e.world_seq, at: e.timestamp, clock: w.clock });
        break;
      }
      case 'hooks_set':
        if (a) a.hooks = pl.hooks && Object.values(pl.hooks).some(Boolean) ? pl.hooks : null;
        break;
      case 'tool_ran':
        if (a && pl.trigger && pl.trigger !== 'self') a.hook_outputs[pl.trigger] = { tool: pl.tool, ok: pl.ok, output: pl.output || '', reason: pl.reason || null, seq: e.world_seq, clock: w.clock };
        break;
      case 'dream_seeded':
        if (a) a.dream = { words: pl.words || [], seq: e.world_seq, turn_id: pl.turn_id || null };
        break;
      case 'showcase_opened':
        w.showcase.number = pl.number;
        w.showcase.last_clock = pl.clock;
        w.showcase.sessions[pl.number] = { number: pl.number, clock: pl.clock, every_clock: pl.every_clock, basis: pl.basis, seq: e.world_seq, at: e.timestamp, entries: [] };
        break;
      case 'showcase_presented': {
        const s = w.showcase.sessions[pl.showcase];
        if (s) {
          s.entries = s.entries.filter((x) => !(x.agent === e.agent_id && x.work === pl.work));
          s.entries.push({ agent: e.agent_id, work: pl.work, key: pl.key, title: pl.title, revision: pl.revision, for_humans: pl.for_humans, seq: e.world_seq, at: e.timestamp });
        }
        break;
      }
      case 'showcase_withdrawn': {
        const s = w.showcase.sessions[pl.showcase];
        if (s) s.entries = s.entries.filter((x) => !(x.agent === e.agent_id && x.work === pl.work));
        break;
      }
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
        // 어느 구간에서 썼는지는 사건 순서로 도출한다. 구간이 없던 방문과 회차 밖의 기록은 일과의 것이다.
        w.notes[`${e.agent_id}/${pl.path}`] = { agent: e.agent_id, path: pl.path, revision: pl.revision || 1, title: pl.title || null, hash: pl.hash, seq: e.world_seq, at: e.timestamp,
          phase: w.turn && e.turn_id === w.turn.turn_id && w.turn.phase === 'evening' ? 'evening' : 'day', origin: pl.origin || null };
        break;
      case 'operator_note':
        w.operator_notes.push({ content: pl.content, seq: e.world_seq, at: e.timestamp });
        break;
      case 'access_reported':
        w.access.push({ host: pl.host, outcome: pl.outcome, detail: pl.detail || null, tool: pl.tool || null, url: pl.url || null, note: pl.note || null, adapter: pl.adapter || null, by: e.agent_id, seq: e.world_seq, at: e.timestamp });
        break;
      case 'work_published':
        w.works[`${e.agent_id}/${pl.slug}`] = {
          key: `${e.agent_id}/${pl.slug}`, agent: e.agent_id, slug: pl.slug, title: pl.title, revision: pl.revision, hash: pl.hash,
          status: 'published', provenance: pl.provenance || null, links: pl.links || [], sources: pl.sources || [],
          first_seq: w.works[`${e.agent_id}/${pl.slug}`]?.first_seq || e.world_seq, seq: e.world_seq, at: e.timestamp,
          edited_by: pl.edited_by || null, // 이 판이 다른 개체의 수정안에서 왔으면 그 개체
        };
        // 원저자가 답하지 않아 공동 결정으로 반영된 수정안
        if (pl.from_edit && w.edits[pl.from_edit]?.status === 'open') w.edits[pl.from_edit].status = 'applied';
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
      case 'operator_withdrawn': {
        // 운영자가 자기 말(공개 운영자의 말, 직무 요청)을 거둔다. 사건 로그에서 지우지 않는다.
        const t = pl.target_seq;
        w.withdrawn_seqs[t] = true;
        w.operator_notes = w.operator_notes.filter((n) => n.seq !== t);
        for (const j of Object.values(w.jobs)) j.requests = j.requests.filter((r) => r.seq !== t);
        break;
      }
      case 'operator_message': // 운영자가 개체 하나에게만 보내는 전언. 다른 개체·광장·사이트에 실리지 않는다.
        w.messages.push({ event_id: e.event_id, seq: e.world_seq, at: e.timestamp, from: 'operator', to: pl.to, public: false, content: pl.content, about: null, in_reply_to: null, delivered: false });
        break;
      case 'reader_note_received': // 사람 독자의 말. 운영자가 옮겨 적는다. 보낸 쪽은 개체가 아니다.
        w.messages.push({ event_id: e.event_id, seq: e.world_seq, at: e.timestamp, from: 'reader', to: pl.to, public: true, content: pl.content, about: pl.about || null, in_reply_to: null, delivered: false });
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
      case 'activity_requested':
        a.activity_request = { event_id: e.event_id, seq: e.world_seq, from_turn: w.turns, from_clock: w.clock,
          after_turns: pl.after_turns ?? null, on_message: !!pl.on_message, on_reference: !!pl.on_reference,
          note: pl.note || null };
        break;
      case 'activity_request_cancelled':
        a.activity_request = null;
        break;
      case 'dormancy_requested':
        a.dormancy_request = { event_id: e.event_id, seq: e.world_seq, clock: w.clock, note: pl.note || null, wake: pl.wake || { on_message: true } };
        break;
      case 'dormancy_request_cancelled':
      case 'dormancy_declined':
        a.dormancy_request = null;
        break;
      case 'agent_dormant':
        a.dormancy_request = null;
        a.status = 'dormant'; a.activity_request = null; a.wake = pl.wake || { on_message: true }; a.dormant_since_turn = w.turns; a.dormant_since_clock = w.clock;
        break;
      case 'change_proposed':
        w.changes[pl.id] = { id: pl.id, by: e.agent_id, title: pl.title, reason: pl.reason || null, files: pl.files || [], config: pl.config || {}, clock: w.clock, seq: e.world_seq, at: e.timestamp, status: 'open', responses: {}, reset_clock: null, result: null };
        break;
      case 'change_withdrawn': { const item = w.changes[pl.change] || w.edits[pl.change]; if (item) item.status = 'withdrawn'; break; }
      case 'change_applied': if (w.changes[pl.change]) Object.assign(w.changes[pl.change], { status: 'applied', result: { seq: e.world_seq, at: e.timestamp, base_commit: pl.base_commit || null } }); break;
      case 'change_failed': if (w.changes[pl.change]) Object.assign(w.changes[pl.change], { status: 'failed', result: { seq: e.world_seq, at: e.timestamp, reason: pl.reason } }); break;
      case 'change_responded': {
        const item = w.changes[pl.change] || w.edits[pl.change];
        if (item) {
          const before = item.responses[e.agent_id]?.decision;
          item.responses[e.agent_id] = { decision: pl.decision, note: pl.note || null, clock: w.clock, seq: e.world_seq };
          if (before === 'object' && pl.decision !== 'object') item.reset_clock = w.clock; // 반대가 거둬지면 그때부터 다시 센다
        }
        break;
      }
      case 'edit_proposed':
        w.edits[pl.id] = { id: pl.id, by: e.agent_id, work: pl.work, base_revision: pl.base_revision, title: pl.title, reason: pl.reason || null, hash: pl.hash, clock: w.clock, seq: e.world_seq, at: e.timestamp, status: 'open', responses: {}, reset_clock: null, answer: null };
        break;
      case 'edit_answered':
        if (w.edits[pl.edit]) Object.assign(w.edits[pl.edit], { status: pl.decision === 'accept' ? 'accepted' : 'declined', answer: { by: e.agent_id, note: pl.note || null, seq: e.world_seq, at: e.timestamp } });
        break;
      case 'wiki_written': {
        const d = w.wiki[pl.page] || (w.wiki[pl.page] = { page: pl.page, history: [] });
        Object.assign(d, { title: pl.title, revision: pl.revision, hash: pl.hash, by: e.agent_id, at: e.timestamp, seq: e.world_seq });
        d.history.push({ revision: pl.revision, by: e.agent_id, at: e.timestamp, seq: e.world_seq, summary: pl.summary || null });
        break;
      }
      case 'feature_enabled':
        w.features[pl.feature] = { seq: e.world_seq, at: e.timestamp };
        break;
      case 'brief_configured': {
        const empty = !pl.order?.length && !pl.hide?.length && !pl.pin?.length;
        a.brief = empty ? null : { order: pl.order || [], hide: pl.hide || [], pin: pl.pin || [], reason: pl.reason || null, set_at_visit: a.turns, seq: e.world_seq };
        break;
      }
      case 'temperament_released':
        a.temperament.released = { seq: e.world_seq, at: e.timestamp, note: pl.note || null };
        break;
      case 'agent_resumed':
        a.status = 'active'; a.wake = null; a.dormant_since_turn = null; a.dormant_since_clock = null;
        break;
      case 'self_end_requested':
        a.pending_end = e.event_id;
        break;
      case 'self_end_cancelled':
        a.pending_end = null;
        break;
      case 'agent_ended':
        a.status = 'ended'; a.activity_request = null; a.dormancy_request = null; a.pending_end = null; a.ended_seq = e.world_seq; a.ended_at = e.timestamp;
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
    if (w.turn && e.turn_id === w.turn.turn_id && e.actor_id === w.turn.agent_id && !['action_rejected', 'birth_seed_recorded', ...PHASE_EVENTS].includes(e.type)) {
      w.turn.counts[e.type] = (w.turn.counts[e.type] || 0) + 1;
      if (w.turn.phase === 'morning') w.turn.morning_counts[e.type] = (w.turn.morning_counts[e.type] || 0) + 1;
      if (w.turn.phase === 'evening') { w.turn.evening_counts[e.type] = (w.turn.evening_counts[e.type] || 0) + 1; if (isBodyAct(e)) w.turn.body_acts += 1; }
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
