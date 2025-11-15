import { useState } from 'react'
import { NotFoundError, ForbiddenError, ServiceError } from '@/utils/api/error'

export function useErrorHandler() {
  const [error, setError] = useState<string | null>(null)

  const handleError = (error: unknown) => {
    if (error instanceof NotFoundError) {
      setError(`Not Found: ${error.message}`)
    } else if (error instanceof ForbiddenError) {
      setError(`Access Forbidden: ${error.message}`)
    } else if (error instanceof ServiceError) {
      setError(`Service Error: ${error.message}`)
    } else {
      setError('An unexpected error occurred')
    }
  }

  return { error, setError, handleError }
}

