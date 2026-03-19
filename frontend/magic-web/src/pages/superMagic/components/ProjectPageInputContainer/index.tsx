import { useDebounceFn, useMemoizedFn } from "ahooks"
import { cn } from "@/lib/utils"
import React, { useEffect, useMemo, useState } from "react"
import { TopicMode } from "../../pages/Workspace/types"
import TaskList from "../TaskList"
import { useIsMobile } from "@/hooks/useIsMobile"
import { observer } from "mobx-react-lite"
import { MessageEditorSize } from "../MessageEditor/types"
import { roleStore } from "../../stores"
import useTopicMode from "../../hooks/useTopicMode"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MessageQueue from "../MessagePanel/components/MessageQueue"
import useMessageQueue from "../MessagePanel/hooks/useMessageQueue"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/store"
import { DEFAULT_LAYOUT_CONFIG } from "../MessageEditor/constants/constant"
import { usePreload } from "../MessagePanel/utils/preload"
import { useTaskData } from "../../hooks/useTaskData"
import { ProjectPageInputContainerProps } from "./types"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "../MainInputContainer/components/editors/types"
import { createSceneStateStore } from "../MainInputContainer/stores"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import DesktopInputContainer from "./DesktopInputContainer"
import { MOBILE_LAYOUT_CONFIG } from "../MainInputContainer/components/editors/constant"
import { createMessageEditorDraftKey } from "../MessageEditor/utils/draftKey"
import { userStore } from "@/models/user"

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
	onFileClick,
	selectedWorkspace,
	attachments,
	isShowLoadingInit = false,
	mentionPanelStore = GlobalMentionPanelStore,
	topicModeLogic: topicModeLogicProps,
	enableMessageSendByContent = true,
	editorLayoutConfig,
	showTopicModeExamplePortal = true,
}) => {
	const isMobile = useIsMobile()
	const { taskData: taskDataFromStore } = useTaskData({ selectedTopic })
	const taskData = taskDataProp ?? taskDataFromStore

	const [isFocused, setIsFocused] = useState(false)
	const [sceneStateStore] = useState(() => createSceneStateStore())
	const organizationCode = userStore.user.organizationCode
	const userId = userStore.user.userInfo?.user_id
	/**
	 * 首页的话题模式选择Tab，用于创建新项目时指定项目的话题模式
	 */
	const tabPattern = roleStore.currentRole
	const setTabPattern = roleStore.setCurrentRole

	/**
	 * 聊天页的话题模式，用于已有话题的模式展示或新话题的模式切换
	 */
	const { topicMode, setTopicMode } = useTopicMode({
		selectedTopic,
		selectedProject,
	})

	const setTabPatternWithFocus = useMemoizedFn((mode: TopicMode) => {
		setTabPattern(mode)
	})

	const setTopicModeWithFocus = useMemoizedFn((mode: TopicMode) => {
		setTopicMode(mode)
		// 发布模式变化事件，通知 Design 组件等更新
		if (selectedProject?.workspace_id && selectedProject?.id) {
			pubsub.publish(PubSubEvents.Super_Magic_Topic_Mode_Changed, {
				mode,
				workspaceId: selectedProject.workspace_id,
				projectId: selectedProject.id,
			})
		}
	})

	/** 消息队列 */
	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		isTaskRunning: showLoading,
		isEmptyStatus,
		isShowLoadingInit,
	})

	const { run: handleInterrupt } = useDebounceFn(
		(callback?: () => void) => {
			pubsub.publish("send_interrupt_message", callback)
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	useEffect(() => {
		sceneStateStore.resetState()
	}, [sceneStateStore, organizationCode, userId])

	useEffect(() => {
		if (selectedProject?.project_mode) {
			setTabPattern(selectedProject.project_mode)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedProject?.project_mode])

	const topicModeLogic = useMemo(() => {
		if (topicModeLogicProps) {
			return topicModeLogicProps
		}

		if (isMobile) {
			const _topicMode =
				tabPattern === TopicMode.Chat
					? superMagicModeService.firstModeIdentifier
					: topicMode

			return {
				topicMode: _topicMode,
				setTopicMode: setTopicModeWithFocus,
				allowEditorModeChange: (messages ?? []).length > 0 ? false : true,
			}
		}

		if (!selectedTopic) {
			const topicMode = tabPattern

			return {
				topicMode: topicMode,
				setTopicMode: setTabPatternWithFocus,
				allowEditorModeChange: false,
			}
		}

		return {
			topicMode:
				topicMode === TopicMode.Chat
					? superMagicModeService.firstModeIdentifier
					: topicMode,
			setTopicMode: setTopicModeWithFocus,
			allowEditorModeChange: (messages ?? []).length > 0 ? false : true,
		}
	}, [
		topicModeLogicProps,
		isMobile,
		selectedTopic,
		topicMode,
		setTopicModeWithFocus,
		messages,
		tabPattern,
		setTabPatternWithFocus,
	])

	const editorSize = "small" as MessageEditorSize

	const editPanelClassName = classNames?.editorContent

	const editPanelContainerClassName = cn(
		"rounded-xl",
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
				queueStats={messageQueue.queueStats}
				editingQueueItem={messageQueue.editingQueueItem}
				onRemoveMessage={messageQueue.removeFromQueue}
				onSendMessage={messageQueue.sendQueuedMessage}
				onStartEdit={messageQueue.startEditQueueItem}
				onCancelEdit={messageQueue.cancelEditQueueItem}
			/>
		)

		return {
			taskDataNode,
			messageQueueNode,
		}
	}, [
		taskData,
		isEmptyStatus,
		messageQueue.queue,
		messageQueue.queueStats,
		messageQueue.editingQueueItem,
		messageQueue.removeFromQueue,
		messageQueue.sendQueuedMessage,
		messageQueue.startEditQueueItem,
		messageQueue.cancelEditQueueItem,
	])

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
			topicMode: topicModeLogic.topicMode,
			setTopicMode: topicModeLogic.setTopicMode,
			topicExamplesMode: tabPattern,
			size: editorSize,
			className: editPanelClassName,
			containerClassName: editPanelContainerClassName,
			showLoading: !!showLoading,
			isEmptyStatus: !!isEmptyStatus,
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
			onFileClick,
			onEditorFocus: () => {
				setIsFocused(true)
				onEditorFocus?.()
			},
			onEditorBlur: () => {
				setIsFocused(false)
				onEditorBlur?.()
			},
			onInterrupt: handleInterrupt,
			queueContext: {
				editingQueueItem: messageQueue.editingQueueItem,
				addToQueue: messageQueue.addToQueue,
				finishEditQueueItem: messageQueue.finishEditQueueItem,
			},
			showTopicExamplesPortal: showTopicModeExamplePortal,
		}
	}, [
		selectedTopic,
		selectedProject,
		selectedWorkspace,
		setSelectedTopic,
		setSelectedProject,
		topicModeLogic.topicMode,
		topicModeLogic.setTopicMode,
		tabPattern,
		editPanelClassName,
		editPanelContainerClassName,
		showLoading,
		isEmptyStatus,
		messages,
		enableMessageSendByContent,
		editorLayoutConfig,
		isMobile,
		attachments,
		mentionPanelStore,
		onFileClick,
		handleInterrupt,
		messageQueue.editingQueueItem,
		messageQueue.addToQueue,
		messageQueue.finishEditQueueItem,
		showTopicModeExamplePortal,
		onEditorFocus,
		onEditorBlur,
	])

	usePreload()

	const scenes = superMagicModeService.getModeConfigWithLegacy(sceneEditorContext.topicMode)?.mode
		.playbooks
	const currentScene = sceneStateStore.currentScene

	useEffect(() => {
		if (!currentScene || !scenes) return

		const isSceneValid = scenes.some((scene) => scene.id === currentScene.id)
		if (!isSceneValid) {
			sceneStateStore.setCurrentScene(null)
		}
	}, [currentScene, scenes, sceneStateStore])

	if (isMobile) {
		return (
			<MobileInputContainer
				editorContext={sceneEditorContext}
				editorNodes={sceneEditorNodes}
			/>
		)
	}

	return (
		<DesktopInputContainer
			sceneStateStore={sceneStateStore}
			containerRef={containerRef}
			className={className}
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
