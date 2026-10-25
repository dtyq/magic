import type { ChangeEvent, ComponentType, ReactNode } from "react"
import {
	Camera,
	Check,
	ChevronLeft,
	FileAudio,
	Loader2,
	MicVocal,
	Pencil,
	Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { formatRecordingDuration } from "@/pages/superMagic/pages/AudioRecordings/utils/audio-recordings-utils"
import EditorBody from "@/pages/superMagic/components/Detail/contents/Md/components/EditorBody"
import type { SimpleEditorRef } from "@/components/tiptap-templates/simple/types"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { ProjectImageUrlResolver } from "@/components/tiptap-node/project-image-node/project-image-node-extension"

import { LiveAudioWaveform } from "./LiveAudioWaveform"
import MagicPopup from "@/components/base-mobile/MagicPopup"

type TranscriptMessage = VoiceResultUtterance & { add_time: number; id: string }

interface MobileRecordingSessionPageProps {
	title: string
	duration: string
	isPaused: boolean
	isBusy: boolean
	startupState?: "idle" | "starting" | "error"
	startupErrorMessage?: string
	startupErrorDetail?: string
	transcriptMessages: TranscriptMessage[]
	noteContent: string
	transcriptionEnabled: boolean
	isEnablingTranscription: boolean
	onBack: () => void
	onPause: () => void
	onResume: () => void
	onRetryStart?: () => void
	onFinish: () => void
	onCancel: () => void
	onRenameTitle?: (title: string) => Promise<boolean>
	onNoteChange: (content: string) => void
	selectedProject?: ProjectListItem | null
	currentDocumentPath?: string
	folderPath?: string
	urlResolver?: ProjectImageUrlResolver
	resolveImagesFolderParentId?: (folderPath: string) => Promise<string | undefined>
	requireImagesFolderParentId?: boolean
	onImageUploadSuccess?: (relativePath: string) => void
	onImageUploadError?: (error: Error) => void
	onEnableTranscription: () => void
	WaveformComponent: ComponentType<{ isRecording: boolean; isPaused: boolean }>
	MessageListComponent: ComponentType<{
		message: TranscriptMessage[]
		isExpanded: boolean
		className?: string
		mobile?: boolean
	}>
	aiChat?: ReactNode
}

type RecordingTopTab = "transcript" | "notes"

function parseHmsDurationToSeconds(duration: string): number {
	const segments = duration.split(":")
	if (segments.length !== 3) return 0

	const [hoursPart, minutesPart, secondsPart] = segments
	const hours = Number(hoursPart)
	const minutes = Number(minutesPart)
	const seconds = Number(secondsPart)

	if (
		!Number.isFinite(hours) ||
		!Number.isFinite(minutes) ||
		!Number.isFinite(seconds) ||
		hours < 0 ||
		minutes < 0 ||
		seconds < 0
	) {
		return 0
	}

	return hours * 3600 + minutes * 60 + seconds
}

/**
 * Renders the full-screen mobile recording experience that mirrors the prototype
 * while still reading transcript, duration, and notes from the shared runtime.
 */
export function MobileRecordingSessionPage({
	title,
	duration,
	isPaused,
	isBusy,
	startupState = "idle",
	startupErrorMessage = "",
	startupErrorDetail = "",
	transcriptMessages,
	noteContent,
	transcriptionEnabled,
	isEnablingTranscription,
	onBack,
	onPause,
	onResume,
	onRetryStart,
	onFinish,
	onRenameTitle,
	onNoteChange,
	selectedProject,
	currentDocumentPath,
	folderPath,
	urlResolver,
	resolveImagesFolderParentId,
	requireImagesFolderParentId,
	onImageUploadSuccess,
	onImageUploadError,
	onEnableTranscription,
	MessageListComponent,
	aiChat,
}: MobileRecordingSessionPageProps) {
	const { t } = useTranslation("super")
	const [activeTab, setActiveTab] = useState<RecordingTopTab>("transcript")
	const [isEditingTitle, setIsEditingTitle] = useState(false)
	const [draftTitle, setDraftTitle] = useState(title)
	const [isSavingTitle, setIsSavingTitle] = useState(false)
	const [isAiChatOpen, setIsAiChatOpen] = useState(false)
	const [isCameraUploadPending, setIsCameraUploadPending] = useState(false)
	const titleInputRef = useRef<HTMLInputElement>(null)
	const cameraInputRef = useRef<HTMLInputElement>(null)
	const editorRef = useRef<SimpleEditorRef>(null)
	const shouldInsertCameraAtEndRef = useRef(false)

	/**
	 * Opens the native camera input and moves the user to the note editor first.
	 * The synchronous click keeps the browser user-activation required by mobile
	 * camera capture while the state update makes the insertion target explicit.
	 */
	function handleCameraPointerDown() {
		if (isCameraUploadPending || isStarting || isBusy || !selectedProject?.id) return
		// Capture focus before opening the native camera because the camera input will
		// blur the editor; an unfocused editor should insert the photo at note end.
		const editor = editorRef.current?.editor
		shouldInsertCameraAtEndRef.current = activeTab !== "notes" || !editor?.isFocused
	}

	function handleCameraClick() {
		if (isCameraUploadPending || isStarting || isBusy || !selectedProject?.id) return
		setActiveTab("notes")
		cameraInputRef.current?.click()
	}

	/**
	 * Inserts the captured file through the same Tiptap project-image command used
	 * by PC notes, preserving project storage and Markdown serialization behavior.
	 */
	function handleCameraFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]
		event.target.value = ""
		if (!file || !editorRef.current?.editor) return

		setIsCameraUploadPending(true)
		if (shouldInsertCameraAtEndRef.current) {
			editorRef.current.editor.commands.focus("end")
			shouldInsertCameraAtEndRef.current = false
		}
		// The command is supplied by SaveImageToProjectExtension; the declaration is
		// augmented in the shared Tiptap image extension module.
		editorRef.current.editor.commands.insertProjectImageFromFile?.(file)
	}

	/**
	 * Resets the editable title draft whenever a new shared session/project title
	 * arrives from the runtime so the input always reflects the latest source data.
	 */
	useEffect(() => {
		setDraftTitle(title)
	}, [title])

	/**
	 * Focuses the title input after entering edit mode to keep the rename flow
	 * aligned with the mobile prototype's inline editing interaction.
	 */
	useEffect(() => {
		if (!isEditingTitle) return
		requestAnimationFrame(() => {
			titleInputRef.current?.focus()
			titleInputRef.current?.select()
		})
	}, [isEditingTitle])

	/**
	 * Presents a stable title even before the runtime has created a project name.
	 */
	const resolvedTitle = useMemo(() => {
		if (draftTitle.trim()) return draftTitle.trim()
		return t("mobile.recordingEntry.active.defaultTitle")
	}, [draftTitle, t])

	/**
	 * Reuses the shared recording formatter to keep mobile live-session time
	 * aligned with card/list duration rules (mm:ss under 1h, h:mm:ss at 1h+).
	 */
	const formattedDuration = useMemo(() => {
		return formatRecordingDuration(parseHmsDurationToSeconds(duration))
	}, [duration])

	const isStarting = startupState === "starting"
	const hasStartupError = startupState === "error"

	async function handleTitleCommit() {
		const trimmedTitle = draftTitle.trim()
		if (!trimmedTitle || trimmedTitle === title.trim()) {
			setDraftTitle(title)
			setIsEditingTitle(false)
			return
		}

		if (!onRenameTitle) {
			setDraftTitle(title)
			setIsEditingTitle(false)
			return
		}

		setIsSavingTitle(true)
		try {
			const success = await onRenameTitle(trimmedTitle)
			if (!success) {
				setDraftTitle(title)
			}
		} finally {
			setIsSavingTitle(false)
			setIsEditingTitle(false)
		}
	}

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-mobile-background"
			data-testid="mobile-recording-session-page"
		>
			<div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
				<button
					type="button"
					onClick={onBack}
					className="flex size-11 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70"
					aria-label={t("mobile.recordingEntry.active.backAria")}
					data-testid="mobile-recording-session-back"
				>
					<ChevronLeft className="size-[22px] !stroke-2 text-foreground" />
				</button>

				<div className="flex min-w-0 flex-1 items-center justify-center gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<span
							className={`inline-block size-1.5 shrink-0 rounded-full ${
								isPaused ? "bg-muted-foreground/60" : "bg-[#ef4444]"
							}`}
							style={{
								animation: isPaused
									? undefined
									: "rec-pulse 1.4s ease-in-out infinite",
							}}
							aria-hidden
						/>
						<span
							className={`min-w-0 truncate text-[16px] font-medium leading-5 ${
								isPaused ? "text-muted-foreground/80" : "text-foreground"
							}`}
						>
							{isPaused
								? t("mobile.recordingEntry.active.statusPaused")
								: t("mobile.recordingEntry.active.statusRecording")}
						</span>
					</div>

					<div className="w-[40px] min-w-0 shrink-0" aria-hidden>
						<LiveAudioWaveform
							active={!isPaused}
							height={18}
							barWidth={2}
							barGap={2}
							sampleIntervalMs={60}
							fadeWidth={16}
							fadeColor="mobile-background"
						/>
					</div>

					<span className="shrink-0 text-[16px] font-medium tabular-nums leading-5 text-foreground">
						{formattedDuration}
					</span>
				</div>

				<button
					type="button"
					onClick={onFinish}
					disabled={isBusy}
					className="flex size-11 items-center justify-center rounded-full bg-foreground text-background transition-opacity active:opacity-80 disabled:opacity-50"
					aria-label={t("mobile.recordingEntry.active.finishAria")}
					data-testid="mobile-recording-session-finish"
				>
					<Check className="size-[22px] !stroke-2" />
				</button>
			</div>

			<div className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3 pt-2">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
					<FileAudio className="size-5 text-muted-foreground" strokeWidth={1.8} />
				</span>

				{isEditingTitle ? (
					<input
						ref={titleInputRef}
						value={draftTitle}
						onChange={(event) => setDraftTitle(event.target.value)}
						onBlur={() => {
							void handleTitleCommit()
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault()
								void handleTitleCommit()
							}
							if (event.key === "Escape") {
								event.preventDefault()
								setDraftTitle(title)
								setIsEditingTitle(false)
							}
						}}
						disabled={isSavingTitle}
						className="min-w-0 flex-1 bg-transparent text-[17px] font-medium leading-6 text-foreground outline-none"
						data-testid="mobile-recording-session-title-input"
					/>
				) : (
					<span className="min-w-0 flex-1 truncate text-[17px] font-medium leading-6 text-foreground">
						{resolvedTitle}
					</span>
				)}

				<button
					type="button"
					onClick={() => setIsEditingTitle(true)}
					disabled={isBusy || isSavingTitle}
					className="flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity active:opacity-70"
					aria-label={t("mobile.recordingEntry.active.renameAria")}
					data-testid="mobile-recording-session-title-edit"
				>
					<Pencil className="size-[18px] text-muted-foreground" strokeWidth={1.8} />
				</button>
			</div>

			<div className="flex shrink-0 gap-2 px-4 py-3">
				<button
					type="button"
					onClick={() => setActiveTab("transcript")}
					className={`rounded-full px-4 py-2 text-[14px] font-medium leading-5 transition-all duration-200 ${
						activeTab === "transcript"
							? "bg-foreground text-background shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
							: "bg-transparent text-muted-foreground"
					}`}
					data-testid="mobile-recording-tab-transcript"
				>
					{t("mobile.recordingEntry.active.tabTranscript")}
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("notes")}
					className={`rounded-full px-4 py-2 text-[14px] font-medium leading-5 transition-all duration-200 ${
						activeTab === "notes"
							? "bg-foreground text-background shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
							: "bg-transparent text-muted-foreground"
					}`}
					data-testid="mobile-recording-tab-notes"
				>
					{t("mobile.recordingEntry.active.tabNotes")}
				</button>
			</div>

			<div className="min-h-0 flex-1">
				<div className="flex h-full min-h-0 flex-col overflow-hidden bg-mobile-background">
					<div className="min-h-0 flex-1">
						{isStarting ? (
							<div
								className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
								data-testid="mobile-recording-session-starting"
							>
								<div className="text-[16px] font-medium leading-6 text-foreground">
									{t("mobile.recordingEntry.active.starting")}
								</div>
								<div className="text-[13px] leading-5 text-muted-foreground">
									{t("mobile.recordingEntry.active.startingHint")}
								</div>
							</div>
						) : hasStartupError ? (
							<div
								className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
								data-testid="mobile-recording-session-start-error"
							>
								<div className="text-[16px] font-medium leading-6 text-foreground">
									{t("mobile.recordingEntry.active.startFailedTitle")}
								</div>
								<div className="text-[13px] leading-5 text-muted-foreground">
									{startupErrorMessage ||
										t("mobile.recordingEntry.active.startFailed")}
								</div>
								{startupErrorDetail ? (
									<div className="max-w-[280px] break-words text-[12px] leading-5 text-muted-foreground/80">
										{startupErrorDetail}
									</div>
								) : null}
							</div>
						) : activeTab === "transcript" ? (
							transcriptionEnabled ? (
								<MessageListComponent
									message={transcriptMessages}
									isExpanded
									className="h-full"
									mobile
								/>
							) : (
								<TranscriptionDisabledState
									loading={isEnablingTranscription}
									onEnable={onEnableTranscription}
								/>
							)
						) : (
							<div className="flex h-full flex-col px-4 py-4">
								<EditorBody
									isLoading={false}
									viewMode="phone"
									content={noteContent}
									processedContent={noteContent}
									isEditMode
									editContent={noteContent}
									setEditContent={onNoteChange}
									selectedProject={selectedProject}
									currentDocumentPath={currentDocumentPath}
									folderPath={folderPath}
									urlResolver={urlResolver}
									onImageUploadSuccess={(relativePath) => {
										setIsCameraUploadPending(false)
										onImageUploadSuccess?.(relativePath)
									}}
									onImageUploadError={(error) => {
										setIsCameraUploadPending(false)
										onImageUploadError?.(error)
									}}
									resolveImagesFolderParentId={resolveImagesFolderParentId}
									requireImagesFolderParentId={requireImagesFolderParentId}
									editorRef={editorRef}
									placeholder={t("mobile.recordingEntry.active.notesPlaceholder")}
									className="min-h-0 flex-1 overflow-y-auto bg-mobile-background text-[15px] leading-6 text-foreground [&_.simple-editor-content]:!bg-mobile-background [&_.simple-editor-wrapper]:!bg-mobile-background [&_.simple-editor]:!bg-mobile-background [&_.tiptap-toolbar]:!bg-mobile-background"
									data-testid="mobile-recording-session-notes"
								/>
							</div>
						)}
					</div>
				</div>
				<input
					ref={cameraInputRef}
					type="file"
					accept="image/*"
					capture="environment"
					onChange={handleCameraFileChange}
					className="hidden"
					aria-hidden="true"
					data-testid="mobile-recording-session-camera-input"
				/>
			</div>

			<div className="grid min-h-[92px] shrink-0 grid-cols-3 items-center px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
				<button
					type="button"
					onClick={() => setIsAiChatOpen(true)}
					className="flex min-w-[76px] flex-col items-center gap-1 justify-self-center text-[13px] text-foreground transition-opacity active:opacity-70"
					data-testid="mobile-recording-session-ask-ai"
				>
					<Sparkles className="size-6 !stroke-2 text-muted-foreground" />
					<span>{t("mobile.recordingEntry.active.askAi")}</span>
				</button>
				{/* Keep the control slot height stable while pause and resume buttons swap shapes. */}
				<div
					className="flex h-[68px] items-center justify-center"
					data-testid="mobile-recording-session-control-slot"
				>
					{hasStartupError ? (
						<button
							type="button"
							onClick={onRetryStart}
							disabled={isBusy}
							className="rounded-full bg-card px-8 py-3 text-[15px] font-medium leading-5 text-foreground shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)] transition-opacity active:opacity-70 disabled:opacity-50"
							data-testid="mobile-recording-session-toggle"
						>
							{t("recordingSummary.actions.retry")}
						</button>
					) : isPaused ? (
						/* Resume: capsule-shaped button, centered */
						<button
							key="resume"
							type="button"
							onClick={onResume}
							disabled={isBusy}
							className="flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-10 text-[17px] font-semibold transition-opacity active:opacity-70 disabled:opacity-50"
							style={{
								background: "rgba(239, 68, 68, 0.12)",
								color: "#ef4444",
							}}
							data-testid="mobile-recording-session-toggle"
						>
							{t("mobile.recordingEntry.active.resume")}
						</button>
					) : (
						/* Recording: red circular pause button, centered */
						<button
							key="pause"
							type="button"
							onClick={onPause}
							disabled={isBusy || isStarting}
							className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-card transition-opacity active:opacity-70 disabled:opacity-50"
							style={{
								boxShadow:
									"0px 4px 14px 0px rgba(0,0,0,0.18), 0px 0px 0px 1px rgba(0,0,0,0.04)",
							}}
							aria-label={t("mobile.recordingEntry.active.pause")}
							data-testid="mobile-recording-session-toggle"
						>
							<span
								aria-hidden="true"
								className="flex h-14 w-14 items-center justify-center gap-[5px] rounded-full"
								style={{ background: "#ef4444" }}
							>
								<span className="block h-5 w-[4px] rounded-full bg-white" />
								<span className="block h-5 w-[4px] rounded-full bg-white" />
							</span>
						</button>
					)}
				</div>
				<button
					type="button"
					onPointerDown={handleCameraPointerDown}
					onClick={handleCameraClick}
					disabled={isCameraUploadPending || isBusy || isStarting || !selectedProject?.id}
					className="flex min-w-[76px] flex-col items-center gap-1 justify-self-center text-[13px] text-muted-foreground transition-opacity active:opacity-70 disabled:opacity-50"
					data-testid="mobile-recording-session-camera"
				>
					<Camera className="size-6 !stroke-2" />
					<span>{t("mobile.recordingEntry.active.camera")}</span>
				</button>
			</div>

			<MagicPopup
				visible={isAiChatOpen}
				onClose={() => setIsAiChatOpen(false)}
				headerVariant="actionHeader"
				headerTitle={t("mobile.recordingEntry.active.askAi")}
				headerSubtitle={`${
					isPaused
						? t("mobile.recordingEntry.active.statusPaused")
						: t("mobile.recordingEntry.active.statusRecording")
				} · ${formattedDuration}`}
				headerLeadingAction={{
					icon: <ChevronLeft />,
					ariaLabel: t("mobile.recordingEntry.active.backAria"),
					onClick: () => setIsAiChatOpen(false),
					testId: "mobile-recording-ai-chat-back",
				}}
				className="!h-[98dvh] !max-h-[calc(100dvh-var(--safe-area-inset-top)-0.5rem)] !bg-mobile-background data-[vaul-drawer-direction=bottom]:!mt-[max(0.5rem,var(--safe-area-inset-top))]"
				bodyClassName="!flex !w-full !min-h-0 !flex-1 !flex-col !overflow-hidden !bg-mobile-background"
			>
				<div className="flex h-full min-h-0 flex-col overflow-hidden bg-mobile-background">
					{aiChat}
				</div>
			</MagicPopup>

			<style>{`
				@keyframes rec-pulse {
					0%, 100% { transform: scale(1); opacity: 1; }
					50% { transform: scale(1.4); opacity: 0.5; }
				}
			`}</style>
		</div>
	)
}

/** Empty state shown when the current recording started with realtime transcription disabled. */
function TranscriptionDisabledState({
	loading,
	onEnable,
}: {
	loading: boolean
	onEnable: () => void
}) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
			data-testid="mobile-recording-transcription-disabled"
		>
			<div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
				<MicVocal className="size-7" strokeWidth={1.8} />
			</div>
			<div className="space-y-1">
				<p className="text-[16px] font-semibold leading-6 text-foreground">
					{t("mobile.recordingEntry.active.transcriptionDisabledTitle")}
				</p>
				<p className="text-[13px] leading-5 text-muted-foreground">
					{t("mobile.recordingEntry.active.transcriptionDisabledDescription")}
				</p>
			</div>
			<button
				type="button"
				onClick={onEnable}
				disabled={loading}
				className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-[14px] font-medium leading-5 text-background transition-opacity active:opacity-80 disabled:opacity-60"
				data-testid="mobile-recording-enable-transcription"
			>
				{loading ? <Loader2 className="size-4 animate-spin" /> : null}
				{loading
					? t("mobile.recordingEntry.active.enablingTranscription")
					: t("mobile.recordingEntry.active.enableTranscription")}
			</button>
		</div>
	)
}
