import type { AssetTagItem, AssetTagMutationResponse, AssetTagTreeNode } from "@/apis"
import { isAssetTagGroup, isExplicitlyUngroupedParent } from "./assetTagTree"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface AssetTagManagerLabels {
	title: string
	createTag: string
	tagPlaceholder: string
	edit: string
	delete: string
	deleting: string
	cancelEdit: string
	cancelCreate: string
	empty: string
	selected: string
	duplicate: string
}

interface AssetTagManagerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	groups: AssetTagTreeNode[]
	selectedIds: string[]
	onCreate: (params: {
		name: string
		node_type: "tag"
		parent_id: null
	}) => Promise<AssetTagMutationResponse>
	onUpdate: (
		tagId: string,
		params: { name: string; node_type: "tag"; parent_id: string | null },
	) => Promise<AssetTagMutationResponse>
	onDelete: (tagId: string) => Promise<AssetTagMutationResponse>
	onMutationError?: (error: unknown) => void
	labels: AssetTagManagerLabels
}

interface CustomTagRow {
	tag: AssetTagItem
	parentId: string | null
}

function normalizeName(value: string): string {
	return value.trim().toLocaleLowerCase()
}

function isUngrouped(parentId: string | null | undefined): boolean {
	// undefined, null, "", and "0" are all stored forms of a tag that has no group.
	return parentId == null || isExplicitlyUngroupedParent(parentId)
}

function getCustomTags(groups: AssetTagTreeNode[]): CustomTagRow[] {
	return groups.flatMap((node) => {
		// A tag with no group is a custom tag, including ones returned beside groups.
		if (!isAssetTagGroup(node)) {
			return [{ tag: node, parentId: isUngrouped(node.parentId) ? null : node.parentId }]
		}
		return node.tags
			.filter((tag) => !tag.isOfficial || isUngrouped(tag.parentId))
			.map((tag) => ({
				tag,
				parentId: isUngrouped(tag.parentId) ? null : tag.parentId,
			}))
	})
}

function hasDuplicateName(tags: CustomTagRow[], name: string, exceptId?: string): boolean {
	const normalized = normalizeName(name)
	return tags.some((row) => row.tag.id !== exceptId && normalizeName(row.tag.name) === normalized)
}

const compactActionButtonClass = "h-6 shrink-0 px-2 text-xs"

