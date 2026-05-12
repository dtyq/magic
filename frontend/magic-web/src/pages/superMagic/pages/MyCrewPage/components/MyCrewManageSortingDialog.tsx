import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
	closestCorners,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from "@dnd-kit/core"
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Loader2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import { SuperMagicApi } from "@/apis"
import { refreshFeaturedModeList } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import { roleStore } from "@/pages/superMagic/stores"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import type {
	SuperMagicAgentFeaturedSortListItem,
	SuperMagicAgentOrderItem,
} from "@/apis/modules/superMagic"
import {
	createSortingDraft,
	DISPLAYED_CONTAINER_ID,
	hasSortingDraftChanged,
	HIDDEN_CONTAINER_ID,
	moveSortableCrewAgentToIndex,
	resolveSortingContainerId,
	resolveSortableAgentOrderValue,
	serializeSortingDraft,
	type SortableCrewAgent,
	type SortingDraft,
} from "./my-crew-manage-sorting-dialog.shared"

interface MyCrewManageSortingDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface SortingPreview {
	targetContainerId: string
	targetIndex: number
}

const START_DROP_ZONE_SUFFIX = "__start-drop-zone"
const END_DROP_ZONE_SUFFIX = "__end-drop-zone"

interface SortableCrewPlaceholder {
	id: string
	name: string
	icon?: SortableCrewAgent["icon"]
	isPlaceholder: true
}

interface SortingDisplayDraft {
	displayed: SortableCrewDisplayItem[]
	hidden: SortableCrewDisplayItem[]
}

type SortableCrewDisplayItem = SortableCrewAgent | SortableCrewPlaceholder

