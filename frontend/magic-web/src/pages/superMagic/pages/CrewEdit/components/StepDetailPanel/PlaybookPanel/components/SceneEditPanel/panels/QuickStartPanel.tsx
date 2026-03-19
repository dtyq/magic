import { useState, useMemo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	CirclePlus,
	Ellipsis,
	Eye,
	GripVertical,
	MousePointerClick,
	PencilLine,
	Search,
	Trash2,
} from "lucide-react"
import {
	DndContext,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core"
import {
	SortableContext,
	arrayMove,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { Separator } from "@/components/shadcn-ui/separator"
import { Switch } from "@/components/shadcn-ui/switch"
import MagicDropdown from "@/components/base/MagicDropdown"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { cn } from "@/lib/tiptap-utils"
import type {
	GuideItem,
	LocaleText,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { resolveLocalText } from "../utils"
import { EmptyState } from "../components/EmptyState"
import { GuideItemEditDialog } from "../components/GuideItemEditDialog"
import { QuickStartConfigDialog } from "../components/QuickStartConfigDialog"
import { useSceneEditStore } from "../store"

export const QuickStartPanel = observer(function QuickStartPanel() {
	const { t, i18n } = useTranslation("crew/create")
	const store = useSceneEditStore()
	const quickStartConfig = store.quickStart

	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
	const [searchValue, setSearchValue] = useState("")
	const [editingItem, setEditingItem] = useState<GuideItem | undefined>(undefined)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [isConfigOpen, setIsConfigOpen] = useState(false)
	const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {}
		for (const item of quickStartConfig?.guide?.items ?? []) {
			initial[item.key] = item.enabled ?? false
		}
		return initial
	})

	const { confirm, dialog: confirmDialog } = useConfirmDialog()

	// Drag is disabled when filtering — reorder only works on the full list
	const isDragDisabled = searchValue.length > 0

	const filteredItems = useMemo(() => {
		const items = quickStartConfig?.guide?.items ?? []
		const search = searchValue.toLowerCase()
		if (!search) return items
		return items.filter((item) => {
			const title = resolveLocalText(item.title, i18n.language).toLowerCase()
			const desc = resolveLocalText(item.description, i18n.language).toLowerCase()
			return title.includes(search) || desc.includes(search)
		})
	}, [quickStartConfig?.guide?.items, searchValue, i18n.language])

	const panelTitle = useMemo(() => {
		if (!quickStartConfig?.title) return t("playbook.edit.quickStart.title")
		return resolveLocalText(quickStartConfig.title, i18n.language)
	}, [quickStartConfig?.title, i18n.language, t])

	const allSelected =
		filteredItems.length > 0 && filteredItems.every((item) => selectedKeys.has(item.key))

	function handleSelectAll() {
		if (allSelected) setSelectedKeys(new Set())
		else setSelectedKeys(new Set(filteredItems.map((item) => item.key)))
	}

	function handleSelectOne(key: string, checked: boolean) {
		setSelectedKeys((prev) => {
			const next = new Set(prev)
			if (checked) next.add(key)
			else next.delete(key)
			return next
		})
	}

	function handleReset() {
		setSelectedKeys(new Set())
		setSearchValue("")
	}

	function handleCancelSelection() {
		setSelectedKeys(new Set())
	}

	function handleBatchDelete() {
		confirm({
			title: t("playbook.edit.quickStart.batchDeleteConfirm.title"),
			description: t("playbook.edit.quickStart.batchDeleteConfirm.description", {
				count: selectedKeys.size,
			}),
			variant: "destructive",
			onConfirm: () => {
				store.deleteQuickStartItems([...selectedKeys])
				setSelectedKeys(new Set())
				void store.save()
			},
		})
	}

	const handleDeleteWithConfirm = useCallback(
		(key: string) => {
			confirm({
				title: t("playbook.edit.quickStart.deleteItemConfirm.title"),
				description: t("playbook.edit.quickStart.deleteItemConfirm.description"),
				variant: "destructive",
				onConfirm: () => {
					store.deleteQuickStartItem(key)
					void store.save()
				},
			})
		},
		[confirm, store, t],
	)

	const handleToggleEnabled = useCallback(
		(key: string, enabled: boolean) => {
			setEnabledMap((prev) => ({ ...prev, [key]: enabled }))
			store.editQuickStartItem(key, { enabled })
			void store.save()
		},
		[store],
	)

	function handleOpenEdit(item: GuideItem) {
		setEditingItem(item)
		setIsCreating(false)
		setIsDialogOpen(true)
	}

	function handleOpenCreate() {
		setEditingItem(undefined)
		setIsCreating(true)
		setIsDialogOpen(true)
	}

	function handleDialogConfirm(data: Partial<GuideItem>) {
		if (isCreating) store.createQuickStartItem(data)
		else if (editingItem) store.editQuickStartItem(editingItem.key, data)
		void store.save()
	}

	function handleConfigConfirm(data: { title: LocaleText }) {
		store.updateQuickStartConfig(data)
		void store.save()
	}

	function handleDragEnd(orderedKeys: string[]) {
		store.reorderQuickStartItems(orderedKeys)
		void store.save()
	}

	return (
		<div className="flex h-full flex-col gap-3.5">
			{/* Header */}
			<div className="flex shrink-0 items-center">
				<p className="min-w-0 flex-1 truncate text-lg font-medium text-foreground">
					{panelTitle}
				</p>
				<Button
					variant="ghost"
					size="icon"
					className="size-9 shrink-0"
					onClick={() => setIsConfigOpen(true)}
					data-testid="quickstart-edit-section-button"
					aria-label={t("playbook.edit.quickStart.config.title")}
				>
					<PencilLine className="h-4 w-4" />
				</Button>
			</div>

			{/* Control bar */}
			<div className="flex shrink-0 items-center justify-between">
				<div className="flex items-center gap-2">
					<Checkbox
						checked={allSelected}
						onCheckedChange={handleSelectAll}
						data-testid="quickstart-select-all-checkbox"
					/>
					<label
						className="cursor-pointer select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-foreground"
						onClick={handleSelectAll}
					>
						{t("playbook.edit.filter.selectAll")}
					</label>
				</div>
				{selectedKeys.size > 0 ? (
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							className="shadow-xs h-9"
							onClick={handleCancelSelection}
							data-testid="quickstart-cancel-selection-button"
						>
							{t("playbook.edit.quickStart.cancelSelection")}
						</Button>
						<Button
							variant="destructive"
							className="shadow-xs h-9 gap-2"
							onClick={handleBatchDelete}
							data-testid="quickstart-batch-delete-button"
						>
							<Trash2 className="h-4 w-4" />
							{t("playbook.edit.quickStart.batchDelete", {
								count: selectedKeys.size,
							})}
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("playbook.edit.filter.search")}
								className="shadow-xs h-9 w-[280px] pl-9"
								data-testid="quickstart-search-input"
							/>
						</div>
						<Button
							variant="outline"
							className="shadow-xs h-9"
							onClick={handleReset}
							data-testid="quickstart-reset-button"
						>
							{t("playbook.edit.filter.reset")}
						</Button>
						<Separator orientation="vertical" className="!h-5" />
						<Button
							className="shadow-xs h-9"
							onClick={handleOpenCreate}
							data-testid="quickstart-create-button"
						>
							<CirclePlus className="h-4 w-4" />
							{t("playbook.edit.filter.create")}
						</Button>
					</div>
				)}
			</div>

			{/* Content list */}
			<div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-border">
				{filteredItems.length === 0 ? (
					<EmptyState
						title={t("playbook.edit.quickStart.empty.title")}
						description={t("playbook.edit.quickStart.empty.description")}
						createLabel={t("playbook.edit.quickStart.empty.create")}
						onCreate={handleOpenCreate}
					/>
				) : (
					<GuideItemList
						items={filteredItems}
						selectedKeys={selectedKeys}
						enabledMap={enabledMap}
						lang={i18n.language}
						isDragDisabled={isDragDisabled}
						onSelect={handleSelectOne}
						onToggleEnabled={handleToggleEnabled}
						onEdit={handleOpenEdit}
						onDelete={handleDeleteWithConfirm}
						onReorder={handleDragEnd}
					/>
				)}
			</div>

			{/* Edit / Create dialog */}
			<GuideItemEditDialog
				item={isCreating ? undefined : editingItem}
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				onConfirm={handleDialogConfirm}
			/>
			<QuickStartConfigDialog
				config={quickStartConfig}
				open={isConfigOpen}
				onOpenChange={setIsConfigOpen}
				onConfirm={handleConfigConfirm}
			/>

			{confirmDialog}
		</div>
	)
})

