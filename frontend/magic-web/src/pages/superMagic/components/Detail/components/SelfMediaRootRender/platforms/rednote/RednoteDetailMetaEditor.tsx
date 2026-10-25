import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Check, Pencil, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { SelfMediaPost, SelfMediaPostMetaPatch } from "../../types"
import { normalizeRednoteTags, parseRednoteTagDraft, updateRednoteTags } from "./rednoteMeta"
import { RednoteMetaSaveStatus } from "./RednoteMetaSaveStatus"
import { RednoteWrappingTitleInput } from "./RednoteWrappingTitleInput"

type EditableField = "title" | "subtitle" | "tags"
type SaveState = "idle" | "saving" | "saved" | "error"
type SaveError = "emptyTitle" | "saveFailed" | null

const TITLE_TEXT_CLASSNAME =
	"whitespace-normal break-words text-[16px] font-semibold leading-6 text-black"

interface RednoteDetailMetaEditorProps {
	post: SelfMediaPost
	allowEdit?: boolean
	onUpdatePostMeta?: (patch: SelfMediaPostMetaPatch) => Promise<boolean>
}

export function RednoteDetailMetaEditor({
	post,
	allowEdit,
	onUpdatePostMeta,
}: RednoteDetailMetaEditorProps) {
	const { t } = useTranslation("super")
	const editable = Boolean(allowEdit && onUpdatePostMeta)
	const title = post.meta.title || post.meta.feedTitle || ""
	const subtitle = post.meta.subtitle || ""
	const tags = normalizeRednoteTags(post.meta.tags)
	const [editingField, setEditingField] = useState<EditableField | null>(null)
	const [draft, setDraft] = useState("")
	const [draftTags, setDraftTags] = useState<string[]>([])
	const [showTagInput, setShowTagInput] = useState(false)
	const [newTagDraft, setNewTagDraft] = useState("")
	const [editingTag, setEditingTag] = useState<string | null>(null)
	const [editingTagDraft, setEditingTagDraft] = useState("")
	const [tagValidationError, setTagValidationError] = useState<string | null>(null)
	const [saveState, setSaveState] = useState<SaveState>("idle")
	const [saveError, setSaveError] = useState<SaveError>(null)
	const saveInFlightRef = useRef(false)
	const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const subtitleTextareaRef = useRef<HTMLTextAreaElement | null>(null)

	useEffect(() => {
		return () => {
			if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
		}
	}, [])

	useLayoutEffect(() => {
		if (editingField !== "subtitle") return
		const textarea = subtitleTextareaRef.current
		if (!textarea) return
		textarea.style.height = "auto"
		const nextHeight = Math.max(textarea.scrollHeight, 24)
		textarea.style.height = `${nextHeight}px`
	}, [draft, editingField])

	const setTemporaryState = (state: SaveState) => {
		if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
		setSaveState(state)
		if (state === "saved") {
			statusTimerRef.current = setTimeout(() => setSaveState("idle"), 1800)
		}
	}

	const startEditing = (field: EditableField) => {
		if (!editable || saveInFlightRef.current) return
		setEditingField(field)
		setSaveState("idle")
		setSaveError(null)
		setShowTagInput(false)
		setNewTagDraft("")
		setEditingTag(null)
		setEditingTagDraft("")
		setTagValidationError(null)
		if (field !== "tags") setDraft(field === "title" ? title : subtitle)
		if (field === "tags") setDraftTags(normalizeRednoteTags(post.meta.tags))
	}

	const cancelEditing = () => {
		if (saveInFlightRef.current) return
		setEditingField(null)
		setSaveState("idle")
		setSaveError(null)
		setEditingTag(null)
		setEditingTagDraft("")
		setTagValidationError(null)
	}

	const saveTags = async (nextTags: string[]): Promise<boolean> => {
		if (!onUpdatePostMeta || saveInFlightRef.current) return false
		if (nextTags.join("\u0000") === tags.join("\u0000")) {
			return true
		}

		saveInFlightRef.current = true
		setSaveState("saving")
		try {
			const saved = await onUpdatePostMeta({
				tags: updateRednoteTags(post.meta.tags, nextTags),
			})
			if (!saved) {
				setSaveError("saveFailed")
				setTemporaryState("error")
				return false
			}
			setSaveError(null)
			setTemporaryState("saved")
			return true
		} catch {
			setSaveError("saveFailed")
			setTemporaryState("error")
			return false
		} finally {
			saveInFlightRef.current = false
		}
	}

	const saveField = async (field: "title" | "subtitle", rawValue: string) => {
		if (!onUpdatePostMeta || saveInFlightRef.current) return
		const value = field === "title" ? rawValue.replace(/[\r\n]+/g, " ").trim() : rawValue.trim()
		if (field === "title" && !value) {
			setSaveError("emptyTitle")
			setTemporaryState("error")
			return
		}
		if (
			(field === "title" && value === title) ||
			(field === "subtitle" && value === subtitle)
		) {
			setEditingField(null)
			return
		}

		saveInFlightRef.current = true
		setSaveState("saving")
		try {
			const saved = await onUpdatePostMeta({ [field]: value })
			if (!saved) {
				setSaveError("saveFailed")
				setTemporaryState("error")
				return
			}
			setEditingField(null)
			setSaveError(null)
			setTemporaryState("saved")
		} catch {
			setSaveError("saveFailed")
			setTemporaryState("error")
		} finally {
			saveInFlightRef.current = false
		}
	}

	const addTag = async () => {
		const newTags = parseRednoteTagDraft(newTagDraft).filter((tag) => !draftTags.includes(tag))
		if (!newTags.length || saveState === "saving") return
		const previousTags = draftTags
		const previousDraft = newTagDraft
		const nextTags = [...draftTags, ...newTags]
		setDraftTags(nextTags)
		setNewTagDraft("")
		const saved = await saveTags(nextTags)
		if (!saved) {
			setDraftTags(previousTags)
			setNewTagDraft(previousDraft)
		}
	}

	const removeTag = async (tag: string) => {
		if (saveState === "saving") return
		const previousTags = draftTags
		const nextTags = draftTags.filter((item) => item !== tag)
		setDraftTags(nextTags)
		const saved = await saveTags(nextTags)
		if (!saved) setDraftTags(previousTags)
	}

	const startTagEdit = (tag: string) => {
		if (saveState === "saving") return
		setEditingTag(tag)
		setEditingTagDraft(tag)
		setTagValidationError(null)
		setShowTagInput(false)
	}

	const cancelTagEdit = () => {
		setEditingTag(null)
		setEditingTagDraft("")
		setTagValidationError(null)
	}

	const commitTagEdit = async () => {
		if (!editingTag || saveState === "saving") return
		const nextTag = parseRednoteTagDraft(editingTagDraft)[0]
		if (!nextTag) {
			setTagValidationError(t("detail.selfMedia.platform.rednote.metaEdit.tagEmpty"))
			return
		}
		if (nextTag !== editingTag && draftTags.includes(nextTag)) {
			setTagValidationError(
				t("detail.selfMedia.platform.rednote.metaEdit.tagDuplicate", { tag: nextTag }),
			)
			return
		}
		if (nextTag === editingTag) {
			cancelTagEdit()
			return
		}

		const previousTags = draftTags
		const nextTags = draftTags.map((tag) => (tag === editingTag ? nextTag : tag))
		setDraftTags(nextTags)
		const saved = await saveTags(nextTags)
		if (!saved) {
			setDraftTags(previousTags)
			return
		}
		cancelTagEdit()
	}

	const fieldLabel = (field: EditableField) =>
		t(`detail.selfMedia.platform.rednote.metaEdit.${field}`)

	const renderEditorButton = (field: EditableField) =>
		editable && editingField !== field ? (
			<button
				type="button"
				disabled={saveState === "saving"}
				className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#86909c] transition-colors hover:bg-black/5 hover:text-black"
				onClick={() => startEditing(field)}
				aria-label={t("detail.selfMedia.platform.rednote.metaEdit.editField", {
					field: fieldLabel(field),
				})}
				data-testid={`red-detail-edit-${field}-button`}
			>
				<Pencil className="h-3.5 w-3.5" />
			</button>
		) : null

	const renderTextField = (field: "title" | "subtitle", currentValue: string) => {
		if (editingField === field) {
			if (field === "title") {
				return (
					<>
						<RednoteWrappingTitleInput
							value={draft}
							disabled={saveState === "saving"}
							ariaLabel={fieldLabel(field)}
							testId="red-detail-title-input"
							className={cn(
								"min-w-0 flex-1 rounded-md bg-white px-0 py-0 outline-none ring-1 ring-[#d9d9d9] focus:ring-2 focus:ring-[#ff2442]/30",
								TITLE_TEXT_CLASSNAME,
							)}
							onChange={setDraft}
							onCancel={cancelEditing}
							onCommit={(value) => void saveField(field, value)}
						/>
						<span className="h-6 w-6 shrink-0" aria-hidden="true" />
					</>
				)
			}

			const commonProps = {
				value: draft,
				onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
					setDraft(event.target.value),
				onBlur: () => void saveField(field, draft),
				onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
					if (event.key === "Escape") cancelEditing()
					if (
						field === "subtitle" &&
						event.key === "Enter" &&
						(event.metaKey || event.ctrlKey)
					) {
						event.preventDefault()
						void saveField(field, draft)
					}
				},
				"aria-label": fieldLabel(field),
				disabled: saveState === "saving",
				autoFocus: true,
				className:
					"w-full rounded-md bg-white px-0 py-0 text-[inherit] leading-6 outline-none ring-1 ring-[#d9d9d9] focus:ring-2 focus:ring-[#ff2442]/30",
				"data-testid": `red-detail-${field}-input`,
			}
			return (
				<textarea
					{...commonProps}
					ref={subtitleTextareaRef}
					rows={1}
					className="w-full resize-none rounded-md bg-white px-0 py-0 leading-6 text-[inherit] outline-none ring-1 ring-[#d9d9d9] focus:ring-2 focus:ring-[#ff2442]/30"
				/>
			)
		}

		return (
			<>
				<button
					type="button"
					disabled={!editable}
					onClick={() => startEditing(field)}
					className={cn(
						"min-w-0 flex-1 text-left",
						field === "title" && TITLE_TEXT_CLASSNAME,
						!currentValue && editable && "text-[#a1a1aa]",
						!editable && "cursor-default",
					)}
					data-testid={`red-detail-${field}-display`}
				>
					<span
						className={
							field === "title"
								? "whitespace-normal break-words"
								: "whitespace-pre-wrap break-words"
						}
					>
						{currentValue ||
							t(
								`detail.selfMedia.platform.rednote.metaEdit.add${field[0].toUpperCase()}${field.slice(1)}`,
							)}
					</span>
				</button>
				{renderEditorButton(field)}
			</>
		)
	}

	return (
		<div
			className="px-4 py-3"
			data-testid="red-detail-meta-editor"
			aria-busy={saveState === "saving"}
		>
			{saveState !== "idle" ? <RednoteMetaSaveStatus state={saveState} /> : null}
			<div className="flex items-start gap-1 text-[16px] font-semibold leading-6 text-black">
				{renderTextField("title", title)}
			</div>
			<div className="mt-2 text-[14px] leading-6 text-black/80">
				{renderTextField("subtitle", subtitle)}
			</div>
			<div className="mt-2 flex items-start gap-1">
				{editingField === "tags" ? (
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-1.5">
							{draftTags.map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center gap-1 rounded-full bg-[#edf4ff] px-2 py-0.5 text-[13px] font-medium leading-5 text-[#1f6fff]"
								>
									{editingTag === tag ? (
										<input
											value={editingTagDraft}
											onChange={(event) => {
												setEditingTagDraft(event.target.value)
												setTagValidationError(null)
											}}
											onBlur={() => void commitTagEdit()}
											onKeyDown={(event) => {
												if (event.key === "Escape") cancelTagEdit()
												if (event.key === "Enter") {
													event.preventDefault()
													void commitTagEdit()
												}
											}}
											autoFocus
											disabled={saveState === "saving"}
											className="h-5 w-20 border-0 bg-transparent px-0 text-[13px] font-medium leading-5 text-[#1f6fff] outline-none"
											aria-label={t(
												"detail.selfMedia.platform.rednote.metaEdit.editTag",
												{ tag },
											)}
											data-testid={`red-detail-tag-input-${tag}`}
										/>
									) : (
										<button
											type="button"
											disabled={saveState === "saving"}
											onClick={() => startTagEdit(tag)}
											className="text-left hover:underline"
											aria-label={t(
												"detail.selfMedia.platform.rednote.metaEdit.editTag",
												{ tag },
											)}
											data-testid={`red-detail-edit-tag-${tag}`}
										>
											#{tag}
										</button>
									)}
									<button
										type="button"
										disabled={saveState === "saving"}
										onClick={() => void removeTag(tag)}
										className="flex h-4 w-4 items-center justify-center rounded-full text-[#6b8fcf] hover:bg-[#d8e7ff] hover:text-[#1f6fff]"
										aria-label={t(
											"detail.selfMedia.platform.rednote.metaEdit.deleteTag",
											{ tag },
										)}
										data-testid={`red-detail-delete-tag-${tag}`}
									>
										<X className="h-3 w-3" />
									</button>
								</span>
							))}
							{showTagInput ? (
								<input
									value={newTagDraft}
									onChange={(event) => setNewTagDraft(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Escape") {
											setShowTagInput(false)
											setNewTagDraft("")
										}
										if (event.key === "Enter") {
											event.preventDefault()
											void addTag()
										}
									}}
									autoFocus
									disabled={saveState === "saving"}
									placeholder={t(
										"detail.selfMedia.platform.rednote.metaEdit.newTagPlaceholder",
									)}
									aria-label={fieldLabel("tags")}
									className="h-7 w-24 rounded-md border border-[#d9d9d9] bg-white px-2 text-[13px] text-[#1f6fff] outline-none focus:border-[#ff2442] focus:ring-2 focus:ring-[#ff2442]/15"
									data-testid="red-detail-new-tag-input"
								/>
							) : null}
							<button
								type="button"
								disabled={saveState === "saving"}
								onClick={() => {
									setShowTagInput(true)
									setNewTagDraft("")
								}}
								className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[#a9bfdc] px-2 py-0.5 text-[12px] leading-5 text-[#1f6fff] hover:bg-[#f5f8ff]"
								aria-label={t("detail.selfMedia.platform.rednote.metaEdit.addTag")}
								data-testid="red-detail-add-tag-button"
							>
								<Plus className="h-3 w-3" />
								{t("detail.selfMedia.platform.rednote.metaEdit.addTag")}
							</button>
							<button
								type="button"
								disabled={saveState === "saving"}
								onClick={() => setEditingField(null)}
								className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f2f2f2] text-[#505050] hover:bg-[#e8e8e8]"
								aria-label={t(
									"detail.selfMedia.platform.rednote.metaEdit.finishTags",
								)}
								data-testid="red-detail-finish-tags-button"
							>
								<Check className="h-3.5 w-3.5" />
							</button>
						</div>
						<div className="mt-1 text-[11px] text-[#86909c]">
							{tagValidationError ||
								t("detail.selfMedia.platform.rednote.metaEdit.tagsHint")}
						</div>
					</div>
				) : (
					<button
						type="button"
						disabled={!editable}
						onClick={() => startEditing("tags")}
						className={cn(
							"flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left text-[15px] font-medium leading-6 text-[#1f6fff]",
							!tags.length && editable && "text-[#a1a1aa]",
							!editable && "cursor-default",
						)}
						data-testid="red-detail-tags-display"
					>
						{tags.length
							? tags.map((tag, idx) => <span key={`${tag}-${idx}`}>#{tag}</span>)
							: t("detail.selfMedia.platform.rednote.metaEdit.addTags")}
					</button>
				)}
				{renderEditorButton("tags")}
			</div>
			{editingField === "title" && saveError === "emptyTitle" ? (
				<div className="mt-1 text-[11px] text-[#dc2626]">
					{t("detail.selfMedia.platform.rednote.metaEdit.titleEmpty")}
				</div>
			) : null}
		</div>
	)
}
