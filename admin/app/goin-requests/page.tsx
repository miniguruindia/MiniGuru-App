'use client'

// This page merged into /goins as a tab (see admin/app/goins/page.tsx) so
// Goins balances/history and top-up requests live in one place instead of
// two separate nav items. This redirect exists only so an old bookmark or
// saved link to /goin-requests still lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GoinRequestsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/goins?tab=requests')
  }, [router])
  return null
}
