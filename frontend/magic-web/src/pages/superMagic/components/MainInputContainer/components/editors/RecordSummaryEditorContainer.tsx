import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { Suspense, useRef } from "react"
import { EDITOR_ICON_SIZE_MAP } from "../../../MessageEditor/constants/constant"
import RecordSummaryEditorPanelSkeleton from "../../../MessagePanel/components/RecordSummaryEditorPanelSkeleton"
import { RecordingSummaryEditorMode } from "../../../MessagePanel/const/recordSummary"
import useRecordingSummaryEditorMode from "../../../MessagePanel/hooks/useRecordingSummaryEditorMode"
import { getButtonPaddingClass } from "../../../MessageEditor/constants/BUTTON_PADDING_CLASS_MAP"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import useRecordSummaryAudioFile from "../../../MessagePanel/hooks/useRecordSummaryAudioFile"
import { roleStore } from "@/pages/superMagic/stores"
import type { MessageEditorRef } from "../../../MessageEditor/MessageEditor"
import DefaultMessageEditorContainer from "./DefaultMessageEditorContainer"
import type { SceneEditorContext, SceneEditorNodes } from "./types"
import useSharedProjectMode from "@/pages/superMagic/hooks/useSharedProjectMode"
import RecordingSummaryEditorModeSwitch from "@/components/business/RecordingSummary/components/EditorModeSwitch"
import RecordingSummaryEditorPanel from "@/components/business/RecordingSummary/EditorPanel"

interface RecordSummaryEditorContainerProps {
	editorContext?: SceneEditorContext
	editorNodes?: SceneEditorNodes
}

export default function RecordSummaryEditorContainer({
	editorContext,
	editorNodes,
}: RecordSummaryEditorContainerProps) {
	const scopedTopicStore = editorContext?.topicStore ?? topicStore

	const selectedTopic = editorContext?.selectedTopic ?? scopedTopicStore.selectedTopic
	const selectedProject = editorContext?.selectedProject ?? projectStore.selectedProject
	const selectedWorkspace =
		editorContext?.selectedWorkspace ??
		workspaceStore.selectedWorkspace ??
		workspaceStore.firstWorkspace
	const effectiveSetTopicMode = editorContext?.setTopicMode ?? roleStore.setCurrentRole

	useSharedProjectMode({ setTopicMode: effectiveSetTopicMode })

	const { editorMode, setEditorMode } = useRecordingSummaryEditorMode({
		selectedTopic,
		hasMessage: (editorContext?.messagesLength ?? 0) > 0,
	})

	const editorSize = editorContext?.size ?? "default"

	const editorModeSwitch =
		editorContext?.editorModeSwitch ??
		(({ disabled }: { disabled: boolean }) => (
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
		))

	const tiptapEditorRef = useRef<MessageEditorRef>(null)

	useRecordSummaryAudioFile({
		editorMode,
		setEditorMode,
		tiptapEditorRef,
	})

	const editingEditorContext: SceneEditorContext = {
		...editorContext,
		selectedTopic,
		selectedProject,
		selectedWorkspace,
		topicStore: scopedTopicStore,
		topicMode: editorContext?.topicMode ?? TopicMode.RecordSummary,
		setTopicMode: effectiveSetTopicMode,
		size: editorSize,
		editorModeSwitch,
		containerClassName: editorContext?.containerClassName,
	}

	return editorMode === RecordingSummaryEditorMode.Recording ? (
		<Suspense fallback={<RecordSummaryEditorPanelSkeleton size={editorSize} />}>
			<RecordingSummaryEditorPanel
				className={editorContext?.className}
				containerClassName={editorContext?.containerClassName}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				selectedWorkspace={selectedWorkspace}
				size={editorSize}
				iconSize={EDITOR_ICON_SIZE_MAP[editorSize]}
				topicMode={editorContext?.topicMode ?? TopicMode.RecordSummary}
				isTaskRunning={editorContext?.showLoading}
				editorModeSwitch={editorModeSwitch}
				attachments={editorContext?.attachments}
				taskDataNode={editorNodes?.taskDataNode}
				messageQueueNode={editorNodes?.messageQueueNode}
			/>
		</Suspense>
	) : (
		<DefaultMessageEditorContainer
			editorContext={editingEditorContext}
			editorNodes={editorNodes}
			editorRef={tiptapEditorRef}
		/>
	)
}
