import { useState } from 'react'

export function useTask() {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(label: string, task: () => Promise<void>) {
    setError(null)
    setPending(label)
    try {
      await task()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That didn’t work.')
    } finally {
      setPending(null)
    }
  }

  return { pending, error, run }
}
