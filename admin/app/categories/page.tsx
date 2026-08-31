'use client'

// This page merged into /projects as a tab (see admin/app/projects/page.tsx)
// so Projects and Categories live in one place instead of two separate nav
// items. This redirect exists only so an old bookmark or saved link to
// /categories still lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CategoriesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects?tab=categories')
  }, [router])
  return null
}
