import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import { observer } from "mobx-react-lite"
import recordingSummaryStore from "@/stores/recordingSummary"
import { useMemoizedFn } from "ahooks"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { userStore } from "@/models/user"
import { useInterruptAndUndoMessage } from "@/pages/superMagic/hooks/useInterruptAndUndoMessage"
import { LongMemoryApi } from "@/apis"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import Editor from "./components/Editor"
import { useStyles } from "./styles"
import { type MentionPanelStore } from "@/components/business/MentionPanel/store"
import { useTopicMessages } from "./hooks/useTopicMessages"
import { useEffect, useMemo, useRef } from "react"
import PreviewDetailPopup, {
	PreviewDetail,
	PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import { JSONContent } from "@tiptap/core"
import { merge } from "lodash-es"
import { useMessageChanges } from "@/pages/superMagic/hooks/useMessageChanges"
import { LongMemory } from "@/types/longMemory"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import { convertFileToTabItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/tabUtils"
import MessageListFallback from "./components/MessageListFallback"

export interface AiChatProps {
	projectFilesStore: ProjectFilesStore
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	checkNowDebounced: () => void
	recordSummaryFileStore: MentionPanelStore
}

export function AiChat(props: AiChatProps) {
	const { attachments, attachmentList, checkNowDebounced, recordSummaryFileStore } = props

	const recordSummaryService = initializeService()
	const { styles } = useStyles()
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)

	const selectedTopic = recordingSummaryStore.businessData.chatTopic ?? null
	const selectedProject = recordingSummaryStore.businessData.project ?? null
	const selectedWorkspace = recordingSummaryStore.businessData.workspace ?? null

	const scopedMessageSendService = useMemo(
		() => createMessageSendService({ mentionPanelStore: recordSummaryFileStore }),
		[recordSummaryFileStore],
	)

	// 使用消息管理 hook
	const { messages, showLoading, isShowLoadingInit, handlePullMoreMessage } = useTopicMessages({
		selectedTopic,
		selectedWorkspace,
		checkNowDebounced,
	})

	const { hasMemoryUpdateMessage } = useMessageChanges(messages)

	useEffect(() => {
		if (!hasMemoryUpdateMessage) return
		// 更新长期记忆
		try {
			LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: 99,
			}).then((res) => {
				if (res?.success) {
					userStore.user.setPendingMemoryList(res.data || [])
				}
			})
		} catch (error) {
			console.error(error)
		}
	}, [hasMemoryUpdateMessage])

	// Handle interrupt and undo message functionality
	useInterruptAndUndoMessage({
		selectedTopic,
		messages,
		userInfo: userStore.user.userInfo,
	})

	// 封装消息发送处理函数
	const handleSendMsg = useMemoizedFn((content: JSONContent | string, options?: any) => {
		/**
		 * 补充 asr_task_key 参数
		 * 用于录音总结模式，AI 对话功能使用该逻辑
		 */
		const _options = merge(options, {
			extra: {
				super_agent: {
					dynamic_params: {
						asr_task_key: recordSummaryService.getCurrentSessionTaskKey(),
					},
				},
			},
		})

		// 立即更新笔记和转文本内容
		recordSummaryService.flushNoteUpdate()
		recordSummaryService.flushTranscriptUpdate()

		scopedMessageSendService.sendContent({
			content,
			showLoading: messages?.length > 1 && showLoading,
			options: {
				..._options,
				_tempProject: selectedProject ?? undefined,
				_tempTopic: selectedTopic ?? undefined,
			},
		})

		// 延迟200ms通知MessageList组件滚动到底部
		setTimeout(() => {
			pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom)
		}, 200)
	})

	const { handleOpenFile, handleNodeFile } = useFileOpen({
		setUserSelectDetail: (detail) => {
			previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
		},
		attachments,
	})

	const onFileClick = useMemoizedFn((fileId: string) => {
		const targetFile = attachmentList.find((item) => item.file_id === fileId)
		if (targetFile) {
			handleOpenFile(targetFile)
		}
	})

	useEffect(() => {
		const openFileTabCallback = (data: { fileId: string; fileData: any }) => {
			handleNodeFile(data.fileData)
		}

		pubsub.subscribe(PubSubEvents.Open_File_Tab, openFileTabCallback)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Open_File_Tab, openFileTabCallback)
		}
	}, [handleNodeFile])

	useEffect(() => {
		const openPlaybackTabCallback = (data: any) => {
			handleNodeFile(data)
		}

		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, openPlaybackTabCallback)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Open_Playback_Tab, openPlaybackTabCallback)
		}
	}, [handleNodeFile])

	useEffect(() => {
		if (!selectedProject?.id) {
			return
		}
		recordSummaryFileStore.getInitLoadAttachmentsPromise(selectedProject?.id).then(() => {
			// 把笔记添加到当前会话的tabs中，方便@
			const noteContent = recordSummaryService.getNoteFile()
			if (noteContent) {
				const targetFile = attachmentList.find(
					(item) => item.file_id === noteContent.file_id,
				)
				if (targetFile) {
					const tabItem = convertFileToTabItem(targetFile, attachmentList, {
						create_at: Date.now(),
						active_at: Date.now(),
					})
					if (tabItem) {
						recordSummaryFileStore.setCurrentTabs([tabItem])
					}
				}
			}
		})
	}, [selectedProject?.id, attachmentList, recordSummaryFileStore, recordSummaryService])

	const value = useMemo(() => {
		return {
			allowRevoke: true,
			allowUserMessageCopy: false,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
		}
	}, [])

	return (
		<>
			<MessageListProvider value={value}>
				{messages.length === 0 ? (
					<div className={styles.messageListFallback}>
						<MessageListFallback />
					</div>
				) : (
					<MessageList
						data={messages}
						selectedTopic={selectedTopic}
						handlePullMoreMessage={handlePullMoreMessage}
						showLoading={showLoading}
						currentTopicStatus={selectedTopic?.task_status}
						handleSendMsg={handleSendMsg}
						className={styles.messageList}
						onFileClick={onFileClick}
						stickyMessageClassName="top-0 [--sticky-message-mask-bg:rgb(255_255_255)] [--sticky-message-mask-fade-from:rgb(255_255_255)]"
					/>
				)}
			</MessageListProvider>
			{/* <div className={styles.aiGeneratedMessageTip}>
				{t("recordingSummary.ui.aiGeneratedTip")}
			</div> */}
			<Editor
				messages={messages}
				attachments={attachments}
				selectedWorkspace={selectedWorkspace}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				mentionPanelStore={recordSummaryFileStore}
				isShowLoadingInit={isShowLoadingInit}
				showLoading={showLoading}
				handleSendMsg={handleSendMsg}
			/>
			<PreviewDetailPopup
				ref={previewDetailPopupRef}
				setUserSelectDetail={(detail: any) => {
					previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
				}}
				onClose={() => {
					previewDetailPopupRef.current?.open(
						{} as PreviewDetail,
						attachments,
						attachmentList,
					)
				}}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
			/>
		</>
	)
}

export default observer(AiChat)
