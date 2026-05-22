import { EditorContent } from "@tiptap/react"
import { ArrowUp, Loader2, Plus, Square } from "lucide-react"
import { useDebounceFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useMemo, useState } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { MessageEditorStoreProvider } from "@/pages/superMagic/components/MessageEditor/stores"
import SuperMagicVoiceInput from "@/pages/superMagic/components/MessageEditor/components/VoiceInput"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import { useSceneSelection } from "@/pages/superMagic/components/MainInputContainer/hooks"
import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import { sceneStateStore } from "@/pages/superMagic/components/MainInputContainer/stores"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import MobileComposerAddSheet from "./MobileComposerAddSheet"
import MobileComposerAttachments from "./MobileComposerAttachments"
import MobileComposerHeader from "./MobileComposerHeader"
import MobileScenePanels from "./MobileScenePanels"
import useMobileComposerLogic from "./useMobileComposerLogic"

interface MobileComposerProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	scenes?: SceneItem[]
	enableReEditMessageFromPubSub?: boolean
}

const mobileComposerEditorClassName = cn(
	"max-h-[100px] min-h-0 overflow-hidden text-sm text-foreground",
	"[&_.ProseMirror]:m-0 [&_.ProseMirror]:max-h-[100px] [&_.ProseMirror]:overflow-y-auto",
	"[&_.ProseMirror]:break-words [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none",
	"[&_.ProseMirror_p]:m-0 [&_.ProseMirror_p]:break-all [&_.ProseMirror_p]:p-0",
	"[&_.ProseMirror_.is-editor-empty:first-child]:relative",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:absolute",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:left-0",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:top-0",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:block",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:max-w-full",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:overflow-hidden",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:whitespace-nowrap",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:text-ellipsis",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground",
	"[&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
)

