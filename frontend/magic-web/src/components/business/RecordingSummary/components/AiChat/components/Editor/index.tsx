import { useMemo } from "react"
import { merge } from "lodash-es"
import type { FC } from "react"
import recordingSummaryStore from "@/stores/recordingSummary"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import TaskList from "@/pages/superMagic/components/TaskList"
import MessageQueue from "@/pages/superMagic/components/MessagePanel/components/MessageQueue"
import useMessageQueue from "@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import { MessageEditorProvider } from "@/pages/superMagic/components/MessageEditor"
import { createMessageEditorDraftKey } from "@/pages/superMagic/components/MessageEditor/utils/draftKey"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { useTaskData } from "@/pages/superMagic/hooks/useTaskData"
import {
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { MentionPanelStore } from "@/components/business/MentionPanel/store"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import { useStyles } from "./styles"

interface EditorProps {
	messages: SuperMagicMessageItem[]
	attachments?: AttachmentItem[]
	selectedWorkspace: Workspace | null
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
	mentionPanelStore: MentionPanelStore
	projectFilesStore: ProjectFilesStore
	isShowLoadingInit: boolean
	showLoading: boolean
}

const Editor: FC<EditorProps> = ({
	messages,
	attachments,
	selectedWorkspace,
	selectedTopic,
	selectedProject,
	mentionPanelStore,
	projectFilesStore,
	isShowLoadingInit,
	showLoading,
}: EditorProps) => {
	const { styles } = useStyles()
	const recordSummaryService = initializeService()
	const { taskData } = useTaskData({ selectedTopic })

	const messageQueue = useMessageQueue({
		projectId: selectedProject?.id,
		topicId: selectedTopic?.id,
		isTaskRunning: showLoading,
		isEmptyStatus: false,
		isShowLoadingInit,
	})

	const editorContext = useMemo<SceneEditorContext>(() => {
		return {
			draftKey: createMessageEditorDraftKey({
				selectedWorkspace,
				selectedProject,
				selectedTopic,
			}),
			selectedWorkspace,
			selectedTopic,
			selectedProject,
			setSelectedWorkspace: (workspace) => {
				if (workspace) {
					void recordSummaryService.updateWorkspace(workspace)
					return
				}

				recordingSummaryStore.setWorkspace(null)
			},
			setSelectedProject: (project) => {
				if (project) {
					void recordSummaryService.updateProject(project)
					return
				}

				recordingSummaryStore.setProject(null)
			},
			setSelectedTopic: (topic) => {
				if (topic) {
					void recordSummaryService.updateChatTopic(topic)
					return
				}

				recordingSummaryStore.setChatTopic(null)
			},
			topicMode: TopicMode.General,
			size: "small",
			className: "border-none",
			containerClassName: "rounded-xl border-muted-foreground",
			showLoading,
			isEmptyStatus: false,
			messagesLength: messages.length,
			enableMessageSendByContent: true,
			modules: {
				aiCompletion: {
					enabled: true,
				},
			},
			attachments,
			mentionPanelStore,
			projectFilesStore,
			mergeSendParams: ({ defaultParams }) => {
				return merge({}, defaultParams, {
					extra: {
						super_agent: {
							dynamic_params: {
								asr_task_key: recordSummaryService.getCurrentSessionTaskKey(),
							},
						},
					},
				})
			},
			onSendSuccess: () => {
				setTimeout(() => {
					pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom)
				}, 200)
			},
			queueContext: {
				editingQueueItem: messageQueue.editingQueueItem,
				addToQueue: messageQueue.addToQueue,
				finishEditQueueItem: messageQueue.finishEditQueueItem,
			},
		}
	}, [
		attachments,
		messageQueue.addToQueue,
		messageQueue.editingQueueItem,
		messageQueue.finishEditQueueItem,
		messages.length,
		mentionPanelStore,
		projectFilesStore,
		recordSummaryService,
		selectedProject,
		selectedTopic,
		selectedWorkspace,
		showLoading,
	])

	const taskDataNode = taskData && taskData?.process?.length > 0 && (
		<div className="mb-2 border-b border-border">
			<TaskList taskData={taskData} isInChat />
		</div>
	)

	const messageQueueNode = messageQueue.queue.length > 0 && (
		<div className="mb-2">
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

	const messageEditorProviderConfig = useMemo(() => {
		return {
			enableVoiceInput: false,
		}
	}, [])

	return (
		<MessageEditorProvider config={messageEditorProviderConfig}>
			<div className={styles.editor}>
				{taskDataNode}
				{messageQueueNode}
				<DefaultMessageEditorContainer editorContext={editorContext} />
			</div>
		</MessageEditorProvider>
	)
}

export default Editor
