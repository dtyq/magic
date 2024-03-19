import { useDebounceFn, useMemoizedFn } from "ahooks"
import { cn } from "@/opensource/lib/utils"
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { TopicMode } from "../../pages/Workspace/types"
import TaskList from "../TaskList"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MessageEditor, { type MessageEditorRef } from "../MessageEditor/MessageEditor"
import { observer } from "mobx-react-lite"
import { MessageEditorSize } from "../MessageEditor/types"
import { roleStore } from "../../stores"
import useTopicMode from "../../hooks/useTopicMode"
import RecordSummaryEditorPanelSkeleton from "./components/RecordSummaryEditorPanelSkeleton"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import MessageQueue from "./components/MessageQueue"
import useMessageQueue from "./hooks/useMessageQueue"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"
import useRecordingSummaryEditorMode from "./hooks/useRecordingSummaryEditorMode"
import { RecordingSummaryEditorMode } from "./const/recordSummary"
import useRecordSummaryAudioFile from "./hooks/useRecordSummaryAudioFile"
import GlobalMentionPanelStore from "@/opensource/components/business/MentionPanel/store"
import { MessagePanelProps } from "./types"
import {
	createMessageSendService,
	type HandleSendParams,
} from "../../services/messageSendFlowService"
import { logger as Logger } from "@/opensource/utils/log"
import { EDITOR_ICON_SIZE_MAP } from "../MessageEditor/constants/constant"
import useSandboxPreWarm from "./hooks/useSandboxPreWarm"
import { usePreload } from "./utils/preload"
import { useNanoBananaPrompt } from "../../hooks/useNanoBananaPrompt"
import { getButtonPaddingClass } from "../MessageEditor/constants/BUTTON_PADDING_CLASS_MAP"
import { GuideTourElementId } from "@/opensource/pages/superMagic/components/LazyGuideTour"
import useTopicExamplesPortal from "../../hooks/useTopicExamplesPortal"
import useSharedProjectMode from "../../hooks/useSharedProjectMode"
import { createMessageEditorDraftKey } from "../MessageEditor/utils/draftKey"
import RecordingSummaryEditorModeSwitch from "@/opensource/components/business/RecordingSummary/components/EditorModeSwitch"
import RecordingSummaryEditorPanel from "@/opensource/components/business/RecordingSummary/EditorPanel"

const logger = Logger.createLogger("messagePanel")

/**
 * 这个组件作为项目页的编辑器组件
 * @param param0
 * @returns
 */
