import { useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { ChevronDown, MessageCircle, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { SuperMagicApi } from "@/apis"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import type { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import ProjectPageInputContainer from "@/pages/superMagic/components/ProjectPageInputContainer"
import { MicroAppConversationEmptyIllustration } from "@/pages/superMagic/components/MicroAppStateIllustration"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useRefreshTopicDetailOnTaskComplete } from "@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete"
import { useScopedTopicReadProgress } from "@/pages/superMagic/hooks/useScopedTopicReadProgress"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import useTopicMode from "@/pages/superMagic/hooks/useTopicMode"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { applyOptimisticTopicRunningState } from "@/pages/superMagic/services/topicStatusSyncService"
import { useCreateTopicListener } from "@/pages/superMagic/components/TopicMode"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { userStore } from "@/models/user"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { MessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import MicroAppTopicPicker from "./MicroAppTopicPicker"
import MicroAppRuntimeMentionHint from "../MicroAppRuntimeMentionHint"
import {
	resolveMicroAppModelSelectionMode,
	resolveMicroAppRuntimeModelSelectionMode,
} from "../../utils/microAppModelMode"
import { TopicMode } from "../../../Workspace/TopicMode"
import { usePinnedCurrentMicroAppMention } from "../../hooks/usePinnedCurrentMicroAppMention"
import { insertCurrentMicroAppMention } from "../../utils/insertCurrentMicroAppMention"

interface MicroAppMobileConversationProps {
	open: boolean
	selectedProject: ProjectListItem | null
	topicStore: TopicStore
	mentionPanelStore: MentionPanelStore
	projectFilesStore: ProjectFilesStore
	attachments: AttachmentItem[]
	onSelectDetail: (detail: unknown) => void
	onOpenFile: (file?: unknown) => void
	onOpenChange: (open: boolean) => void
	onTerminalTopicStatusChange?: () => void
	lockToMicroAppMode?: boolean
	microAppId?: string
	microAppName?: string
}

function MobileConversationEmpty() {
	const { t } = useTranslation("super")
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
			<MicroAppConversationEmptyIllustration
				size="sm"
				className="w-[136px]"
				testId="micro-app-mobile-conversation-empty-illustration"
			/>
			<div className="space-y-1">
				<p className="text-base font-medium text-foreground">
					{t("microAppPage.conversation.emptyTitle")}
				</p>
				<p className="text-sm text-muted-foreground">
					{t("microAppPage.conversation.emptyDescription")}
				</p>
			</div>
		</div>
	)
}

/**
 * 微应用移动端独立对话弹层：沿用共享 MessageList 的默认消息节点样式，
 * 仅使用移动端弹层和 MobileComposer 组织交互。
 * Tool/file preview stacks above this sheet; keep it open.
 */
const MicroAppMobileConversation = observer(function MicroAppMobileConversation({
	open,
	selectedProject,
	topicStore,
	mentionPanelStore,
	projectFilesStore,
	attachments,
	onSelectDetail,
	onOpenFile,
	onOpenChange,
	onTerminalTopicStatusChange,
	lockToMicroAppMode = true,
	microAppId,
	microAppName,
}: MicroAppMobileConversationProps) {
	const { t } = useTranslation("super")
	const editorRef = useRef<MessageEditorRef | null>(null)
	const handleMentionHintClick = useMemoizedFn(() => {
		insertCurrentMicroAppMention(editorRef.current?.editor, {
			appId: microAppId,
			appName: microAppName,
		})
	})
	// Runtime chats pin this app at the @ panel root so users can mention it.
	usePinnedCurrentMicroAppMention({
		mentionPanelStore,
		enabled: !lockToMicroAppMode,
		appId: microAppId,
		appName: microAppName,
	})
	const [topicPickerOpen, setTopicPickerOpen] = useState(false)
	const selectedTopic = topicStore.selectedTopic
	const selectableTopicMode = useTopicMode({ selectedTopic, selectedProject })
	const topicMode = lockToMicroAppMode ? TopicMode.MicroApp : selectableTopicMode.topicMode
	const agentCode = lockToMicroAppMode
		? undefined
		: resolveAgentSelection(topicMode, selectedTopic?.agent_code).agentCode
	const modelTopicMode = lockToMicroAppMode
		? resolveMicroAppModelSelectionMode()
		: resolveMicroAppRuntimeModelSelectionMode(topicMode, agentCode)
	const keepMicroAppMode = useMemoizedFn((mode: TopicMode) => void mode)

	useCreateTopicListener({
		selectedProject,
		topicStore,
	})

	useRefreshTopicDetailOnTaskComplete({
		selectedTopic,
		onTopicDetailLoaded: topicStore.updateTopic,
	})

	const { handlePullMoreMessage, isMessagesInitialLoading, isSelectedTopicMessagesReady } =
		useTopicMessages({ selectedTopic })
	const { handleTopicMessagesChange } = useScopedTopicReadProgress({
		scopeName: "MicroAppMobileConversation",
		topicStore,
		selectedTopic,
		isSelectedTopicMessagesReady,
		onTerminalTopicStatusChange,
	})
	const { messages, showLoading } = useTopicConversationLoading({
		selectedTopic,
		hideLoadingWhenBufferHasContent: true,
		onTopicMessagesChange: handleTopicMessagesChange,
	})

	useInterruptAndUndoMessage({
		selectedTopic,
		messages,
		userInfo: userStore.user.userInfo,
	})

	const messageListContext = useMemo<MessageListContextState>(
		() => ({
			allowRevoke: true,
			allowUserMessageCopy: false,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: false,
			allowConversationCopy: false,
			allowCreateNewTopic: false,
			onTopicSwitch: topicStore.setSelectedTopic,
			projectFilesStore,
			showTaskCompletedBadge: false,
		}),
		[projectFilesStore, topicStore.setSelectedTopic],
	)

	const handleSelectTopic = useMemoizedFn(async (topic: Topic) => {
		setTopicPickerOpen(false)
		topicStore.setSelectedTopic(topic)

		try {
			const topicDetail = await SuperMagicApi.getTopicDetail(
				{ id: topic.id },
				{ enableErrorMessagePrompt: false },
			)
			if (topicDetail) topicStore.updateTopic(topicDetail)
		} catch (error) {
			console.error("Failed to load micro app topic detail:", error)
		}
	})

	const isEmpty =
		isSelectedTopicMessagesReady && !isMessagesInitialLoading && messages.length === 0
	const topicName = selectedTopic?.topic_name || t("topic.unnamedTopic")

	return (
		<>
			<MagicPopup
				visible={open}
				position="bottom"
				onClose={() => onOpenChange(false)}
				hideDefaultHandle
				title={t("microAppPage.mobileConversation.title")}
				bodyClassName="h-[88dvh] max-h-[88dvh] overflow-hidden rounded-t-[20px] border-0 bg-mobile-background p-0"
			>
				<div className="flex h-full min-h-0 flex-col">
					<header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
						<button
							type="button"
							className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left active:bg-muted"
							onClick={() => setTopicPickerOpen(true)}
							data-testid="micro-app-mobile-topic-switch"
						>
							<div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<MessageCircle className="size-4" aria-hidden />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-foreground">
									{topicName}
								</p>
								<p className="text-xs text-muted-foreground">
									{t("microAppPage.mobileConversation.switchTopic")}
								</p>
							</div>
							<ChevronDown
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden
							/>
						</button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-9 shrink-0"
							onClick={() => onOpenChange(false)}
							aria-label={t("common.close")}
						>
							<X className="size-[18px]" aria-hidden />
						</Button>
					</header>

					<div className="min-h-0 flex-1 overflow-hidden">
						<MessageListProvider value={messageListContext}>
							<MessageList
								data={messages}
								selectedTopic={selectedTopic}
								setSelectedDetail={onSelectDetail}
								handlePullMoreMessage={handlePullMoreMessage}
								showLoading={showLoading}
								onFileClick={onOpenFile}
								isEmptyStatus={isEmpty}
								isMessagesLoading={isMessagesInitialLoading}
								fallbackRender={
									lockToMicroAppMode ? <MobileConversationEmpty /> : undefined
								}
								className="bg-mobile-background [--message-list-sticky-fade-height:0px] [--message-list-surface:rgb(var(--mobile-background-rgb))]"
								classNames={{ content: "px-4 pt-[10px]" }}
								scrollEdgeFade
							/>
						</MessageListProvider>
					</div>

					<div className="shrink-0 border-t border-border bg-mobile-background pb-[var(--safe-area-inset-bottom)] pt-2">
						<ProjectPageInputContainer
							messages={messages}
							showLoading={showLoading}
							selectedProject={selectedProject}
							selectedTopic={selectedTopic}
							setSelectedTopic={topicStore.setSelectedTopic}
							modelTopicMode={modelTopicMode}
							topicModeLogic={
								lockToMicroAppMode
									? {
											topicMode: TopicMode.MicroApp,
											setTopicMode: keepMicroAppMode,
											recoverTopicMode: keepMicroAppMode,
										}
									: undefined
							}
							attachments={attachments}
							mentionPanelStore={mentionPanelStore}
							onFileClick={onOpenFile}
							isShowLoadingInit={!isSelectedTopicMessagesReady}
							showTopicModeExamplePortal={!lockToMicroAppMode}
							showModeToggle={!lockToMicroAppMode}
							// Runtime previews use the default selector so the employee list stays available;
							// its popup still contains the model rows below the employee list.
							showModelSelector={lockToMicroAppMode}
							editorRef={editorRef}
							onSendComplete={({ success, currentProject, currentTopic }) => {
								if (!success) return
								applyOptimisticTopicRunningState({
									topicStore,
									topic: currentTopic ?? topicStore.selectedTopic,
									project: currentProject ?? selectedProject,
								})
							}}
						/>
						{lockToMicroAppMode ? null : (
							<MicroAppRuntimeMentionHint
								className="px-3 pt-2"
								onClick={handleMentionHintClick}
							/>
						)}
					</div>
				</div>
			</MagicPopup>

			<MicroAppTopicPicker
				projectId={selectedProject?.id || ""}
				open={topicPickerOpen}
				topics={topicStore.topics}
				selectedTopicId={selectedTopic?.id}
				onSelect={handleSelectTopic}
				onClose={() => setTopicPickerOpen(false)}
				showModeIcon={!lockToMicroAppMode}
			/>
		</>
	)
})

export default MicroAppMobileConversation