function MobileComposerComponent({
	editorContext,
	editorNodes,
	scenes,
	enableReEditMessageFromPubSub = false,
}: MobileComposerProps) {
	const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
	const logic = useMobileComposerLogic({
		editorContext,
		enableReEditMessageFromPubSub,
	})
	const isRecordSummaryMode = editorContext.topicMode === TopicMode.RecordSummary
	const effectiveScenes =
		scenes ??
		superMagicModeService.getModeConfigWithLegacy(
			logic.effectiveTopicMode,
			undefined,
			false,
			editorContext.agentCode ?? logic.selectedTopic?.agent_code,
		)?.mode.playbooks
	const { hasOnlyScene } = useSceneSelection({
		scenes: effectiveScenes,
		sceneStateStore,
	})
	const { panels: currentScenePanels, isLoading: isScenePanelLoading } = useCurrentSceneConfig({
		topicMode: editorContext.topicMode,
	})
	const hasScenePanels = isScenePanelLoading || currentScenePanels.length > 0
	const shouldRenderPanelsInHeader = hasOnlyScene || (!effectiveScenes?.length && hasScenePanels)

	const files = logic.store.fileUploadStore.files
	const shouldShowInterrupt = logic.isTaskRunning
	const editorModeSwitchNode = isRecordSummaryMode
		? (editorContext.editorModeSwitch?.({ disabled: false }) ?? null)
		: null
	const sendButtonDisabled = useMemo(() => {
		if (shouldShowInterrupt) return false
		if (logic.isPreparingSend) return true
		if (!logic.store.fileUploadStore.isAllFilesUploaded) return true
		if (logic.showLoading) return false
		return logic.store.editorStore.isEmpty
	}, [
		logic.isPreparingSend,
		logic.showLoading,
		logic.store.editorStore.isEmpty,
		logic.store.fileUploadStore.isAllFilesUploaded,
		shouldShowInterrupt,
	])
	const { run: handleActionClick } = useDebounceFn(
		() => {
			if (shouldShowInterrupt) {
				logic.handleInterrupt()
				return
			}

			logic.handleSend()
		},
		{
			wait: 300,
			leading: true,
			trailing: false,
		},
	)

	const taskAndQueueNodes = (
		<div className="flex flex-col gap-2 [&:empty]:hidden">
			{editorNodes?.taskDataNode}
			{editorNodes?.messageQueueNode}
		</div>
	)
	const headerScenePanelsNode = shouldRenderPanelsInHeader ? (
		<MobileScenePanels editorContext={editorContext} compact />
	) : null

	const composerInnerContent = (
		<>
			<MobileComposerAttachments files={files} onRemove={logic.handleRemoveUploadedFile} />

			<div
				className="px-3 pb-1.5 pt-2"
				onPaste={logic.handlePaste}
				onCompositionStart={logic.handleCompositionStart}
				onCompositionEnd={logic.handleCompositionEnd}
			>
				<div
					ref={logic.domRef}
					className={mobileComposerEditorClassName}
					data-testid="mobile-composer-editor"
				>
					<EditorContent editor={logic.tiptapEditor} />
				</div>
			</div>

			<div className="flex items-center justify-between gap-2 px-1.5 py-1">
				<div className="flex items-center">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-10 rounded-none bg-transparent p-0 shadow-none hover:bg-transparent"
						onClick={() => setIsAddSheetOpen(true)}
						aria-label="open more tools"
						data-testid="mobile-composer-open-sheet-button"
					>
						<Plus className="size-6" />
					</Button>
					{logic.selectedPluginCount > 0 && (
						<span
							className={cn(
								"flex h-6 shrink-0 items-center justify-center rounded-full bg-foreground px-2 text-sm font-semibold leading-none text-background",
								logic.selectedPluginCount < 10 && "w-6 px-0",
							)}
							data-testid="mobile-composer-open-sheet-plugin-count"
						>
							{logic.selectedPluginCount}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1">
					{editorModeSwitchNode}
					{logic.voiceInputEnabled && (
						<SuperMagicVoiceInput
							ref={logic.voiceInputRef}
							initValue={logic.store.editorStore.value}
							tiptapEditor={logic.tiptapEditor}
							updateValue={logic.store.editorStore.setValue}
							iconSize={24}
							className="size-10 !bg-transparent"
						/>
					)}

					<Button
						type="button"
						size="icon"
						className={cn(
							"size-10 rounded-full bg-primary text-background shadow-none",
							sendButtonDisabled && "opacity-60",
						)}
						disabled={sendButtonDisabled}
						onClick={handleActionClick}
						aria-label={shouldShowInterrupt ? "interrupt task" : "send message"}
						data-testid="mobile-composer-send-button"
					>
						{shouldShowInterrupt ? (
							<Square className="size-4 fill-current" />
						) : logic.isPreparingSend || logic.showLoading ? (
							<Loader2 className="size-6 animate-spin" />
						) : (
							<ArrowUp className="size-6" />
						)}
					</Button>
				</div>
			</div>
		</>
	)

	const content = isRecordSummaryMode ? (
		<>
			{taskAndQueueNodes}
			{composerInnerContent}
			<MobileComposerAddSheet
				open={isAddSheetOpen}
				onOpenChange={setIsAddSheetOpen}
				selectedTopic={logic.selectedTopic}
				selectedProject={logic.selectedProject}
				mentionPanelStore={logic.mentionPanelStore}
				onSelectMention={logic.handleSelectMentionItem}
				onAfterMentionSelect={logic.focusComposerEditor}
				onFileUpload={logic.handleFileUploadClick}
				mcpStorageKey={logic.mcpStorageKey}
				useTempStorage={logic.mcpUseTempStorage}
				modules={editorContext.modules}
			/>

			{logic.uploadModal}
		</>
	) : (
		<div
			className="flex w-full shrink-0 flex-col gap-1.5 px-2 pb-1.5 pt-1.5"
			data-testid="mobile-composer"
		>
			{taskAndQueueNodes}

			<MobileComposerHeader
				scenes={effectiveScenes}
				selectedTopic={logic.selectedTopic}
				selectedProject={logic.selectedProject}
				topicMode={logic.effectiveTopicMode}
				agentCode={editorContext.agentCode ?? logic.selectedTopic?.agent_code}
				selectorVariant={editorContext.mobileModeSelectorVariant}
				messagesLength={editorContext.messagesLength}
				sceneControlNode={headerScenePanelsNode}
				onModeChange={editorContext.setTopicMode}
			/>

			<div
				className={cn(
					"overflow-hidden rounded-2xl bg-background shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-colors",
					logic.isComposerFocused && "ring-1 ring-primary/20",
				)}
				data-testid="mobile-composer-card"
			>
				<div className="border-b border-border px-3 pb-2 pt-2 [&:empty]:hidden">
					{shouldRenderPanelsInHeader ? null : (
						<MobileScenePanels editorContext={editorContext} />
					)}
				</div>
				{composerInnerContent}
			</div>

			<MobileComposerAddSheet
				open={isAddSheetOpen}
				onOpenChange={setIsAddSheetOpen}
				selectedTopic={logic.selectedTopic}
				selectedProject={logic.selectedProject}
				mentionPanelStore={logic.mentionPanelStore}
				onSelectMention={logic.handleSelectMentionItem}
				onAfterMentionSelect={logic.focusComposerEditor}
				onFileUpload={logic.handleFileUploadClick}
				mcpStorageKey={logic.mcpStorageKey}
				useTempStorage={logic.mcpUseTempStorage}
				modules={editorContext.modules}
			/>

			{logic.uploadModal}
		</div>
	)

	return <MessageEditorStoreProvider store={logic.store}>{content}</MessageEditorStoreProvider>
}

const MobileComposer = observer(MobileComposerComponent)

export default MobileComposer
