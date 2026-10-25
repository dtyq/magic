import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import { MagicPromptEditor } from "@/components/base/MagicPromptEditor"
import type { MagicPromptEditorRef } from "@/components/base/MagicPromptEditor/types"
import { buildFileReferenceMention } from "../../../../services/selfMediaPromptBuilder"
import type { ReferenceFileValue, VisualPresetOption } from "../../types"
import ReferenceFilePicker from "./ReferenceFilePicker"
import PresetHoverPreview, {
	PREVIEW_CLOSE_DELAY_MS,
	getPreviewPosition,
	type PreviewState,
} from "./PresetHoverPreview"
import { PresetLayoutMark } from "./PresetLayoutMark"

interface VisualPresetPickerProps {
	presets: VisualPresetOption[]
	value: string
	onChange: (value: string) => void
	/** Custom description text for "custom" mode */
	customDescription?: string
	onCustomDescriptionChange?: (value: string) => void
	/** Rich JSON content for custom visual description */
	customDescriptionJson?: JSONContent
	onCustomDescriptionJsonChange?: (json: JSONContent) => void
	/** Visual reference files for "custom" mode */
	visualReferenceFiles?: ReferenceFileValue[]
	onVisualReferenceFilesChange?: (files: ReferenceFileValue[]) => void
	/** Called when editor loses focus */
	onBlur?: () => void
	/** Size variant */
	size?: "sm" | "md"
}

