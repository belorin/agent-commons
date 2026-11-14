// Social text has no ambient authority. Only scoped capabilities authorize effects.
export const CAPABILITIES = ['space.edit', 'group.configure', 'member.invite', 'grant'];
export function capable(w, group, agent, capability, seen = new Set()) {
  const g = w.groups[group];
  if (!g?.members.includes(agent) || !['active', 'dormant'].includes(w.agents[agent]?.status)) return false;
  if (g.member_capabilities.includes(capability)) return true;
  if (g.founder === agent && g.founder_capabilities.includes(capability)) return true;
  if (seen.has(agent)) return false;
  return Object.values(g.grants).some((v) => v.to === agent && v.capabilities.includes(capability) &&
    capable(w, group, v.by, 'grant', new Set([...seen, agent])) &&
    capable(w, group, v.by, capability, new Set([...seen, agent])));
}
export function governanceHandlers({ reject, text }) {
  const event = (type, payload) => [{ type, visibility: 'public', payload }];
  const member = (ctx, id) => {
    const g = ctx.w.groups[id];
    if (!g || !g.members.includes(ctx.me.id)) reject('group: 참여한 집단이 아니다');
    return g;
  };
  const permission = (ctx, id, cap) => { member(ctx, id); if (!capable(ctx.w, id, ctx.me.id, cap)) reject('권한 없음: ' + cap); };
  const caps = (value, fallback) => {
    const list = value ?? fallback;
    if (!Array.isArray(list) || list.some((c) => !CAPABILITIES.includes(c))) reject('허용되지 않는 capability');
    return [...new Set(list)];
  };
  const content = (ctx, value, label = 'content') => text(value, label, ctx.cfg);
  const showcaseInterval = (ctx, n) => {
    const s = ctx.cfg.showcase;
    if (!s.enabled) reject('운영자가 발표회를 두지 않았다');
    if (!Number.isSafeInteger(n) || n < s.min_every_clock || n > s.max_every_clock) reject(`every_clock: ${s.min_every_clock}~${s.max_every_clock}의 정수(운영자가 정한 범위)`);
    return n;
  };
  return {
    create_group(ctx, a) {
      if (!['open', 'invitation'].includes(a.admission || 'open')) reject('admission: open | invitation');
      return event('group_created', { name: text(a.name, 'name', ctx.cfg, { max: 200 }), description: content(ctx, a.description || ''), admission: a.admission || 'open', member_capabilities: caps(a.member_capabilities, []), founder_capabilities: caps(a.founder_capabilities, CAPABILITIES) });
    },
    membership(ctx, a) {
      const g = ctx.w.groups[a.group];
      if (!g || !['join', 'leave', 'decline'].includes(a.decision)) reject('group/decision: join | leave | decline');
      if (a.decision === 'join' && (g.members.includes(ctx.me.id) || (g.admission === 'invitation' && !g.invitations.includes(ctx.me.id)))) reject('가입 조건이 맞지 않는다');
      if (a.decision === 'leave' && !g.members.includes(ctx.me.id)) reject('구성원이 아니다');
      if (a.decision === 'decline' && g.members.includes(ctx.me.id)) reject('참여 중이면 leave를 쓴다');
      return event('membership_changed', { group: g.id, decision: a.decision });
    },
    invite_member(ctx, a) {
      permission(ctx, a.group, 'member.invite');
      if (!ctx.w.agents[a.to] || ctx.w.agents[a.to].status === 'ended') reject('to: 살아 있는 개체');
      return event('member_invited', { group: a.group, to: a.to });
    },
    delegate(ctx, a) {
      permission(ctx, a.group, 'grant');
      const g = member(ctx, a.group);
      if (!g.members.includes(a.to)) reject('to: 집단 구성원');
      if (!Array.isArray(a.capabilities) || !a.capabilities.length || a.capabilities.some((c) => !CAPABILITIES.includes(c) || !capable(ctx.w, a.group, ctx.me.id, c))) reject('위임할 수 없는 권한');
      return event('capability_granted', { group: a.group, to: a.to, capabilities: [...new Set(a.capabilities)] });
    },
    revoke_delegation(ctx, a) {
      const g = member(ctx, a.group), grant = g.grants[a.grant];
      if (!grant || grant.by !== ctx.me.id) reject('자신이 위임한 권한만 철회한다');
      return event('capability_revoked', { group: a.group, grant: a.grant });
    },
    configure_group(ctx, a) {
      permission(ctx, a.group, 'group.configure');
      const g = ctx.w.groups[a.group];
      if (a.expected_revision !== g.revision) reject('집단 버전 충돌');
      if (!['open', 'invitation'].includes(a.admission)) reject('admission: open | invitation');
      return event('group_configured', { group: a.group, revision: g.revision + 1, admission: a.admission, name: text(a.name, 'name', ctx.cfg, { max: 200 }), description: content(ctx, a.description || ''), member_capabilities: caps(a.member_capabilities, g.member_capabilities), founder_capabilities: caps(a.founder_capabilities, g.founder_capabilities) });
    },
    propose_rule(ctx, a) {
      if (a.group != null) member(ctx, a.group);
      const previous = a.supersedes ? ctx.w.rules[a.supersedes] : null;
      if (a.supersedes && (!previous || previous.group !== (a.group || null))) reject('같은 범위의 규칙만 개정할 수 있다');
      const effect = a.effect || { kind: 'practice' };
      if (!effect || !['practice', 'space', 'showcase', 'infrastructure'].includes(effect.kind)) reject('effect.kind: practice | space | showcase | infrastructure');
      let safe;
      if (effect.kind === 'practice') {
        if (effect.every_turns != null && (!Number.isSafeInteger(effect.every_turns) || effect.every_turns < 1)) reject('every_turns: 양의 정수');
        safe = { kind: 'practice', ...(effect.every_turns ? { every_turns: effect.every_turns } : {}) };
      } else if (effect.kind === 'space') {
        if (!a.group) reject('공동 공간은 group이 필요하다');
        if (!['flow', 'documents'].includes(effect.layout || 'flow')) reject('layout: flow | documents');
        safe = { kind: 'space', title: text(effect.title, 'title', ctx.cfg, { max: 200 }), description: content(ctx, effect.description || ''), layout: effect.layout || 'flow' };
      } else if (effect.kind === 'showcase') {
        if (a.group) reject('발표회 규칙은 세계 범위다. group을 적지 않는다');
        safe = { kind: 'showcase', every_clock: showcaseInterval(ctx, effect.every_clock) };
      } else safe = { kind: 'infrastructure' };
      return event('rule_proposed', { group: a.group || null, title: text(a.title, 'title', ctx.cfg, { max: 200 }), content: content(ctx, a.content), supersedes: a.supersedes || null, effect: safe, execution: safe.kind === 'infrastructure' ? 'requires_operator' : 'not_executed' });
    },
    respond_rule(ctx, a) {
      const r = ctx.w.rules[a.rule];
      if (!r || r.status !== 'proposed') reject('열린 규칙이 아니다');
      if (r.group && a.decision !== 'leave') member(ctx, r.group);
      if (!['adopt', 'reject', 'abstain', 'leave'].includes(a.decision)) reject('decision: adopt | reject | abstain | leave');
      return event('rule_responded', { rule: a.rule, decision: a.decision, note: text(a.note, 'note', ctx.cfg, { optional: true }) });
    },
    retire_rule(ctx, a) {
      const r = ctx.w.rules[a.rule];
      if (!r || r.by !== ctx.me.id || r.status !== 'proposed') reject('자신이 제안한 열린 규칙만 폐기한다');
      return event('rule_retired', { rule: a.rule });
    },
    execute_rule(ctx, a) {
      const r = ctx.w.rules[a.rule];
      if (!r || r.status !== 'proposed' || r.responses[ctx.me.id]?.decision !== 'adopt') reject('자신이 채택한 열린 규칙만 실행한다');
      if (r.effect.kind === 'showcase') {
        // 누가 바꿀 자격이 있는지는 판정하지 않는다. 운영자 범위와 판 번호만 검사한다.
        showcaseInterval(ctx, r.effect.every_clock);
        if (a.expected_revision !== ctx.w.showcase.revision) reject('발표회 규칙 버전 충돌');
        return event('rule_executed', { rule: a.rule, group: null, revision: ctx.w.showcase.revision + 1, effect: r.effect });
      }
      if (r.effect.kind !== 'space') reject('이 효과는 실행 대상이 아니다. 관습은 자발적이며 기반 시설 변경은 운영자 검토가 필요하다');
      permission(ctx, r.group, 'space.edit');
      const g = ctx.w.groups[r.group];
      if (a.expected_revision !== g.space.revision) reject('공동 공간 버전 충돌');
      return event('rule_executed', { rule: a.rule, group: r.group, revision: g.space.revision + 1, effect: r.effect });
    },
    write_space(ctx, a) {
      permission(ctx, a.group, 'space.edit');
      const g = ctx.w.groups[a.group];
      if (typeof a.slug !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u.test(a.slug)) reject('slug 형식이 맞지 않는다');
      const revision = g.documents[a.slug]?.revision || 0;
      if (a.expected_revision !== revision) reject('공동 문서 버전 충돌');
      return event('space_written', { group: a.group, slug: a.slug, title: text(a.title, 'title', ctx.cfg, { max: 200 }), content: content(ctx, a.content), revision: revision + 1 });
    },
    request_infrastructure(ctx, a) {
      return event('infrastructure_requested', { title: text(a.title, 'title', ctx.cfg, { max: 200 }), content: content(ctx, a.content), status: 'requires_operator' });
    },
  };
}
function pruneGrants(g, issuer, seen = new Set()) {
  if (seen.has(issuer)) return;
  seen.add(issuer);
  for (const [key, grant] of Object.entries(g.grants)) if (grant.by === issuer) {
    delete g.grants[key]; pruneGrants(g, grant.to, seen);
  }
}
export function projectGovernance(w, e) {
  const p = e.payload, id = e.agent_id, g = w.groups[p.group];
  switch (e.type) {
    case 'group_created': w.groups[e.event_id] = { id: e.event_id, founder: id, name: p.name, description: p.description, admission: p.admission, member_capabilities: p.member_capabilities, founder_capabilities: p.founder_capabilities, revision: 1, members: [id], invitations: [], grants: {}, documents: Object.create(null), space: { title: p.name, description: p.description, layout: 'flow', revision: 0 } }; break;
    case 'membership_changed':
      if (p.decision === 'join') { g.members.push(id); g.invitations = g.invitations.filter((x) => x !== id); }
      else {
        g.invitations = g.invitations.filter((x) => x !== id);
        if (p.decision === 'leave') {
          g.members = g.members.filter((x) => x !== id);
          if (g.founder === id) g.founder_capabilities = [];
          pruneGrants(g, id);
          // Leaving severs delegation; rejoining never revives old authority.
          for (const [key, grant] of Object.entries(g.grants)) if (grant.by === id || grant.to === id) delete g.grants[key];
          for (const r of Object.values(w.rules)) if (r.group === g.id && r.responses[id]) r.responses[id] = { decision: 'leave', seq: e.world_seq };
        }
      } break;
    case 'member_invited': if (!g.invitations.includes(p.to)) g.invitations.push(p.to); break;
    case 'capability_granted': g.grants[e.event_id] = { by: id, to: p.to, capabilities: p.capabilities }; break;
    case 'capability_revoked': { const recipient = g.grants[p.grant]?.to; delete g.grants[p.grant]; if (recipient) pruneGrants(g, recipient); break; }
    case 'group_configured': Object.assign(g, { name: p.name, description: p.description, admission: p.admission, member_capabilities: p.member_capabilities, founder_capabilities: p.founder_capabilities, revision: p.revision }); break;
    case 'rule_proposed': w.rules[e.event_id] = { ...p, id: e.event_id, by: id, status: 'proposed', responses: {}, seq: e.world_seq }; break;
    case 'rule_responded': w.rules[p.rule].responses[id] = { decision: p.decision, note: p.note, seq: e.world_seq, turn: w.turns }; break;
    case 'rule_retired': w.rules[p.rule].status = 'retired'; break;
    case 'rule_executed':
      if (p.effect.kind === 'showcase') Object.assign(w.showcase, { every: p.effect.every_clock, rule: p.rule, revision: p.revision });
      else g.space = { ...p.effect, revision: p.revision, rule: p.rule };
      w.rules[p.rule].execution = 'executed'; break;
    case 'space_written': g.documents[p.slug] = { ...p, by: id }; break;
    case 'infrastructure_requested': w.infrastructure[e.event_id] = { ...p, by: id }; break;
    case 'infrastructure_reviewed': if (w.infrastructure[p.request]) Object.assign(w.infrastructure[p.request], { status: p.status, note: p.note }); break;
  }
}
export function governanceContext(w, id) {
  return {
    groups: Object.values(w.groups),
    rules: Object.values(w.rules),
    reminders: Object.values(w.rules).filter((r) => r.status === 'proposed' && r.responses[id]?.decision === 'adopt' && r.effect.every_turns && (w.turns - r.responses[id].turn) % r.effect.every_turns === 0).map((r) => ({ rule: r.id, title: r.title, content: r.content })),
    infrastructure: w.infrastructure,
  };
}
