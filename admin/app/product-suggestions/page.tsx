'use client'

// Merged into /materials as the "Suggestions" tab (see
// admin/app/materials/page.tsx) — suggestions naturally resolve into new
// catalog entries, so having them side-by-side speeds up that workflow.
// This redirect exists only so an old bookmark or saved link to
// /product-suggestions still lands somewhere sensible.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProductSuggestionsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/materials?tab=suggestions')
  }, [router])
  return null
}
