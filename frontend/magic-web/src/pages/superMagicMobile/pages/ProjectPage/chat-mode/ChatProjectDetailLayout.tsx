import { observer } from "mobx-react-lite"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { HostConversationProvider } from "@/pages/superMagic/contexts/HostConversationContext"
import { ChatProjectMessagePanel } from "./ChatProjectMessagePanel"
import { useConversationFeedbackSheet } from "@/pages/superMagicMobile/hooks/useConversationFeedbackSheet"
import { MobileSettingsFeedbackSheet } from "@/layouts/BaseLayoutMobile/components/MobileSettings/components/FeedbackSheet"
import { useChatConversationActions } from "./useChatConversationActions"
import { TopicFilesPopup } from "@/pages/superMagicMobile/pages/TopicPage/components/TopicFilesPopup"
import projectFilesStore from "@/stores/projectFiles"
import ConversationActionsPopup from "@/pages/superMagicMobile/components/ConversationActionsPopup"
import { useAttachments } from "@/pages/superMagicMobile/components/HierarchicalWorkspacePopup/hooks/useAttachments"
import { useMemoizedFn } from "ahooks"
import { useEffect } from "react"

function ChatProjectDetailLayoutComponent() {
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList
	const { updateAttachments } = useAttachments()
	const {
		feedbackSheetOpen,
		feedbackPrefill,
		openConversationFeedback,
		closeConversationFeedback,
	} = useConversationFeedbackSheet({
		selectedProject,
		selectedTopic,
	})
	const {
		actionSheetVisible,
		filesDrawerOpen,
		setFilesDrawerOpen,
		openConversationActionSheet,
		closeConversationActionSheet,
		conversationActionGroups,
		conversationActionPopupTitle,
		conversationActionPopupSubtitle,
		projectActionComponents,
		topicActionComponents,
	} = useChatConversationActions({
		selectedProject,
		selectedTopic,
		onOpenConversationFeedback: openConversationFeedback,
	})

	/** Loads the active chat project's attachments before message file previews are used. */
	const initializeProjectAttachments = useMemoizedFn(() => {
		if (!selectedProject) return

		updateAttachments(selectedProject)
	})

	/** Refreshes attachment state on the first detail mount and when the active project changes. */
	useEffect(() => {
		initializeProjectAttachments()
	}, [initializeProjectAttachments, selectedProject?.id])

	const refreshProjectAttachments = useMemoizedFn(async () => {
		if (!selectedProject) return

		// Keep an explicit refresh when the file drawer opens so it displays current server data.
		await updateAttachments(selectedProject)
	})

	return (
		<HostConversationProvider selectedProject={selectedProject} topicStore={topicStore}>
			<div
				className="flex h-full min-h-0 w-full flex-col bg-mobile-background"
				data-testid="chat-project-detail-layout"
			>
				<ChatProjectMessagePanel onOpenActions={openConversationActionSheet} />
			</div>
			<ConversationActionsPopup
				visible={actionSheetVisible}
				title={conversationActionPopupTitle}
				subtitle={conversationActionPopupSubtitle}
				actionGroups={conversationActionGroups}
				onClose={closeConversationActionSheet}
			/>
			{projectActionComponents}
			{topicActionComponents}
			<MobileSettingsFeedbackSheet
				open={feedbackSheetOpen}
				onClose={closeConversationFeedback}
				prefill={feedbackPrefill}
			/>
			<TopicFilesPopup
				open={filesDrawerOpen}
				onOpenChange={setFilesDrawerOpen}
				attachments={attachments}
				attachmentList={attachmentList}
				selectedProject={selectedProject}
				selectedTopic={selectedTopic}
				selectedWorkspace={selectedWorkspace}
				projects={projectStore.projects}
				workspaces={workspaceStore.workspaces}
				projectId={selectedProject?.id}
				refreshAttachments={refreshProjectAttachments}
			/>
		</HostConversationProvider>
	)
}

export const ChatProjectDetailLayout = observer(ChatProjectDetailLayoutComponent)
