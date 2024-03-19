import { lazy, Suspense } from "react"
import type { AgentCommonProps } from "./AgentSettings"
import AgentSettingsSkeleton from "./AgentSettingsSkeleton"

const BaseAgentSettings = lazy(() => import("./AgentSettings"))

export default function AgentSettings(props: AgentCommonProps) {
	return (
		<Suspense fallback={<AgentSettingsSkeleton />}>
			<BaseAgentSettings {...props} />
		</Suspense>
	)
}

export { AgentSettingsSkeleton }
