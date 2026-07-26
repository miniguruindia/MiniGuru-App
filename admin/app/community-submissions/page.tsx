'use client'

// Merged into /community as the "Happenings & Challenges" tab (see
// admin/app/community/page.tsx), alongside the Stats & Resources CMS editor
// that used to be buried inside Site Content — everything "community" now
// lives in one place. This redirect exists only so an old bookmark or saved
// link to /community-submissions still lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CommunitySubmissionsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/community')
  }, [router])
  return null
}
