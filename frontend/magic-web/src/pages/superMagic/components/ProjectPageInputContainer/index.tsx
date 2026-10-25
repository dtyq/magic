import { cn } from "@/utils/cn"
import React, { useEffect, useMemo, useRef, useState } from "react"
import TaskList from "../TaskList"
import { useIsMobile } from "@/hooks/useIsMobile"
import { observer } from "mobx-react-lite"
import type { MessageEditorSize } from "../MessageEditor/types"
import { roleStore } from "../../stores"
import useTopicMode from "../../hooks/useTopicMode"
import MessageQueue from "../MessagePanel/components/MessageQueue"
import useMessageQueue from "../MessagePanel/hooks/useMessageQueue"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { DEFAULT_LAYOUT_CONFIG } from "../MessageEditor/constants/constant"
import { usePreload } from "../MessagePanel/utils/preload"
import { useTaskData } from "../../hooks/useTaskData"
import type { ProjectPageInputContainerProps } from "./types"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "../MainInputContainer/components/editors/types"
import { useSceneSelection } from "../MainInputContainer/hooks"
import { buildTopicInputScopeKey, createSceneStateStore } from "../MainInputContainer/stores"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import DesktopInputContainer from "./DesktopInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "../MainInputContainer/components/editors/constant"
import { createMessageEditorDraftKey } from "../MessageEditor/utils/draftKey"
import { TopicInvalidModeFallback } from "../MessageEditor/components/TopicInvalidModeFallback"
import { userStore } from "@/models/user"
import { useTaskInterrupt } from "@/pages/superMagic/hooks/useTaskInterrupt"
import { isCachedChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"
import {
	isTopicTaskRunning,
	isTopicWaitingForUser,
	TaskStatus,
} from "@/pages/superMagic/pages/Workspace/types"
import { useConversationInputLayout } from "../ConversationInputResize/context"

/**
 * 这个组件作为项目页的编辑器组件
 * @param param0
 * @returns
 */
const ProjectPageInputContainerComponent: React.FC<ProjectPageInputContainerProps> = ({
	messages,
	taskData: taskDataProp,
	className,
	classNames,
	containerRef,
	showLoading = false,
	selectedTopic,
	setSelectedTopic,
	isEmptyStatus = false,
	selectedProject,
	setSelectedProject,
	onEditorBlur,
	onEditorFocus,
	onMessageSendReady,
	onFileClick,
	selectedWorkspace,
	attachments,
	isShowLoadingInit = false,
	mentionPanelStore = GlobalMentionPanelStore,
	topicStore,
	allowRecordingMode,
	topicModeLogic: topicModeLogicProps,
	modelTopicMode,
	agentCode,
	placeholder,
	size = "small",
	enableMessageSendByContent = true,
	editorLayoutConfig,
	showTopicModeExamplePortal = true,
	enableReEditMessageFromPubSub = false,
	showModeToggle,
	showModelSelector,
	onSendSuccess,
	onSendComplete,
	createTopic,
	getImplicitMentionItems,
	editorRef,
}) => {
	const isMobile = useIsMobile()
	const inputLayout = useConversationInputLayout()
	// Layout context is available only inside resizable desktop conversations.
	const shouldFillHeight = Boolean(inputLayout?.fillHeight)
	// Keep the editor's own root ref separate from the layout container: the shared
	// containerRef is already attached to the layout wrapper, so reusing it here would
	// silently rebind it to the editor node and break the height measurement target.
	const localContainerRef = useRef<HTMLDivElement>(null)
	const effectiveContainerRef = containerRef ?? localContainerRef
	const { taskData: taskDataFromStore } = useTaskData({ selectedTopic })
	const taskData = taskDataProp ?? taskDataFromStore

	const [isFocused, setIsFocused] = useState(false)
	const [stopEventLoading, setStopEventLoading] = useState(false)
	const [sceneStateStore] = useState(() => createSceneStateStore())
	const organizationCode = userStore.user.organizationCode
	const userId = userStore.user.userInfo?.user_id
	const isTaskRunning = showLoading || isTopicTaskRunning(selectedTopic)
	const canInterruptTask =
		isTaskRunning || selectedTopic?.task_status === TaskStatus.WAITING_FOR_USER
	/**
	 * 话题页优先使用当前项目模式展示示例，不修改首页的全局模式选择。
	 */
	const projectMode = selectedProject?.project_mode
	const tabPattern =
		projectMode && superMagicModeService.isModeValid(projectMode)
			? projectMode
			: roleStore.currentRole

	/**
	 * 聊天页的话题模式，用于已有话题的模式展示或新话题的模式切换
	 */
	const {
		topicMode: innerTopicMode,
		setTopicMode: innerSetTopicMode,
		recoverTopicMode: innerRecoverTopicMode,
	} = useTopicMode({
		selectedTopic,
		selectedProject,
	})

	const topicMode = topicModeLogicProps?.topicMode ?? innerTopicMode
	const setTopicMode = topicModeLogicProps?.setTopicMode ?? innerSetTopicMode
	const recoverTopicMode = topicModeLogicProps?.recoverTopicMode ?? innerRecoverTopicMode
	// An explicit null clears a historical topic employee; omitted keeps the task detail fallback.
	const effectiveAgentCode =
		agentCode !== undefined ? (agentCode ?? undefined) : selectedTopic?.agent_code

	const { handleInterrupt } = useTaskInterrupt({
		selectedTopic: selectedTopic ?? null,
		userId,
		isStopping: stopEventLoading,
		setIsStopping: setStopEventLoading,
		canInterrupt: canInterruptTask,
	})

	/** 消息队列 */
	const messageQueue = useMessageQueue({
		editorRef,
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		agentCode: effectiveAgentCode,
		isTaskRunning,
		isWaitingForUser: isTopicWaitingForUser(selectedTopic),
		isEmptyStatus,
		isShowLoadingInit,
	})

	useEffect(() => {
		sceneStateStore.resetState()
	}, [sceneStateStore, organizationCode, userId])

	useEffect(() => {
		sceneStateStore.setInputScopeKey(
			buildTopicInputScopeKey(
				String(topicMode),
				selectedTopic?.id ?? "",
				effectiveAgentCode ?? "",
			),
		)
	}, [
		topicMode,
		selectedTopic?.id,
		effectiveAgentCode,
		sceneStateStore,
		organizationCode,
		userId,
	])

	const editorSize = size as MessageEditorSize

	const editPanelClassName = cn(classNames?.editorContent, shouldFillHeight && "h-full min-h-0")

	const editPanelContainerClassName = cn(
		"rounded-xl",
		shouldFillHeight && "h-full min-h-0",
		// Let the project conversation panel use its negotiated manual height above 50vh.
		shouldFillHeight && "!max-h-none",
		classNames?.editorInnerWrapper,
		isFocused && "border-blue-500 dark:border-blue-400",
	)

	const sceneEditorNodes = useMemo<SceneEditorNodes>(() => {
		const taskDataNode = taskData?.process?.length > 0 && !isEmptyStatus && (
			<div className="border-b border-border">
				<TaskList taskData={taskData} isInChat />
			</div>
		)

		const messageQueueNode = messageQueue.queue.length > 0 && !isEmptyStatus && (
			<MessageQueue
				queue={messageQueue.queue}
				editorRef={messageQueue.editorRef}
				queueStats={messageQueue.queueStats}
				onRemoveMessage={messageQueue.removeFromQueue}
				onSendMessage={messageQueue.sendQueuedMessage}
				onStartEdit={messageQueue.startEditQueueItem}
				onWithdraw={messageQueue.withdrawQueueItem}
				onMove={messageQueue.moveQueueItem}
				isOperationPending={messageQueue.isQueueOperationPending}
				variant={isMobile ? "mobile" : "default"}
			/>
		)

		return {
			taskDataNode,
			messageQueueNode,
		}
	}, [taskData, isEmptyStatus, messageQueue, isMobile])

	const sceneEditorContext = useMemo<SceneEditorContext>(() => {
		return {
			draftKey: createMessageEditorDraftKey({
				selectedWorkspace,
				selectedProject,
				selectedTopic,
			}),
			selectedTopic,
			selectedProject,
			setSelectedTopic,
			setSelectedProject,
			topicMode: topicMode,
			modelTopicMode,
			agentCode: effectiveAgentCode,
			placeholder,
			setTopicMode: setTopicMode,
			recoverTopicMode,
			topicExamplesMode: tabPattern,
			size: editorSize,
			className: editPanelClassName,
			containerClassName: editPanelContainerClassName,
			showLoading: !!showLoading,
			isTaskRunning: !!canInterruptTask,
			stopEventLoading,
			handleInterrupt,
			isEmptyStatus: !!isEmptyStatus,
			useChatTerminology: isCachedChatWorkspaceProject(selectedProject),
			showModeToggle,
			showModelSelector,
			messagesLength: (messages ?? []).length,
			enableMessageSendByContent,
			modules: {
				aiCompletion: {
					enabled: true,
				},
			},
			layoutConfig:
				editorLayoutConfig ?? (isMobile ? MOBILE_LAYOUT_CONFIG : DEFAULT_LAYOUT_CONFIG),
			attachments,
			mentionPanelStore,
			// Recording detail injects its isolated store so send-time renames never fall back globally.
			topicStore,
			allowRecordingMode,
			onFileClick,
			onEditorFocus: () => {
				setIsFocused(true)
				onEditorFocus?.()
			},
			onEditorBlur: () => {
				setIsFocused(false)
				onEditorBlur?.()
			},
			onSendComplete,
			onMessageSendReady,
			editorRef: messageQueue.editorRef,
			queueContext: messageQueue,
			showTopicExamplesPortal: showTopicModeExamplePortal,
			onSendSuccess,
			createTopic,
			getImplicitMentionItems,
			invalidModeFallback: TopicInvalidModeFallback,
		}
	}, [
		selectedTopic,
		selectedProject,
		selectedWorkspace,
		setSelectedTopic,
		setSelectedProject,
		topicMode,
		modelTopicMode,
		effectiveAgentCode,
		placeholder,
		setTopicMode,
		recoverTopicMode,
		tabPattern,
		editorSize,
		editPanelClassName,
		editPanelContainerClassName,
		showLoading,
		canInterruptTask,
		stopEventLoading,
		handleInterrupt,
		isEmptyStatus,
		messages,
		enableMessageSendByContent,
		editorLayoutConfig,
		isMobile,
		attachments,
		mentionPanelStore,
		topicStore,
		allowRecordingMode,
		onFileClick,
		onMessageSendReady,
		messageQueue,
		showTopicModeExamplePortal,
		showModeToggle,
		showModelSelector,
		onSendSuccess,
		createTopic,
		getImplicitMentionItems,
		onEditorFocus,
		onEditorBlur,
		onSendComplete,
	])

	usePreload()

	const scenes = superMagicModeService.getModeConfigWithLegacy(
		sceneEditorContext.topicMode,
		undefined,
		false,
		sceneEditorContext.agentCode,
	)?.mode.playbooks
	const { currentScene, shouldShowCurrentSceneBadge, shouldShowSceneControls } =
		useSceneSelection({
			scenes,
			sceneStateStore,
		})

	if (isMobile) {
		return (
			<MobileInputContainer
				editorContext={sceneEditorContext}
				editorNodes={sceneEditorNodes}
				enableReEditMessageFromPubSub={enableReEditMessageFromPubSub}
			/>
		)
	}

	return (
		<DesktopInputContainer
			sceneStateStore={sceneStateStore}
			scenes={scenes}
			currentScene={currentScene}
			shouldShowCurrentSceneBadge={shouldShowCurrentSceneBadge}
			shouldShowSceneControls={shouldShowSceneControls}
			containerRef={effectiveContainerRef}
			className={className}
			fillHeight={shouldFillHeight}
			inputResizeHandle={inputLayout?.inputResizeHandle}
			classNames={classNames}
			editorSize={editorSize}
			isFocused={isFocused}
			editorContext={sceneEditorContext}
			editorNodes={sceneEditorNodes}
		/>
	)
}

const ProjectPageInputContainer = observer(ProjectPageInputContainerComponent)

export default observer((props: ProjectPageInputContainerProps) => {
	return <ProjectPageInputContainer {...props} />
})
