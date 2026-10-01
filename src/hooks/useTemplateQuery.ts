import { useLocation, useSearchParams } from 'react-router-dom'

/** The search text lives in the URL (?q=) so the navbar field and the library stay in sync. */
export function useTemplateQuery(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  // Keep the router state (where Back returns to) while typing.
  const { state } = useLocation()
  return [params.get('q') ?? '', (value) => setParams(value ? { q: value } : {}, { replace: true, state })]
}