export default function AssetTagManager({
	open,
	onOpenChange,
	groups,
	selectedIds,
	onCreate,
	onUpdate,
	onDelete,
	onMutationError,
	labels,
}: AssetTagManagerProps) {
	const [draftName, setDraftName] = useState<string | null>(null)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState("")
	const [busyKey, setBusyKey] = useState<string | null>(null)
	const [validationError, setValidationError] = useState<string | null>(null)
	const viewportRef = useRef<HTMLDivElement>(null)
	const draftSessionRef = useRef(0)
	const ignoreNextBlurRef = useRef(false)
	const committingRef = useRef(false)
	const tags = getCustomTags(groups)

	const resetDraft = () => {
		draftSessionRef.current += 1
		setDraftName(null)
		setValidationError(null)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			resetDraft()
			setEditingId(null)
			setEditingName("")
		}
		onOpenChange(nextOpen)
	}

	const handleStartCreate = () => {
		if (busyKey !== null) return
		setEditingId(null)
		setValidationError(null)
		draftSessionRef.current += 1
		setDraftName("")
		viewportRef.current?.scrollTo({ top: 0 })
	}

	const cancelRename = (cancel: () => void) => {
		// Escape unmounts the input, which also blurs it. Ignore that blur so
		// cancelling does not submit the text that was just discarded.
		ignoreNextBlurRef.current = true
		cancel()
		queueMicrotask(() => {
			ignoreNextBlurRef.current = false
		})
	}

	const commitDraft = async () => {
		if (ignoreNextBlurRef.current) {
			ignoreNextBlurRef.current = false
			return
		}
		const session = draftSessionRef.current
		const name = (draftName ?? "").trim()
		if (!name) {
			if (draftSessionRef.current === session) resetDraft()
			return
		}
		if (hasDuplicateName(tags, name)) {
			setValidationError(labels.duplicate)
			return
		}
		if (committingRef.current) return

		committingRef.current = true
		setBusyKey("create")
		setValidationError(null)
		try {
			// null parent means the tag belongs to no group, so it is a custom tag.
			await onCreate({ name, node_type: "tag", parent_id: null })
			if (draftSessionRef.current === session) resetDraft()
		} catch (error) {
			onMutationError?.(error)
		} finally {
			committingRef.current = false
			setBusyKey(null)
		}
	}

	const commitEdit = async (row: CustomTagRow) => {
		if (ignoreNextBlurRef.current) {
			ignoreNextBlurRef.current = false
			return
		}
		const name = editingName.trim()
		if (!name || name === row.tag.name) {
			setEditingId(null)
			setEditingName("")
			setValidationError(null)
			return
		}
		if (hasDuplicateName(tags, name, row.tag.id)) {
			setValidationError(labels.duplicate)
			return
		}
		if (committingRef.current) return

		committingRef.current = true
		setBusyKey(`update:${row.tag.id}`)
		setValidationError(null)
		try {
			await onUpdate(row.tag.id, {
				name,
				node_type: "tag",
				parent_id: row.parentId,
			})
			setEditingId(null)
			setEditingName("")
		} catch (error) {
			onMutationError?.(error)
		} finally {
			committingRef.current = false
			setBusyKey(null)
		}
	}

	const handleDelete = async (tag: AssetTagItem) => {
		if (committingRef.current) return
		committingRef.current = true
		setBusyKey(`delete:${tag.id}`)
		try {
			await onDelete(tag.id)
		} catch (error) {
			onMutationError?.(error)
		} finally {
			committingRef.current = false
			setBusyKey(null)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="flex max-h-[min(560px,calc(100vh-32px))] w-[min(520px,calc(100vw-32px))] max-w-[520px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"
				// This dialog portals outside the save dialog, whose scroll lock
				// cancels wheel events that reach document.
				onWheel={(event) => event.stopPropagation()}
			>
				<Button
					type="button"
					variant="link"
					className="absolute right-12 top-3.5 z-10 h-auto p-0 text-sm font-normal hover:no-underline"
					onClick={handleStartCreate}
				>
					{labels.createTag}
				</Button>
				<DialogHeader className="shrink-0 border-b px-5 py-4 pr-36 text-left">
					<DialogTitle>{labels.title}</DialogTitle>
					<DialogDescription className="sr-only">{labels.title}</DialogDescription>
				</DialogHeader>
				<ScrollArea
					className="min-h-0 grow"
					viewportRef={viewportRef}
					viewportClassName="max-h-[min(420px,calc(100vh-180px))] p-4 [&>div]:!block"
				>
					{tags.length === 0 && draftName === null ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							{labels.empty}
						</div>
					) : (
						<div className="space-y-2">
							{draftName !== null ? (
								<RenameInput
									value={draftName}
									placeholder={labels.tagPlaceholder}
									cancelLabel={labels.cancelCreate}
									disabled={busyKey !== null}
									error={validationError}
									onChange={(value) => {
										setDraftName(value)
										setValidationError(null)
									}}
									onBlur={() => void commitDraft()}
									onCancel={() => cancelRename(resetDraft)}
								/>
							) : null}
							{tags.map((row) =>
								editingId === row.tag.id ? (
									<RenameInput
										key={row.tag.id}
										value={editingName}
										placeholder={row.tag.name}
										cancelLabel={labels.cancelEdit}
										disabled={busyKey !== null}
										error={validationError}
										onChange={(value) => {
											setEditingName(value)
											setValidationError(null)
										}}
										onBlur={() => void commitEdit(row)}
										onCancel={() =>
											cancelRename(() => {
												setEditingId(null)
												setEditingName("")
												setValidationError(null)
											})
										}
									/>
								) : (
									<div
										key={row.tag.id}
										className="flex h-12 items-center gap-3 rounded-lg border bg-muted/30 px-4"
									>
										<span className="min-w-0 flex-1 truncate text-sm text-foreground">
											{row.tag.name || row.tag.id}
											{selectedIds.includes(row.tag.id) ? (
												<span className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
													{labels.selected}
												</span>
											) : null}
										</span>
										<div className="flex shrink-0 items-center gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												className={compactActionButtonClass}
												disabled={busyKey === `delete:${row.tag.id}`}
												onClick={() => {
													resetDraft()
													setValidationError(null)
													setEditingId(row.tag.id)
													setEditingName(row.tag.name)
												}}
											>
												{labels.edit}
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-6 shrink-0 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
												disabled={busyKey === `delete:${row.tag.id}`}
												onClick={() => void handleDelete(row.tag)}
											>
												{busyKey === `delete:${row.tag.id}` ? (
													<LoaderCircle
														className="size-3 animate-spin"
														aria-hidden="true"
													/>
												) : null}
												{busyKey === `delete:${row.tag.id}`
													? labels.deleting
													: labels.delete}
											</Button>
										</div>
									</div>
								),
							)}
						</div>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}

function RenameInput({
	value,
	placeholder,
	cancelLabel,
	disabled,
	error,
	onChange,
	onBlur,
	onCancel,
}: {
	value: string
	placeholder: string
	cancelLabel: string
	disabled: boolean
	error: string | null
	onChange: (value: string) => void
	onBlur: () => void
	onCancel: () => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const isComposingRef = useRef(false)
	// Safari and some IME builds dispatch the confirming Enter after compositionend, with isComposing already false.
	const compositionEndedAtRef = useRef(0)
	// A duplicate name stays in the field. Put focus back so the row remains editable.
	useEffect(() => {
		if (error) inputRef.current?.focus()
	}, [error])

	return (
		<div>
			{/* gap-4 matches the tag item's px-4. */}
			<div className="flex h-12 items-center gap-4 rounded-lg border bg-background px-4">
				<Input
					ref={inputRef}
					autoFocus
					maxLength={100}
					value={value}
					disabled={disabled}
					placeholder={placeholder}
					aria-invalid={error ? true : undefined}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
					onCompositionStart={() => {
						isComposingRef.current = true
					}}
					onCompositionEnd={() => {
						isComposingRef.current = false
						compositionEndedAtRef.current = performance.now()
					}}
					onKeyDown={(event) => {
						const nativeEvent = event.nativeEvent
						const confirmingComposition =
							isComposingRef.current ||
							nativeEvent.isComposing ||
							nativeEvent.keyCode === 229 ||
							(event.key === "Enter" &&
								performance.now() - compositionEndedAtRef.current < 100)
						if (confirmingComposition) return
						if (event.key === "Enter") event.currentTarget.blur()
						if (event.key === "Escape") {
							event.preventDefault()
							event.stopPropagation()
							onCancel()
						}
					}}
					className="h-8 min-w-0 flex-1"
				/>
				{/* preventDefault keeps focus on the input so blur does not submit before cancel. */}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={compactActionButtonClass}
					disabled={disabled}
					onMouseDown={(event) => event.preventDefault()}
					onClick={onCancel}
				>
					{cancelLabel}
				</Button>
			</div>
			{error ? (
				<p className="px-4 pt-1 text-xs text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</div>
	)
}
