import { useState, useMemo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	AlignLeft,
	ChevronRight,
	CirclePlus,
	Ellipsis,
	Eye,
	GripVertical,
	LayoutGrid,
	PencilLine,
	Rows2,
	Search,
	SquareCheckBig,
	Tablet,
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
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Badge } from "@/opensource/components/shadcn-ui/badge"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { Input } from "@/opensource/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { Switch } from "@/opensource/components/shadcn-ui/switch"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import { useConfirmDialog } from "@/opensource/components/shadcn-composed/confirm-dialog"
import { cn } from "@/opensource/lib/tiptap-utils"
import type {
	FieldItem,
	LocaleText,
	OptionItem,
	OptionViewType,
} from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import { resolveLocalText } from "../utils"
import { EmptyState } from "../components/EmptyState"
import { PresetItemEditDialog } from "../components/PresetItemEditDialog"
import { PresetConfigDialog } from "../components/PresetConfigDialog"
import { GalleryOptionsDialog } from "../components/GalleryOptionsDialog"
import { useSceneEditStore } from "../store"

/** Icon map for each view type */
const VIEW_TYPE_ICON: Record<string, React.ElementType> = {
	dropdown: SquareCheckBig,
	grid: LayoutGrid,
	waterfall: Rows2,
	text_list: AlignLeft,
	capsule: Tablet,
}

