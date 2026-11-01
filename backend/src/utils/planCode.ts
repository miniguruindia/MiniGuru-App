// Planning-sheet / project ID (Nov 2026): MG-<SCHOOL>-<INITIALS>-<NNNN>, e.g. MG-SSK-PK-0042.
// Hyphens (not slashes) so the ID is safe in links, searches and file names.
const SKIP = new Set(['the', 'of', 'and', 'school', 'public', 'high', 'higher', 'secondary', 'senior', 'sr', 'sec', 'convent', 'academy', 'vidyalaya', 'vidhyalaya', 'vidya', 'mandir', 'international']);

// Hindi (Devanagari) names -> English letters, so "प्रमोद कुमार" gives PK, not XX.
const DEV_V: Record<string, string> = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'r', 'ए': 'e', 'ऐ': 'a', 'ओ': 'o', 'औ': 'a' };
const DEV_C: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'क्ष': 'ksh', 'ज्ञ': 'gy',
};
const DEV_M: Record<string, string> = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'r', 'े': 'e', 'ै': 'a', 'ो': 'o', 'ौ': 'a' };
function translit(s: string): string {
  let out = '';
  const ch = Array.from(s);
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (DEV_V[c]) { out += DEV_V[c]; continue; }
    if (DEV_C[c]) {
      out += DEV_C[c];
      const n = ch[i + 1];
      if (n === '\u094D') { i++; continue; }            // halant: no vowel
      if (n && DEV_M[n]) { out += DEV_M[n]; i++; continue; }
      out += 'a';                                         // inherent vowel (initials only need the first letter)
      continue;
    }
    if (c === 'ं' || c === 'ँ' || c === 'ः' || c === '़' || c === 'ऽ') continue;
    out += c;
  }
  return out;
}
const letters = (s: string) => translit((s || '').normalize('NFC')).normalize('NFKD').replace(/[^A-Za-z ]/g, ' ').trim();

export function schoolCode(schoolName?: string | null): string {
  const words = letters(schoolName || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'HOME';
  const main = words.filter((w) => !SKIP.has(w.toLowerCase()));
  const use = main.length > 0 ? main : words;
  const code = use.length === 1 ? use[0].slice(0, 3) : use.slice(0, 3).map((w) => w[0]).join('');
  return code.toUpperCase() || 'HOME';
}

export function initialsOf(name?: string | null): string {
  const words = letters(name || '').split(/\s+/).filter(Boolean);
  const ini = words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return ini || 'XX';
}

export function buildPlanCode(school: string | null | undefined, name: string | null | undefined, num: number): string {
  return `MG-${schoolCode(school)}-${initialsOf(name)}-${String(num).padStart(4, '0')}`;
}
