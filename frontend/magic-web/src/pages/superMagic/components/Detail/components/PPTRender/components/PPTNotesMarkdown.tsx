import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react"
import PPTNotesPatchReview from "./PPTNotesPatchReview"
import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/core"
import { AiPatch, getAiPatchState, proposeAiPatchMarkdown } from "@/components/tiptap-node/ai-patch"
import { useTranslation } from "react-i18next"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import type { SimpleEditorRef } from "@/components/tiptap-templates/simple/types"
import { cn } from "@/utils/cn"
import "./notesGenerating.css"

export interface PPTNotesMarkdownRef {
	getSnapshot: () => JSONContent | undefined
	propose: (markdown: string, snapshot: JSONContent, autoApply: boolean) => boolean
}

interface PPTNotesMarkdownProps {
	onPatchApplied?: (value: string) => void
	onPatchPending?: (pending: boolean) => void
	active?: boolean
	overview?: boolean
	fontSize?: number
	generating?: boolean
	value: string
	readOnly: boolean
	onChange: (value: string) => void
	onSave: () => void
}

/** Markdown stays rendered while the user edits it directly in the shared rich-text editor. */
const PPTNotesMarkdown = forwardRef<PPTNotesMarkdownRef, PPTNotesMarkdownProps>(
	function PPTNotesMarkdown(
		{
			onPatchApplied,
			onPatchPending,
			active = true,
			value,
			readOnly,
			onChange,
			onSave,
			overview = false,
			fontSize = 13,
			generating = false,
		}: PPTNotesMarkdownProps,
		ref,
	) {
		const { t } = useTranslation("super")
		const [editor, setEditor] = useState<Editor | null>(null)
		const editorRef = useRef<SimpleEditorRef | null>(null)
		const attachEditor = useCallback((instance: SimpleEditorRef | null) => {
			editorRef.current = instance
			setEditor(instance?.editor ?? null)
		}, [])
		const initialContent = useRef(value)
		const baselineRef = useRef<{ markdown: string; source: string }>()
		const extensions = useMemo(() => [AiPatch], [])
		const [unchanged, setUnchanged] = useState(false)
		const [patchState, setPatchState] = useState<ReturnType<typeof getAiPatchState>>()
		const callbacks = useRef({ onPatchApplied, onPatchPending })
		callbacks.current = { onPatchApplied, onPatchPending }
		useImperativeHandle(
			ref,
			() => ({
				getSnapshot: () => editorRef.current?.editor?.getJSON(),
				propose: (markdown, snapshot, autoApply) => {
					const current = editorRef.current?.editor
					const accepted = Boolean(
						current &&
						!current.isDestroyed &&
						proposeAiPatchMarkdown(current, markdown, {
							expectedDoc: snapshot,
							autoApply,
						}),
					)
					setUnchanged(
						Boolean(
							accepted && current && !getAiPatchState(current.state)?.patches.length,
						),
					)
					return accepted
				},
			}),
			[],
		)
		useEffect(() => {
			if (!editor) return
			let revision = getAiPatchState(editor.state)?.appliedRevision ?? 0
			// Accepted changes are handed back once, after the last pending change is resolved.
			let hasUnflushedApply = false
			const sync = () => {
				const state = getAiPatchState(editor.state)
				setPatchState(state)
				if (state?.patches.length) setUnchanged(false)
				const pending = Boolean(state?.patches.length || state?.phase === "removing")
				callbacks.current.onPatchPending?.(pending)
				if (state && state.appliedRevision !== revision) {
					revision = state.appliedRevision
					hasUnflushedApply = true
				}
				if (hasUnflushedApply && !pending) {
					hasUnflushedApply = false
					// Serialize after the whole transaction has completed, including Markdown updates.
					queueMicrotask(() => {
						if (!editor.isDestroyed)
							callbacks.current.onPatchApplied?.(
								(
									editor.storage as unknown as {
										markdown: { getMarkdown: () => string }
									}
								).markdown.getMarkdown(),
							)
					})
				}
			}
			editor.on("transaction", sync)
			sync()
			return () => {
				editor.off("transaction", sync)
			}
		}, [editor])
		useEffect(() => {
			if (!active && editor && !editor.isDestroyed) editor.commands.clearAiPatches()
		}, [active, editor])

		useEffect(() => {
			if (!editor || editor.isDestroyed) return
			const current = (
				editor.storage as { markdown?: { getMarkdown: () => string } }
			).markdown?.getMarkdown()
			// Accept AI/server updates without resetting the cursor on local typing or creating a new edit.
			if (current !== value) editor.commands.setContent(value, { emitUpdate: false })
			// Remember how the editor serializes the untouched source, so re-serialization is not a user edit.
			if (!baselineRef.current || current !== value) {
				baselineRef.current = {
					markdown:
						(
							editor.storage as { markdown?: { getMarkdown: () => string } }
						).markdown?.getMarkdown() ?? value,
					source: value,
				}
			}
		}, [value, editor])

		return (
			<div
				className={cn(
					"relative mx-3 mb-3 min-h-20 rounded-lg bg-muted/40 text-[13px] leading-6 text-foreground focus-within:ring-1 focus-within:ring-ring/40",
					generating && "ppt-notes-generating",
				)}
				onKeyDown={(event) => {
					// Notes own the arrow keys and save shortcut; do not navigate the slide behind them.
					event.stopPropagation()
					if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
						event.preventDefault()
						onSave()
					}
				}}
				onBlur={(event) => {
					// Header actions save explicitly; avoid disabling their target before click fires.
					const panel =
						event.currentTarget.closest("[data-notes-editor]") || event.currentTarget
					if (!panel.contains(event.relatedTarget)) onSave()
				}}
			>
				<PPTNotesPatchReview editor={editor} patchState={patchState} readOnly={readOnly} />
				{unchanged && (
					<p role="status" className="px-3 py-1 text-xs text-muted-foreground">
						{t("ppt.speakerNotes.noChanges")}
					</p>
				)}
				{/* Scale only Markdown, keeping review controls at a readable, consistent size. */}
				<div
					data-testid="ppt-speaker-notes-content"
					className="relative"
					style={{ zoom: fontSize / 13 }}
				>
					{/* Keep empty guidance visible even in read-only mode, without intercepting editing. */}
					{!value.trim() && !patchState?.patches.length && (
						<div className="pointer-events-none absolute inset-x-3 top-2 z-10 text-muted-foreground">
							{readOnly
								? t("ppt.speakerNotes.empty")
								: overview
									? t("ppt.speakerNotes.overviewPlaceholder")
									: t("ppt.speakerNotes.placeholder")}
						</div>
					)}
					<SimpleEditor
						ref={attachEditor}
						additionalExtensions={extensions}
						// This wrapper owns synchronization; read-only save transitions must not rebuild the doc or undo stack.
						content={initialContent.current}
						isEditable={!readOnly}
						showToolbar={false}
						enableDragHandle={false}
						enableSearchReplace={false}
						placeholder={
							readOnly
								? t("ppt.speakerNotes.empty")
								: overview
									? t("ppt.speakerNotes.overviewPlaceholder")
									: t("ppt.speakerNotes.placeholder")
						}
						onContentChange={(content) => {
							setUnchanged(false)
							const baseline = baselineRef.current
							onChange(
								baseline && content === baseline.markdown
									? baseline.source
									: content,
							)
						}}
						onSave={onSave}
						// Reset both editor scroll containers so wheel input reaches the panel's ScrollArea.
						className="!h-auto !overflow-visible !overscroll-auto !bg-transparent [&_.is-editor-empty]:before:!content-none [&_.simple-editor-content]:!h-auto [&_.simple-editor-content]:!flex-none [&_.simple-editor-content]:!overflow-visible [&_.tiptap.ProseMirror.simple-editor]:min-h-20 [&_.tiptap.ProseMirror.simple-editor]:!px-3 [&_.tiptap.ProseMirror.simple-editor]:!py-2 [&_.tiptap.ProseMirror.simple-editor]:!text-[13px] [&_.tiptap.ProseMirror.simple-editor]:!leading-6"
					/>
				</div>
			</div>
		)
	},
)

export default PPTNotesMarkdown
