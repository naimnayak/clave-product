import { useLocation, useSearchParams } from 'react-router-dom'

/** Query lives in the URL (?q=) so the navbar search and the library list stay in sync. */
export function useResumeQuery(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  // Keep the router state (where Back returns to) while typing.
  const { state } = useLocation()
  return [params.get('q') ?? '', (value) => setParams(value ? { q: value } : {}, { replace: true, state })]
}
