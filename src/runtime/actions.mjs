// 행동 제안 → 권한·동의·예산 검사 → 사건 확정 → 파일 반영.
// 개체(모델)가 쓴 문장은 그 자체로 상태를 바꾸지 못한다. 여기서 수락된 것만 현실이 된다.
// 주의: 이 파일에는 control/ 을 건드리는 행동이 없다. 정지·예산·인구 상한은 개체가 지울 수 없다.
import { verify } from './verify.mjs';
import { governanceHandlers } from './governance.mjs';
import { appendEvent, withTransaction, canonical, loadEvents, loadConfig, isPaused, agentDir, writeText, sha256 } from './store.mjs';
import { project, living, SELF_FILES } from './world.mjs';
import { currentSession } from './showcase.mjs';

const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const FONTS = ['serif', 'sans', 'mono'];
const PROVENANCE = ['cited', 'inferred', 'speculative', 'relayed', 'mixed'];
const DEFAULT_VISIBILITY = { identity: 'public', exploration: 'private', writing: 'private', lifecycle: 'private' };

class Reject extends Error {}
const reject = (reason) => { throw new Reject(reason); };

function text(value, label, cfg, { optional = false, max } = {}) {
  if (value === undefined || value === null) { if (optional) return null; reject(`${label}: 필요한 항목이다`); }
  if (typeof value !== 'string') reject(`${label}: 문자열이어야 한다`);
  const limit = max || cfg.turn.max_chars;
  if (value.length > limit) reject(`${label}: ${limit}자를 넘는다(회차 한도)`);
  return value;
}
const visibilityOf = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  if (v !== 'public' && v !== 'private') reject('visibility는 public 또는 private');
  return v;
};
function notePath(value) {
  if (typeof value !== 'string') reject('path: 문자열이어야 한다');
  const parts = value.replace(/\.md$/, '').split('/');
  if (parts.length > 3 || !parts.every((s) => SLUG.test(s))) reject('path: 글자·숫자·-·_ 로 된 이름(폴더는 두 단계까지)만 쓸 수 있다');
  return parts.join('/');
}

