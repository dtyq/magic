import { useContext, useMemo } from "react"
import { FileAccessContext } from "../context"

/** Read resolved permissions and presentation options without exposing internal scope metadata. */
export function useFileAccess() {
	const { permissions, options } = useContext(FileAccessContext)
	return useMemo(() => ({ permissions, options }), [permissions, options])
}
