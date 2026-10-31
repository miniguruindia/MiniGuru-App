// backend/src/utils/signupSource.ts
// The channel a sign-up came from (Oct 2026), e.g. "whatsapp" from miniguru.in/?src=whatsapp.
// Only short plain labels are stored. No sign-up path ever fails because of this value.
export function cleanSource(v: any): string {
  const s = String(v ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
  return s || 'direct';
}
