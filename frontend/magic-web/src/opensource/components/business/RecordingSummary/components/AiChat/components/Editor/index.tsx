import MessagePanel from "@/opensource/pages/superMagic/components/MessagePanel"
import {
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import { initializeService } from "@/opensource/services/recordSummary/serviceInstance"
import { JSONContent } from "@tiptap/core"
import { useMemoizedFn } from "ahooks"
import { MentionPanelStore } from "@/opensource/components/business/MentionPanel/store"
import { useMemo } from "react"
import { useStyles } from "./styles"
import { MessageEditorProvider } from "@/opensource/pages/superMagic/components/MessageEditor"
import { SuperMagicApi } from "@/opensource/apis"
import type { FC } from "react"
import { useTaskData } from "@/opensource/pages/superMagic/hooks/useTaskData"
import { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"

interface EditorProps {
	messages: any[]
	attachments?: AttachmentItem[]
	selectedWorkspace: Workspace | null
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
	mentionPanelStore: MentionPanelStore
	isShowLoadingInit: boolean
	showLoading: boolean
	handleSendMsg: (content: JSONContent | string, options?: any) => void
}

const Editor: FC<EditorProps> = ({
	messages,
	attachments,
	selectedWorkspace,
	selectedTopic,
	selectedProject,
	mentionPanelStore,
	isShowLoadingInit,
	showLoading,
	handleSendMsg,
}: EditorProps) => {
	const { styles } = useStyles()

	const recordSummaryService = initializeService()

	const { taskData } = useTaskData({ selectedTopic })

	const handleCreateTopic = useMemoizedFn(async (): Promise<Topic | null> => {
		if (!selectedProject) {
			return null
		}
		const newTopic = await SuperMagicApi.createTopic({
			topic_name: "",
			// workspace_id: selectedProject?.workspace_id,
			project_id: selectedProject?.id,
			project_mode: TopicMode.General,
		})

		recordSummaryService.updateChatTopic(newTopic)

		return newTopic
	})

	const topicModeLogic = useMemo(() => {
		return {
			topicMode: TopicMode.General,
			setTopicMode: () => {},
			allowEditorModeChange: false,
		}
	}, [])

	const messageEditorProviderConfig = useMemo(() => {
		return {
			enableVoiceInput: false,
		}
	}, [])

	return (
		<MessageEditorProvider config={messageEditorProviderConfig}>
			<MessagePanel
				classNames={{
					editorInnerWrapper: "border border-muted-foreground",
					editor: "border-none",
				}}
				isShowLoadingInit={isShowLoadingInit}
				messages={messages}
				taskData={taskData}
				showLoading={showLoading}
				selectedWorkspace={selectedWorkspace}
				selectedProject={selectedProject}
				selectedTopic={selectedTopic}
				setSelectedTopic={(topic: Topic | null | ((prev: Topic | null) => Topic | null)) =>
					recordSummaryService.updateChatTopic(topic as Topic)
				}
				isEmptyStatus={false}
				size="small"
				attachments={attachments}
				className={styles.editor}
				mentionPanelStore={mentionPanelStore}
				topicModeLogic={topicModeLogic}
				enableMessageSendByContent
			/>
		</MessageEditorProvider>
	)
}

export default Editor