export function MyCrewManageSortingDialog({ open, onOpenChange }: MyCrewManageSortingDialogProps) {
	const { t } = useTranslation("crew/market")
	const [draft, setDraft] = useState<SortingDraft>(() => createSortingDraft())
	const [initialDraft, setInitialDraft] = useState<SortingDraft>(() => createSortingDraft())
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [hasLoadFailed, setHasLoadFailed] = useState(false)
	const [reloadNonce, setReloadNonce] = useState(0)
	const [activeItemId, setActiveItemId] = useState<string | null>(null)
	const [preview, setPreview] = useState<SortingPreview | null>(null)
	const previewRef = useRef<SortingPreview | null>(null)

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	const hasChanges = useMemo(
		() => hasSortingDraftChanged(draft, initialDraft),
		[draft, initialDraft],
	)

	const loadSortingConfig = useCallback(async () => {
		setIsLoading(true)
		setHasLoadFailed(false)

		try {
			const response = await SuperMagicApi.getAgentFeaturedSortList()
			const nextDraft = createSortingDraft({
				frequent: response.frequent.map(mapSortableCrewAgent),
				all: response.all.map(mapSortableCrewAgent),
			})

			setDraft(nextDraft)
			setInitialDraft(nextDraft)
		} catch {
			setHasLoadFailed(true)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		if (!open) return
		void loadSortingConfig()
	}, [loadSortingConfig, open, reloadNonce])

	const activeItem = useMemo(
		() => findSortableCrewAgentById(draft, activeItemId),
		[draft, activeItemId],
	)

	const displayDraft = useMemo(
		() =>
			buildSortingDisplayDraft({
				draft,
				activeItem,
				activeItemId,
				preview,
			}),
		[draft, activeItem, activeItemId, preview],
	)

	function clearDragState() {
		setActiveItemId(null)
		previewRef.current = null
		setPreview(null)
	}

	function updatePreview(nextPreview: SortingPreview | null) {
		previewRef.current = nextPreview
		setPreview((currentPreview) => {
			if (areSortingPreviewsEqual(currentPreview, nextPreview)) return currentPreview
			return nextPreview
		})
	}

	const handleDragStart = useCallback((event: DragStartEvent) => {
		setActiveItemId(String(event.active.id))
		updatePreview(null)
	}, [])

	const handleDragOver = useCallback(
		(event: DragOverEvent) => {
			const { active, over } = event
			if (!over) {
				updatePreview(null)
				return
			}

			const nextPreview = resolveSortingPreview({
				draft,
				activeId: String(active.id),
				overId: String(over.id),
				activeRectTop: active.rect.current.translated?.top,
				activeRectHeight: active.rect.current.translated?.height,
				overRectTop: over.rect.top,
				overRectHeight: over.rect.height,
			})

			updatePreview(nextPreview)
		},
		[draft],
	)

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event
			if (!over) {
				clearDragState()
				return
			}

			const activeId = String(active.id)
			const nextPreview =
				previewRef.current ??
				resolveSortingPreview({
					draft,
					activeId,
					overId: String(over.id),
					activeRectTop: active.rect.current.translated?.top,
					activeRectHeight: active.rect.current.translated?.height,
					overRectTop: over.rect.top,
					overRectHeight: over.rect.height,
				})

			if (!nextPreview) {
				clearDragState()
				return
			}

			const activeContainerId = resolveSortingContainerId(draft, activeId)
			if (
				activeContainerId === DISPLAYED_CONTAINER_ID &&
				nextPreview.targetContainerId === HIDDEN_CONTAINER_ID &&
				draft.displayed.length <= 1
			) {
				magicToast.warning(t("myCrewPage.sortingDialog.atLeastOneDisplayed"))
				clearDragState()
				return
			}

			setDraft((currentDraft) =>
				moveSortableCrewAgentToIndex({
					draft: currentDraft,
					activeId,
					targetContainerId: nextPreview.targetContainerId,
					targetIndex: nextPreview.targetIndex,
				}),
			)
			clearDragState()
		},
		[draft, t],
	)

	const handleRetry = useCallback(() => {
		setReloadNonce((value) => value + 1)
	}, [])

	const handleCancel = useCallback(() => {
		setDraft(initialDraft)
		clearDragState()
		onOpenChange(false)
	}, [initialDraft, onOpenChange])

	const handleSave = useCallback(async () => {
		if (draft.displayed.length === 0) {
			magicToast.warning(t("myCrewPage.sortingDialog.atLeastOneDisplayed"))
			return
		}

		const nextVisibleRole = resolveNextVisibleRoleAfterHiding({
			currentRole: roleStore.currentRole,
			previousDisplayed: initialDraft.displayed,
			draft,
		})

		setIsSaving(true)
		try {
			await SuperMagicApi.sortAgents({
				data: serializeSortingDraft(draft),
			})
			if (nextVisibleRole) roleStore.setCurrentRole(nextVisibleRole)
			setInitialDraft(draft)
			try {
				await refreshFeaturedModeList()
			} catch {
				// Sort saved; home mode list refresh failed — timer/retry may recover
			}
			onOpenChange(false)
		} catch {
			magicToast.error(t("myCrewPage.sortingDialog.saveFailed"))
		} finally {
			setIsSaving(false)
		}
	}, [draft, initialDraft.displayed, onOpenChange, t])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="w-[720px] !max-w-[calc(100vw-3rem)] gap-0 overflow-hidden p-0 shadow-lg"
				data-testid="my-crew-sorting-dialog"
			>
				<div className="flex items-center border-b border-border px-3 py-3">
					<h2
						className="flex-1 text-base font-semibold leading-6 text-foreground"
						data-testid="my-crew-sorting-dialog-title"
					>
						{t("myCrewPage.sortingDialog.title")}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 rounded-xs text-muted-foreground hover:text-foreground"
						onClick={() => onOpenChange(false)}
						aria-label={t("myCrewPage.sortingDialog.cancel")}
						data-testid="my-crew-sorting-dialog-close"
					>
						<X className="size-4" />
					</Button>
				</div>

				<div className="flex h-[400px] min-h-0 min-w-0 items-stretch">
					{isLoading ? (
						<div
							className="flex flex-1 items-center justify-center"
							data-testid="my-crew-sorting-dialog-loading"
						>
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : hasLoadFailed ? (
						<div
							className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
							data-testid="my-crew-sorting-dialog-error"
						>
							<p className="text-sm text-muted-foreground">
								{t("myCrewPage.sortingDialog.loadFailed")}
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRetry}
								data-testid="my-crew-sorting-dialog-retry"
							>
								{t("myCrewPage.sortingDialog.retry")}
							</Button>
						</div>
					) : (
						<DndContext
							sensors={sensors}
							collisionDetection={closestCorners}
							onDragOver={handleDragOver}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onDragCancel={clearDragState}
						>
							<SortingColumn
								containerId={DISPLAYED_CONTAINER_ID}
								title={t("myCrewPage.sortingDialog.displayed", {
									count: displayDraft.displayed.filter(
										(item) => !isPlaceholderItem(item),
									).length,
								})}
								items={displayDraft.displayed}
								activeItemId={activeItemId}
								hasPreview={preview != null}
								dataTestId="my-crew-sorting-displayed"
							/>
							<Separator orientation="vertical" />
							<SortingColumn
								containerId={HIDDEN_CONTAINER_ID}
								title={t("myCrewPage.sortingDialog.hidden", {
									count: displayDraft.hidden.filter(
										(item) => !isPlaceholderItem(item),
									).length,
								})}
								items={displayDraft.hidden}
								activeItemId={activeItemId}
								hasPreview={preview != null}
								dataTestId="my-crew-sorting-hidden"
							/>
							{typeof document !== "undefined"
								? createPortal(
										<DragOverlay dropAnimation={null} zIndex={100000}>
											{activeItem ? (
												<div className="w-[300px] max-w-[calc(50vw-4rem)]">
													<CrewRowCard item={activeItem} isOverlay />
												</div>
											) : null}
										</DragOverlay>,
										document.body,
									)
								: null}
						</DndContext>
					)}
				</div>

				<div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-3">
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={isSaving}
						data-testid="my-crew-sorting-dialog-cancel"
					>
						{t("myCrewPage.sortingDialog.cancel")}
					</Button>
					<Button
						onClick={() => void handleSave()}
						disabled={!hasChanges || isSaving || isLoading || hasLoadFailed}
						data-testid="my-crew-sorting-dialog-save"
					>
						{isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
						{t("myCrewPage.sortingDialog.save")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

interface SortingColumnProps {
	containerId: string
	title: string
	items: SortableCrewDisplayItem[]
	activeItemId: string | null
	hasPreview: boolean
	dataTestId: string
}

function SortingColumn({
	containerId,
	title,
	items,
	activeItemId,
	hasPreview,
	dataTestId,
}: SortingColumnProps) {
	const { isOver, setNodeRef } = useDroppable({
		id: containerId,
	})

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3">
			<div className="truncate text-sm font-medium leading-5 text-foreground">{title}</div>
			<ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block [&_[data-slot='scroll-area-viewport']>div]:!w-full">
				<div
					ref={setNodeRef}
					className={cn(
						"flex min-h-full w-full min-w-0 flex-col gap-1.5 pb-2 transition-colors",
						isOver && "bg-accent/20",
					)}
					data-testid={dataTestId}
				>
					<SortableContext
						items={items
							.filter((item) => !isPlaceholderItem(item))
							.map((item) => item.id)}
						strategy={verticalListSortingStrategy}
					>
						<SortingStartDropZone containerId={containerId} />
						{items.map((item) =>
							isPlaceholderItem(item) ? (
								<SortingPlaceholderRow key={item.id} item={item} />
							) : (
								<SortableCrewRow
									key={item.id}
									item={item}
									isGhost={item.id === activeItemId && !hasPreview}
								/>
							),
						)}
						<SortingEndDropZone containerId={containerId} />
					</SortableContext>
				</div>
			</ScrollArea>
		</div>
	)
}

function SortingStartDropZone({ containerId }: { containerId: string }) {
	const { isOver, setNodeRef } = useDroppable({
		id: createSortingStartDropZoneId(containerId),
	})

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"-mb-1 h-3 w-full shrink-0 rounded-md transition-colors",
				isOver && "bg-primary/6",
			)}
			data-testid={`${containerId}-start-drop-zone`}
		/>
	)
}

