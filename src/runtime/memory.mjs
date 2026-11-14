// 자기 기록의 발견 순서만 제공한다. 내용의 중요도나 관심사를 평가하지 않는다.
export function ownNotes(w, id) {
  return Object.values(w.notes).filter((n) => n.agent === id)
    .sort((a, b) => b.seq - a.seq || a.path.localeCompare(b.path));
}

export const noteLabel = (n) => `- ${n.path}${n.title ? ` — ${n.title}` : ''} (r${n.revision}, #${n.seq})`;
