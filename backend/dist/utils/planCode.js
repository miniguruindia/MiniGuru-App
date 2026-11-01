"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolCode = schoolCode;
exports.initialsOf = initialsOf;
exports.buildPlanCode = buildPlanCode;
// Planning-sheet / project ID (Nov 2026): MG-<SCHOOL>-<INITIALS>-<NNNN>, e.g. MG-SSK-PK-0042.
// Hyphens (not slashes) so the ID is safe in links, searches and file names.
const SKIP = new Set(['the', 'of', 'and', 'school', 'public', 'high', 'higher', 'secondary', 'senior', 'sr', 'sec', 'convent', 'academy', 'vidyalaya', 'vidhyalaya', 'vidya', 'mandir', 'international']);
const letters = (s) => (s || '').normalize('NFKD').replace(/[^A-Za-z ]/g, ' ').trim();
function schoolCode(schoolName) {
    const words = letters(schoolName || '').split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return 'HOME';
    const main = words.filter((w) => !SKIP.has(w.toLowerCase()));
    const use = main.length > 0 ? main : words;
    const code = use.length === 1 ? use[0].slice(0, 3) : use.slice(0, 3).map((w) => w[0]).join('');
    return code.toUpperCase() || 'HOME';
}
function initialsOf(name) {
    const words = letters(name || '').split(/\s+/).filter(Boolean);
    const ini = words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return ini || 'XX';
}
function buildPlanCode(school, name, num) {
    return `MG-${schoolCode(school)}-${initialsOf(name)}-${String(num).padStart(4, '0')}`;
}