function SortingEndDropZone({ containerId }: { containerId: string }) {
	const { isOver, setNodeRef } = useDroppable({
		id: createSortingEndDropZoneId(containerId),
	})

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"-mt-1 h-3 w-full shrink-0 rounded-md transition-colors",
				isOver && "bg-primary/6",
			)}
			data-testid={`${containerId}-end-drop-zone`}
		/>
	)
}

function SortableCrewRow({
	item,
	isGhost = false,
}: {
	item: SortableCrewAgent
	isGhost?: boolean
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
	})

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition: isDragging ? "none" : transition,
			}}
			data-testid={`my-crew-sorting-item-${item.id}`}
		>
			<CrewRowCard
				item={item}
				isDragging={isDragging}
				isGhost={isGhost}
				dragHandleProps={{
					...attributes,
					...listeners,
					"data-testid": `my-crew-sorting-drag-${item.id}`,
				}}
			/>
		</div>
	)
}

function SortingPlaceholderRow({ item }: { item: SortableCrewPlaceholder }) {
	return (
		<div
			className="flex w-full min-w-0 items-center gap-2 rounded-full border border-dashed border-primary/45 bg-primary/5 py-[3px] pl-[3px] pr-4 shadow-xs"
			data-testid="my-crew-sorting-placeholder"
		>
			<CrewSortingAvatar item={item} />
			<div className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-primary/80">
				{item.name}
			</div>
			<div className="size-7 shrink-0" aria-hidden />
		</div>
	)
}