export const PresetsPanel = observer(function PresetsPanel() {
	const { t, i18n } = useTranslation("crew/create")
	const store = useSceneEditStore()

	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
	const [filterValue, setFilterValue] = useState("all")
	const [searchValue, setSearchValue] = useState("")
	const [editingItem, setEditingItem] = useState<FieldItem | undefined>(undefined)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [isConfigOpen, setIsConfigOpen] = useState(false)
	const [isGalleryOptionsOpen, setIsGalleryOptionsOpen] = useState(false)

	const { confirm, dialog: confirmDialog } = useConfirmDialog()

	const presets = store.presets
	const viewType = presets?.field?.view_type ?? "dropdown"
	const ViewIcon = VIEW_TYPE_ICON[viewType] ?? SquareCheckBig

	const isDragDisabled = searchValue.length > 0 || filterValue !== "all"

	const filteredItems = useMemo(() => {
		const items = store.presets?.field?.items ?? []
		const search = searchValue.toLowerCase()
		return items.filter((item) => {
			// Gallery item is displayed via the banner, exclude from regular list
			if (item.option_view_type === "grid") return false
			if (filterValue === "enabled" && !item.enabled) return false
			if (filterValue === "disabled" && item.enabled !== false) return false
			if (search) {
				const label = resolveLocalText(item.label, i18n.language).toLowerCase()
				if (!label.includes(search)) return false
			}
			return true
		})
	}, [store.presets?.field?.items, filterValue, searchValue, i18n.language])

	const allSelected =
		filteredItems.length > 0 && filteredItems.every((item) => selectedKeys.has(item.data_key))

	function handleSelectAll() {
		if (allSelected) setSelectedKeys(new Set())
		else setSelectedKeys(new Set(filteredItems.map((item) => item.data_key)))
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
		setFilterValue("all")
		setSearchValue("")
	}

	function handleCancelSelection() {
		setSelectedKeys(new Set())
	}

	function handleBatchDelete() {
		confirm({
			title: t("playbook.edit.presets.batchDeleteConfirm.title"),
			description: t("playbook.edit.presets.batchDeleteConfirm.description", {
				count: selectedKeys.size,
			}),
			variant: "destructive",
			onConfirm: () => {
				store.deletePresetItems(Array.from(selectedKeys))
				setSelectedKeys(new Set())
				void store.save()
			},
		})
	}

	const handleDeleteWithConfirm = useCallback(
		(dataKey: string) => {
			confirm({
				title: t("playbook.edit.presets.deleteItemConfirm.title"),
				description: t("playbook.edit.presets.deleteItemConfirm.description"),
				variant: "destructive",
				onConfirm: () => {
					store.deletePresetItem(dataKey)
					void store.save()
				},
			})
		},
		[confirm, store, t],
	)

	const handleToggleEnabled = useCallback(
		(dataKey: string, enabled: boolean) => {
			store.editPresetItem(dataKey, { enabled })
			void store.save()
		},
		[store],
	)

	function handleOpenEdit(item: FieldItem) {
		setEditingItem(item)
		setIsCreating(false)
		setIsDialogOpen(true)
	}

	function handleOpenCreate() {
		setEditingItem(undefined)
		setIsCreating(true)
		setIsDialogOpen(true)
	}

	function handleDialogConfirm(data: Partial<FieldItem>) {
		if (isCreating) store.createPresetItem(data)
		else if (editingItem) store.editPresetItem(editingItem.data_key, data)
		void store.save()
	}

	function handleConfigConfirm(data: { view_type?: OptionViewType }) {
		store.updatePresetsConfig(data)
		void store.save()
	}

	function handleGalleryOptionsConfirm(data: {
		label: LocaleText
		options: OptionItem[]
		default_value?: string
		preset_content?: LocaleText
	}) {
		store.updateGalleryPresetItem(data)
		void store.save()
	}

	function handleDragEnd(orderedKeys: string[]) {
		store.reorderPresetItems(orderedKeys)
		void store.save()
	}

	return (
		<div className="flex h-full flex-col gap-3.5">
			{/* Content header */}
			<div className="flex shrink-0 items-center">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<p className="shrink-0 text-lg font-medium text-foreground">
						{t("playbook.edit.presets.title")}
					</p>
					<Badge variant="outline" className="gap-1 px-2 py-0.5">
						<ViewIcon className="h-4 w-4" />
						<span className="text-xs font-semibold">
							{t(`playbook.edit.presets.config.themeOptions.${viewType}`, {
								defaultValue: viewType,
							})}
						</span>
					</Badge>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="size-9 shrink-0"
					onClick={() => setIsConfigOpen(true)}
					data-testid="presets-edit-config-button"
					aria-label={t("playbook.edit.presets.config.title")}
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
						data-testid="presets-select-all-checkbox"
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
							data-testid="presets-cancel-selection-button"
						>
							{t("playbook.edit.presets.cancelSelection")}
						</Button>
						<Button
							variant="destructive"
							className="shadow-xs h-9 gap-2"
							onClick={handleBatchDelete}
							data-testid="presets-batch-delete-button"
						>
							<Trash2 className="h-4 w-4" />
							{t("playbook.edit.presets.batchDelete", { count: selectedKeys.size })}
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2">
						<FilterSelect value={filterValue} onChange={setFilterValue} />
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("playbook.edit.filter.search")}
								className="shadow-xs h-9 w-[200px] pl-9"
								data-testid="presets-search-input"
							/>
						</div>
						<Button
							variant="outline"
							className="shadow-xs h-9"
							onClick={handleReset}
							data-testid="presets-reset-button"
						>
							{t("playbook.edit.filter.reset")}
						</Button>
						<Separator orientation="vertical" className="!h-5" />
						<Button
							className="shadow-xs h-9"
							onClick={handleOpenCreate}
							data-testid="presets-create-button"
						>
							<CirclePlus className="h-4 w-4" />
							{t("playbook.edit.filter.create")}
						</Button>
					</div>
				)}
			</div>

			{/* Gallery Options banner — visible only when view_type is "grid" */}
			{viewType === "grid" && (
				<div className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-4 py-2.5">
					<LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="flex-1 text-sm font-medium text-foreground">
						{t("playbook.edit.presets.gallery.configured")}
					</span>
					<Button
						variant="ghost"
						className="h-8 gap-1 rounded-md border border-border px-2 text-sm"
						onClick={() => setIsGalleryOptionsOpen(true)}
						data-testid="gallery-options-edit-btn"
					>
						{t("playbook.edit.presets.gallery.edit")}
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			)}

			{/* Content */}
			<div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-border">
				{filteredItems.length === 0 ? (
					<EmptyState
						title={t("playbook.edit.presets.empty.title")}
						description={t("playbook.edit.presets.empty.description")}
						createLabel={t("playbook.edit.presets.empty.create")}
						onCreate={handleOpenCreate}
					/>
				) : (
					<PresetItemList
						items={filteredItems}
						selectedKeys={selectedKeys}
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

			{/* Create / Edit dialog */}
			<PresetItemEditDialog
				item={isCreating ? undefined : editingItem}
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				onConfirm={handleDialogConfirm}
			/>

			{/* Config dialog */}
			<PresetConfigDialog
				config={presets}
				open={isConfigOpen}
				onOpenChange={setIsConfigOpen}
				onConfirm={handleConfigConfirm}
			/>

			{/* Gallery Options dialog — only relevant when view_type is "grid" */}
			<GalleryOptionsDialog
				galleryItem={store.galleryPresetItem}
				open={isGalleryOptionsOpen}
				onOpenChange={setIsGalleryOptionsOpen}
				onConfirm={handleGalleryOptionsConfirm}
			/>

			{confirmDialog}
		</div>
	)
})