const HANDLERS = {
  ...governanceHandlers({ reject, text }),
  write_private(ctx, a) {
    const path = notePath(a.path);
    const content = text(a.content, 'content', ctx.cfg);
    const title = text(a.title, 'title', ctx.cfg, { optional: true, max: 200 });
    const revision = (ctx.w.notes[`${ctx.me.id}/${path}`]?.revision || 0) + 1;
    writeText(agentDir(ctx.me.id, 'private', path + '.md'), content);
    writeText(agentDir(ctx.me.id, 'history', 'notes', `${path}.r${revision}.md`), content);
    return [{ type: 'note_written', visibility: 'private', payload: { path, title, revision, content, hash: sha256(content) } }];
  },

  publish(ctx, a) {
    if (!SLUG.test(a.slug || '')) reject('slug: 글자·숫자·-·_ 로 된 64자 이하 이름');
    if ((ctx.w.turn.counts.work_published || 0) >= ctx.cfg.turn.max_publish) reject(`이번 회차의 공개 한도(${ctx.cfg.turn.max_publish}편)에 닿았다. 기술적 한도이며 다음 회차에 이어 갈 수 있다`);
    const title = text(a.title, 'title', ctx.cfg, { max: 200 });
    const content = text(a.content, 'content', ctx.cfg);
    if (a.provenance != null && !PROVENANCE.includes(a.provenance)) reject(`provenance는 ${PROVENANCE.join(' | ')} 중 하나이거나 비워 둔다`);
    const known = (key) => ctx.w.works[key]?.status === 'published' || ctx.w.agents[key] || ctx.w.trails[key];
    const links = new Set();
    for (const l of a.links || []) { if (!known(l)) reject(`links: ${l} 은(는) 공개된 글·개체·흔적이 아니다`); links.add(l); }
    for (const m of content.matchAll(/\[\[([^\]\n]+)\]\]/g)) if (known(m[1].trim())) links.add(m[1].trim());
    const sources = (a.sources || []).map((s) => (typeof s === 'string' ? { title: s } : { title: String(s.title || ''), url: s.url ? String(s.url) : undefined }));
    const prev = ctx.w.works[`${ctx.me.id}/${a.slug}`];
    const revision = (prev?.revision || 0) + 1;
    writeText(agentDir(ctx.me.id, 'public', a.slug + '.md'), content);
    writeText(agentDir(ctx.me.id, 'history', 'works', `${a.slug}.r${revision}.md`), content);
    return [{ type: 'work_published', visibility: 'public', payload: { slug: a.slug, title, revision, content, hash: sha256(content), provenance: a.provenance || null, links: [...links], sources } }];
  },

  withdraw(ctx, a) {
    const work = ctx.w.works[`${ctx.me.id}/${a.slug}`];
    if (!work || work.status !== 'published') reject('거둘 수 있는 자기 공개 글이 아니다');
    return [{ type: 'work_withdrawn', visibility: 'public', payload: { slug: a.slug, reason: text(a.reason, 'reason', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  revise_self(ctx, a) {
    const { me, cfg } = ctx;
    if (a.target === 'name') {
      const name = a.name === null || a.name === '' ? null : text(a.name, 'name', cfg, { max: 40 });
      if (name && /[\n\r<>]/.test(name)) reject('name: 줄바꿈과 꺾쇠는 쓸 수 없다');
      return [{ type: 'agent_renamed', visibility: 'public', payload: { name, from: me.name } }];
    }
    if (a.target === 'theme') {
      const t = a.theme;
      if (t !== null) {
        if (typeof t !== 'object') reject('theme: 객체 또는 null');
        for (const k of Object.keys(t)) if (!['accent', 'background', 'text', 'font'].includes(k)) reject(`theme: ${k} 은(는) 쓸 수 없는 항목이다`);
        for (const k of ['accent', 'background', 'text']) if (t[k] != null && !COLOR.test(t[k])) reject(`theme.${k}: #rrggbb 형식`);
        if (t.font != null && !FONTS.includes(t.font)) reject(`theme.font: ${FONTS.join(' | ')}`);
      }
      return [{ type: 'profile_updated', visibility: 'public', payload: { target: 'theme', theme: t } }];
    }
    if (!SELF_FILES.includes(a.target)) reject(`target은 name | theme | ${SELF_FILES.join(' | ')}`);
    const content = text(a.content, 'content', cfg); // 빈 문자열은 '비움'이며 정상이다
    const prev = me.files[a.target];
    const to = (prev?.revision || 0) + 1;
    const visibility = visibilityOf(a.visibility, prev?.visibility || DEFAULT_VISIBILITY[a.target]);
    const payload = { content, target: a.target, from_revision: prev?.revision || 0, to_revision: to, hash: sha256(content), visibility, reason: text(a.reason, 'reason', cfg, { optional: true, max: 2000 }) };
    if (a.lineage) {
      const { kind, from } = a.lineage;
      if (!['cite', 'fork', 'mix', 'reject'].includes(kind)) reject('lineage.kind는 cite | fork | mix | reject');
      for (const ref of from || []) {
        const [aid, target] = String(ref).split('/');
        if (ctx.w.agents[aid]?.files[target]?.visibility !== 'public') reject(`lineage: ${ref} 은(는) 공개된 방법이 아니다`);
      }
      payload.lineage = { kind, from: from || [] };
    }
    writeText(agentDir(me.id, a.target + '.md'), content);
    writeText(agentDir(me.id, 'history', `${a.target}.r${to}.md`), content);
    const type = a.target === 'identity' ? 'profile_updated' : a.target === 'lifecycle' ? 'lifecycle_rule_revised' : 'method_revised';
    return [{ type, visibility: visibility === 'public' ? 'public' : 'private', payload }];
  },

  contact(ctx, a) {
    const to = ctx.w.agents[a.to];
    if (!to || to.id === ctx.me.id) reject('to: 다른 개체의 ID여야 한다');
    if (to.status === 'ended') reject('to: 종료된 개체는 전언을 받지 않는다');
    messageBudget(ctx);
    if (a.about != null && !ctx.w.works[a.about] && !ctx.w.trails[a.about]) reject('about: 공개 글이나 흔적의 키여야 한다');
    return [{ type: 'message_sent', visibility: a.public ? 'public' : 'direct', payload: { to: to.id, content: text(a.content, 'content', ctx.cfg), about: a.about || null, public: !!a.public } }];
  },

  respond(ctx, a) {
    const m = ctx.w.messages.find((x) => x.event_id === a.to_event);
    if (!m || !(m.public || m.to === ctx.me.id || m.from === ctx.me.id)) reject('to_event: 네가 볼 수 있는 전언이 아니다');
    const to = m.from === ctx.me.id ? m.to : m.from;
    messageBudget(ctx);
    return [{ type: 'response_recorded', visibility: a.public ? 'public' : 'direct', caused_by: [m.event_id], payload: { to, to_event: m.event_id, content: text(a.content, 'content', ctx.cfg), about: m.about, public: !!a.public } }];
  },

  propose_relation(ctx, a) {
    const to = ctx.w.agents[a.to];
    if (!to || to.id === ctx.me.id || to.status === 'ended') reject('to: 살아 있는 다른 개체여야 한다');
    return [{ type: 'relation_proposed', visibility: 'direct', payload: { to: to.id, kind: text(a.kind, 'kind', ctx.cfg, { max: 80 }), note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  acknowledge_relation(ctx, a) {
    const r = ctx.w.relations[a.proposal];
    if (!r || r.to !== ctx.me.id || r.status !== 'proposed') reject('proposal: 네게 온, 아직 답하지 않은 관계 제안이 아니다');
    if (!['accept', 'decline'].includes(a.decision)) reject('decision은 accept | decline');
    // 수락된 관계만 공개 그래프에 실린다. 거절은 두 당사자만 안다.
    return [{ type: 'relation_acknowledged', visibility: a.decision === 'accept' ? 'public' : 'direct', caused_by: [r.id], payload: { proposal: r.id, to: r.from, decision: a.decision, public_kind: text(a.public_kind, 'public_kind', ctx.cfg, { optional: true, max: 80 }), note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  dissolve_relation(ctx, a) {
    const r = ctx.w.relations[a.proposal];
    if (!r || ![r.from, r.to].includes(ctx.me.id) || r.status !== 'acknowledged') reject('proposal: 네가 당사자인 성립된 관계가 아니다');
    return [{ type: 'relation_dissolved', visibility: 'public', caused_by: [r.id], payload: { proposal: r.id, to: r.from === ctx.me.id ? r.to : r.from, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  leave_trail(ctx, a) {
    return [{ type: 'trail_opened', visibility: 'public', payload: { title: text(a.title, 'title', ctx.cfg, { max: 200 }), content: text(a.content, 'content', ctx.cfg, { max: 4000 }), links: (a.links || []).filter((l) => ctx.w.works[l] || ctx.w.trails[l]) } }];
  },
  continue_trail(ctx, a) {
    const t = ctx.w.trails[a.trail];
    if (!t || t.status !== 'open') reject('trail: 열려 있는 흔적이 아니다');
    return [{ type: 'trail_continued', visibility: 'public', caused_by: [t.id], payload: { trail: t.id, content: text(a.content, 'content', ctx.cfg, { max: 4000 }) } }];
  },
  close_trail(ctx, a) {
    const t = ctx.w.trails[a.trail];
    if (!t || t.by !== ctx.me.id || t.status !== 'open') reject('trail: 네가 연, 열려 있는 흔적만 닫을 수 있다');
    return [{ type: 'trail_closed', visibility: 'public', caused_by: [t.id], payload: { trail: t.id, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },

  propose_birth(ctx, a) {
    const { w, me, cfg } = ctx;
    if (Object.values(w.births).some((b) => b.by === me.id && ['proposed', 'accepted'].includes(b.status))) reject('아직 열려 있는 네 탄생 제안이 있다');
    const contributors = [...new Set([me.id, ...(a.contributors || [])])];
    for (const id of contributors) if (!living(w).some((x) => x.id === id)) reject(`contributors: ${id} 은(는) 살아 있는 개체가 아니다`);
    const seed = text(a.seed_note, 'seed_note', cfg, { optional: true });
    return [{ type: 'birth_proposed', visibility: 'public', payload: {
      reason: text(a.reason, 'reason', cfg, { max: 4000 }), contributors,
      seed_note: null, // 새 개체에게 건네는 기록. 읽을 의무도 따를 의무도 없다
      requires_approval: !!cfg.birth.requires_operator_approval,
      cost: { turns: '새 개체는 이후 회차 기회를 나눠 갖는다', population_cap: cfg.max_population },
    } }, ...(seed === null ? [] : [{ type: 'birth_seed_recorded', visibility: 'private', payload: { content: seed } }])];
  },
  consent_birth(ctx, a) {
    const b = ctx.w.births[a.proposal];
    if (!b || b.status !== 'proposed' || !b.contributors.includes(ctx.me.id) || b.by === ctx.me.id || b.consents[ctx.me.id]) reject('proposal: 네 동의를 기다리는 탄생 제안이 아니다');
    if (!['consent', 'reject'].includes(a.decision)) reject('decision은 consent | reject');
    return [{ type: a.decision === 'consent' ? 'birth_consented' : 'birth_rejected', visibility: 'public', caused_by: [b.id], payload: { proposal: b.id, note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }) } }];
  },
  withdraw_birth(ctx, a) {
    const b = ctx.w.births[a.proposal];
    if (!b || b.by !== ctx.me.id || !['proposed', 'accepted'].includes(b.status)) reject('proposal: 네가 낸, 아직 실행되지 않은 탄생 제안이 아니다');
    return [{ type: 'birth_withdrawn', visibility: 'public', caused_by: [b.id], payload: { proposal: b.id } }];
  },

  present(ctx, a) {
    const session = currentSession(ctx.w);
    if (!ctx.cfg.showcase.enabled || !session) reject('열려 있는 발표회가 없다');
    const work = typeof a.work === 'string' ? ctx.w.works[`${ctx.me.id}/${a.work}`] : null;
    if (!work || work.status !== 'published') reject('work: 네가 공개한 글의 slug여야 한다');
    const intro = text(a.for_humans, 'for_humans', ctx.cfg, { max: ctx.cfg.showcase.max_intro_chars });
    if (!intro.trim()) reject('for_humans: 사람 독자에게 건네는 소개가 비어 있다');
    return [{ type: 'showcase_presented', visibility: 'public', payload: { showcase: session.number, work: work.slug, key: work.key, title: work.title, revision: work.revision, for_humans: intro } }];
  },
  withdraw_presentation(ctx, a) {
    const session = currentSession(ctx.w);
    if (!session?.entries.some((x) => x.agent === ctx.me.id && x.work === a.work)) reject('work: 이번 발표회에 네가 내놓은 글이 아니다');
    return [{ type: 'showcase_withdrawn', visibility: 'public', payload: { showcase: session.number, work: a.work } }];
  },

  request_activity(ctx, a) {
    if (ctx.me.status !== 'active') reject('활동 요청은 활동 중인 개체만 설정할 수 있다. 휴면 중에는 wake 조건을 사용한다');
    if (a.after_turns != null && (!Number.isInteger(a.after_turns) || a.after_turns < 0 || a.after_turns > 10000)) reject('after_turns는 0~10000의 정수');
    if (a.on_message != null && typeof a.on_message !== 'boolean') reject('on_message는 불리언');
    if (a.on_reference != null && typeof a.on_reference !== 'boolean') reject('on_reference는 불리언');
    const after_turns = a.after_turns ?? null;
    const on_message = a.on_message === true, on_reference = a.on_reference === true;
    if (after_turns === null && !on_message && !on_reference) reject('after_turns, on_message, on_reference 가운데 적어도 하나를 설정한다');
    return [{ type: 'activity_requested', visibility: 'private', payload: {
      after_turns, on_message, on_reference,
      note: text(a.note, 'note', ctx.cfg, { optional: true, max: 1000 }),
    } }];
  },
  cancel_activity_request(ctx) {
    if (!ctx.me.activity_request) reject('취소할 활동 요청이 없다');
    return [{ type: 'activity_request_cancelled', visibility: 'private',
      caused_by: [ctx.me.activity_request.event_id], payload: {} }];
  },

  request_dormancy(ctx, a) {
    if (ctx.me.status !== 'active') reject('이미 휴면 중이다');
    const wake = {};
    if (a.wake?.after_turns != null) { if (!Number.isInteger(a.wake.after_turns) || a.wake.after_turns < 1) reject('wake.after_turns: 1 이상의 정수'); wake.after_turns = a.wake.after_turns; }
    if (a.wake?.on_message != null) wake.on_message = !!a.wake.on_message;
    if (!Object.keys(wake).length) wake.on_message = true;
    return [{ type: 'agent_dormant', visibility: 'public', payload: { note: text(a.note, 'note', ctx.cfg, { optional: true, max: 2000 }), wake } }];
  },
  resume(ctx) {
    if (ctx.me.status !== 'dormant') reject('휴면 중이 아니다');
    return [{ type: 'agent_resumed', visibility: 'public', payload: {} }];
  },
  request_self_end(ctx, a) {
    if (ctx.me.pending_end) reject('이미 자기 종료를 요청했다');
    if (a.confirm !== true) reject('자기 종료는 되돌릴 수 없다. 정말 원하면 "confirm": true 를 함께 보낸다. 회차를 닫기 전까지는 cancel_self_end로 거둘 수 있다');
    return [{ type: 'self_end_requested', visibility: 'public', payload: { statement: text(a.statement, 'statement', ctx.cfg, { optional: true, max: 4000 }) } }];
  },
  cancel_self_end(ctx) {
    if (!ctx.me.pending_end) reject('거둘 자기 종료 요청이 없다');
    return [{ type: 'self_end_cancelled', visibility: 'public', caused_by: [ctx.me.pending_end], payload: {} }];
  },
};

function messageBudget(ctx) {
  const c = ctx.w.turn.counts;
  if ((c.message_sent || 0) + (c.response_recorded || 0) >= ctx.cfg.turn.max_messages) reject(`이번 회차의 전언 한도(${ctx.cfg.turn.max_messages}통)에 닿았다. 기술적 한도다`);
}

export const ACTIONS = Object.keys(HANDLERS);

/** 열려 있는 회차의 개체 이름으로만 실행된다. 제안이 다른 행위자를 지정할 길은 없다. */
export function applyAction(proposal) {
  return withTransaction(() => applyUnlocked(proposal));
}
function applyUnlocked(proposal) {
  const v = verify();
  if (!v.ok) throw new Error(v.problems.join('\n'));
  if (isPaused()) return { ok: false, paused: true, reason: '운영자가 정지했다(control/PAUSE). 새 행위를 수락하지 않는다' };
  const cfg = loadConfig();
  const w = project(loadEvents());
  if (!w.turn) return { ok: false, reason: '열려 있는 회차가 없다. 먼저 tick 을 실행한다' };
  const me = w.agents[w.turn.agent_id];
  const base = { agent_id: me.id, actor_id: me.id, turn_id: w.turn.turn_id };
  const name = proposal && typeof proposal === 'object' ? proposal.action : undefined;
  try {
    if (!['active', 'dormant'].includes(me.status)) reject('실행이 허용되지 않은 개체');
    if (!Object.hasOwn(HANDLERS, name)) reject(`알 수 없는 행동: ${name}. 가능한 행동: ${ACTIONS.join(', ')}`);
    const used = Object.values(w.turn.counts).reduce((s, n) => s + n, 0);
    if (used >= cfg.turn.max_actions) reject(`이번 회차의 행동 한도(${cfg.turn.max_actions})에 닿았다. 기술적 한도이며 다음 회차에 이어 갈 수 있다`);
    if (canonical(proposal).length > cfg.turn.max_chars * 3) reject('제안 전체 크기 한도');
    const drafts = HANDLERS[name]({ w, me, cfg }, proposal);
    const events = [];
    for (const d of drafts) {
      if (d.type === 'birth_seed_recorded') d.payload.proposal = events[0].event_id;
      events.push(appendEvent({ ...base, ...d }));
    }
    return { ok: true, events };
  } catch (err) {
    if (!(err instanceof Reject)) throw err;
    const event = appendEvent({ ...base, type: 'action_rejected', visibility: 'private', payload: { action: String(name), reason: err.message } });
    return { ok: false, reason: err.message, events: [event] };
  }
}

/** Trusted executor entry. The model supplies data, never execution credentials. */
export function executeProposal(envelope) {
  return withTransaction(() => {
    if (!envelope || typeof envelope.request_id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(envelope.request_id)) throw new Error('request_id required');
    const events = loadEvents();
    const receipt = events.find((e) => e.type === 'proposal_executed' && e.payload.request_id === envelope.request_id);
    const hash = sha256(canonical(envelope));
    if (receipt) {
      if (receipt.payload.hash !== hash) throw new Error('request_id reused with different proposal');
      return { ok: receipt.payload.ok, duplicate: true, events: [] };
    }
    const w = project(events);
    if (!w.turn || w.turn.turn_id !== envelope.turn_id || w.seq !== envelope.expected_seq) throw new Error('Stale proposal: turn/sequence conflict');
    const result = applyAction(envelope.proposal);
    if (result.paused) return result;
    appendEvent({ type: 'proposal_executed', visibility: 'private', agent_id: w.turn.agent_id, turn_id: w.turn.turn_id, payload: { request_id: envelope.request_id, hash, ok: result.ok } });
    return result;
  });
}