function CrewRowCard({
	item,
	isDragging = false,
	isGhost = false,
	isOverlay = false,
	dragHandleProps,
}: {
	item: SortableCrewAgent
	isDragging?: boolean
	isGhost?: boolean
	isOverlay?: boolean
	dragHandleProps?: Record<string, unknown>
}) {
	return (
		<div
			className={cn(
				"flex w-full min-w-0 items-center gap-2 rounded-full border border-border bg-background py-[3px] pl-[3px] pr-4 shadow-xs transition-shadow",
				isDragging && "border-primary/50 shadow-md",
				isGhost && "opacity-0",
				isOverlay && "rotate-1 shadow-lg ring-1 ring-primary/10",
			)}
		>
			<CrewSortingAvatar item={item} />
			<div className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-foreground">
				{item.name}
			</div>
			<button
				type="button"
				className={cn(
					"flex size-7 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
					isDragging || isOverlay ? "cursor-grabbing text-foreground" : "cursor-grab",
				)}
				aria-label={item.name}
				{...(dragHandleProps ?? {})}
			>
				<GripVertical className="size-4" />
			</button>
		</div>
	)
}

function CrewSortingAvatar({ item }: { item: Pick<SortableCrewAgent, "icon"> }) {
	const avatarUrl = item.icon?.url?.trim()

	if (avatarUrl)
		return (
			<div className="size-[34px] shrink-0 overflow-hidden rounded-full border-[3px] border-popover shadow-sm">
				<img src={avatarUrl} alt="" className="size-full object-cover" draggable={false} />
			</div>
		)

	return (
		<div className="flex size-[34px] shrink-0 items-center justify-center rounded-full border-[3px] border-popover bg-muted text-muted-foreground shadow-sm">
			<CrewFallbackAvatar iconSize={20} />
		</div>
	)
}

