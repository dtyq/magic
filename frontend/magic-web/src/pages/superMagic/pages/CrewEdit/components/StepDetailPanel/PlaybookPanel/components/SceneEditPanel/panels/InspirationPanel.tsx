import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Circle, CirclePlus, Ellipsis, PencilLine, Search, Trash2, ViewIcon } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { Separator } from "@/components/shadcn-ui/separator"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicDropdown from "@/components/base/MagicDropdown"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import type {
	IdentifiedOptionItem,
	LocaleText,
	OptionGroup,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { resolveLocalText } from "../utils"
import { EmptyState } from "../components/EmptyState"
import { InspirationConfigDialog } from "../components/InspirationConfigDialog"
import { DemoGroupEditDialog } from "../components/DemoGroupEditDialog"
import { DemoItemEditDialog } from "../components/DemoItemEditDialog"
import { DEFAULT_INSPIRATION_GROUP_KEY, useSceneEditStore } from "../store"
import TemplateViewSwitcher from "@/pages/superMagic/components/MainInputContainer/panels/TemplateViewSwitcher"
import {
	isIdentifiedOptionItem,
	resolveDemoPromptText,
} from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import type { InspirationItemData } from "../inspirationItems"

const INSPIRATION_THEME_LABEL_KEY: Record<string, string> = {
	grid: "playbook.edit.inspiration.config.themeOptions.grid",
	text_list: "playbook.edit.inspiration.config.themeOptions.textList",
	waterfall: "playbook.edit.inspiration.config.themeOptions.waterfall",
}

export const InspirationPanel = observer(function InspirationPanel() {
	const { t, i18n } = useTranslation("crew/create")
	const store = useSceneEditStore()
	const readOnly = store.readOnly
	const config = store.inspiration
	const viewType = config?.demo?.view_type ?? "grid"
	const viewTypeLabelKey = INSPIRATION_THEME_LABEL_KEY[viewType]

	const groups = useMemo<OptionGroup[]>(() => config?.demo?.groups ?? [], [config?.demo?.groups])
	const defaultGroupKey = config?.demo?.default_selected_group_key ?? groups[0]?.group_key ?? null

	const [activeGroupKey, setActiveGroupKey] = useState<string | null>(defaultGroupKey)
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
	const [searchValue, setSearchValue] = useState("")
	// Confirm callbacks may run after a refreshed scene replaces the provider store.
	const storeRef = useRef(store)
	storeRef.current = store
	const defaultGroupName = useMemo<LocaleText>(
		() => ({
			default: t("playbook.edit.inspiration.defaultGroup"),
		}),
		[t],
	)

	// Dialog state
	const [configDialogOpen, setConfigDialogOpen] = useState(false)
	const [groupDialogOpen, setGroupDialogOpen] = useState(false)
	const [editingGroup, setEditingGroup] = useState<OptionGroup | undefined>(undefined)
	const [itemDialogOpen, setItemDialogOpen] = useState(false)
	const [editingItem, setEditingItem] = useState<IdentifiedOptionItem | undefined>(undefined)
	const [editingItemGroupKey, setEditingItemGroupKey] = useState<string>("")

	const { confirm, dialog: confirmDialog } = useConfirmDialog()

	useEffect(() => {
		if (activeGroupKey && groups.some((group) => group.group_key === activeGroupKey)) return
		setActiveGroupKey(defaultGroupKey)
	}, [activeGroupKey, defaultGroupKey, groups])

	const activeGroup = groups.find((g) => g.group_key === activeGroupKey) ?? null
	const allItems = useMemo<IdentifiedOptionItem[]>(
		() => (activeGroup?.children ?? []).filter(isIdentifiedOptionItem),
		[activeGroup],
	)
	const itemsByValue = useMemo(
		() => new Map(allItems.map((item) => [item.value, item])),
		[allItems],
	)

	useEffect(() => {
		setSelectedKeys((previousKeys) => {
			const nextKeys = new Set(
				Array.from(previousKeys).filter((key) => itemsByValue.has(key)),
			)
			return nextKeys.size === previousKeys.size ? previousKeys : nextKeys
		})
	}, [itemsByValue])

	const filteredItems = useMemo(() => {
		const search = searchValue.toLowerCase()
		if (!search) return allItems
		return allItems.filter((item) => {
			const label = item.label
				? resolveLocalText(item.label, i18n.language).toLowerCase()
				: ""
			const prompt = resolveDemoPromptText(item, i18n.language).toLowerCase()
			return label.includes(search) || prompt.includes(search)
		})
	}, [allItems, searchValue, i18n.language])

	const allSelected =
		filteredItems.length > 0 && filteredItems.every((item) => selectedKeys.has(item.value))

	function handleSelectAll() {
		if (allSelected) setSelectedKeys(new Set())
		else setSelectedKeys(new Set(filteredItems.map((item) => item.value)))
	}

	function handleSelectOne(value: string, checked: boolean) {
		setSelectedKeys((prev) => {
			const next = new Set(prev)
			if (checked) next.add(value)
			else next.delete(value)
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
		if (readOnly) return
		confirm({
			title: t("playbook.edit.inspiration.batchDeleteConfirm.title"),
			description: t("playbook.edit.inspiration.batchDeleteConfirm.description", {
				count: selectedKeys.size,
			}),
			variant: "destructive",
			onConfirm: () => {
				storeRef.current.deleteInspirationItems(Array.from(selectedKeys))
				setSelectedKeys(new Set())
				void storeRef.current.save()
			},
		})
	}

	// Group dialogs
	function openCreateGroup() {
		if (readOnly) return
		setEditingGroup(undefined)
		setGroupDialogOpen(true)
	}

	function openEditGroup(group: OptionGroup) {
		if (readOnly) return
		setEditingGroup(group)
		setGroupDialogOpen(true)
	}

	const handleGroupConfirm = useCallback(
		(data: { group_name: LocaleText; group_icon?: string }) => {
			if (readOnly) return
			if (editingGroup) store.editInspirationGroup(editingGroup.group_key, data)
			else store.createInspirationGroup(data, defaultGroupName)
			void store.save()
		},
		[defaultGroupName, editingGroup, readOnly, store],
	)

	// Item dialogs
	function openCreateItem() {
		if (readOnly) return
		setEditingItem(undefined)
		setEditingItemGroupKey(activeGroupKey ?? defaultGroupKey ?? DEFAULT_INSPIRATION_GROUP_KEY)
		setItemDialogOpen(true)
	}

	function openEditItem(item: IdentifiedOptionItem, groupKey: string) {
		if (readOnly) return
		setEditingItem(item)
		setEditingItemGroupKey(groupKey)
		setItemDialogOpen(true)
	}

	const handleItemConfirm = useCallback(
		(data: InspirationItemData, groupKey: string) => {
			if (readOnly) return
			if (editingItem) store.editInspirationItem(editingItem.value, data, groupKey)
			else store.createInspirationItem(data, groupKey, defaultGroupName)
			setSelectedKeys(new Set())
			void store.save()
		},
		[defaultGroupName, editingItem, readOnly, store],
	)

	function handleCreateGroupFromItem(data: { group_name: LocaleText; group_icon?: string }) {
		if (readOnly) return DEFAULT_INSPIRATION_GROUP_KEY
		const newGroupKey = store.createInspirationGroup(data, defaultGroupName)
		void store.save()
		return newGroupKey
	}

	return (
		<div className="flex h-full flex-col gap-3.5">
			{/* Content header */}
			<div className="flex shrink-0 items-center">
				<p className="min-w-0 flex-1 truncate text-lg font-medium text-foreground">
					{t("playbook.edit.inspiration.title")}
				</p>
				<Badge variant="outline" className="gap-1 px-2 py-0.5">
					<ViewIcon className="h-4 w-4" />
					<span className="text-xs font-semibold">
						{viewTypeLabelKey
							? t(viewTypeLabelKey, { defaultValue: viewType })
							: viewType}
					</span>
				</Badge>
				{readOnly ? null : (
					<Button
						variant="ghost"
						size="icon"
						className="size-9 shrink-0"
						onClick={() => setConfigDialogOpen(true)}
						data-testid="inspiration-enable-button"
					>
						<PencilLine className="h-4 w-4" />
					</Button>
				)}
			</div>

			{/* Control bar */}
			<div className="flex shrink-0 items-center justify-between">
				{readOnly ? null : (
					<div className="flex items-center gap-2">
						<Checkbox
							checked={allSelected}
							onCheckedChange={handleSelectAll}
							data-testid="inspiration-select-all-checkbox"
						/>
						<label
							className="cursor-pointer select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-foreground"
							onClick={() => handleSelectAll(!allSelected)}
							data-testid="handle-select-all"
						>
							{t("playbook.edit.filter.selectAll")}
						</label>
					</div>
				)}
				{!readOnly && selectedKeys.size > 0 ? (
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							className="h-9 shadow-xs"
							onClick={handleCancelSelection}
							data-testid="inspiration-cancel-selection-button"
						>
							{t("playbook.edit.inspiration.cancelSelection")}
						</Button>
						<Button
							variant="destructive"
							className="h-9 gap-2 shadow-xs"
							onClick={handleBatchDelete}
							data-testid="inspiration-batch-delete-button"
						>
							<Trash2 className="h-4 w-4" />
							{t("playbook.edit.inspiration.batchDelete", {
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
								className="h-9 w-[280px] pl-9 shadow-xs"
								data-testid="inspiration-search-input"
							/>
						</div>
						<Button
							variant="outline"
							className="h-9 shadow-xs"
							onClick={handleReset}
							data-testid="inspiration-reset-button"
						>
							{t("playbook.edit.filter.reset")}
						</Button>
						{readOnly ? null : <Separator orientation="vertical" className="!h-5" />}
						{readOnly ? null : (
							<Button
								className="h-9 shadow-xs"
								onClick={openCreateItem}
								data-testid="inspiration-create-button"
							>
								<CirclePlus className="h-4 w-4" />
								{t("playbook.edit.filter.create")}
							</Button>
						)}
					</div>
				)}
			</div>

			{/* Content area */}
			<div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border p-4">
				{/* Toolbar: Create Group + scrollable group tabs */}
				<div className="flex shrink-0 items-center gap-3">
					{readOnly ? null : (
						<Button
							className="h-9 shrink-0 rounded-full shadow-xs"
							onClick={openCreateGroup}
							data-testid="inspiration-create-group-button"
						>
							<CirclePlus className="h-4 w-4" />
							{t("playbook.edit.inspiration.createGroup")}
						</Button>
					)}
					{readOnly ? null : (
						<Separator orientation="vertical" className="h-5 shrink-0" />
					)}
					<HeadlessHorizontalScroll
						className="min-w-0 flex-1"
						scrollContainerClassName="flex items-center gap-2 overflow-x-auto py-1"
					>
						{groups.length === 0 ? (
							<Button
								variant="outline"
								className="h-9 shrink-0 gap-2 shadow-xs"
								data-testid="inspiration-default-group"
							>
								<Circle className="h-4 w-4" />
								{t("playbook.edit.inspiration.defaultGroup")}
							</Button>
						) : (
							groups.map((group) => (
								<GroupTab
									key={group.group_key}
									group={group}
									isActive={activeGroupKey === group.group_key}
									lang={i18n.language}
									onClick={() => {
										setActiveGroupKey(group.group_key)
										setSelectedKeys(new Set())
									}}
									onEdit={() => openEditGroup(group)}
									onDelete={() =>
										confirm({
											title: t(
												"playbook.edit.inspiration.deleteGroupConfirm.title",
											),
											description: t(
												"playbook.edit.inspiration.deleteGroupConfirm.description",
											),
											variant: "destructive",
											onConfirm: () => {
												storeRef.current.deleteInspirationGroup(
													group.group_key,
												)
												void storeRef.current.save()
											},
										})
									}
									readOnly={readOnly}
								/>
							))
						)}
					</HeadlessHorizontalScroll>
				</div>

				{/* Items / Empty state */}
				{/* Keep group controls fixed and let the empty state fill the item viewport. */}
				{/* Inset cards without moving them so their selection rings are not clipped. */}
				<ScrollArea
					className="-m-1 grid min-h-0 flex-1"
					viewportClassName="h-auto min-h-0 p-1 [&>div]:!flex [&>div]:min-h-full [&>div]:flex-col"
				>
					{filteredItems.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center">
							<EmptyState
								title={t("playbook.edit.inspiration.empty.title")}
								description={t("playbook.edit.inspiration.empty.description")}
								createLabel={t("playbook.edit.inspiration.empty.create")}
								onCreate={readOnly ? undefined : openCreateItem}
							/>
						</div>
					) : readOnly ? (
						<TemplateViewSwitcher
							mode="view"
							viewType={config?.demo?.view_type}
							items={filteredItems}
							onTemplateClick={() => undefined}
						/>
					) : (
						<TemplateViewSwitcher
							mode="edit"
							viewType={config?.demo?.view_type}
							items={filteredItems}
							selectedKeys={selectedKeys}
							onSelect={handleSelectOne}
							onEdit={(item) => openEditItem(item, activeGroupKey ?? "")}
							onDelete={(value) =>
								confirm({
									title: t("playbook.edit.inspiration.deleteItemConfirm.title"),
									description: t(
										"playbook.edit.inspiration.deleteItemConfirm.description",
									),
									variant: "destructive",
									onConfirm: () => {
										storeRef.current.deleteInspirationItem(value)
										void storeRef.current.save()
									},
								})
							}
						/>
					)}
				</ScrollArea>
			</div>

			{/* Dialogs */}
			{readOnly ? null : (
				<InspirationConfigDialog
					config={config}
					open={configDialogOpen}
					onOpenChange={setConfigDialogOpen}
					onConfirm={(data) => {
						store.updateInspirationConfig(data)
						void store.save()
					}}
				/>
			)}

			{readOnly ? null : (
				<DemoGroupEditDialog
					group={editingGroup}
					open={groupDialogOpen}
					onOpenChange={setGroupDialogOpen}
					onConfirm={handleGroupConfirm}
				/>
			)}

			{readOnly ? null : (
				<DemoItemEditDialog
					item={editingItem}
					defaultGroupKey={editingItemGroupKey}
					groups={groups}
					open={itemDialogOpen}
					onOpenChange={setItemDialogOpen}
					onConfirm={handleItemConfirm}
					onCreateGroup={handleCreateGroupFromItem}
				/>
			)}

			{confirmDialog}
		</div>
	)
})

interface GroupTabProps {
	group: OptionGroup
	isActive: boolean
	lang: string
	onClick: () => void
	onEdit: () => void
	onDelete: () => void
	readOnly?: boolean
}

function GroupTab({
	group,
	isActive,
	lang,
	onClick,
	onEdit,
	onDelete,
	readOnly = false,
}: GroupTabProps) {
	const { t } = useTranslation("crew/create")
	const name = resolveLocalText(group.group_name, lang)

	const menuItems = [
		{
			key: "edit",
			label: t("playbook.edit.inspiration.actions.edit"),
			icon: <PencilLine className="h-4 w-4" />,
			onClick: onEdit,
		},
		{
			key: "delete",
			label: t("playbook.edit.inspiration.actions.delete"),
			icon: <Trash2 className="h-4 w-4" />,
			danger: true,
			onClick: onDelete,
		},
	]

	return (
		<div className="flex shrink-0 items-center">
			<Button
				variant="outline"
				className={cn(
					"h-9 shrink-0 gap-2 rounded-full border-[2px] px-4 text-foreground shadow-xs",
					isActive && "border-foreground dark:border-white",
				)}
				onClick={onClick}
				data-testid={`inspiration-group-${group.group_key}`}
			>
				{group.group_icon ? (
					<LucideLazyIcon icon={group.group_icon} size={16} />
				) : (
					<Circle className="h-4 w-4" />
				)}
				{name}
				{readOnly ? null : (
					<MagicDropdown
						menu={{ items: menuItems }}
						trigger={["click"]}
						placement="bottomLeft"
					>
						<span>
							<Button
								variant="outline"
								size="icon"
								className={cn("size-6 shrink-0 rounded-full border-none shadow-xs")}
								data-testid={`inspiration-group-menu-${group.group_key}`}
								onClick={(e) => e.stopPropagation()}
							>
								<Ellipsis className="h-4 w-4" />
							</Button>
						</span>
					</MagicDropdown>
				)}
			</Button>
		</div>
	)
}
