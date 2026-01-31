'use client'

import { useState, useCallback } from 'react'

interface UseAsyncActionState<T> {
  isLoading: boolean
  error: string | null
  data: T | null
}

interface UseAsyncActionReturn<T, Args extends unknown[]> {
  isLoading: boolean
  error: string | null
  data: T | null
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
}

export function useAsyncAction<T, Args extends unknown[] = []>(
  action: (...args: Args) => Promise<T>
): UseAsyncActionReturn<T, Args> {
  const [state, setState] = useState<UseAsyncActionState<T>>({
    isLoading: false,
    error: null,
    data: null,
  })

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState({ isLoading: true, error: null, data: null })

      try {
        const result = await action(...args)
        setState({ isLoading: false, error: null, data: result })
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        setState({ isLoading: false, error: message, data: null })
        return null
      }
    },
    [action]
  )

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, data: null })
  }, [])

  return {
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    execute,
    reset,
  }
}
