import { useEffect, useMemo, useRef, useState } from "react"
import { JSONContent } from "@tiptap/react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { ArrowLeft, ChevronRight, Loader2, PencilLine } from "lucide-react"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import avatarHighlight from "@/assets/resources/magi-claw/card-avatar-highlight.svg"
import { Button } from "@/components/shadcn-ui/button"
import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
import ConversationPanelScaffold from "@/pages/superMagic/components/ConversationPanelScaffold"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import Detail, { type DetailRef } from "@/pages/superMagic/components/Detail"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { useTopicConversationLoading } from "@/pages/superMagic/hooks/useTopicConversationLoading"
import { useTopicMessages } from "@/pages/superMagic/hooks/useTopicMessages"
import { resolveMessageSendContext } from "@/pages/superMagic/services/messageSendPreparation"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import TopicDesktopPanels from "@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels"
import { useTopicDetailPanelController } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicDetailPanelController"
import { useTopicFiles } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicFiles"
import {
	FileActionVisibilityProvider,
	HIDE_CLAW_FILE_ACTIONS,
} from "@/pages/superMagic/providers/file-action-visibility-provider"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { TopicMode, type TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import { userStore } from "@/models/user"
import useNavigate from "@/routes/hooks/useNavigate"
import { ClawHeroIcon } from "./components/ClawHeroIcon"
import { ClawSkillsPanel } from "./components/ClawSkillsPanel"
import { useClawPlaygroundStore } from "./context"
import { DEFAULT_LAYOUT_CONFIG } from "../../components/MessageEditor/constants/constant"
import { createClawPlaygroundFileRowDecorationResolver } from "./claw-playground-file-tree-decorations"
import { merge } from "lodash-es"
import { Skills } from "@/enhance/lucide-react"
import { useClawPlaygroundCore } from "./hooks/useClawPlaygroundCore"
import { useClawPlaygroundMessageListContextValue } from "./hooks/useClawPlaygroundMessageListContextValue"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

interface ClawConversationPanelProps {
	isConversationPanelCollapsed?: boolean
	onToggleConversationPanel?: () => void
	onExpandConversationPanel?: () => void
	detailPanelVisible?: boolean
	clawCode?: string
}

function ClawConversationPanel({
	isConversationPanelCollapsed = false,
	detailPanelVisible = true,
	clawCode,
	..._rest
}: ClawConversationPanelProps) {
	void _rest
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const store = useClawPlaygroundStore()
	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	const topicStore = store.topicStore
	const scopedMessageSendService = useMemo(
		() =>
			createMessageSendService({
				mentionPanelStore: store.mentionPanelStore,
			}),
		[store.mentionPanelStore],
	)

	const { messages, showLoading } = useTopicConversationLoading<TaskStatus>({
		selectedTopic,
		onConversationGeneratingChange: store.setConversationGenerating,
		onTopicMessagesChange: ({ lastMessageNode, selectedTopic: currentTopic }) => {
			if (currentTopic?.id && lastMessageNode?.status) {
				store.updateTopicStatus(currentTopic.id, lastMessageNode?.status)
			}
		},
	})

	const { handlePullMoreMessage, isMessagesInitialLoading } = useTopicMessages({
		selectedTopic,
	})

	const handleSendMsg = useMemoizedFn(
		(content: JSONContent | string, options?: SendMessageOptions) => {
			scopedMessageSendService.sendContent({
				content,
				options,
				showLoading: messages.length > 1 && showLoading,
				context: resolveMessageSendContext({
					selectedProject,
					selectedTopic,
					selectedWorkspace: store.selectedWorkspace,
					setSelectedProject: store.projectStore.setSelectedProject,
					setSelectedTopic: topicStore.setSelectedTopic,
					setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
					topicStore,
				}),
			})

			pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom, { time: 1000 })
		},
	)

	useInterruptAndUndoMessage({
		selectedTopic,
		messages,
		userInfo: userStore.user.userInfo,
	})

	const editorContext = useMemo<SceneEditorContext>(() => {
		return {
			draftKey: createMessageEditorDraftKey({
				selectedProject,
				selectedTopic,
			}),
			selectedTopic,
			selectedProject,
			selectedWorkspace: store.selectedWorkspace,
			setSelectedTopic: topicStore.setSelectedTopic,
			setSelectedProject: store.projectStore.setSelectedProject,
			setSelectedWorkspace: store.workspaceStore.setSelectedWorkspace,
			topicMode: TopicMode.Default,
			topicStore,
			layoutConfig: DEFAULT_LAYOUT_CONFIG,
			showLoading,
			mentionPanelStore: store.mentionPanelStore,
			projectFilesStore: store.projectFilesStore,
			enableMessageSendByContent: true,
			mergeSendParams: ({ defaultParams }) => {
				const mergedParams = merge(defaultParams, {
					topicMode: TopicMode.MagiClaw,
					extra: { agent_code: clawCode },
				})
				return mergedParams
			},
		}
	}, [
		clawCode,
		selectedProject,
		selectedTopic,
		showLoading,
		store.mentionPanelStore,
		store.projectFilesStore,
		store.projectStore.setSelectedProject,
		store.selectedWorkspace,
		store.workspaceStore.setSelectedWorkspace,
		topicStore,
	])

	const messageListProviderValue = useClawPlaygroundMessageListContextValue({
		setSelectedTopic: topicStore.setSelectedTopic,
	})
	const emptyStateSubtitle = t("superLobster.workspace.emptyHeroSubtitle", clawBrandValues)

	function renderEmptyStateTitle() {
		return (
			<div className="flex items-center justify-center gap-[2px] leading-none tracking-[-0.02em]">
				<span className="font-semibold text-foreground">
					{t("superLobster.workspace.emptyHeroLead", clawBrandValues)}
				</span>
				<span className="font-black text-red-500">
					{t("superLobster.workspace.emptyHeroAccent", clawBrandValues)}
				</span>
			</div>
		)
	}

	return (
		<ConversationPanelScaffold
			scope="claw-playground-conversation"
			rootTestId="claw-playground-conversation-panel"
			editorTestId="claw-playground-conversation-editor"
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			detailPanelVisible={detailPanelVisible}
			emptyHero={
				<ConversationEmptyState
					className="w-full"
					icon={<ClawHeroIcon testId="claw-playground-conversation-empty-hero-icon" />}
					iconSoundEnabled={false}
					title={renderEmptyStateTitle()}
					subtitle={emptyStateSubtitle}
					variant="hero"
					testId="claw-playground-conversation-empty"
				/>
			}
			emptyCompact={
				<ConversationEmptyState
					icon={
						<ClawHeroIcon
							className="scale-75"
							testId="claw-playground-conversation-empty-compact-icon"
						/>
					}
					iconSoundEnabled={false}
					title={renderEmptyStateTitle()}
					subtitle={emptyStateSubtitle}
					variant="compact"
					testId="claw-playground-conversation-empty-compact"
				/>
			}
			editor={<DefaultMessageEditorContainer editorContext={editorContext} />}
			messageListProviderValue={messageListProviderValue}
			messages={messages as SuperMagicMessageItem[]}
			selectedTopic={selectedTopic}
			handlePullMoreMessage={handlePullMoreMessage}
			showLoading={showLoading}
			currentTopicStatus={selectedTopic?.task_status}
			handleSendMsg={handleSendMsg}
			isMessagesLoading={isMessagesInitialLoading}
			stickyMessageClassName="top-0"
		/>
	)
}

