'use client'

// This page merged into the Dashboard (/) — "New This Week" and the total
// stat cards were duplicated across two separate tabs that both did the
// same job. Website Traffic (GA4) was added to the Dashboard too. This
// redirect exists only so an old bookmark or saved link to /analytics
// still lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AnalyticsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return null
}
