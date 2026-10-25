import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Textarea } from "@/components/shadcn-ui/textarea"
import MemberDepartmentSelector from "@/components/business/MemberDepartmentSelector"
import { cn } from "@/utils/cn"
import { NodeType, type TreeNode } from "@dtyq/user-selector"
import { Loader2, Plus, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type {
	CanvasAssetResourceInfo,
	CanvasAssetVisibilityTarget,
	CanvasEditAssetTarget,
	CanvasLocalAssetUploadMode,
	CanvasOpenSaveAssetDialogParams,
	CanvasSaveAssetToLibraryParams,
	CanvasSaveLocalAssetToLibraryParams,
	CanvasUpdateAssetParams,
} from "@/components/CanvasDesign/public/magic-types"
import { getAssetDisplayName } from "@/components/CanvasDesign/ui/toolbar/asset-library/assetLibraryMedia"
import type {
	ImageContentAssetBindingParams,
	ImageContentAssetBindingResult,
} from "@/components/CanvasDesign/runtime/resources/asset/imageContentAssetBinding"
import { useAssetTags } from "@/components/CanvasDesign/runtime/resources/asset/useAssetTags"
import AssetTagMultiSelect from "./AssetTagMultiSelect"

export interface LocalAssetFileDialogSource {
	file: File
	mode: CanvasLocalAssetUploadMode
}

type SaveAssetDialogSource =
	CanvasOpenSaveAssetDialogParams | LocalAssetFileDialogSource | CanvasEditAssetTarget

interface SaveAssetToLibraryDialogProps {
	open: boolean
	source: SaveAssetDialogSource | null
	onClose: () => void
	getPreviewUrl: (path: string) => Promise<string | undefined>
	onSave: (params: CanvasSaveAssetToLibraryParams) => Promise<CanvasAssetResourceInfo>
	onSaveLocalFile?: (
		params: CanvasSaveLocalAssetToLibraryParams,
	) => Promise<CanvasAssetResourceInfo>
	onUpdateAsset?: (assetId: string, params: CanvasUpdateAssetParams) => Promise<void>
	onBindSavedAsset: (params: ImageContentAssetBindingParams) => ImageContentAssetBindingResult
}

function isLocalAssetFileSource(
	source: SaveAssetDialogSource | null,
): source is LocalAssetFileDialogSource {
	return !!source && "file" in source && source.file instanceof File
}

function isEditAssetSource(source: SaveAssetDialogSource | null): source is CanvasEditAssetTarget {
	return !!source && "assetId" in source
}

function isWorkspaceAssetSource(
	source: SaveAssetDialogSource | null,
): source is CanvasOpenSaveAssetDialogParams {
	return Boolean(source) && !isLocalAssetFileSource(source) && !isEditAssetSource(source)
}

type VisibilityMode = "private" | "team"

/** 选择器节点的记录 ID 与接口需要的用户/部门业务 ID 不一定相同。 */
function getTargetBusinessId(target: TreeNode): string {
	if (target.dataType === NodeType.User) {
		return (target as TreeNode & { user_id?: string }).user_id || target.id
	}
	return (target as TreeNode & { department_id?: string }).department_id || target.id
}

function getTargetLabel(target: TreeNode): string {
	return target.name || target.id
}

function getVisibilityTargets(targets: TreeNode[]): TreeNode[] {
	return targets.filter(
		(target) => target.dataType === NodeType.User || target.dataType === NodeType.Department,
	)
}

function toTreeNode(target: CanvasAssetVisibilityTarget): TreeNode {
	return {
		id: target.id,
		name: target.name || target.id,
		dataType: target.type === "user" ? NodeType.User : NodeType.Department,
	} as TreeNode
}

function toFallbackTreeNode(id: string, type: CanvasAssetVisibilityTarget["type"]): TreeNode {
	return toTreeNode({ id, name: id, type })
}

/** The response interceptor already toasts business errors that include a message. */
function hasPromptedApiMessage(error: unknown): boolean {
	if (!error || typeof error !== "object" || error instanceof Error) return false
	const message = (error as { message?: unknown }).message
	return typeof message === "string" && message.length > 0
}

export default function SaveAssetToLibraryDialog({
	open,
	source,
	onClose,
	getPreviewUrl,
	onSave,
	onSaveLocalFile,
	onUpdateAsset,
	onBindSavedAsset,
}: SaveAssetToLibraryDialogProps) {
	const { t } = useTranslation("super")
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [visibility, setVisibility] = useState<VisibilityMode>("private")
	const [selectedTargets, setSelectedTargets] = useState<TreeNode[]>([])
	const [pendingTargets, setPendingTargets] = useState<TreeNode[]>([])
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
	const [previewUrl, setPreviewUrl] = useState<string>()
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [selectorOpen, setSelectorOpen] = useState(false)
	const [tagManagerOpen, setTagManagerOpen] = useState(false)
	const [error, setError] = useState<string>()
	const { tagGroups, loading: loadingTags, createTag, updateTag, deleteTag } = useAssetTags(open)
	const getPreviewUrlRef = useRef(getPreviewUrl)
	const localFileSource = isLocalAssetFileSource(source) ? source : null
	const editSource = isEditAssetSource(source) ? source : null
	const workspaceSource = isWorkspaceAssetSource(source) ? source : null
	const sourcePath = workspaceSource?.path
	const sourceName = localFileSource
		? getAssetDisplayName(localFileSource.file.name)
		: workspaceSource?.name
	const sourceIdentity = editSource
		? `edit:${editSource.assetId}`
		: localFileSource
			? `${localFileSource.file.name}:${localFileSource.file.size}:${localFileSource.file.lastModified}`
			: sourcePath
	const previewIsVideo = editSource
		? editSource.mediaType === "video"
		: localFileSource
			? localFileSource.file.type.startsWith("video/") ||
				/\.(mp4|mov|webm)$/i.test(localFileSource.file.name)
			: /\.(mp4|mov|webm)(?:$|[?#])/i.test(sourcePath ?? "")
	const visibilityEditable = !editSource || editSource.visibilityEditable === true
	const initialEditTargets = useMemo(() => {
		if (!editSource) return []
		if (editSource.visibilityTargets?.length) {
			return editSource.visibilityTargets.map(toTreeNode)
		}
		return [
			...(editSource.userIds ?? []).map((id) => toFallbackTreeNode(id, "user")),
			...(editSource.departmentIds ?? []).map((id) => toFallbackTreeNode(id, "department")),
		]
	}, [editSource])

	useEffect(() => {
		getPreviewUrlRef.current = getPreviewUrl
	}, [getPreviewUrl])

	// 表单状态只在切换素材或重新打开弹窗时初始化，不跟随宿主方法引用变化。
	useEffect(() => {
		if (!open || !sourceIdentity) return

		setName(editSource?.name ?? sourceName ?? "")
		setDescription(editSource?.description ?? "")
		setVisibility(editSource?.visibility ?? "private")
		setSelectedTargets(initialEditTargets)
		setPendingTargets(initialEditTargets)
		setSelectedTagIds(editSource?.tagIds ?? [])
		setPreviewUrl(editSource?.fileUrl ?? undefined)
		setSelectorOpen(false)
		setError(undefined)
		setLoading(!localFileSource && !editSource)
	}, [editSource, initialEditTargets, open, sourceIdentity, sourceName, localFileSource])

	const localPreviewFile = localFileSource?.file

	// 本地上传还没有工作区路径，预览直接使用 File。
	useEffect(() => {
		if (!open || !localPreviewFile) return

		const objectUrl = URL.createObjectURL(localPreviewFile)
		setPreviewUrl(objectUrl)
		setLoading(false)
		return () => {
			URL.revokeObjectURL(objectUrl)
		}
	}, [localPreviewFile, open])

	// 预览只绑定资源路径；getPreviewUrl 通过 ref 获取最新实现，避免宿主重渲染导致重复请求。
	useEffect(() => {
		if (!open || !sourcePath || localFileSource) return

		let cancelled = false
		setLoading(true)
		void getPreviewUrlRef
			.current(sourcePath)
			.then((url) => {
				if (cancelled) return
				setPreviewUrl(url)
				setLoading(false)
			})
			.catch(() => {
				if (cancelled) return
				setPreviewUrl(undefined)
				setLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [localFileSource, open, sourcePath])

	const handleSubmit = async () => {
		const trimmedName = name.trim()
		if (!trimmedName) {
			setError(t("assetLibrarySave.nameRequired"))
			return
		}
		if (
			visibilityEditable &&
			visibility === "team" &&
			getVisibilityTargets(selectedTargets).length === 0
		) {
			setError(t("assetLibrarySave.visibilityTargetRequired"))
			return
		}
		if (!source || saving) return

		setError(undefined)
		setSaving(true)
		try {
			if (editSource) {
				if (!onUpdateAsset) return
				await onUpdateAsset(editSource.assetId, {
					name: trimmedName,
					description: description.trim(),
					// The edit endpoint replaces the complete visibility set. Send empty
					// arrays when switching to private so previous team grants are removed.
					userIds: visibilityEditable
						? visibility === "team"
							? selectedTargets
									.filter((target) => target.dataType === NodeType.User)
									.map(getTargetBusinessId)
							: []
						: undefined,
					departmentIds: visibilityEditable
						? visibility === "team"
							? selectedTargets
									.filter((target) => target.dataType === NodeType.Department)
									.map(getTargetBusinessId)
							: []
						: undefined,
					tagIds: selectedTagIds,
				})
				toast.success(t("assetLibrarySave.editSuccess"))
				onClose()
				return
			}

			if (localFileSource) {
				if (!onSaveLocalFile) return
				await onSaveLocalFile({
					file: localFileSource.file,
					mode: localFileSource.mode,
					name: trimmedName,
					description: description.trim() || null,
					userIds:
						visibility === "team"
							? selectedTargets
									.filter((target) => target.dataType === NodeType.User)
									.map(getTargetBusinessId)
							: undefined,
					departmentIds:
						visibility === "team"
							? selectedTargets
									.filter((target) => target.dataType === NodeType.Department)
									.map(getTargetBusinessId)
							: undefined,
					tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
				})
				toast.success(t("assetLibrarySave.success"))
				onClose()
				return
			}

			if (!workspaceSource) return
			const asset = await onSave({
				elementId: workspaceSource.elementId,
				contentId: workspaceSource.contentId,
				path: workspaceSource.path,
				name: trimmedName,
				description: description.trim() || null,
				userIds:
					visibility === "team"
						? selectedTargets
								.filter((target) => target.dataType === NodeType.User)
								.map(getTargetBusinessId)
						: undefined,
				departmentIds:
					visibility === "team"
						? selectedTargets
								.filter((target) => target.dataType === NodeType.Department)
								.map(getTargetBusinessId)
						: undefined,
				tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
			})
			let bindingResult: ImageContentAssetBindingResult
			try {
				bindingResult = onBindSavedAsset({
					elementId: workspaceSource.elementId,
					contentId: workspaceSource.contentId,
					sourcePath: workspaceSource.path,
					assetId: asset.assetId,
				})
			} catch {
				// 素材已经保存成功，绑定异常不能让用户重试并创建重复素材。
				bindingResult = "target-missing"
			}
			if (bindingResult === "bound" || bindingResult === "already-bound") {
				toast.success(t("assetLibrarySave.success"))
			} else {
				toast.warning(t("assetLibrarySave.bindingSkipped"))
			}
			onClose()
		} catch (saveError) {
			toast.error(
				saveError instanceof Error ? saveError.message : t("assetLibrarySave.saveFailed"),
			)
		} finally {
			setSaving(false)
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !saving) onClose()
			}}
		>
			<DialogContent
				className="flex max-h-[calc(100vh-40px)] w-[min(780px,calc(100vw-32px))] max-w-[780px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[780px]"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onPointerDownOutside={(event) => {
					// Nested pickers portal outside this dialog. Ignore those events so
					// choosing members or managing tags does not dismiss the save form.
					if (selectorOpen || tagManagerOpen) {
						event.preventDefault()
						event.stopPropagation()
					}
				}}
				onFocusOutside={(event) => {
					if (selectorOpen || tagManagerOpen) {
						event.preventDefault()
						event.stopPropagation()
					}
				}}
				onEscapeKeyDown={(event) => {
					// The tag manager is its own dialog layer and consumes Escape.
					// The member selector is not, so this dialog must ignore Escape while it is open.
					if (selectorOpen) {
						event.preventDefault()
						event.stopPropagation()
					}
				}}
				data-testid="save-asset-to-library-dialog"
			>
				<DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
					<DialogTitle>
						{editSource ? t("assetLibrarySave.editTitle") : t("assetLibrarySave.title")}
					</DialogTitle>
					<DialogDescription>
						{editSource
							? t("assetLibrarySave.editDescription")
							: t("assetLibrarySave.description")}
					</DialogDescription>
				</DialogHeader>

				{/* Avoid a percentage-height cycle between this auto-sized dialog and Radix's viewport. */}
				<ScrollArea
					className="max-h-[calc(100vh-180px)] min-h-0"
					viewportClassName="!h-auto max-h-[calc(100vh-180px)]"
				>
					<div className="grid grid-cols-1 gap-6 px-5 py-5 sm:grid-cols-[180px_minmax(0,1fr)]">
						<div className="w-full max-w-[180px] space-y-2">
							<div className="relative flex aspect-square w-full max-w-[180px] items-center justify-center overflow-hidden rounded-lg bg-muted">
								{loading ? (
									<Loader2
										className="size-5 animate-spin text-muted-foreground"
										aria-hidden="true"
									/>
								) : previewUrl && previewIsVideo ? (
									<video
										src={previewUrl}
										muted
										playsInline
										controls
										className="absolute inset-0 h-full w-full object-contain"
									/>
								) : previewUrl ? (
									<img
										src={previewUrl}
										alt={name || t("assetLibrarySave.preview")}
										className="absolute inset-0 h-full w-full object-contain"
									/>
								) : (
									<span className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
										{t("assetLibrarySave.previewUnavailable")}
									</span>
								)}
							</div>
						</div>

						<div className="min-w-0 space-y-5">
							<label className="block space-y-2">
								<span className="text-sm font-medium text-foreground">
									{t("assetLibrarySave.nameLabel")}
									<span className="ml-1 text-destructive">*</span>
								</span>
								<div className="relative">
									<Input
										value={name}
										maxLength={255}
										placeholder={t("assetLibrarySave.namePlaceholder")}
										onChange={(event) => {
											setName(event.target.value)
											setError(undefined)
										}}
										aria-invalid={Boolean(error && !name.trim())}
									/>
									<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
										{name.length}/255
									</span>
								</div>
							</label>

							<label className="block space-y-2">
								<span className="text-sm font-medium text-foreground">
									{t("assetLibrarySave.descriptionLabel")}
								</span>
								<Textarea
									value={description}
									rows={3}
									placeholder={t("assetLibrarySave.descriptionPlaceholder")}
									onChange={(event) => setDescription(event.target.value)}
								/>
							</label>

							<div className="space-y-2">
								<span className="text-sm font-medium text-foreground">
									{t("assetLibrarySave.visibilityLabel")}
									<span className="ml-1 text-destructive">*</span>
								</span>
								<div className="grid grid-cols-2 rounded-lg border bg-muted/40 p-1">
									{(["private", "team"] as const).map((mode) => (
										<button
											key={mode}
											type="button"
											disabled={!visibilityEditable}
											className={cn(
												"rounded-md px-3 py-2 text-sm font-medium transition-colors",
												visibility === mode
													? "bg-background text-primary shadow-sm"
													: "text-muted-foreground hover:text-foreground",
											)}
											onClick={() => {
												setVisibility(mode)
												setError(undefined)
											}}
										>
											{mode === "private"
												? t("assetLibrarySave.privateVisibility")
												: t("assetLibrarySave.teamVisibility")}
										</button>
									))}
								</div>
								{!visibilityEditable ? (
									<p className="text-xs text-muted-foreground">
										{t("assetLibrarySave.visibilityReadOnly")}
									</p>
								) : visibility === "private" ? (
									<p className="text-xs text-muted-foreground">
										{t("assetLibrarySave.privateHint")}
									</p>
								) : (
									<div className="space-y-2">
										<div className="flex flex-wrap gap-1.5">
											{selectedTargets.map((target) => (
												<span
													key={`${target.dataType}-${getTargetBusinessId(target)}`}
													className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground"
												>
													<span className="truncate">
														{getTargetLabel(target)}
													</span>
													{visibilityEditable ? (
														<button
															type="button"
															className="text-muted-foreground hover:text-foreground"
															aria-label={t(
																"assetLibrarySave.removeTarget",
															)}
															onClick={() =>
																setSelectedTargets((current) =>
																	current.filter(
																		(item) =>
																			item.dataType !==
																				target.dataType ||
																			getTargetBusinessId(
																				item,
																			) !==
																				getTargetBusinessId(
																					target,
																				),
																	),
																)
															}
														>
															<X
																className="size-3"
																aria-hidden="true"
															/>
														</button>
													) : null}
												</span>
											))}
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="gap-1.5"
											onClick={() => {
												// The selector edits a draft. Rebuild it from the last confirmed
												// targets whenever it opens so a cancelled edit cannot leak into
												// the next session.
												setPendingTargets(selectedTargets)
												setSelectorOpen(true)
											}}
										>
											<Plus className="size-4" aria-hidden="true" />
											{t("assetLibrarySave.selectTargets")}
										</Button>
									</div>
								)}
							</div>

							<div className="space-y-2">
								<span className="text-sm font-medium text-foreground">
									{t("assetLibrarySave.tagsLabel")}
								</span>
								{loadingTags ? (
									<div className="flex min-h-10 items-center text-xs text-muted-foreground">
										<Loader2
											className="mr-1.5 size-3.5 animate-spin"
											aria-hidden="true"
										/>
										{t("assetLibrarySave.loadingTags")}
									</div>
								) : (
									<AssetTagMultiSelect
										groups={tagGroups}
										value={selectedTagIds}
										onChange={setSelectedTagIds}
										label={t("assetLibrarySave.tagsLabel")}
										placeholder={t("assetLibrarySave.tagsPlaceholder")}
										searchPlaceholder={t(
											"assetLibrarySave.tagsSearchPlaceholder",
										)}
										emptyText={t("assetLibrarySave.noMatchingTags")}
										removeLabel={t("assetLibrarySave.removeTag")}
										labels={{
											manage: t("assetLibrarySave.manageTags"),
											title: t("assetLibrarySave.manageTags"),
											createTag: t("assetLibrarySave.createTag"),
											customGroup: t("assetLibrarySave.customTags"),
											tagPlaceholder: t("assetLibrarySave.tagPlaceholder"),
											edit: t("assetLibrarySave.editTag"),
											delete: t("assetLibrarySave.deleteTag"),
											deleting: t("assetLibrarySave.deletingTag"),
											cancelEdit: t("assetLibrarySave.cancelEdit"),
											cancelCreate: t("assetLibrarySave.cancelCreate"),
											empty: t("assetLibrarySave.noCustomTags"),
											selected: t("assetLibrarySave.tagSelected"),
											selectedCount: t("assetLibrarySave.selectedCount", {
												count: selectedTagIds.length,
											}),
											clear: t("assetLibrarySave.clearTags"),
											duplicate: t("assetLibrarySave.tagDuplicate"),
										}}
										onManagerOpenChange={setTagManagerOpen}
										onCreateTag={createTag}
										onUpdateTag={updateTag}
										onDeleteTag={deleteTag}
										onMutationError={(mutationError) => {
											if (hasPromptedApiMessage(mutationError)) return
											toast.error(
												mutationError instanceof Error
													? mutationError.message
													: t("assetLibrarySave.tagMutationFailed"),
											)
										}}
									/>
								)}
							</div>

							{error ? <p className="text-sm text-destructive">{error}</p> : null}
						</div>
					</div>
				</ScrollArea>

				<DialogFooter className="shrink-0 border-t px-5 py-3 sm:items-center">
					<Button type="button" variant="outline" onClick={onClose} disabled={saving}>
						{t("assetLibrarySave.cancel")}
					</Button>
					<Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
						{saving ? (
							<Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
						) : null}
						{editSource
							? t("assetLibrarySave.save")
							: localFileSource?.mode === "verify"
								? t("assetLibrarySave.saveAndVerify")
								: t("assetLibrarySave.save")}
					</Button>
				</DialogFooter>
			</DialogContent>

			<MemberDepartmentSelector
				open={selectorOpen}
				title={t("assetLibrarySave.selectTargets")}
				selectedValues={pendingTargets}
				onSelectChange={(values) =>
					setPendingTargets(getVisibilityTargets(values as TreeNode[]))
				}
				onOk={(values) => {
					const confirmedTargets = getVisibilityTargets(values as TreeNode[])
					setSelectedTargets(confirmedTargets)
					setPendingTargets(confirmedTargets)
					setSelectorOpen(false)
				}}
				// MemberDepartmentSelector invokes onCancel after onOk to clear its
				// navigation state. Do not roll back the draft here; opening the
				// selector above already rehydrates it from selectedTargets.
				onCancel={() => setSelectorOpen(false)}
				zIndex={1600}
			/>
		</Dialog>
	)
}
