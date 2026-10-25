import QueueDraftNotice from "@/pages/superMagic/components/MessagePanel/components/MessageQueue/QueueDraftNotice"
import { EditorContent } from "@/infrastructure/editors/tiptap/react"
import { ArrowUp, Check, Loader2, Plus, Square, X } from "lucide-react"
import { useDebounceFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { VoiceInputStatus } from "@/components/business/VoiceInput"
import type {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { useSceneSelection } from "@/pages/superMagic/components/MainInputContainer/hooks"
import { useCurrentSceneConfig } from "@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig"
import {
	sceneStateStore as globalSceneStateStore,
	useOptionalSceneStateStore,
} from "@/pages/superMagic/components/MainInputContainer/stores"
import SuperMagicVoiceInput from "@/pages/superMagic/components/MessageEditor/components/VoiceInput"
import { MessageEditorStoreProvider } from "@/pages/superMagic/components/MessageEditor/stores"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import { isVideoProductionContext } from "@/pages/superMagic/components/MainInputContainer/utils/videoProductionConfig"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import MobileComposerAddSheet from "./MobileComposerAddSheet"
import MobileComposerAttachments from "./MobileComposerAttachments"
import MobileComposerHeader from "./MobileComposerHeader"
import MobileVoiceEdgeGlow from "./MobileVoiceEdgeGlow"
import MobileScenePanels from "./MobileScenePanels"
import { getMobileComposerEditorClassName } from "./mobileComposerEditorClassName"
import useMobileComposerLogic from "./useMobileComposerLogic"
import { useInvalidTopicModeFallback } from "@/pages/superMagic/components/MessageEditor/hooks/useInvalidTopicModeFallback"
import EditorHost from "@/pages/superMagic/components/MessageEditor/components/WechatChatHistory/EditorHost"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface MobileComposerProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
	scenes?: SceneItem[]
	enableReEditMessageFromPubSub?: boolean
}

const MOBILE_VOICE_WAVEFORM_BAR_COUNT = 76
const MOBILE_VOICE_WAVEFORM_HEIGHT = 40
const MOBILE_VOICE_WAVEFORM_BAR_WIDTH = 2
const MOBILE_VOICE_WAVEFORM_BAR_GAP = 1
const MOBILE_VOICE_WAVEFORM_FADE_WIDTH = 20
const MOBILE_VOICE_WAVEFORM_SAMPLE_INTERVAL_MS = 44

const voiceRecordingWaveformClassName =
	"relative h-10 min-w-0 flex-1 overflow-hidden text-muted-foreground"

/** Build default waveform bar heights for the mobile voice recording UI. */
function createMobileVoiceWaveformLevels(): number[] {
	return Array.from({ length: MOBILE_VOICE_WAVEFORM_BAR_COUNT }, () => 0)
}

function normalizeMobileVoiceLevel(level: number): number {
	if (Number.isNaN(level) || !Number.isFinite(level)) return 0
	if (level <= 0.16) return 0
	if (level >= 1) return 1
	return (level - 0.16) / 0.84
}

/** Render animated waveform bars while the user is recording voice input. */
function MobileVoiceRecordingWaveform({ levels }: { levels: number[] }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const stateRef = useRef({
		amplitudes: [] as number[],
		latestLevel: normalizeMobileVoiceLevel(levels[levels.length - 1] ?? 0),
		scrollOffset: 0,
		lastFrameTime: 0,
		rafId: 0,
	})

	useEffect(() => {
		stateRef.current.latestLevel = normalizeMobileVoiceLevel(levels[levels.length - 1] ?? 0)
	}, [levels])

	useEffect(() => {
		const canvas = canvasRef.current
		const container = containerRef.current
		if (!canvas || !container) return

		const dpr = window.devicePixelRatio || 1
		const barPitch = MOBILE_VOICE_WAVEFORM_BAR_WIDTH + MOBILE_VOICE_WAVEFORM_BAR_GAP
		const pixelsPerMs = barPitch / MOBILE_VOICE_WAVEFORM_SAMPLE_INTERVAL_MS

		const resize = () => {
			const width = container.getBoundingClientRect().width
			canvas.width = Math.round(width * dpr)
			canvas.height = Math.round(MOBILE_VOICE_WAVEFORM_HEIGHT * dpr)
			canvas.style.width = `${width}px`
			canvas.style.height = `${MOBILE_VOICE_WAVEFORM_HEIGHT}px`

			// Keep enough silent bars buffered to cover the full canvas, avoiding an empty left edge.
			const maxBars = Math.ceil(width / barPitch) + 2
			const amplitudes = stateRef.current.amplitudes
			if (amplitudes.length < maxBars) {
				amplitudes.push(...new Array(maxBars - amplitudes.length).fill(0))
			}
			if (amplitudes.length > maxBars) amplitudes.length = maxBars
		}

		resize()
		const resizeObserver = new ResizeObserver(resize)
		resizeObserver.observe(container)

		const draw = (timestamp: number) => {
			const context = canvas.getContext("2d")
			if (!context) {
				stateRef.current.rafId = requestAnimationFrame(draw)
				return
			}

			const width = canvas.width
			const height = canvas.height
			const deltaTime = stateRef.current.lastFrameTime
				? Math.min(timestamp - stateRef.current.lastFrameTime, 100)
				: 16
			stateRef.current.lastFrameTime = timestamp
			stateRef.current.scrollOffset += pixelsPerMs * deltaTime

			const maxBars = Math.ceil(width / (barPitch * dpr)) + 2
			while (stateRef.current.scrollOffset >= barPitch) {
				stateRef.current.scrollOffset -= barPitch
				stateRef.current.amplitudes.unshift(stateRef.current.latestLevel)
				if (stateRef.current.amplitudes.length > maxBars) {
					stateRef.current.amplitudes.length = maxBars
				}
			}

			context.clearRect(0, 0, width, height)
			context.fillStyle = getComputedStyle(canvas).color

			const barPitchInPixels = barPitch * dpr
			const barWidthInPixels = MOBILE_VOICE_WAVEFORM_BAR_WIDTH * dpr
			const radius = barWidthInPixels / 2
			const newestRight = width - stateRef.current.scrollOffset * dpr

			for (let index = 0; index < stateRef.current.amplitudes.length; index += 1) {
				const barRight = newestRight - index * barPitchInPixels
				const barLeft = barRight - barWidthInPixels
				if (barLeft > width) continue
				if (barRight < 0) break

				const amplitude = stateRef.current.amplitudes[index]
				const barHeight = Math.max(2 * dpr, amplitude * height)
				const barTop = (height - barHeight) / 2

				context.beginPath()
				if (typeof context.roundRect === "function") {
					context.roundRect(barLeft, barTop, barWidthInPixels, barHeight, radius)
				} else {
					context.rect(barLeft, barTop, barWidthInPixels, barHeight)
				}
				context.fill()
			}

			stateRef.current.rafId = requestAnimationFrame(draw)
		}

		stateRef.current.rafId = requestAnimationFrame(draw)

		return () => {
			cancelAnimationFrame(stateRef.current.rafId)
			resizeObserver.disconnect()
		}
	}, [])

	return (
		<div
			ref={containerRef}
			className={voiceRecordingWaveformClassName}
			data-testid="mobile-composer-voice-waveform"
			aria-hidden
		>
			<canvas
				ref={canvasRef}
				className="block text-inherit"
				data-testid="mobile-composer-canvas"
			/>

			<div
				className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-card to-transparent"
				style={{ width: MOBILE_VOICE_WAVEFORM_FADE_WIDTH }}
				aria-hidden
			/>
			<div
				className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-card to-transparent"
				style={{ width: MOBILE_VOICE_WAVEFORM_FADE_WIDTH }}
				aria-hidden
			/>
		</div>
	)
}

function MobileComposerComponent({
	editorContext,
	editorNodes,
	scenes,
	enableReEditMessageFromPubSub = false,
}: MobileComposerProps) {
	const sceneStateStore = useOptionalSceneStateStore() ?? globalSceneStateStore
	const { isActive, InvalidModeFallback, onCreateTopic } =
		useInvalidTopicModeFallback(editorContext)
	const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
	const [isVoicePanelActive, setIsVoicePanelActive] = useState(false)
	const [isVoiceRecording, setIsVoiceRecording] = useState(false)
	const [isVoiceConfirming, setIsVoiceConfirming] = useState(false)
	const [voiceWaveformLevels, setVoiceWaveformLevels] = useState(createMobileVoiceWaveformLevels)
	const [voiceRecordingStartedAt, setVoiceRecordingStartedAt] = useState<number | null>(null)
	const [voiceRecordingElapsedSeconds, setVoiceRecordingElapsedSeconds] = useState(0)
	const voiceInputTextRef = useRef("")
	const isVoiceConfirmingRef = useRef(false)
	const voicePanelIdleTimerRef = useRef<number | null>(null)
	const logic = useMobileComposerLogic({
		editorContext,
		enableReEditMessageFromPubSub,
	})
	const wechatScrollRef = useRef<HTMLDivElement>(null)
	// Homepage defers project creation, but the recording expert still needs its text/recording switch.
	const isRecordSummaryMode =
		editorContext.topicMode === TopicMode.RecordSummary &&
		(!editorContext.deferProjectCreationUntilSend || editorContext.editorModeSwitch != null)
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
	const shouldShowInterrupt = logic.isTaskRunning && logic.store.editorStore.isEmpty
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
	const clearVoicePanelIdleTimer = useCallback(() => {
		if (!voicePanelIdleTimerRef.current) return

		window.clearTimeout(voicePanelIdleTimerRef.current)
		voicePanelIdleTimerRef.current = null
	}, [])
	const handleVoiceRecordingChange = useCallback(
		(nextIsRecording: boolean) => {
			setIsVoiceRecording(nextIsRecording)
			if (nextIsRecording) {
				clearVoicePanelIdleTimer()
				setIsVoicePanelActive(true)
				voiceInputTextRef.current = ""
				setVoiceWaveformLevels(createMobileVoiceWaveformLevels())
				setVoiceRecordingElapsedSeconds(0)
				setVoiceRecordingStartedAt(Date.now())
				return
			}

			setVoiceRecordingStartedAt(null)
		},
		[clearVoicePanelIdleTimer],
	)
	const handleVoiceStatusChange = useCallback(
		(nextStatus: VoiceInputStatus) => {
			if (
				nextStatus === "connecting" ||
				nextStatus === "recording" ||
				nextStatus === "processing"
			) {
				clearVoicePanelIdleTimer()
				setIsVoicePanelActive(true)
				return
			}

			if (nextStatus === "error") {
				clearVoicePanelIdleTimer()
				setIsVoicePanelActive(false)
				return
			}

			if (nextStatus !== "idle") return

			clearVoicePanelIdleTimer()
			voicePanelIdleTimerRef.current = window.setTimeout(() => {
				setIsVoicePanelActive(false)
				voicePanelIdleTimerRef.current = null
			}, 180)
		},
		[clearVoicePanelIdleTimer],
	)
	const handleDeferredVoiceTextChange = useCallback((nextText: string) => {
		voiceInputTextRef.current = nextText
	}, [])
	const appendVoiceTextToEditor = useCallback(
		(text: string) => {
			const normalizedText = text.trim()
			if (!normalizedText) return

			const editor = logic.tiptapEditor
			if (!editor || editor.isDestroyed) return

			const insertPosition = Math.max(1, editor.state.doc.content.size - 1)
			editor.chain().focus().insertContentAt(insertPosition, normalizedText).run()
			logic.store.editorStore.setValue(editor.getJSON())
		},
		[logic.store.editorStore, logic.tiptapEditor],
	)
	const handleCancelVoiceInput = useCallback(() => {
		logic.voiceInputRef.current?.disconnect()
		clearVoicePanelIdleTimer()
		setIsVoicePanelActive(false)
		setIsVoiceRecording(false)
		setIsVoiceConfirming(false)
		isVoiceConfirmingRef.current = false
		voiceInputTextRef.current = ""
		setVoiceWaveformLevels(createMobileVoiceWaveformLevels())
		setVoiceRecordingStartedAt(null)
		setVoiceRecordingElapsedSeconds(0)
	}, [clearVoicePanelIdleTimer, logic.voiceInputRef])
	const handleConfirmVoiceInput = useCallback(async () => {
		if (isVoiceConfirmingRef.current) return

		isVoiceConfirmingRef.current = true
		setIsVoiceConfirming(true)
		try {
			await logic.voiceInputRef.current?.stopRecording()
			appendVoiceTextToEditor(voiceInputTextRef.current)
		} finally {
			clearVoicePanelIdleTimer()
			setIsVoicePanelActive(false)
			setIsVoiceRecording(false)
			isVoiceConfirmingRef.current = false
			setIsVoiceConfirming(false)
			voiceInputTextRef.current = ""
			setVoiceWaveformLevels(createMobileVoiceWaveformLevels())
			setVoiceRecordingStartedAt(null)
			setVoiceRecordingElapsedSeconds(0)
		}
	}, [appendVoiceTextToEditor, clearVoicePanelIdleTimer, logic.voiceInputRef])
	const formattedVoiceRecordingTime = useMemo(() => {
		const minutes = Math.floor(voiceRecordingElapsedSeconds / 60)
		const seconds = voiceRecordingElapsedSeconds % 60
		return `${minutes}:${seconds.toString().padStart(2, "0")}`
	}, [voiceRecordingElapsedSeconds])
	const isVoiceInputInitializing = isVoicePanelActive && !isVoiceRecording
	const shouldShowVoiceRecordingUi = isVoicePanelActive || isVoiceRecording
	const currentVoiceEdgeGlowLevel = normalizeMobileVoiceLevel(
		voiceWaveformLevels[voiceWaveformLevels.length - 1] ?? 0,
	)

	useEffect(() => {
		if (!voiceRecordingStartedAt) return

		const timerId = window.setInterval(() => {
			setVoiceRecordingElapsedSeconds(
				Math.max(0, Math.floor((Date.now() - voiceRecordingStartedAt) / 1000)),
			)
		}, 250)

		return () => window.clearInterval(timerId)
	}, [voiceRecordingStartedAt])

	useEffect(() => {
		return () => {
			clearVoicePanelIdleTimer()
		}
	}, [clearVoicePanelIdleTimer])

	const taskAndQueueNodes = (
		<div className="flex flex-col gap-2 [&:empty]:hidden">
			{editorNodes?.taskDataNode}
			{editorNodes?.messageQueueNode}
		</div>
	)
	const voiceInputNode = (
		<SuperMagicVoiceInput
			ref={logic.voiceInputRef}
			initValue={logic.store.editorStore.value}
			tiptapEditor={logic.tiptapEditor}
			updateValue={logic.store.editorStore.setValue}
			iconSize={24}
			className="size-10 !bg-transparent"
			commitMode="deferred"
			onStatusChange={handleVoiceStatusChange}
			onRecordingChange={handleVoiceRecordingChange}
			onDeferredTextChange={handleDeferredVoiceTextChange}
			onWaveformLevelsChange={setVoiceWaveformLevels}
			waveformBarCount={MOBILE_VOICE_WAVEFORM_BAR_COUNT}
		/>
	)
	const voiceRecordingContent = (
		<div
			className="flex h-10 w-full shrink-0 items-center gap-2 px-3"
			data-testid="mobile-composer-voice-recording"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-10 shrink-0 rounded-full border border-border bg-transparent text-foreground shadow-none ring-offset-2 transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-foreground/20"
				onClick={handleCancelVoiceInput}
				aria-label="cancel voice input"
				data-testid="mobile-composer-cancel-voice-button"
			>
				<X className="size-6" strokeWidth={1.5} />
			</Button>

			{isVoiceInputInitializing ? (
				<div
					className="flex min-w-0 flex-1 items-center justify-center"
					data-testid="mobile-composer-voice-connecting-loading"
				>
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					<MobileVoiceRecordingWaveform levels={voiceWaveformLevels} />

					<span
						className="shrink-0 text-[13px] tabular-nums leading-4 text-muted-foreground"
						data-testid="mobile-composer-voice-recording-time"
					>
						{formattedVoiceRecordingTime}
					</span>
				</>
			)}

			<Button
				type="button"
				size="icon"
				className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-none ring-offset-2 transition-opacity focus-visible:ring-2 focus-visible:ring-foreground/25 disabled:pointer-events-none disabled:opacity-40"
				onClick={handleConfirmVoiceInput}
				disabled={isVoiceInputInitializing || isVoiceConfirming}
				aria-label="confirm voice input"
				data-testid="mobile-composer-confirm-voice-button"
			>
				{isVoiceConfirming ? (
					<Loader2 className="size-5 animate-spin" />
				) : (
					<Check className="size-6" strokeWidth={2} />
				)}
			</Button>
		</div>
	)
	const shouldShowVideoProductionConfigInHeader = isVideoProductionContext({
		topicMode: editorContext.topicMode,
		agentCode: editorContext.agentCode,
		selectedTopic: editorContext.selectedTopic,
	})
	const headerScenePanelsNode =
		shouldRenderPanelsInHeader || shouldShowVideoProductionConfigInHeader ? (
			<MobileScenePanels
				editorContext={editorContext}
				compact
				renderScenePanels={shouldRenderPanelsInHeader}
				includeVideoProductionConfig
			/>
		) : null

	const composerInnerContent = (
		<div
			className={cn("relative", logic.wechatChat.activeId && "flex h-full min-h-0 flex-col")}
			data-queue-editor-surface
		>
			<div
				className={cn(
					logic.wechatChat.activeId && "flex min-h-0 flex-1 flex-col",
					shouldShowVoiceRecordingUi &&
						"pointer-events-none absolute inset-x-0 top-0 opacity-0",
				)}
				aria-hidden={shouldShowVoiceRecordingUi}
			>
				<MobileComposerAttachments
					files={files}
					onRemove={logic.handleRemoveUploadedFile}
				/>
				<div className="px-4 [&:empty]:hidden">
					<QueueDraftNotice context={editorContext.queueContext} variant="warning" />
				</div>

				<div
					className={cn(
						"px-4 pb-1.5 pt-3",
						logic.wechatChat.activeId && "flex min-h-0 flex-1 flex-col",
					)}
					onPasteCapture={logic.handlePaste}
					onCompositionStart={logic.handleCompositionStart}
					onCompositionEnd={logic.handleCompositionEnd}
					data-testid="handle-paste"
				>
					<ScrollArea
						className={cn(
							logic.wechatChat.activeId ? "min-h-0 flex-1" : "max-h-[100px]",
						)}
						viewportRef={wechatScrollRef}
						viewportClassName={logic.wechatChat.activeId ? "h-full" : "max-h-[100px]"}
					>
						<div
							ref={logic.domRef}
							className={cn(
								getMobileComposerEditorClassName(logic.placeholder),
								"max-h-none [&_.ProseMirror]:max-h-none [&_.ProseMirror]:overflow-visible",
								logic.wechatChat.activeId && "[&_.ProseMirror>p]:hidden",
							)}
							data-testid="mobile-composer-editor"
						>
							<EditorContent editor={logic.tiptapEditor} />
						</div>
					</ScrollArea>
				</div>

				<div className="flex items-center justify-between gap-2 pb-2 pl-1.5 pr-2">
					<div className="flex min-w-0 items-center">
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
						<QueueDraftNotice context={editorContext.queueContext} compact />
					</div>

					<div className="flex shrink-0 items-center gap-1">
						{editorModeSwitchNode}
						{logic.voiceInputEnabled && voiceInputNode}

						<Button
							type="button"
							size="icon"
							className={cn(
								"size-10 rounded-full bg-primary text-background shadow-none",
								sendButtonDisabled && "disabled:opacity-40",
							)}
							disabled={sendButtonDisabled || logic.wechatChat.activeId !== null}
							onClick={handleActionClick}
							aria-label={shouldShowInterrupt ? "interrupt task" : "send message"}
							data-testid="mobile-composer-send-button"
						>
							{shouldShowInterrupt ? (
								<Square className="size-4 fill-current" />
							) : logic.isPreparingSend ? (
								<Loader2 className="size-6 animate-spin" />
							) : (
								<ArrowUp className="size-6" />
							)}
						</Button>
					</div>
				</div>
			</div>
			{shouldShowVoiceRecordingUi && (
				<div className="flex items-center py-2">{voiceRecordingContent}</div>
			)}
		</div>
	)
	const composerEditor = (
		<EditorHost
			editor={logic.tiptapEditor}
			controller={logic.wechatChat}
			fileUploadStore={logic.store.fileUploadStore}
			scrollRef={wechatScrollRef}
		>
			{composerInnerContent}
		</EditorHost>
	)

	const content = isRecordSummaryMode ? (
		<>
			{taskAndQueueNodes}
			{composerEditor}
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
			className="flex w-full shrink-0 flex-col gap-1.5 bg-mobile-background px-2 pb-3 pt-1.5"
			data-testid="mobile-composer"
		>
			{taskAndQueueNodes}

			<MobileComposerHeader
				scenes={effectiveScenes}
				selectedTopic={logic.selectedTopic}
				selectedProject={logic.selectedProject}
				topicMode={editorContext.modelTopicMode ?? logic.effectiveTopicMode}
				agentCode={editorContext.agentCode ?? logic.selectedTopic?.agent_code}
				selectorVariant={editorContext.mobileModeSelectorVariant}
				showModeSelector={editorContext.showModeToggle ?? true}
				showModelSelector={editorContext.showModelSelector ?? false}
				messagesLength={editorContext.messagesLength}
				useChatTerminology={editorContext.useChatTerminology}
				sceneControlNode={headerScenePanelsNode}
				onModeChange={editorContext.setTopicMode}
			/>

			<div
				className={cn(
					"overflow-hidden rounded-3xl bg-card shadow-mobile-dock-surface transition-colors",
					logic.isComposerFocused && "ring-1 ring-primary/20",
				)}
				data-testid="mobile-composer-card"
			>
				<div className="border-b border-border px-3 pb-2 pt-2 [&:empty]:hidden">
					<MobileScenePanels
						editorContext={editorContext}
						renderScenePanels={!shouldRenderPanelsInHeader}
					/>
				</div>
				{composerEditor}
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

	if (isActive && InvalidModeFallback) {
		return (
			<div
				className="flex w-full shrink-0 flex-col gap-1.5 bg-mobile-background px-2 pb-3 pt-1.5"
				data-testid="mobile-composer"
			>
				{taskAndQueueNodes}
				<div className="overflow-hidden rounded-3xl bg-card px-4 py-6 shadow-mobile-dock-surface">
					<InvalidModeFallback onCreateTopic={onCreateTopic} />
				</div>
			</div>
		)
	}

	return (
		<MessageEditorStoreProvider store={logic.store}>
			<MobileVoiceEdgeGlow
				active={shouldShowVoiceRecordingUi}
				audioLevel={currentVoiceEdgeGlowLevel}
			/>
			{content}
		</MessageEditorStoreProvider>
	)
}

const MobileComposer = observer(MobileComposerComponent)

export default MobileComposer
