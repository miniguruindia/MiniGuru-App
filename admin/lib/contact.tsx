// Contact helpers for the admin screens.
// user.email is the MiniGuru ID (login). The real inbox is guardianEmail, or
// the account email itself when it is a genuine address (not @miniguru.in).
// A child's phoneNumber is a "child_..." placeholder; the real phone is parentPhone.
import React from 'react'

type ContactUser = {
  email: string
  guardianEmail?: string | null
  phoneNumber?: string | null
  parentPhone?: string | null
  emailVerified?: boolean
  phoneVerified?: boolean
}

export function contactEmail(u: ContactUser): string {
  if (u.guardianEmail) return u.guardianEmail
  return u.email && !u.email.toLowerCase().endsWith('@miniguru.in') ? u.email : ''
}

export function contactPhone(u: ContactUser): string {
  const p = u.phoneNumber || ''
  if (p && !p.startsWith('child_')) return p
  return u.parentPhone || ''
}

export function VerifiedBadge({ value, verified }: { value: string; verified?: boolean }) {
  if (!value) return <span className="text-gray-400">not given</span>
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="break-all">{value}</span>
      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
        verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {verified ? '✓ Verified' : 'Not verified'}
      </span>
    </span>
  )
}