function mapSortableCrewAgent(
	item: SuperMagicAgentOrderItem | SuperMagicAgentFeaturedSortListItem,
): SortableCrewAgent {
	const orderItem = item as Partial<SuperMagicAgentOrderItem>
	const logoUrl = "logo" in item ? item.logo?.trim() : undefined
	const avatarUrl = logoUrl || orderItem.icon?.url?.trim()

	return {
		id: item.id,
		agentCode: item.code,
		code: item.code,
		name: item.name?.trim() || item.code?.trim() || item.id,
		description: orderItem.description,
		icon: avatarUrl ? { url: avatarUrl } : orderItem.icon,
		icon_type: orderItem.icon_type ?? null,
	}
}

function buildSortingDisplayDraft({
	draft,
	activeItem,
	activeItemId,
	preview,
}: {
	draft: SortingDraft
	activeItem: SortableCrewAgent | null
	activeItemId: string | null
	preview: SortingPreview | null
}): SortingDisplayDraft {
	if (!activeItem || !activeItemId || !preview)
		return {
			displayed: draft.displayed,
			hidden: draft.hidden,
		}

	const displayed = draft.displayed.filter((item) => item.id !== activeItemId)
	const hidden = draft.hidden.filter((item) => item.id !== activeItemId)
	const placeholder = createSortingPlaceholderItem(activeItem)

	if (preview.targetContainerId === DISPLAYED_CONTAINER_ID) {
		const nextDisplayed = [...displayed]
		nextDisplayed.splice(
			clampSortingIndex(preview.targetIndex, nextDisplayed.length),
			0,
			placeholder,
		)
		return {
			displayed: nextDisplayed,
			hidden,
		}
	}

	const nextHidden = [...hidden]
	nextHidden.splice(clampSortingIndex(preview.targetIndex, nextHidden.length), 0, placeholder)
	return {
		displayed,
		hidden: nextHidden,
	}
}

function findSortableCrewAgentById(draft: SortingDraft, itemId: string | null) {
	if (!itemId) return null
	return [...draft.displayed, ...draft.hidden].find((item) => item.id === itemId) ?? null
}

function resolveNextVisibleRoleAfterHiding({
	currentRole,
	previousDisplayed,
	draft,
}: {
	currentRole: TopicMode
	previousDisplayed: SortableCrewAgent[]
	draft: SortingDraft
}): TopicMode | null {
	const displayedRoleIds = new Set(draft.displayed.map(resolveSortableAgentOrderValue))
	if (displayedRoleIds.has(currentRole)) return null

	const previousDisplayedRoles = previousDisplayed.map(resolveSortableAgentOrderValue)
	const currentRoleIndex = previousDisplayedRoles.findIndex((roleId) => roleId === currentRole)
	if (currentRoleIndex < 0) return null

	const fallbackIndex = Math.min(currentRoleIndex, draft.displayed.length - 1)
	if (fallbackIndex < 0) return null

	return resolveSortableAgentOrderValue(draft.displayed[fallbackIndex]) as TopicMode
}

