'use client'

// Merged into /people as the "Schools & T-LABs" tab (see
// admin/app/people/page.tsx) — same exact list/create/reset-password logic,
// just organized alongside Directory and Contact Changes instead of its own
// nav item. Individual school detail pages (/schools/[id]) are UNCHANGED —
// only this list page redirects.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SchoolsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/people?tab=schools')
  }, [router])
  return null
}