// ─── GuideItemList ────────────────────────────────────────────────────────────

interface GuideItemListProps {
	items: GuideItem[]
	selectedKeys: Set<string>
	enabledMap: Record<string, boolean>
	lang: string
	isDragDisabled: boolean
	onSelect: (key: string, checked: boolean) => void
	onToggleEnabled: (key: string, enabled: boolean) => void
	onEdit: (item: GuideItem) => void
	onDelete?: (key: string) => void
	onReorder?: (orderedKeys: string[]) => void
}

function GuideItemList({
	items,
	selectedKeys,
	enabledMap,
	lang,
	isDragDisabled,
	onSelect,
	onToggleEnabled,
	onEdit,
	onDelete,
	onReorder,
}: GuideItemListProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, {
			// Require pointer to move 8px before activating drag
			activationConstraint: { distance: 8 },
		}),
	)

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = items.findIndex((i) => i.key === String(active.id))
		const newIndex = items.findIndex((i) => i.key === String(over.id))
		const reordered = arrayMove(items, oldIndex, newIndex)
		onReorder?.(reordered.map((i) => i.key))
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
				<div className="flex flex-col divide-y divide-border p-4">
					{items.map((item) => (
						<GuideItemRow
							key={item.key}
							item={item}
							isSelected={selectedKeys.has(item.key)}
							isEnabled={enabledMap[item.key] ?? false}
							lang={lang}
							isDragDisabled={isDragDisabled}
							onSelect={onSelect}
							onToggleEnabled={onToggleEnabled}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	)
}

// ─── GuideItemRow ─────────────────────────────────────────────────────────────

interface GuideItemRowProps {
	item: GuideItem
	isSelected: boolean
	isEnabled: boolean
	lang: string
	isDragDisabled: boolean
	onSelect: (key: string, checked: boolean) => void
	onToggleEnabled: (key: string, enabled: boolean) => void
	onEdit: (item: GuideItem) => void
	onDelete?: (key: string) => void
}

function GuideItemRow({
	item,
	isSelected,
	isEnabled,
	lang,
	isDragDisabled,
	onSelect,
	onToggleEnabled,
	onEdit,
	onDelete,
}: GuideItemRowProps) {
	const { t } = useTranslation("crew/create")
	const title = resolveLocalText(item.title, lang)
	const description = resolveLocalText(item.description, lang)

	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.key, disabled: isDragDisabled })

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	const dropdownItems = useMemo(
		() => [
			{
				key: "edit",
				label: t("playbook.actions.edit"),
				icon: <PencilLine className="h-4 w-4" />,
				onClick: () => onEdit(item),
			},
			{
				key: "toggle",
				label: isEnabled ? t("playbook.actions.disable") : t("playbook.actions.enable"),
				icon: <Eye className="h-4 w-4" />,
				onClick: () => onToggleEnabled(item.key, !isEnabled),
			},
			{
				type: "divider" as const,
			},
			{
				key: "delete",
				label: t("playbook.actions.delete"),
				icon: <Trash2 className="h-4 w-4" />,
				danger: true,
				onClick: () => onDelete?.(item.key),
			},
		],
		[t, item, isEnabled, onEdit, onToggleEnabled, onDelete],
	)

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-start gap-1.5 overflow-hidden p-2 transition-colors hover:bg-muted/40",
				isDragging && "z-10 opacity-50",
			)}
			data-testid={`guide-item-${item.key}`}
			{...attributes}
		>
			{/* Checkbox */}
			<div className="flex size-6 shrink-0 items-center justify-center">
				<Checkbox
					checked={isSelected}
					onCheckedChange={(checked) => onSelect(item.key, !!checked)}
				/>
			</div>

			{/* Drag handle */}
			<button
				ref={setActivatorNodeRef}
				className={cn(
					"flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
					isDragDisabled
						? "cursor-not-allowed opacity-30"
						: "cursor-grab active:cursor-grabbing",
				)}
				aria-label="drag"
				data-testid={`guide-item-drag-${item.key}`}
				{...(isDragDisabled ? {} : listeners)}
			>
				<GripVertical className="h-4 w-4" />
			</button>

			{/* Content */}
			<div className="flex min-w-0 flex-1 items-start gap-2">
				{/* Icon container */}
				<div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-accent">
					{item.icon ? (
						<img src={item.icon} alt={title} className="size-5 object-cover" />
					) : (
						<MousePointerClick className="h-4 w-4 text-muted-foreground" />
					)}
				</div>

				{/* Text details */}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					{/* Title row with updated time */}
					<div className="flex items-center gap-1.5 whitespace-nowrap">
						<p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
							{title}
						</p>
						{item.updated_at && (
							<span className="shrink-0 text-[10px] leading-3 text-muted-foreground">
								{t("playbook.edit.quickStart.updatedAt", { date: item.updated_at })}
							</span>
						)}
					</div>

					{/* Description */}
					{description && (
						<p className="min-w-full text-xs text-muted-foreground">{description}</p>
					)}

					{/* Action badge */}
					<div>
						<Badge
							variant="outline"
							className="gap-1 rounded-md px-2 py-0.5 text-xs font-semibold"
						>
							<MousePointerClick className="h-3 w-3" />
							{item.click_action
								? t(
									`playbook.edit.quickStart.form.clickActions.${toCamelKey(item.click_action)}`,
								)
								: t("playbook.edit.quickStart.action.noAction")}
						</Badge>
					</div>
				</div>
			</div>

			{/* Switch */}
			<div className="flex shrink-0 items-start">
				<Switch
					checked={isEnabled}
					onCheckedChange={(checked) => onToggleEnabled(item.key, checked)}
					data-testid={`guide-item-switch-${item.key}`}
				/>
			</div>

			{/* More options via MagicDropdown */}
			<MagicDropdown placement="bottomRight" menu={{ items: dropdownItems }}>
				<span>
					<Button
						variant="ghost"
						size="icon"
						className="size-5 shrink-0 self-center"
						data-testid={`guide-item-more-${item.key}`}
					>
						<Ellipsis className="h-4 w-4" />
					</Button>
				</span>
			</MagicDropdown>
		</div>
	)
}

/** Convert snake_case action key to camelCase for i18n lookup */
function toCamelKey(key: string): string {
	return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}
