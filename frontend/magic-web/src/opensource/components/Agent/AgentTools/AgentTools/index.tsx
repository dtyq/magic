import { lazy, Suspense } from "react"
import type { AgentTools } from "./AgentTools"

const BaseAgentTools = lazy(() => import("./AgentTools"))

export default function AgentTools(props: AgentTools) {
	return (
		<Suspense>
			<BaseAgentTools {...props} />
		</Suspense>
	)
}
