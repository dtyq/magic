import { useContext } from "react"
import type { PPTStore } from "../PPTRender/stores"
import { PPTContext } from "../PPTRender/contexts/PPTContext"

/**
 * Optional PPT Store hook
 * Returns PPT store if available, undefined if not in PPT context
 * This hook is safe to use outside PPT context
 */
function usePPTStoreOptional(): PPTStore | undefined {
	const context = useContext(PPTContext)
	return context?.store
}

export default usePPTStoreOptional
