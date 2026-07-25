'use client'

// Merged into /people as the "Directory" tab (see admin/app/people/page.tsx),
// alongside Schools & T-LABs and Contact Change Requests — all three are
// fundamentally "things about a person" and now live in one place. This
// redirect exists only so an old bookmark or saved link to /users still
// lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UsersRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/people?tab=directory')
  }, [router])
  return null
}
