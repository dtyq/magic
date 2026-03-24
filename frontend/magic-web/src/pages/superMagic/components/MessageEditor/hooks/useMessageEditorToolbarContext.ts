import { useMemo } from "react"
import type { RefObject } from "react"
import type { Editor, JSONContent } from "@tiptap/react"
import type { VoiceInputRef } from "@/components/business/VoiceInput"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { MentionPanelStore } from "@/components/business/MentionPanel/store"
import type { ProjectListItem, Topic, TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import type { DraftStore } from "../stores"
import type { FileUploadStore } from "../stores/FileUploadStore"
import type { FileData, MessageEditorSize } from "../types"
import type { ButtonRendererContext } from "../utils/buttonRenderer"

interface UseMessageEditorToolbarContextParams {
	voiceInputRef: RefObject<VoiceInputRef>
	tiptapEditor: Editor | null
	iconSize: number
	topBarIconSize: number
	size: MessageEditorSize
	value?: JSONContent
	draftStore: DraftStore
	fileUploadStore: FileUploadStore
	shouldEnableMention: boolean
	uploadEnabled: boolean
	sendButtonDisabled: boolean
	showLoading: boolean
	isTaskRunning: boolean
	stopEventLoading: boolean
	isEditingQueueItem: boolean
	isUploadingFiles: boolean
	voiceInputEnabled: boolean
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	topicMode?: TopicMode
	mentionPanelStore: MentionPanelStore
	mcpButtonConfig: ButtonRendererContext["mcpButtonConfig"]
	handleSelectMentionItem: (item: TiptapMentionAttributes) => Promise<void>
	handleFileUploadClick: (files: FileList) => void
	handleRemoveUploadedFile: (file: FileData) => void
	handleSend: () => void
	handleInterrupt: () => void
	handleCompressContext: () => void
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => React.ReactNode
	modelSwitch?: React.ReactNode
	t: (key: string, options?: Record<string, unknown>) => string
	updateEditorValue: (value: JSONContent | undefined) => void
}

function useMessageEditorToolbarContext({
	voiceInputRef,
	tiptapEditor,
	iconSize,
	topBarIconSize,
	size,
	value,
	draftStore,
	fileUploadStore,
	shouldEnableMention,
	uploadEnabled,
	sendButtonDisabled,
	showLoading,
	isTaskRunning,
	stopEventLoading,
	isEditingQueueItem,
	isUploadingFiles,
	voiceInputEnabled,
	selectedTopic,
	selectedProject,
	topicMode,
	mentionPanelStore,
	mcpButtonConfig,
	handleSelectMentionItem,
	handleFileUploadClick,
	handleRemoveUploadedFile,
	handleSend,
	handleInterrupt,
	handleCompressContext,
	editorModeSwitch,
	modelSwitch,
	t,
	updateEditorValue,
}: UseMessageEditorToolbarContextParams) {
	return useMemo<ButtonRendererContext>(
		() => ({
			voiceInputRef,
			tiptapEditor,
			iconSize,
			topBarIconSize,
			size,
			value,
			draftStore,
			fileUploadStore,
			shouldEnableMention,
			uploadEnabled,
			sendButtonDisabled,
			showLoading,
			isTaskRunning,
			isUploadingFiles,
			voiceInputEnabled,
			stopEventLoading,
			isEditingQueueItem,
			selectedTopic,
			selectedProject,
			topicMode,
			mentionPanelStore,
			mcpButtonConfig,
			handleSelectMentionItem,
			handleFileUploadClick,
			handleRemoveUploadedFile,
			handleSend,
			handleInterrupt,
			handleCompressContext,
			editorModeSwitch,
			modelSwitch,
			t,
			updateEditorValue,
		}),
		[
			voiceInputRef,
			tiptapEditor,
			iconSize,
			topBarIconSize,
			size,
			value,
			draftStore,
			fileUploadStore,
			shouldEnableMention,
			uploadEnabled,
			sendButtonDisabled,
			showLoading,
			isTaskRunning,
			isUploadingFiles,
			voiceInputEnabled,
			stopEventLoading,
			isEditingQueueItem,
			selectedTopic,
			selectedProject,
			topicMode,
			mentionPanelStore,
			mcpButtonConfig,
			handleSelectMentionItem,
			handleFileUploadClick,
			handleRemoveUploadedFile,
			handleSend,
			handleInterrupt,
			handleCompressContext,
			editorModeSwitch,
			modelSwitch,
			t,
			updateEditorValue,
		],
	)
}

export default useMessageEditorToolbarContext
