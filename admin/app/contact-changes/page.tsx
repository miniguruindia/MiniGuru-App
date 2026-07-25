'use client'

// Merged into /people as the "Contact Changes" tab (see
// admin/app/people/page.tsx). This redirect exists only so an old bookmark
// or saved link to /contact-changes still lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ContactChangesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/people?tab=contact')
  }, [router])
  return null
}
