// Planning-sheet / project ID (Nov 2026): MG-<SCHOOL>-<INITIALS>-<NNNN>, e.g. MG-SSK-PK-0042.
// Hyphens (not slashes) so the ID is safe in links, searches and file names.
const SKIP = new Set(['the', 'of', 'and', 'school', 'public', 'high', 'higher', 'secondary', 'senior', 'sr', 'sec', 'convent', 'academy', 'vidyalaya', 'vidhyalaya', 'vidya', 'mandir', 'international']);

const letters = (s: string) => (s || '').normalize('NFKD').replace(/[^A-Za-z ]/g, ' ').trim();

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
