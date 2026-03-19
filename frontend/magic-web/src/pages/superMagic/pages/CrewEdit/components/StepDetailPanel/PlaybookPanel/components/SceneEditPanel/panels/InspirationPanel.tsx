import { useState, useMemo, useCallback, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Circle, CirclePlus, Ellipsis, PencilLine, Search, Trash2, ViewIcon } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { Separator } from "@/components/shadcn-ui/separator"
import MagicDropdown from "@/components/base/MagicDropdown"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import type {
	LocaleText,
	OptionGroup,
	OptionItem,
} from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { resolveLocalText } from "../utils"
import { EmptyState } from "../components/EmptyState"
import { InspirationConfigDialog } from "../components/InspirationConfigDialog"
import { DemoGroupEditDialog } from "../components/DemoGroupEditDialog"
import { DemoItemEditDialog } from "../components/DemoItemEditDialog"
import { DEFAULT_INSPIRATION_GROUP_KEY, useSceneEditStore } from "../store"
import TemplateViewSwitcher from "@/pages/superMagic/components/MainInputContainer/panels/TemplateViewSwitcher"
import { localeTextToDisplayString } from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import { cn } from "@/lib/tiptap-utils"
import { Badge } from "@/components/shadcn-ui/badge"

export const InspirationPanel = observer(function InspirationPanel() {
	const { t, i18n } = useTranslation("crew/create")
	const store = useSceneEditStore()
	const config = store.inspiration

	const groups: OptionGroup[] = config?.demo?.groups ?? []
	const defaultGroupKey = config?.demo?.default_selected_group_key ?? groups[0]?.group_key ?? null

	const [activeGroupKey, setActiveGroupKey] = useState<string | null>(defaultGroupKey)
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
	const [searchValue, setSearchValue] = useState("")
	const defaultGroupName = useMemo<LocaleText>(
		() => ({
			default: t("playbook.edit.inspiration.defaultGroup"),
			zh_CN: t("playbook.edit.inspiration.defaultGroup", { lng: "zh_CN" }),
			en_US: t("playbook.edit.inspiration.defaultGroup", { lng: "en_US" }),
		}),
		[t],
	)

	// Dialog state
	const [configDialogOpen, setConfigDialogOpen] = useState(false)
	const [groupDialogOpen, setGroupDialogOpen] = useState(false)
	const [editingGroup, setEditingGroup] = useState<OptionGroup | undefined>(undefined)
	const [itemDialogOpen, setItemDialogOpen] = useState(false)
	const [editingItem, setEditingItem] = useState<OptionItem | undefined>(undefined)
	const [editingItemGroupKey, setEditingItemGroupKey] = useState<string>("")

	const { confirm, dialog: confirmDialog } = useConfirmDialog()

	useEffect(() => {
		if (activeGroupKey && groups.some((group) => group.group_key === activeGroupKey)) return
		setActiveGroupKey(defaultGroupKey)
	}, [activeGroupKey, defaultGroupKey, groups])

	const activeGroup = groups.find((g) => g.group_key === activeGroupKey) ?? null
	const allItems = useMemo<OptionItem[]>(() => activeGroup?.children ?? [], [activeGroup])

	const filteredItems = useMemo(() => {
		const search = searchValue.toLowerCase()
		if (!search) return allItems
		return allItems.filter((item) => {
			const label = item.label
				? resolveLocalText(item.label, i18n.language).toLowerCase()
				: ""
			const itemValue = localeTextToDisplayString(item.value).toLowerCase()
			return label.includes(search) || itemValue.includes(search)
		})
	}, [allItems, searchValue, i18n.language])

	const allSelected =
		filteredItems.length > 0 &&
		filteredItems.every((item) => selectedKeys.has(localeTextToDisplayString(item.value)))

	function handleSelectAll() {
		if (allSelected) setSelectedKeys(new Set())
		else
			setSelectedKeys(
				new Set(filteredItems.map((item) => localeTextToDisplayString(item.value))),
			)
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
		confirm({
			title: t("playbook.edit.inspiration.batchDeleteConfirm.title"),
			description: t("playbook.edit.inspiration.batchDeleteConfirm.description", {
				count: selectedKeys.size,
			}),
			variant: "destructive",
			onConfirm: () => {
				store.deleteInspirationItems(Array.from(selectedKeys))
				setSelectedKeys(new Set())
				void store.save()
			},
		})
	}

	// Group dialogs
	function openCreateGroup() {
		setEditingGroup(undefined)
		setGroupDialogOpen(true)
	}

	function openEditGroup(group: OptionGroup) {
		setEditingGroup(group)
		setGroupDialogOpen(true)
	}

	const handleGroupConfirm = useCallback(
		(data: { group_name: LocaleText; group_icon?: string }) => {
			if (editingGroup) store.editInspirationGroup(editingGroup.group_key, data)
			else store.createInspirationGroup(data, defaultGroupName)
			void store.save()
		},
		[defaultGroupName, editingGroup, store],
	)

	// Item dialogs
	function openCreateItem() {
		setEditingItem(undefined)
		setEditingItemGroupKey(activeGroupKey ?? defaultGroupKey ?? DEFAULT_INSPIRATION_GROUP_KEY)
		setItemDialogOpen(true)
	}

	function openEditItem(item: OptionItem, groupKey: string) {
		setEditingItem(item)
		setEditingItemGroupKey(groupKey)
		setItemDialogOpen(true)
	}

	const handleItemConfirm = useCallback(
		(data: Partial<OptionItem>, groupKey: string) => {
			if (editingItem)
				store.editInspirationItem(
					localeTextToDisplayString(editingItem.value),
					data,
					groupKey,
				)
			else store.createInspirationItem(data, groupKey, defaultGroupName)
			void store.save()
		},
		[defaultGroupName, editingItem, store],
	)

	function handleCreateGroupFromItem(data: { group_name: LocaleText; group_icon?: string }) {
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
						{t(
							`playbook.edit.inspiration.config.themeOptions.${config?.demo?.view_type}`,
							{
								defaultValue: config?.demo?.view_type,
							},
						)}
					</span>
				</Badge>
				<Button
					variant="ghost"
					size="icon"
					className="size-9 shrink-0"
					onClick={() => setConfigDialogOpen(true)}
					data-testid="inspiration-enable-button"
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
						data-testid="inspiration-select-all-checkbox"
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
							data-testid="inspiration-cancel-selection-button"
						>
							{t("playbook.edit.inspiration.cancelSelection")}
						</Button>
						<Button
							variant="destructive"
							className="shadow-xs h-9 gap-2"
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
								className="shadow-xs h-9 w-[280px] pl-9"
								data-testid="inspiration-search-input"
							/>
						</div>
						<Button
							variant="outline"
							className="shadow-xs h-9"
							onClick={handleReset}
							data-testid="inspiration-reset-button"
						>
							{t("playbook.edit.filter.reset")}
						</Button>
						<Separator orientation="vertical" className="!h-5" />
						<Button
							className="shadow-xs h-9"
							onClick={openCreateItem}
							data-testid="inspiration-create-button"
						>
							<CirclePlus className="h-4 w-4" />
							{t("playbook.edit.filter.create")}
						</Button>
					</div>
				)}
			</div>

			{/* Content area */}
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto rounded-lg border border-border p-4">
				{/* Toolbar: Create Group + scrollable group tabs */}
				<div className="flex shrink-0 items-center gap-3">
					<Button
						className="shadow-xs h-9 shrink-0 rounded-full"
						onClick={openCreateGroup}
						data-testid="inspiration-create-group-button"
					>
						<CirclePlus className="h-4 w-4" />
						{t("playbook.edit.inspiration.createGroup")}
					</Button>
					<Separator orientation="vertical" className="h-5 shrink-0" />
					<HeadlessHorizontalScroll
						className="min-w-0 flex-1"
						scrollContainerClassName="flex items-center gap-2 overflow-x-auto py-1"
					>
						{groups.length === 0 ? (
							<Button
								variant="outline"
								className="shadow-xs h-9 shrink-0 gap-2"
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
									onClick={() => setActiveGroupKey(group.group_key)}
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
												store.deleteInspirationGroup(group.group_key)
												void store.save()
											},
										})
									}
								/>
							))
						)}
					</HeadlessHorizontalScroll>
				</div>

				{/* Items / Empty state */}
				{filteredItems.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center">
						<EmptyState
							title={t("playbook.edit.inspiration.empty.title")}
							description={t("playbook.edit.inspiration.empty.description")}
							createLabel={t("playbook.edit.inspiration.empty.create")}
							onCreate={openCreateItem}
						/>
					</div>
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
									store.deleteInspirationItem(value)
									void store.save()
								},
							})
						}
					/>
				)}
			</div>

			{/* Dialogs */}
			<InspirationConfigDialog
				config={config}
				open={configDialogOpen}
				onOpenChange={setConfigDialogOpen}
				onConfirm={(data) => {
					store.updateInspirationConfig(data)
					void store.save()
				}}
			/>

			<DemoGroupEditDialog
				group={editingGroup}
				open={groupDialogOpen}
				onOpenChange={setGroupDialogOpen}
				onConfirm={handleGroupConfirm}
			/>

			<DemoItemEditDialog
				item={editingItem}
				defaultGroupKey={editingItemGroupKey}
				groups={groups}
				open={itemDialogOpen}
				onOpenChange={setItemDialogOpen}
				onConfirm={handleItemConfirm}
				onCreateGroup={handleCreateGroupFromItem}
			/>

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
}

function GroupTab({ group, isActive, lang, onClick, onEdit, onDelete }: GroupTabProps) {
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
					"shadow-xs h-9 shrink-0 gap-2 rounded-full border-[2px] px-4 text-foreground",
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
				<MagicDropdown
					menu={{ items: menuItems }}
					trigger={["click"]}
					placement="bottomLeft"
				>
					<span>
						<Button
							variant="outline"
							size="icon"
							className={cn("shadow-xs size-6 shrink-0 rounded-full border-none")}
							data-testid={`inspiration-group-menu-${group.group_key}`}
							onClick={(e) => e.stopPropagation()}
						>
							<Ellipsis className="h-4 w-4" />
						</Button>
					</span>
				</MagicDropdown>
			</Button>
		</div>
	)
}
