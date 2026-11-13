// 안전한 최소 Markdown → HTML. 원문의 HTML은 전부 글자로 내보낸다(스크립트·원격 자원 불가).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(raw, linkFor) {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[\[([^\]]+)\]\]/g, (m, key) => { const href = linkFor?.(key.trim()); return href ? `<a href="${esc(href)}">${key.trim()}</a>` : m; });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}

export function render(markdown, linkFor) {
  const out = [];
  let para = [], list = null, quote = [], code = null;
  const flush = () => {
    if (para.length) { out.push(`<p>${para.map((l) => inline(l, linkFor)).join('<br>')}</p>`); para = []; }
    if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i, linkFor)}</li>`).join('')}</${list.tag}>`); list = null; }
    if (quote.length) { out.push(`<blockquote>${quote.map((l) => inline(l, linkFor)).join('<br>')}</blockquote>`); quote = []; }
  };
  for (const line of String(markdown || '').split('\n')) {
    if (code !== null) { if (line.startsWith('```')) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; } else code.push(line); continue; }
    if (line.startsWith('```')) { flush(); code = []; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); const h = Math.min(m[1].length + 1, 5); out.push(`<h${h}>${inline(m[2], linkFor)}</h${h}>`); }
    else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (list?.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list?.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); }
    else if ((m = line.match(/^>\s?(.*)$/))) { if (!quote.length) flush(); quote.push(m[1]); }
    else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { flush(); out.push('<hr>'); }
    else if (!line.trim()) flush();
    else { if (list || quote.length) flush(); para.push(line); }
  }
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flush();
  return out.join('\n');
}