// ─── FilterSelect ─────────────────────────────────────────────────────────────

interface FilterSelectProps {
	value: string
	onChange: (value: string) => void
}

function FilterSelect({ value, onChange }: FilterSelectProps) {
	const { t } = useTranslation("crew/create")
	const options = [
		{ value: "all", label: t("playbook.edit.filter.all") },
		{ value: "enabled", label: t("playbook.filter.enabled") },
		{ value: "disabled", label: t("playbook.filter.disabled") },
	]

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className="w-[120px]" data-testid="presets-filter-select">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((opt) => (
					<SelectItem key={opt.value} value={opt.value}>
						{opt.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

// ─── PresetItemList ───────────────────────────────────────────────────────────

interface PresetItemListProps {
	items: FieldItem[]
	selectedKeys: Set<string>
	lang: string
	isDragDisabled: boolean
	onSelect: (key: string, checked: boolean) => void
	onToggleEnabled: (key: string, enabled: boolean) => void
	onEdit: (item: FieldItem) => void
	onDelete?: (key: string) => void
	onReorder?: (orderedKeys: string[]) => void
}

function PresetItemList({
	items,
	selectedKeys,
	lang,
	isDragDisabled,
	onSelect,
	onToggleEnabled,
	onEdit,
	onDelete,
	onReorder,
}: PresetItemListProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	)

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = items.findIndex((i) => i.data_key === String(active.id))
		const newIndex = items.findIndex((i) => i.data_key === String(over.id))
		const reordered = arrayMove(items, oldIndex, newIndex)
		onReorder?.(reordered.map((i) => i.data_key))
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext
				items={items.map((i) => i.data_key)}
				strategy={verticalListSortingStrategy}
			>
				<div className="flex flex-col divide-y divide-border p-2">
					{items.map((item) => (
						<PresetItemRow
							key={item.data_key}
							item={item}
							isSelected={selectedKeys.has(item.data_key)}
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

// ─── PresetItemRow ────────────────────────────────────────────────────────────

interface PresetItemRowProps {
	item: FieldItem
	isSelected: boolean
	lang: string
	isDragDisabled: boolean
	onSelect: (key: string, checked: boolean) => void
	onToggleEnabled: (key: string, enabled: boolean) => void
	onEdit: (item: FieldItem) => void
	onDelete?: (key: string) => void
}

function PresetItemRow({
	item,
	isSelected,
	lang,
	isDragDisabled,
	onSelect,
	onToggleEnabled,
	onEdit,
	onDelete,
}: PresetItemRowProps) {
	const { t } = useTranslation("crew/create")
	const label = resolveLocalText(item.label, lang)
	const isEnabled = item.enabled !== false
	const handleOpenEdit = useCallback(() => onEdit(item), [item, onEdit])

	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.data_key, disabled: isDragDisabled })

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 1 : undefined,
	}

	// Collect visible option labels (up to 6, then show +N)
	const optionLabels = (item.options ?? [])
		.filter(
			(
				opt,
			): opt is import("@/opensource/pages/superMagic/components/MainInputContainer/panels/types").OptionItem =>
				!("group_key" in opt),
		)
		.map((opt) => resolveLocalText(opt.label ?? String(opt.value), lang) || String(opt.value))

	const updatedAt = item.updated_at
		? t("playbook.edit.presets.updatedAt", {
				date: new Date(item.updated_at).toLocaleString(
					lang === "zh_CN" ? "zh-CN" : "en-US",
					{
						month: "short",
						day: "numeric",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					},
				),
			})
		: null

	const dropdownItems = useMemo(
		() => [
			{
				key: "edit",
				label: t("playbook.edit.presets.actions.edit"),
				icon: <PencilLine className="h-4 w-4" />,
				onClick: () => onEdit(item),
			},
			{
				key: "toggle",
				label: isEnabled
					? t("playbook.edit.presets.actions.disable")
					: t("playbook.edit.presets.actions.enable"),
				icon: <Eye className="h-4 w-4" />,
				onClick: () => onToggleEnabled(item.data_key, !isEnabled),
			},
			{ type: "divider" as const },
			{
				key: "delete",
				label: t("playbook.edit.presets.actions.delete"),
				icon: <Trash2 className="h-4 w-4" />,
				danger: true,
				onClick: () => onDelete?.(item.data_key),
			},
		],
		[t, item, isEnabled, onEdit, onToggleEnabled, onDelete],
	)

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex flex-col gap-1.5 px-4 py-3 transition-colors",
				isDragging ? "bg-muted/60 opacity-80" : "hover:bg-muted/40",
			)}
			data-testid={`preset-item-row-${item.data_key}`}
			{...attributes}
		>
			<div className="flex items-start gap-3">
				{/* Drag handle */}
				<button
					ref={setActivatorNodeRef}
					type="button"
					className={cn(
						"shrink-0 touch-none text-muted-foreground transition-opacity",
						isDragDisabled
							? "cursor-default opacity-30"
							: "cursor-grab active:cursor-grabbing",
					)}
					{...(isDragDisabled ? {} : listeners)}
					aria-label="drag"
					data-testid={`preset-item-drag-${item.data_key}`}
				>
					<GripVertical className="h-4 w-4" />
				</button>

				{/* Checkbox */}
				<Checkbox
					checked={isSelected}
					onCheckedChange={(checked) => onSelect(item.data_key, !!checked)}
					onClick={(event) => event.stopPropagation()}
					data-testid={`preset-item-checkbox-${item.data_key}`}
				/>

				<button
					type="button"
					className="min-w-0 flex-1 text-left"
					onClick={handleOpenEdit}
					data-testid={`preset-item-edit-trigger-${item.data_key}`}
				>
					<div className="flex min-w-0 items-center gap-3">
						<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary">
							{label || (
								<span className="text-muted-foreground">{item.data_key}</span>
							)}
						</span>
						{updatedAt && (
							<span className="shrink-0 text-xs text-muted-foreground">
								{updatedAt}
							</span>
						)}
					</div>

					<div className="mt-1.5 flex flex-wrap gap-2">
						{optionLabels.length > 0 ? (
							optionLabels.map((lbl, i) => (
								<Badge
									key={i}
									variant="secondary"
									className="h-6 max-w-[160px] truncate rounded-md border-border bg-transparent px-2 py-0.5 text-xs font-normal"
								>
									{lbl}
								</Badge>
							))
						) : (
							<span className="text-xs text-muted-foreground">
								{t("playbook.edit.presets.form.noOption")}
							</span>
						)}
					</div>
				</button>

				{/* Enable switch */}
				<Switch
					checked={isEnabled}
					onCheckedChange={(checked) => onToggleEnabled(item.data_key, checked)}
					onClick={(event) => event.stopPropagation()}
					data-testid={`preset-item-switch-${item.data_key}`}
				/>

				{/* More menu */}
				<MagicDropdown placement="bottomRight" menu={{ items: dropdownItems }}>
					<span onClick={(event) => event.stopPropagation()}>
						<Button
							variant="ghost"
							size="icon"
							className="size-5 shrink-0"
							data-testid={`preset-item-more-${item.data_key}`}
						>
							<Ellipsis className="h-4 w-4" />
						</Button>
					</span>
				</MagicDropdown>
			</div>
		</div>
	)
}
