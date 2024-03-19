import { useRef, type PropsWithChildren } from "react"
import type { FlowStoreState } from "@/opensource/stores/flow"
import { flowStoreContext } from "./context"

function FlowProvider({ children }: PropsWithChildren) {
	const storeRef = useRef<FlowStoreState | null>(null)

	return (
		<flowStoreContext.Provider value={storeRef.current}>{children}</flowStoreContext.Provider>
	)
}

export default FlowProvider