function resolveSortingPreview({
	draft,
	activeId,
	overId,
	activeRectTop,
	activeRectHeight,
	overRectTop,
	overRectHeight,
}: {
	draft: SortingDraft
	activeId: string
	overId: string
	activeRectTop?: number
	activeRectHeight?: number
	overRectTop?: number
	overRectHeight?: number
}): SortingPreview | null {
	const targetContainerId = resolvePreviewContainerId(draft, overId)
	const activeContainerId = resolveSortingContainerId(draft, activeId)
	if (!targetContainerId || !activeContainerId) return null

	if (
		activeContainerId === DISPLAYED_CONTAINER_ID &&
		targetContainerId === HIDDEN_CONTAINER_ID &&
		draft.displayed.length <= 1
	)
		return null

	const targetItems =
		targetContainerId === DISPLAYED_CONTAINER_ID ? draft.displayed : draft.hidden
	const activeIndex = targetItems.findIndex((item) => item.id === activeId)
	if (overId === createSortingStartDropZoneId(targetContainerId))
		return {
			targetContainerId,
			targetIndex: 0,
		}

	if (overId === createSortingEndDropZoneId(targetContainerId)) {
		const nextTargetIndex = targetItems.length
		return {
			targetContainerId,
			targetIndex:
				activeContainerId === targetContainerId &&
				activeIndex >= 0 &&
				nextTargetIndex > activeIndex
					? nextTargetIndex - 1
					: nextTargetIndex,
		}
	}

	const overIndex =
		overId === targetContainerId
			? targetItems.length
			: targetItems.findIndex((item) => item.id === overId)

	if (overIndex < 0 && overId !== targetContainerId) return null

	if (activeContainerId === targetContainerId && overId === activeId)
		return {
			targetContainerId,
			targetIndex: activeIndex,
		}

	const isBelowOverItem = resolveIsBelowOverItem({
		activeRectTop,
		activeRectHeight,
		overRectTop,
		overRectHeight,
	})
	const nextTargetIndex =
		overId === targetContainerId ? targetItems.length : overIndex + (isBelowOverItem ? 1 : 0)

	return {
		targetContainerId,
		targetIndex:
			activeContainerId === targetContainerId &&
			activeIndex >= 0 &&
			nextTargetIndex > activeIndex
				? nextTargetIndex - 1
				: nextTargetIndex,
	}
}

function resolveIsBelowOverItem({
	activeRectTop,
	activeRectHeight,
	overRectTop,
	overRectHeight,
}: {
	activeRectTop?: number
	activeRectHeight?: number
	overRectTop?: number
	overRectHeight?: number
}) {
	if (
		activeRectTop == null ||
		activeRectHeight == null ||
		overRectTop == null ||
		overRectHeight == null
	)
		return false

	return activeRectTop + activeRectHeight / 4 > overRectTop + overRectHeight / 2
}

function areSortingPreviewsEqual(
	currentPreview: SortingPreview | null,
	nextPreview: SortingPreview | null,
) {
	if (currentPreview == null && nextPreview == null) return true
	if (currentPreview == null || nextPreview == null) return false
	return (
		currentPreview.targetContainerId === nextPreview.targetContainerId &&
		currentPreview.targetIndex === nextPreview.targetIndex
	)
}

function createSortingPlaceholderItem(item: SortableCrewAgent): SortableCrewPlaceholder {
	return {
		id: "__my-crew-sorting-placeholder__",
		name: item.name,
		icon: item.icon,
		isPlaceholder: true,
	}
}

function isPlaceholderItem(item: SortableCrewDisplayItem): item is SortableCrewPlaceholder {
	return "isPlaceholder" in item
}

function clampSortingIndex(targetIndex: number, itemsLength: number) {
	if (targetIndex <= 0) return 0
	if (targetIndex >= itemsLength) return itemsLength
	return targetIndex
}

function createSortingStartDropZoneId(containerId: string) {
	return `${containerId}${START_DROP_ZONE_SUFFIX}`
}

function createSortingEndDropZoneId(containerId: string) {
	return `${containerId}${END_DROP_ZONE_SUFFIX}`
}

function resolvePreviewContainerId(draft: SortingDraft, id: string | null | undefined) {
	if (!id) return null
	if (id === createSortingStartDropZoneId(DISPLAYED_CONTAINER_ID)) return DISPLAYED_CONTAINER_ID
	if (id === createSortingStartDropZoneId(HIDDEN_CONTAINER_ID)) return HIDDEN_CONTAINER_ID
	if (id === createSortingEndDropZoneId(DISPLAYED_CONTAINER_ID)) return DISPLAYED_CONTAINER_ID
	if (id === createSortingEndDropZoneId(HIDDEN_CONTAINER_ID)) return HIDDEN_CONTAINER_ID
	return resolveSortingContainerId(draft, id)
}
