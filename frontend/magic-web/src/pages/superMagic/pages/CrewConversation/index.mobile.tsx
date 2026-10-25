import { useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import { cn } from "@/utils/cn"
import { useCrewConversationStore } from "./context"
import CrewConversationPanel from "./components/CrewConversationPanel"
import CrewStateView from "./components/CrewStateView"
import CrewTopicList from "./components/CrewTopicList"

interface CrewConversationMobileProps {
	widgetContext?: {
		instanceId: string
		hostOrigin: string
		renderMode?: "inline" | "floating"
	} | null
}

/** Renders the mobile Crew layout and forwards optional widget bridge metadata. */
function CrewConversationMobile({ widgetContext = null }: CrewConversationMobileProps) {
	const { t } = useTranslation("crew/market")
	const store = useCrewConversationStore()
	const [isTopicDrawerOpen, setIsTopicDrawerOpen] = useState(false)

	useNamedPageTitle({
		entityName: store.agent?.name,
		fallbackName: t("crewConversation.unknownCrew"),
		isReady: store.status === "ready" && !!store.selectedProject,
	})

	if (store.status !== "ready" || !store.selectedProject) {
		return <CrewStateView status={store.status} onRetry={() => void store.retryBootstrap()} />
	}

	return (
		<div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
			<CrewConversationPanel
				widgetContext={widgetContext}
				variant="mobile"
				detailPanelVisible={false}
				onOpenTopics={() => setIsTopicDrawerOpen(true)}
			/>
			{isTopicDrawerOpen ? (
				<div
					className="fixed inset-0 z-50"
					role="dialog"
					aria-modal="true"
					data-testid="dialog-div"
				>
					<button
						type="button"
						className="absolute inset-0 bg-black/30"
						aria-label={t("crewConversation.closeTopics")}
						onClick={() => setIsTopicDrawerOpen(false)}
						data-testid="set-is-topic-drawer-open"
					/>
					<div
						className={cn(
							"absolute inset-x-0 bottom-0 flex max-h-[78vh] min-h-[360px] flex-col overflow-hidden rounded-t-lg bg-background shadow-2xl",
							"duration-200 animate-in fade-in slide-in-from-bottom-4",
						)}
					>
						<CrewTopicList
							projectId={store.selectedProject.id}
							topics={store.topicList}
							selectedTopicId={store.selectedTopic?.id}
							isCreatingTopic={store.isCreatingTopic}
							showClose
							onClose={() => setIsTopicDrawerOpen(false)}
							onCreateTopic={() => void store.createAndSelectNewTopic()}
							onSelectTopic={(topic) => {
								store.setSelectedTopic(topic)
								setIsTopicDrawerOpen(false)
							}}
						/>
					</div>
				</div>
			) : null}
		</div>
	)
}

export default observer(CrewConversationMobile)
