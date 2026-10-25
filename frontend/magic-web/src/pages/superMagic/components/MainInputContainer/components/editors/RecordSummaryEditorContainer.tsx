import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { Suspense, useRef } from "react"
import { EDITOR_ICON_SIZE_MAP } from "../../../MessageEditor/constants/constant"
import RecordSummaryEditorPanelSkeleton from "../../../MessagePanel/components/RecordSummaryEditorPanelSkeleton"
import { RecordingSummaryEditorMode } from "../../../MessagePanel/const/recordSummary"
import useRecordingSummaryEditorMode from "../../../MessagePanel/hooks/useRecordingSummaryEditorMode"
import { getButtonPaddingClass } from "../../../MessageEditor/constants/BUTTON_PADDING_CLASS_MAP"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import useRecordSummaryAudioFile from "../../../MessagePanel/hooks/useRecordSummaryAudioFile"
import { roleStore } from "@/pages/superMagic/stores"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { MessageEditorRef } from "../../../MessageEditor/MessageEditor"
import DefaultMessageEditorContainer from "./DefaultMessageEditorContainer"
import type { SceneEditorContext, SceneEditorNodes } from "./types"
import useSharedProjectMode from "@/pages/superMagic/hooks/useSharedProjectMode"
import RecordingSummaryEditorModeSwitch from "@/components/business/RecordingSummary/components/EditorModeSwitch"
import RecordingSummaryEditorPanel from "@/components/business/RecordingSummary/EditorPanel"
import MobileComposer from "@/pages/superMagicMobile/pages/ChatPage/components/mobile-composer/MobileComposer"
import { useConversationInputLayout } from "@/pages/superMagic/components/ConversationInputResize/context"

interface RecordSummaryEditorContainerProps {
	editorContext?: SceneEditorContext
	editorNodes?: SceneEditorNodes
}

export default function RecordSummaryEditorContainer({
	editorContext,
	editorNodes,
}: RecordSummaryEditorContainerProps) {
	const isMobile = useIsMobile()
	const inputLayout = useConversationInputLayout()
	// Only resizable desktop conversations provide a fixed-height layout contract.
	const shouldFillHeight = Boolean(inputLayout?.fillHeight)
	const scopedTopicStore = editorContext?.topicStore ?? topicStore

	const selectedTopic =
		editorContext?.selectedTopic !== undefined
			? editorContext.selectedTopic
			: scopedTopicStore.selectedTopic
	const selectedProject =
		editorContext?.selectedProject !== undefined
			? editorContext.selectedProject
			: projectStore.selectedProject
	const selectedWorkspace =
		editorContext?.selectedWorkspace !== undefined
			? editorContext.selectedWorkspace
			: (workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace)
	const effectiveSetTopicMode = editorContext?.setTopicMode ?? roleStore.setCurrentRole

	useSharedProjectMode({ setTopicMode: effectiveSetTopicMode })

	const { editorMode: savedEditorMode, setEditorMode } = useRecordingSummaryEditorMode({
		selectedTopic,
		hasMessage: (editorContext?.messagesLength ?? 0) > 0,
	})
	// Detail conversations stay in text-editing mode regardless of the persisted recording preference.
	const editorMode =
		editorContext?.allowRecordingMode === false
			? RecordingSummaryEditorMode.Editing
			: savedEditorMode

	const editorSize = editorContext?.size ?? "default"

	// Hiding the switch also removes the only inline entry that could start a new recording.
	const editorModeSwitch =
		editorContext?.allowRecordingMode === false
			? undefined
			: (editorContext?.editorModeSwitch ??
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
				)))

	const tiptapEditorRef = useRef<MessageEditorRef | null>(null)

	useRecordSummaryAudioFile({
		editorMode,
		setEditorMode,
		tiptapEditorRef,
	})
	const recordingEditorNode = (
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
				modelSwitch={editorContext?.modelSwitch}
				attachments={editorContext?.attachments}
				beforeRecordingStart={editorContext?.beforeSend}
				recordingNewProjectTopicMode={editorContext?.recordingNewProjectTopicMode}
				allowSelectRecordingProject={editorContext?.allowSelectRecordingProject}
				taskDataNode={editorNodes?.taskDataNode}
				messageQueueNode={editorNodes?.messageQueueNode}
				fillHeight={shouldFillHeight}
			/>
		</Suspense>
	)

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
		editorRef: tiptapEditorRef,
	}

	return editorMode === RecordingSummaryEditorMode.Recording ? (
		shouldFillHeight ? (
			// Reserve space for the small-mode toolbar while the idle surface fills the remainder.
			<div className="flex h-full min-h-0 w-full flex-col">{recordingEditorNode}</div>
		) : (
			recordingEditorNode
		)
	) : isMobile ? (
		<MobileComposer editorContext={editingEditorContext} editorNodes={editorNodes} />
	) : (
		<DefaultMessageEditorContainer
			editorContext={editingEditorContext}
			editorNodes={editorNodes}
			editorRef={tiptapEditorRef}
		/>
	)
}