const MessagePanel: React.FC<MessagePanelProps> = ({
	messages,
	taskData,
	className,
	classNames,
	containerRef,
	showLoading,
	selectedTopic,
	setSelectedTopic,
	isEmptyStatus,
	selectedProject,
	setSelectedProject,
	onEditorBlur,
	onEditorFocus,
	onFileClick,
	selectedWorkspace,
	attachments,
	isShowLoadingInit,
	mentionPanelStore = GlobalMentionPanelStore,
	topicModeLogic: topicModeLogicProps,
	enableMessageSendByContent = false,
	size = "default" as MessageEditorSize,
	editorLayoutConfig,
}) => {
	const { t } = useTranslation("super")

	const isMobile = useIsMobile()

	const [isFocused, setIsFocused] = useState(false)

	/**
	 * 首页的话题模式选择Tab，用于创建新项目时指定项目的话题模式
	 */
	const tabPattern = roleStore.currentRole
	const setTabPattern = roleStore.setCurrentRole
	const isChatMode = roleStore.isChatMode

	/**
	 * 聊天页的话题模式，用于已有话题的模式展示或新话题的模式切换
	 */
	const { topicMode, setTopicMode } = useTopicMode({
		selectedTopic,
		selectedProject,
	})

	const handleFocus = useMemoizedFn(() => {
		if (
			!tiptapEditorRef.current?.editor?.isDestroyed &&
			!tiptapEditorRef.current?.editor?.isFocused
		) {
			tiptapEditorRef.current?.focus({ enableWhenIsMobile: true })
		}
	})

	const setTabPatternWithFocus = useMemoizedFn((mode: TopicMode) => {
		setTabPattern(mode)
		// 在移动端，模式切换时不自动 focus，避免触发覆盖层
		if (!isMobile) {
			// Use requestAnimationFrame to ensure DOM is fully updated
			requestAnimationFrame(() => {
				handleFocus()
			})
		}
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
		// 在移动端，模式切换时不自动 focus，避免触发覆盖层
		if (!isMobile) {
			// Use requestAnimationFrame to ensure DOM is fully updated
			requestAnimationFrame(() => {
				handleFocus()
			})
		}
	})

	const tiptapEditorRef = useRef<MessageEditorRef>(null)

	/** 消息队列 */
	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		isTaskRunning: showLoading,
		isEmptyStatus,
		isShowLoadingInit,
	})

	// 跟踪前一个编辑状态
	const prevEditingQueueItemRef = useRef(messageQueue.editingQueueItem)

	// 当编辑队列项状态变化时处理
	useEffect(() => {
		const currentEditingItem = messageQueue.editingQueueItem
		const prevEditingItem = prevEditingQueueItemRef.current

		// 检查是否真正的状态变化（通过ID比较而非对象引用比较）
		const currentEditingId = currentEditingItem?.id
		const prevEditingId = prevEditingItem?.id

		if (currentEditingItem && tiptapEditorRef.current) {
			// 进入编辑状态：只有当真正进入新的编辑状态时才填充内容
			if (!prevEditingId || currentEditingId !== prevEditingId) {
				setTimeout(() => {
					// @deprecated mentionItems 已经移除了
					// const content = currentEditingItem.content
					// const filteredMentions = currentEditingItem.mentionItems.filter(
					// 	(item) => item.attrs.type !== MentionItemType.DESIGN_MARKER,
					// )
					// tiptapEditorRef.current?.restoreContent?.(content, filteredMentions)
					tiptapEditorRef.current?.editor?.commands.focus()
				}, 100)
			}
		} else if (!currentEditingItem && prevEditingItem && tiptapEditorRef.current) {
			// 退出编辑状态：只有当真正退出编辑状态时才清空内容
			tiptapEditorRef.current?.clearContent()
			setIsFocused(false)
		}

		// 更新前一个状态
		prevEditingQueueItemRef.current = currentEditingItem
	}, [messageQueue.editingQueueItem])

	/** 发送消息 */
	const [isSending, setIsSending] = useState(false)

	const scopedMessageSendService = useMemo(
		() => createMessageSendService({ mentionPanelStore }),
		[mentionPanelStore],
	)

	const handleSend = useMemoizedFn(async (params: HandleSendParams) => {
		if (messageQueue.editingQueueItem) {
			if (!params.queueId || params.queueId === messageQueue.editingQueueItem.id) {
				messageQueue.finishEditQueueItem(params.value, params.mentionItems)
				tiptapEditorRef.current?.clearContent()
				setIsFocused(false)
				return
			}
		}

		if (!params.value || isSending) {
			return
		}

		if (showLoading && !params.isFromQueue) {
			messageQueue.addToQueue({
				content: params.value,
				mentionItems: params.mentionItems,
				selectedModel: params.selectedModel,
				selectedImageModel: params.selectedImageModel,
				topicMode: params.topicMode,
			})
			tiptapEditorRef.current?.clearContent()
			setIsFocused(false)
			return
		}

		await scopedMessageSendService.sendPanelMessage({
			params,
			isSending,
			setIsSending,
			showLoading: !!showLoading,
			isMobile,
			isEmptyStatus: !!isEmptyStatus,
			tabPattern,
			editorRef: tiptapEditorRef.current,
			setFocused: setIsFocused,
			selectedProject,
			selectedTopic,
			messagesLength: messages.length,
			setSelectedProject,
			setSelectedTopic,
		})
	})

	const { run: handleInterrupt } = useDebounceFn(
		(callback?: () => void) => {
			pubsub.publish("send_interrupt_message", callback)
		},
		{ wait: 3000, leading: true, trailing: false },
	)

	const topicExamplesPortalNode = useTopicExamplesPortal({
		editorRef: tiptapEditorRef,
		topicMode: tabPattern,
	})

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
			if (!selectedTopic && !selectedProject) {
				const topicMode =
					tabPattern === TopicMode.Chat
						? superMagicModeService.firstModeIdentifier
						: tabPattern

				return {
					topicMode: topicMode,
					setTopicMode: setTabPatternWithFocus,
					allowEditorModeChange: true,
				}
			}

			const _topicMode =
				tabPattern === TopicMode.Chat
					? superMagicModeService.firstModeIdentifier
					: topicMode

			return {
				topicMode: _topicMode,
				setTopicMode: setTopicModeWithFocus,
				allowEditorModeChange: messages.length > 0 ? false : true,
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
			allowEditorModeChange: messages.length > 0 ? false : true,
		}
	}, [
		topicModeLogicProps,
		isMobile,
		selectedTopic,
		topicMode,
		setTopicModeWithFocus,
		messages.length,
		selectedProject,
		tabPattern,
		setTabPatternWithFocus,
	])

	useSharedProjectMode({ setTopicMode: topicModeLogic.setTopicMode })

	const topicModePlaceholder =
		superMagicModeService.getModePlaceholderWithLegacy(topicModeLogic.topicMode, t, isMobile) ||
		t("messageEditor.placeholderTask")

	const onFocus = useMemoizedFn(() => {
		setIsFocused(true)
		onEditorFocus?.()
	})
	const onBlur = useMemoizedFn(() => {
		setIsFocused(false)
		onEditorBlur?.()
	})

	const isRecordSummaryMode = topicModeLogic.topicMode === TopicMode.RecordSummary

	const { editorMode, setEditorMode } = useRecordingSummaryEditorMode({
		selectedTopic,
		hasMessage: messages.length > 0,
	})

	const editorSize = size
	const draftKey = useMemo(
		() =>
			createMessageEditorDraftKey({
				selectedWorkspace,
				selectedProject,
				selectedTopic,
			}),
		[selectedProject, selectedTopic, selectedWorkspace],
	)

	const editorModeSwitch =
		topicModeLogic.topicMode === TopicMode.RecordSummary
			? ({ disabled }: { disabled: boolean }) => {
					return (
						<RecordingSummaryEditorModeSwitch
							className={getButtonPaddingClass(editorSize)}
							selectedTopic={selectedTopic}
							selectedProject={selectedProject}
							selectedWorkspace={selectedWorkspace}
							iconSize={EDITOR_ICON_SIZE_MAP[editorSize]}
							editorMode={editorMode}
							setEditorMode={setEditorMode}
							disabled={disabled}
						/>
					)
				}
			: undefined

	useRecordSummaryAudioFile({
		editorMode,
		setEditorMode,
		tiptapEditorRef,
	})

	useSandboxPreWarm({
		selectedTopic,
		selectedWorkspace,
		editorRef: tiptapEditorRef.current?.editor,
	})

	useNanoBananaPrompt({
		editorRef: tiptapEditorRef,
		setTopicMode: topicModeLogic.setTopicMode,
		setIsFocused,
		logger,
	})

	const taskDataNode = taskData?.process?.length > 0 && !isEmptyStatus && (
		<div className="border-b border-[#f0f0f0]">
			<TaskList taskData={taskData} isInChat />
		</div>
	)

	const messageQueueNode = messageQueue.queue.length > 0 && !isEmptyStatus && (
		<div className="relative border-none after:absolute after:bottom-[-10px] after:left-0 after:h-[20px] after:w-full after:bg-[#FBFBFB] after:content-['']">
			<MessageQueue
				queue={messageQueue.queue}
				queueStats={messageQueue.queueStats}
				editingQueueItem={messageQueue.editingQueueItem}
				onRemoveMessage={messageQueue.removeFromQueue}
				onSendMessage={messageQueue.sendQueuedMessage}
				onStartEdit={messageQueue.startEditQueueItem}
				onCancelEdit={messageQueue.cancelEditQueueItem}
			/>
		</div>
	)

	const editPanelClassName = classNames?.editorContent

	const editPanelContainerClassName = cn(
		"rounded-xl",
		classNames?.editorInnerWrapper,
		isFocused && "border-primary",
	)

	usePreload()

	return (
		<div
			ref={containerRef}
			id={GuideTourElementId.MessagePanel}
			className={cn(
				"relative flex w-full flex-none flex-col items-start self-stretch",
				className,
				classNames?.container,
			)}
		>
			<div className={cn("w-full", classNames?.editorWrapper)}>
				<div
					className={cn(
						"z-[2] overflow-hidden border border-transparent",
						classNames?.editor,
						isFocused && "border-blue-500",
					)}
					data-testid="message-panel-input-group"
				>
					<div
						className={cn("flex flex-col", {
							"gap-1.5": editorSize !== "default",
							"p-2.5": isChatMode,
						})}
					>
						{isRecordSummaryMode &&
						editorMode === RecordingSummaryEditorMode.Recording ? (
							<Suspense
								fallback={<RecordSummaryEditorPanelSkeleton size={editorSize} />}
							>
								<RecordingSummaryEditorPanel
									className={editPanelClassName}
									containerClassName={editPanelContainerClassName}
									selectedTopic={selectedTopic}
									selectedProject={selectedProject}
									selectedWorkspace={selectedWorkspace}
									size={editorSize}
									iconSize={EDITOR_ICON_SIZE_MAP[editorSize]}
									topicMode={topicModeLogic.topicMode}
									isTaskRunning={showLoading}
									onInterrupt={handleInterrupt}
									editorModeSwitch={editorModeSwitch}
									attachments={attachments}
									taskDataNode={taskDataNode}
									messageQueueNode={messageQueueNode}
								/>
							</Suspense>
						) : (
							<MessageEditor
								ref={tiptapEditorRef}
								className={editPanelClassName}
								containerClassName={editPanelContainerClassName}
								placeholder={
									showLoading
										? t("messageEditor.placeholderLoading")
										: topicModePlaceholder
								}
								onSend={handleSend}
								isTaskRunning={showLoading}
								onInterrupt={handleInterrupt}
								selectedTopic={selectedTopic}
								selectedProject={selectedProject}
								selectedWorkspace={selectedWorkspace}
								draftKey={draftKey}
								topicMode={topicModeLogic.topicMode}
								size={editorSize}
								modules={{
									aiCompletion: {
										enabled: true,
									},
								}}
								isSending={isSending}
								onFocus={onFocus}
								onBlur={onBlur}
								onFileClick={onFileClick}
								attachments={attachments}
								isEditingQueueItem={!!messageQueue.editingQueueItem}
								onCreateTopic={() =>
									scopedMessageSendService.createTopic({
										selectedProject,
									})
								}
								showLoading={showLoading}
								editorModeSwitch={editorModeSwitch}
								mentionPanelStore={mentionPanelStore}
								taskDataNode={taskDataNode}
								messageQueueNode={messageQueueNode}
								layoutConfig={editorLayoutConfig}
								enableMessageSendByContent={enableMessageSendByContent}
							/>
						)}
					</div>
				</div>
				{topicExamplesPortalNode}
			</div>
		</div>
	)
}

const MessagePanelComponent = observer(MessagePanel)

export default observer((props: MessagePanelProps) => {
	return <MessagePanelComponent {...props} />
})