export default function VisualPresetPicker({
	presets,
	value,
	onChange,
	customDescription,
	onCustomDescriptionChange,
	customDescriptionJson,
	onCustomDescriptionJsonChange,
	visualReferenceFiles,
	onVisualReferenceFilesChange,
	onBlur,
	size = "sm",
}: VisualPresetPickerProps) {
	const { t } = useTranslation("super")
	const selected = value || "none"
	const isMd = size === "md"
	const columnCount = isMd ? 2 : 3
	const editorRef = useRef<MagicPromptEditorRef>(null)
	const closePreviewTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
	const [previewState, setPreviewState] = useState<PreviewState | null>(null)

	const cancelClosePreview = useCallback(() => {
		if (!closePreviewTimerRef.current) return
		window.clearTimeout(closePreviewTimerRef.current)
		closePreviewTimerRef.current = null
	}, [])

	const openPreview = useCallback(
		(trigger: HTMLElement, presetValue: string, side: "left" | "right") => {
			cancelClosePreview()
			setPreviewState({
				...getPreviewPosition(trigger, side),
				side,
				value: presetValue,
			})
		},
		[cancelClosePreview],
	)

	const closePreview = useCallback(
		(presetValue: string) => {
			cancelClosePreview()
			setPreviewState((current) => (current?.value === presetValue ? null : current))
		},
		[cancelClosePreview],
	)

	const scheduleClosePreview = useCallback(
		(presetValue: string) => {
			cancelClosePreview()
			closePreviewTimerRef.current = window.setTimeout(() => {
				setPreviewState((current) => (current?.value === presetValue ? null : current))
				closePreviewTimerRef.current = null
			}, PREVIEW_CLOSE_DELAY_MS)
		},
		[cancelClosePreview],
	)

	useEffect(() => cancelClosePreview, [cancelClosePreview])

	/** When reference files are selected, insert them as @mention nodes into the editor */
	const handleVisualReferenceFilesChange = useCallback(
		(files: ReferenceFileValue[]) => {
			// Still store them for data persistence
			onVisualReferenceFilesChange?.(files)

			// Insert new files as @mention nodes into the editor
			const editor = editorRef.current?.getEditor()
			if (!editor) return

			// Find files that are newly added (not already in current value)
			const currentFiles = visualReferenceFiles || []
			const currentPaths = new Set(currentFiles.map((f) => f.file_path))
			const newFiles = files.filter((f) => f.file_path && !currentPaths.has(f.file_path))

			if (newFiles.length === 0) return

			// Move cursor to end and insert mention nodes
			editor.commands.focus("end")
			for (const file of newFiles) {
				if (!file.file_path) continue
				const ext =
					file.name.lastIndexOf(".") !== -1
						? file.name.slice(file.name.lastIndexOf(".") + 1)
						: ""
				const mentionNode = buildFileReferenceMention({
					file_id: file.file_id || "",
					file_name: file.name,
					file_path: file.file_path,
					file_extension: ext,
				})
				editor.commands.insertContent([{ type: "text", text: " " }, mentionNode])
			}
		},
		[onVisualReferenceFilesChange, visualReferenceFiles],
	)

	return (
		<div>
			<div className={cn("grid gap-1.5", isMd ? "grid-cols-2 gap-2" : "grid-cols-3")}>
				{presets.map((preset, index) => {
					const isSelected = selected === preset.value
					const label = t(preset.labelKey)
					const description = t(preset.descriptionKey)
					const previewSide = (index + 1) % columnCount === 0 ? "left" : "right"
					return (
						<button
							key={preset.value}
							type="button"
							data-testid={`visual-preset-option-${preset.value}`}
							className={cn(
								"group relative flex items-center gap-2 overflow-visible rounded-lg border-0 bg-zinc-50/70 text-left shadow-none ring-1 ring-zinc-950/[0.06] transition-all duration-200 hover:z-[1001] hover:bg-zinc-100/70 hover:ring-zinc-950/10 focus-visible:z-[1001]",
								isMd ? "py-2 pl-2 pr-2.5" : "py-1.5 pl-1.5 pr-2",
								isSelected && "bg-white ring-1 ring-zinc-950/30",
							)}
							onClick={() => onChange(preset.value)}
							onBlur={() => closePreview(preset.value)}
							onFocus={(event) =>
								openPreview(event.currentTarget, preset.value, previewSide)
							}
							onMouseEnter={(event) =>
								openPreview(event.currentTarget, preset.value, previewSide)
							}
							onMouseLeave={() => scheduleClosePreview(preset.value)}
						>
							<PresetLayoutMark
								className={cn("shrink-0", isMd ? "h-10 w-10" : "h-8 w-8")}
								preset={preset}
							/>
							<span
								className={cn(
									"min-w-0 flex-1 truncate font-bold leading-tight",
									isMd ? "text-xs" : "text-[11px]",
									isSelected ? "text-foreground" : "text-muted-foreground",
								)}
							>
								{label}
							</span>
							{isSelected && (
								<Badge className="absolute right-1 top-1 h-4 min-w-4 rounded-full px-0">
									<svg
										width="8"
										height="8"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</Badge>
							)}
							<PresetHoverPreview
								isOpen={previewState?.value === preset.value}
								position={
									previewState?.value === preset.value ? previewState : undefined
								}
								preset={preset}
								label={label}
								description={description}
								scrollHint={t("detail.selfMedia.initPanel.visuals.scrollHint")}
								side={
									previewState?.value === preset.value
										? previewState.side
										: previewSide
								}
								onMouseEnter={cancelClosePreview}
								onMouseLeave={() => scheduleClosePreview(preset.value)}
							/>
						</button>
					)
				})}
			</div>

			{/* Custom mode inputs */}
			{selected === "custom" && onCustomDescriptionChange && (
				<div className={cn(isMd ? "mt-3" : "mt-2")}>
					<MagicPromptEditor
						ref={editorRef}
						value={customDescriptionJson}
						textValue={customDescription ?? ""}
						onChange={(json: JSONContent) => onCustomDescriptionJsonChange?.(json)}
						onTextChange={(text: string) => onCustomDescriptionChange(text)}
						onBlur={onBlur}
						placeholder={t(
							"detail.selfMedia.initPanel.stepDetail.visualCustomPlaceholder",
						)}
						enableMention
						enableVoice={false}
						enableAIPolish={false}
						rows={2}
						className={cn(
							"rounded-none border-0 border-b border-zinc-200 bg-zinc-50/40 shadow-none ring-0 ring-offset-0 focus-within:border-zinc-950 focus-within:bg-primary/[0.03] focus-within:ring-0 focus-within:ring-offset-0",
							isMd ? "text-sm" : "text-xs",
						)}
						bottomToolbar={
							onVisualReferenceFilesChange ? (
								<div className="flex items-center border-t border-zinc-200/70 bg-zinc-50/40 px-3 py-1.5">
									<ReferenceFilePicker
										compact
										label={t(
											"detail.selfMedia.initPanel.stepDetail.visualReferenceLabel",
										)}
										value={visualReferenceFiles || []}
										onChange={handleVisualReferenceFilesChange}
									/>
								</div>
							) : undefined
						}
					/>
				</div>
			)}
		</div>
	)
}
