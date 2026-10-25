import { Suspense, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { Outlet } from "react-router-dom"
import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { isTopicTaskRunning } from "@/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { PersonaResearchStoreProvider, usePersonaResearchStore } from "./context"
import ResearchStateView from "./components/ResearchStateView"
import { useResearchRealtime } from "./hooks/useResearchRealtime"

/**
 * Parent route of the AI research pages. The store lives here so moving between home,
 * studio and persona library keeps the conversation and parsed files in memory.
 */
const PersonaResearchShell = observer(function PersonaResearchShell() {
	const store = usePersonaResearchStore()
	const isStudyRunning = isTopicTaskRunning(store.selectedTopic) || store.isConversationGenerating
	useResearchRealtime(store, isStudyRunning)

	if (store.status === "error") {
		return (
			<ResearchFrame>
				<ResearchStateView status="error" onRetry={() => void store.bootstrap()} />
			</ResearchFrame>
		)
	}
	if (store.status !== "ready") {
		return (
			<ResearchFrame>
				<ResearchStateView status="loading" />
			</ResearchFrame>
		)
	}
	return (
		<ResearchFrame>
			<Suspense fallback={<ResearchStateView status="loading" />}>
				<Outlet />
			</Suspense>
		</ResearchFrame>
	)
})

/** Desktop pages sit in the same rounded, bordered panel as the other market pages. */
function ResearchFrame({ children }: { children: ReactNode }) {
	const isMobile = useIsMobile()
	if (isMobile) return <>{children}</>
	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs">
			{children}
		</div>
	)
}

export default function PersonaResearchLayout() {
	return (
		<FileAccessProvider>
			<PersonaResearchStoreProvider>
				<PersonaResearchShell />
			</PersonaResearchStoreProvider>
		</FileAccessProvider>
	)
}