function ClawPlaygroundDesktop() {
	const { t } = useTranslation("sidebar")
	const { t: tSuper } = useTranslation("super")
	const clawBrandValues = getClawBrandTranslationValues()
	const navigate = useNavigate()
	const { code, store, selectedProject, attachments, attachmentList } = useClawPlaygroundCore()
	const detailRef = useRef<DetailRef>(null)
	const [userSelectDetail, setUserSelectDetail] = useState<unknown>()
	const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false)
	const [isSkillsPanelOpen, setIsSkillsPanelOpen] = useState(false)

	const selectedWorkspace = store.selectedWorkspace
	const selectedTopic = store.selectedTopic
	const isReadOnly = isReadOnlyProject(selectedProject?.user_role)

	const { activeFileId, handleFileClick, topicFilesProps, setActiveFileId } = useTopicFiles({
		selectedProject,
		selectedWorkspace,
		selectedTopic,
		projects: store.projectStore.projects,
		workspaces: store.workspaceStore.workspaces,
		attachments,
		setAttachments: store.projectFilesStore.setWorkspaceFileTree,
		setUserSelectDetail,
		detailRef,
		isReadOnly,
	})

	const {
		shouldShowDetailPanel,
		topicFilesPropsWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	} = useTopicDetailPanelController({
		detailRef,
		isReadOnly: false,
		activeFileId,
		setActiveFileId,
		handleFileClick,
		topicFilesProps,
	})

	const shouldShowDetailPanelWithSkills = shouldShowDetailPanel || isSkillsPanelOpen
	const resolveTopicFileRowDecoration = useMemoizedFn(
		createClawPlaygroundFileRowDecorationResolver({
			t: tSuper,
		}),
	)

	useEffect(() => {
		setUserSelectDetail(undefined)
		setIsDetailPanelFullscreen(false)
		clearActiveDetailTabType()
		setActiveFileId(null)
		setIsSkillsPanelOpen(false)
	}, [clearActiveDetailTabType, selectedProject?.id, setActiveFileId])

	function handleBack() {
		navigate({ delta: -1 })
	}

	if (store.loading) {
		return (
			<div
				className="flex h-full w-full items-center justify-center bg-background"
				data-testid="claw-playground-loading"
			>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (store.error || !selectedProject) {
		return (
			<div
				className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background"
				data-testid="claw-playground-error"
			>
				<p className="text-sm text-muted-foreground">
					{t("superLobster.workspace.loadFailed", clawBrandValues)}
				</p>
				<Button
					type="button"
					variant="outline"
					data-testid="claw-playground-error-back-button"
					onClick={handleBack}
				>
					{t("superLobster.workspace.back", clawBrandValues)}
				</Button>
			</div>
		)
	}

	return (
		<FileActionVisibilityProvider value={HIDE_CLAW_FILE_ACTIONS}>
			<TopicDesktopPanels
				containerClassName="flex h-full w-full min-w-0 items-center overflow-hidden pr-2"
				detailPanelClassName="flex h-full flex-col"
				isDetailPanelFullscreen={isDetailPanelFullscreen}
				sidebar={
					<div
						className="flex h-full flex-col gap-1"
						data-testid="claw-playground-sidebar"
					>
						<div className="flex shrink-0 items-center gap-1">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="size-10 rounded-[10px] bg-background shadow-xs"
								data-testid="claw-playground-back-button"
								onClick={handleBack}
							>
								<ArrowLeft className="size-4" />
							</Button>

							<div
								className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-background px-2 py-1.5 shadow-xs"
								data-testid="claw-playground-project-card"
							>
								<div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
									<img
										alt=""
										aria-hidden
										className="pointer-events-none size-full object-cover"
										src={avatarHighlight}
									/>
								</div>
								<p className="truncate text-sm font-medium text-sidebar-foreground">
									{selectedProject.project_name ||
										t(
											"superLobster.workspace.untitledProject",
											clawBrandValues,
										)}
								</p>
								<button
									type="button"
									className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
									data-testid="claw-playground-project-edit-button"
								>
									<PencilLine className="size-4" />
								</button>
							</div>
						</div>

						<div
							className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background pt-1"
							data-testid="claw-playground-files-tree"
						>
							<TopicFilesButton
								{...topicFilesPropsWithPanel}
								className="h-full"
								resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
							/>
						</div>

						<button
							type="button"
							className="flex w-full shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left shadow-xs transition-colors hover:bg-muted/60"
							data-testid="claw-playground-skills-library-entry"
							onClick={() => setIsSkillsPanelOpen(true)}
						>
							<Skills className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
								{t("skillsLibrary.title")}
							</span>
							<ChevronRight
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden
							/>
						</button>
					</div>
				}
				detailPanel={
					isSkillsPanelOpen ? (
						<ClawSkillsPanel onClose={() => setIsSkillsPanelOpen(false)} />
					) : (
						<Detail
							ref={detailRef}
							disPlayDetail={userSelectDetail}
							userSelectDetail={userSelectDetail}
							setUserSelectDetail={setUserSelectDetail}
							attachments={attachments}
							attachmentList={attachmentList}
							topicId={selectedTopic?.id}
							baseShareUrl={`${window.location.origin}/share`}
							currentTopicStatus={selectedTopic?.task_status}
							messages={[]}
							allowEdit={!isReadOnly}
							selectedTopic={selectedTopic}
							selectedProject={selectedProject}
							activeFileId={activeFileId}
							onActiveFileChange={setActiveFileId}
							onActiveTabChange={handleActiveDetailTabChange}
							onFullscreenChange={setIsDetailPanelFullscreen}
							projectId={selectedProject.id}
							showFallbackWhenEmpty
						/>
					)
				}
				isReadOnly={false}
				showProjectResizeHandle
				shouldShowDetailPanel={shouldShowDetailPanelWithSkills}
				renderMessagePanel={({
					isConversationPanelCollapsed,
					onToggleConversationPanel,
					onExpandConversationPanel,
				}) => (
					<ClawConversationPanel
						isConversationPanelCollapsed={isConversationPanelCollapsed}
						onToggleConversationPanel={onToggleConversationPanel}
						onExpandConversationPanel={onExpandConversationPanel}
						detailPanelVisible={shouldShowDetailPanelWithSkills}
						clawCode={code}
					/>
				)}
			/>
		</FileActionVisibilityProvider>
	)
}

export default observer(ClawPlaygroundDesktop)
