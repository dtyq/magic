import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"
import { usePPTNotesAI } from "../hooks/usePPTNotesAI"
import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Loader2, NotebookPen } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { shadow } from "@/utils/shadow"
import { extractSlideNotes, upsertSlideNotes } from "../utils/slideNotes"
import PPTNotesMarkdown, { type PPTNotesMarkdownRef } from "./PPTNotesMarkdown"
import PPTNotesActions from "./PPTNotesActions"
import NotesSaveControl from "./NotesSaveControl"
import type { PPTSpeakerNotesPanelProps } from "./pptNotesTypes"

export type SaveState = "idle" | "saving" | "saved" | "error" | "unsaved"
const MAX_NOTE_SAVE_REBASES = 3

export default function SpeakerNotesEditor({
	visible = true,
	slideIndex,
	rawContent,
	fileId,
	getLatestRawContent,
	allowEdit,
	saveEditContent,
	onSaved,
	onGenerate,
	initialDraft,
	onDraftChange,
	onDraftSaved,
	overview = false,
	fontSize = 13,
	isCurrentPage,
	onSaveStateChange,
}: PPTSpeakerNotesPanelProps & {
	onSaveStateChange: (state: SaveState | undefined) => void
	overview?: boolean
	fontSize?: number
	isCurrentPage: boolean
	initialDraft?: string
	onDraftChange: (draft: string | undefined) => void
	onDraftSaved: (draft: string) => void
}) {
	const { t } = useTranslation("super")
	const markdownRef = useRef<PPTNotesMarkdownRef>(null)
	const [patchPending, setPatchPending] = useState(false)
	const [patchError, setPatchError] = useState(false)
	const savingRef = useRef(false)
	const activeRef = useRef(true)
	const lastSyncedRawContentRef = useRef(rawContent)
	const [notes, setNotes] = useState(() => extractSlideNotes(rawContent))
	const [draft, setDraft] = useState(initialDraft ?? notes)
	const [isEditing, setIsEditing] = useState(initialDraft !== undefined && initialDraft !== notes)
	const [saveState, setSaveState] = useState<SaveState>("idle")
	const [hasInitializedMarkdown, setHasInitializedMarkdown] = useState(
		visible || initialDraft !== undefined,
	)
	// 未打开且无草稿时不创建富文本；打开或恢复草稿后，关闭面板不销毁已有编辑状态。
	const shouldRenderMarkdown = visible || initialDraft !== undefined || hasInitializedMarkdown
	useEffect(() => {
		if (visible || initialDraft !== undefined) setHasInitializedMarkdown(true)
	}, [visible, initialDraft])
	const dirty = draft !== notes
	const ai = usePPTNotesAI({
		fileId,
		draft,
		rawContent,
		enabled: visible && allowEdit,
		generate: onGenerate,
	})

	const reportSaveState = useMemoizedFn(onSaveStateChange)
	useEffect(() => {
		reportSaveState(saveState === "idle" && dirty ? "unsaved" : saveState)
	}, [saveState, dirty, reportSaveState])
	useEffect(() => () => reportSaveState(undefined), [reportSaveState])

	useEffect(() => {
		activeRef.current = true
		return () => {
			activeRef.current = false
		}
	}, [])

	useEffect(() => {
		if (isEditing && dirty) return
		const nextNotes = extractSlideNotes(rawContent)
		// The parent may update the slide content asynchronously after save. Do not
		// let the still-stale prop overwrite the locally saved notes in that window.
		if (rawContent === lastSyncedRawContentRef.current && nextNotes !== notes) return
		lastSyncedRawContentRef.current = rawContent
		setNotes(nextNotes)
		setDraft(nextNotes)
		if (nextNotes !== notes) setSaveState("idle")
	}, [dirty, isEditing, notes, rawContent])

	const saveNotes = async (value = draft) => {
		if (value === notes) {
			setIsEditing(false)
			return true
		}
		if (!allowEdit || !saveEditContent || !fileId) return false
		if (savingRef.current) return false

		savingRef.current = true
		setSaveState("saving")
		try {
			let latestRawContent = getLatestRawContent?.(fileId) || rawContent
			let nextContent = upsertSlideNotes(latestRawContent, value)
			for (let attempt = 0; attempt <= MAX_NOTE_SAVE_REBASES; attempt += 1) {
				const result = await saveEditContent(
					shadow(nextContent),
					fileId,
					true,
					undefined,
					true,
					false,
					{ silent: true },
				)
				// Navigation invalidates this editor, including retries against the latest HTML.
				if (!activeRef.current) return false
				if (result === false) throw new Error("Failed to save speaker notes")

				const currentRawContent = getLatestRawContent?.(fileId) || latestRawContent
				if (currentRawContent === latestRawContent || currentRawContent === nextContent)
					break
				if (attempt === MAX_NOTE_SAVE_REBASES) {
					throw new Error("Slide changed repeatedly while saving speaker notes")
				}
				latestRawContent = currentRawContent
				nextContent = upsertSlideNotes(latestRawContent, value)
			}

			await onSaved(nextContent, fileId)
			if (!activeRef.current) return false
			onDraftSaved(value)
			setNotes(value)
			setDraft(value)
			setIsEditing(false)
			setSaveState("saved")
			return true
		} catch (error) {
			console.error("Failed to save speaker notes:", error)
			if (activeRef.current) setSaveState("error")
			return false
		} finally {
			savingRef.current = false
		}
	}

	return (
		<section data-notes-editor className="group/notes relative flex min-h-0 flex-col">
			{/* Each page's toolbar stays above its notes until the next page takes over. */}
			<div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 bg-background px-4 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<NotebookPen className="size-4 shrink-0 text-muted-foreground" />
					<h2 className="truncate text-xs font-normal text-muted-foreground">
						{isCurrentPage
							? t("ppt.speakerNotes.currentPageTitle")
							: t("ppt.speakerNotes.pageTitle", { page: slideIndex + 1 })}
					</h2>
				</div>
				<div className="flex min-h-6 flex-wrap items-center gap-1">
					{onGenerate && (
						<div
							className={cn(
								"flex items-center gap-1",
								overview &&
									"pointer-events-none opacity-0 group-focus-within/notes:pointer-events-auto group-focus-within/notes:opacity-100 group-hover/notes:pointer-events-auto group-hover/notes:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
							)}
						>
							{/* Keep controls in the tab order; focusing a note or action reveals the group. */}
							<PPTNotesActions
								hasNotes={Boolean(draft.trim())}
								disabled={
									saveState === "saving" || !allowEdit || ai.busy || patchPending
								}
								onAction={async (action, instruction) => {
									const snapshot = markdownRef.current?.getSnapshot()
									if (!snapshot) return
									setPatchError(false)
									const result = await ai.run(action, instruction)
									if (result !== undefined && activeRef.current) {
										setPatchError(
											!markdownRef.current?.propose(
												result,
												snapshot,
												pptNotesPreferenceStore.autoApply,
											),
										)
									}
								}}
							/>
						</div>
					)}
					{ai.busy && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 gap-1.5 rounded-md px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
							onClick={ai.cancel}
						>
							<Loader2 className="size-4 animate-spin" />
							{t("ppt.speakerNotes.cancelGeneration")}
						</Button>
					)}
					{allowEdit && (
						<NotesSaveControl
							saveState={saveState}
							dirty={dirty}
							onSave={() => void saveNotes()}
						/>
					)}
				</div>
			</div>

			{(ai.error || patchError) && (
				<p role="alert" className="px-4 py-1 text-xs text-destructive">
					{ai.error === "changed" || patchError
						? t("ppt.speakerNotes.contentChanged")
						: t("ppt.speakerNotes.generationFailed")}
				</p>
			)}
			{shouldRenderMarkdown && (
				<PPTNotesMarkdown
					ref={markdownRef}
					active={visible && allowEdit}
					onPatchPending={setPatchPending}
					onPatchApplied={(value) => {
						setIsEditing(true)
						setDraft(value)
						onDraftChange(value === notes ? undefined : value)
						void saveNotes(value)
					}}
					fontSize={fontSize}
					generating={ai.busy}
					overview={overview}
					value={isEditing ? draft : notes}
					readOnly={saveState === "saving" || !allowEdit}
					onChange={(value) => {
						// Tiptap emits update when setEditable changes, even without a text edit.
						// Saving temporarily makes it read-only; that callback must not reset save status.
						if (savingRef.current || !allowEdit || value === draft) return
						setIsEditing(true)
						setDraft(value)
						onDraftChange(value === notes ? undefined : value)
						setSaveState("idle")
					}}
					onSave={() => void saveNotes()}
				/>
			)}
		</section>
	)
}
