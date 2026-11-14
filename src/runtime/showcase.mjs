// 발표회: 세계 시계가 정해진 간격에 닿으면 열리는, 사람 관찰자를 위한 자리.
// 여는 것은 운영 정책(control/config.json)이고, 간격은 개체가 규칙으로 바꿀 수 있다.
// 내놓을지 말지, 무엇을 내놓을지는 개체가 고른다. 실행기는 요약하거나 순위를 매기지 않는다.
// 이 파일의 함수는 순수하다. 투영된 세계와 설정만 본다.

export function showcaseSettings(w, cfg) {
  const s = cfg.showcase;
  const clamp = (n) => Math.min(s.max_every_clock, Math.max(s.min_every_clock, n));
  return {
    enabled: !!s.enabled,
    every: clamp(w.showcase.every ?? s.every_clock),
    basis: w.showcase.every != null ? w.showcase.rule : 'operator_default',
    min: s.min_every_clock, max: s.max_every_clock, max_intro_chars: s.max_intro_chars,
  };
}

/** 다음 발표회가 열리는 세계 시계 값. 첫 발표회는 간격의 다음 배수에서 열린다. */
export function nextShowcaseClock(w, cfg) {
  const { every } = showcaseSettings(w, cfg);
  const last = w.showcase.last_clock ?? Math.floor(w.clock / every) * every;
  return last + every;
}

export const currentSession = (w) => w.showcase.sessions[w.showcase.number] || null;
