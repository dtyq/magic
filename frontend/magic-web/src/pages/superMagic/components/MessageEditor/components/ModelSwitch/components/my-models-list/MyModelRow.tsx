import { useRef } from "react"
import type { MenuProps } from "antd"
import type React from "react"
import { useTranslation } from "react-i18next"
import { MagicDropdown } from "@/components/base"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/utils/cn"
import { serviceProviderModelToModelItem } from "@/services/superMagic/SuperMagicCustomModelService"
import { Check, Ellipsis, Pencil, Trash2, TriangleAlert } from "lucide-react"
import type { ModelItem, ModelSelectionState } from "../../types"
import { ModelInfoHoverCard } from "../ModelInfoHoverCard"
import ModelIcon from "../ModelIcon"
import ModelName from "../ModelName"
import { ProviderTypeIcon } from "../ProviderTypeIcon"
import type { MyModelGroup, MyModelProviderEntry } from "./utils"
import { userStore } from "@/models/user"

interface MyModelRowProps {
	allowModelManagement?: boolean
	group: MyModelGroup
	isSelected?: boolean
	onSelect?: (model: ModelItem) => void
	getModelState?: (model: ModelItem) => ModelSelectionState | undefined
	selectedItemRef?: React.RefObject<HTMLDivElement>
	onEdit: (model: MyModelProviderEntry["model"]) => void
	onDelete: (modelId: string) => void
	/**
	 * 桌面紧凑行：与平台模型行同一套尺寸、图标和勾选列，不缩进，描述收进悬停信息卡。
	 * 移动端弹层不传，保留两行描述与复选框的原布局。
	 */
	compact?: boolean
}

export function MyModelRow({
	group,
	isSelected = false,
	onSelect,
	getModelState,
	selectedItemRef,
	onEdit,
	onDelete,
	compact = false,
	allowModelManagement = true,
}: MyModelRowProps) {
	const { t } = useTranslation("super")
	const isActionMenuOpenRef = useRef(false)
	const shouldSkipNextSelectRef = useRef(false)
	const { representativeModel, providerEntries } = group
	const model = serviceProviderModelToModelItem(representativeModel)
	const modelState = getModelState?.(model)
	const isSelectionDisabled = modelState?.disabled ?? false
	const isCandidateSelected = isSelected && !isSelectionDisabled
	const hasMultipleProviders = providerEntries.length > 1
	const primaryProviderEntry = providerEntries[0]
	const primaryProviderName = primaryProviderEntry
		? getProviderDisplayName(primaryProviderEntry)
		: ""
	const extraProviderEntries = providerEntries.slice(1)
	const moreProviderCount = extraProviderEntries.length

	// 企业组织的模型由管理后台维护，模型选择器只允许个人组织用户管理自定义模型。
	const { isPersonalOrganization } = userStore.user
	const canManageModels = isPersonalOrganization && allowModelManagement

	const handleSelect = () => {
		if (!isSelectionDisabled) onSelect?.(serviceProviderModelToModelItem(representativeModel))
	}

	const handleItemClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement | null

		if (isActionMenuOpenRef.current || shouldSkipNextSelectRef.current) {
			shouldSkipNextSelectRef.current = false
			return
		}

		if (target?.closest('[data-stop-model-select="true"]')) return
		handleSelect()
	}

	const handleActionMenuOpenChange = (open: boolean) => {
		isActionMenuOpenRef.current = open

		if (open) {
			shouldSkipNextSelectRef.current = true
			return
		}

		window.setTimeout(() => {
			shouldSkipNextSelectRef.current = false
		}, 0)
	}

	const handleActionTriggerPointerDown = () => {
		shouldSkipNextSelectRef.current = true
	}

	const actionMenuItems = hasMultipleProviders
		? buildGroupedActionMenuItems({
				providerEntries,
				multipleProviderHint: t("messageEditor.addModel.multipleProviderHint"),
				editLabel: t("messageEditor.addModel.edit"),
				deleteLabel: t("messageEditor.addModel.delete"),
				onEdit,
				onDelete,
			})
		: buildModelActionMenuItems({
				model: representativeModel,
				editLabel: t("messageEditor.addModel.edit"),
				deleteLabel: t("messageEditor.addModel.delete"),
				onEdit,
				onDelete,
			})

	const renderActionMenu = (trigger: React.ReactNode) => (
		<MagicDropdown
			placement="bottomRight"
			onOpenChange={handleActionMenuOpenChange}
			overlayClassName={cn(
				"min-w-[200px] rounded-lg shadow-md",
				"[&_[data-slot=dropdown-menu-label]]:p-0",
				"[&_[data-slot=dropdown-menu-item]]:rounded-md",
				"[&_[data-slot=dropdown-menu-item]]:px-2",
				"[&_[data-slot=dropdown-menu-item]]:py-1.5",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:rounded-md",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:px-2",
				"[&_[data-slot=dropdown-menu-sub-trigger]]:py-1.5",
				"[&_[data-slot=dropdown-menu-sub-content]]:min-w-[160px]",
			)}
			menu={{ items: actionMenuItems }}
		>
			<span
				className="flex items-center justify-center"
				data-stop-model-select="true"
				onPointerDown={handleActionTriggerPointerDown}
			>
				{trigger}
			</span>
		</MagicDropdown>
	)

	if (compact && !getModelState) {
		const modelItem = serviceProviderModelToModelItem(representativeModel)
		const row = (
			<div
				ref={isSelected ? selectedItemRef : null}
				className={cn(
					"group flex h-8 items-center gap-2 rounded-lg px-2",
					"cursor-pointer transition-colors duration-100",
					// 与平台模型行一致：选中底色比悬停深一档。
					isSelected
						? "bg-muted"
						: "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60",
					"outline-none focus-visible:ring-2 focus-visible:ring-ring",
				)}
				role="button"
				tabIndex={isSelectionDisabled ? -1 : 0}
				aria-pressed={isSelected}
				aria-label={[representativeModel.name, modelState?.label, modelState?.reason]
					.filter(Boolean)
					.join("，")}
				aria-disabled={isSelectionDisabled || undefined}
				title={modelState?.reason}
				data-testid={`my-model-item-${representativeModel.id}`}
				data-model-id={representativeModel.model_id}
				data-selected={isSelected}
				data-provider-count={providerEntries.length}
				onClick={handleItemClick}
				onKeyDown={(event) => {
					if (event.target !== event.currentTarget) return
					if (event.key !== "Enter" && event.key !== " ") return
					event.preventDefault()
					handleSelect()
				}}
			>
				{/* 与平台模型行一致，行首显示模型自己的图标。 */}
				<ModelIcon model={modelItem} size={16} className="shrink-0 rounded" />
				<span
					className={cn(
						"min-w-0 flex-1 truncate text-[13px] leading-5",
						isSelected
							? "font-semibold text-foreground"
							: "font-normal text-foreground/80",
					)}
				>
					{representativeModel.name}
				</span>
				{/* 自定义模型没有倍率，个人组织在倍率的位置显示服务商，多服务商只给数量。 */}
				{canManageModels && primaryProviderName ? (
					<span
						className="max-w-[40%] shrink-0 truncate text-[11px] leading-4 text-muted-foreground"
						data-testid={`my-model-provider-badge-${representativeModel.id}`}
					>
						{hasMultipleProviders
							? `${primaryProviderName} +${moreProviderCount}`
							: primaryProviderName}
					</span>
				) : null}
				{/* 管理入口平时隐藏，悬停或键盘聚焦到行内时出现，不占用默认视觉。 */}
				{canManageModels
					? renderActionMenu(
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-5 w-5 shrink-0 p-0 text-muted-foreground shadow-none",
									"invisible group-focus-within:visible",
									"[@media(hover:hover)_and_(pointer:fine)]:group-hover:visible",
								)}
								data-stop-model-select="true"
								onPointerDown={handleActionTriggerPointerDown}
								data-testid={`my-model-actions-${representativeModel.id}`}
							>
								<Ellipsis size={16} />
							</Button>,
						)
					: null}
				{/* 固定勾选列，与供应商分组的行保持同一条右侧基线。 */}
				<span
					className="flex size-5 shrink-0 items-center justify-center"
					aria-hidden="true"
				>
					{isSelected ? (
						<Check className="size-4 text-foreground" strokeWidth={2} />
					) : null}
				</span>
			</div>
		)
		return (
			<ModelInfoHoverCard model={modelItem} description={modelItem.model_description}>
				{row}
			</ModelInfoHoverCard>
		)
	}

	return (
		<div
			ref={isSelected ? selectedItemRef : null}
			className={cn(
				"group flex cursor-pointer items-center gap-2.5 rounded px-3 py-2",
				"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
				isSelectionDisabled && "cursor-not-allowed",
			)}
			data-testid={`my-model-item-${representativeModel.id}`}
			data-model-id={representativeModel.model_id}
			data-selected={isCandidateSelected}
			aria-disabled={isSelectionDisabled || undefined}
			data-provider-count={providerEntries.length}
			onClick={handleItemClick}
		>
			<div className="min-w-0 flex-1">
				<div className={cn(getModelState && "flex flex-col gap-1")}>
					<div className="flex min-w-0 items-center gap-2">
						{getModelState ? (
							<ModelName
								model={model}
								isSelected={false}
								className="w-fit max-w-full"
							/>
						) : (
							<p className="min-w-0 text-sm font-medium leading-5 text-foreground">
								{representativeModel.name}
							</p>
						)}
						{modelState && (
							<span className="inline-flex shrink-0 items-center gap-1 text-xs font-normal leading-4 text-amber-600 dark:text-amber-400">
								<TriangleAlert className="size-4 shrink-0" aria-hidden />
								{modelState.label}
							</span>
						)}
					</div>
					<p
						className={cn(
							"line-clamp-2 text-xs leading-4 text-muted-foreground",
							"empty:hidden",
						)}
					>
						{modelState?.reason ?? representativeModel.description}
					</p>
				</div>
				{canManageModels && (
					<div className="mt-1 flex items-center gap-2">
						<div className="min-w-0">
							{primaryProviderName && (
								<div className="flex items-center gap-1">
									<span
										className="inline-flex max-w-full items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium"
										data-testid={`my-model-provider-badge-${representativeModel.id}`}
									>
										<span className="truncate">{primaryProviderName}</span>
									</span>
									{hasMultipleProviders && (
										<div className="group/provider-more relative">
											<button
												type="button"
												className="inline-flex h-5 items-center rounded-md border border-border bg-background px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
												data-stop-model-select="true"
												data-testid={`my-model-provider-more-${representativeModel.id}`}
												onPointerDown={handleActionTriggerPointerDown}
											>
												+{moreProviderCount}
											</button>
											<div
												className={cn(
													"pointer-events-none absolute left-0 top-[calc(100%+6px)] z-popup min-w-[180px] rounded-lg border bg-popover p-1.5 text-popover-foreground opacity-0 shadow-md transition-opacity",
													"group-hover/provider-more:pointer-events-auto group-hover/provider-more:opacity-100",
													"group-focus-within/provider-more:pointer-events-auto group-focus-within/provider-more:opacity-100",
												)}
												data-testid={`my-model-provider-more-content-${representativeModel.id}`}
											>
												<div className="flex flex-col gap-0.5">
													{extraProviderEntries.map((providerEntry) => (
														<div
															key={providerEntry.model.id}
															className="flex items-center gap-2 rounded-md px-2 py-1.5"
															data-testid={`my-model-provider-more-item-${providerEntry.model.id}`}
														>
															<ProviderListIcon
																providerEntry={providerEntry}
															/>
															<ProviderListLabel
																providerEntry={providerEntry}
															/>
														</div>
													))}
												</div>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
						{renderActionMenu(
							<Button
								variant="outline"
								size="sm"
								className="h-5 w-5 shrink-0 border p-0 shadow-none"
								data-stop-model-select="true"
								onPointerDown={handleActionTriggerPointerDown}
								data-testid={`my-model-actions-${representativeModel.id}`}
							>
								<Ellipsis size={16} />
							</Button>,
						)}
					</div>
				)}
			</div>
			{!isSelectionDisabled && (
				<Checkbox
					checked={isCandidateSelected}
					onCheckedChange={handleSelect}
					onClick={(event) => event.stopPropagation()}
					className={cn(
						"shrink-0",
						"invisible opacity-0 transition-opacity",
						"[@media(hover:hover)_and_(pointer:fine)]:group-hover:visible",
						"[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
						isCandidateSelected && "visible opacity-100",
					)}
				/>
			)}
		</div>
	)
}

function buildGroupedActionMenuItems({
	providerEntries,
	multipleProviderHint,
	editLabel,
	deleteLabel,
	onEdit,
	onDelete,
}: {
	providerEntries: MyModelProviderEntry[]
	multipleProviderHint: string
	editLabel: string
	deleteLabel: string
	onEdit: (model: MyModelProviderEntry["model"]) => void
	onDelete: (modelId: string) => void
}): MenuProps["items"] {
	return [
		{
			key: "grouped-provider-actions",
			type: "group",
			label: (
				<div
					className="rounded-md bg-secondary px-3 py-1.5 text-xs leading-4 text-muted-foreground"
					data-testid="my-model-multiple-provider-hint"
				>
					{multipleProviderHint}
				</div>
			),
			children: providerEntries.map((providerEntry) => ({
				key: `provider-${providerEntry.model.id}`,
				icon: <ProviderMenuIcon providerEntry={providerEntry} />,
				label: <ProviderMenuLabel providerEntry={providerEntry} />,
				children: buildModelActionMenuItems({
					model: providerEntry.model,
					editLabel,
					deleteLabel,
					onEdit,
					onDelete,
				}),
				"data-testid": `my-model-provider-actions-${providerEntry.model.id}`,
			})),
		},
	]
}

function buildModelActionMenuItems({
	model,
	editLabel,
	deleteLabel,
	onEdit,
	onDelete,
}: {
	model: MyModelProviderEntry["model"]
	editLabel: string
	deleteLabel: string
	onEdit: (model: MyModelProviderEntry["model"]) => void
	onDelete: (modelId: string) => void
}): MenuProps["items"] {
	return [
		{
			key: `edit-${model.id}`,
			label: editLabel,
			icon: <Pencil size={16} />,
			onClick: () => onEdit(model),
			"data-testid": `my-model-edit-${model.id}`,
		},
		{
			type: "divider",
		},
		{
			key: `delete-${model.id}`,
			label: deleteLabel,
			icon: <Trash2 size={16} />,
			danger: true,
			onClick: () => onDelete(model.id),
			"data-testid": `my-model-delete-${model.id}`,
		},
	]
}

function ProviderMenuIcon({ providerEntry }: { providerEntry: MyModelProviderEntry }) {
	return (
		<ProviderTypeIcon
			providerTypeId={providerEntry.provider?.providerTypeId}
			className="rounded-sm"
			size={16}
		/>
	)
}

function ProviderMenuLabel({ providerEntry }: { providerEntry: MyModelProviderEntry }) {
	const { primaryLabel, secondaryLabel } = getProviderLabelParts(providerEntry)

	return (
		<div className="flex min-w-0 flex-1 items-center gap-2 text-sm leading-5">
			<span className="min-w-0 flex-1 truncate">{primaryLabel}</span>
			{secondaryLabel && (
				<span className="ml-10 max-w-[45%] shrink-0 truncate text-muted-foreground">
					{secondaryLabel}
				</span>
			)}
		</div>
	)
}

function ProviderListIcon({ providerEntry }: { providerEntry: MyModelProviderEntry }) {
	return (
		<ProviderTypeIcon
			providerTypeId={providerEntry.provider?.providerTypeId}
			className="rounded-sm"
			size={16}
		/>
	)
}

function ProviderListLabel({ providerEntry }: { providerEntry: MyModelProviderEntry }) {
	const { primaryLabel, secondaryLabel } = getProviderLabelParts(providerEntry)

	return (
		<div className="flex min-w-0 flex-1 items-center gap-2 text-sm leading-5">
			<span className="min-w-0 flex-1 truncate text-foreground">{primaryLabel}</span>
			{secondaryLabel && (
				<span className="max-w-[45%] shrink-0 truncate text-muted-foreground">
					{secondaryLabel}
				</span>
			)}
		</div>
	)
}

function getProviderLabelParts(providerEntry: MyModelProviderEntry): {
	primaryLabel: string
	secondaryLabel: string
} {
	const providerAlias = providerEntry.providerAlias.trim()
	const providerName = providerEntry.providerName.trim()
	const providerTypeName = providerEntry.providerTypeName.trim()

	if (providerAlias && providerAlias !== providerTypeName)
		return {
			primaryLabel: providerAlias,
			secondaryLabel: providerTypeName,
		}

	if (!providerName)
		return {
			primaryLabel: providerTypeName || providerEntry.model.name,
			secondaryLabel: "",
		}

	return {
		primaryLabel: providerName,
		secondaryLabel: "",
	}
}

function getProviderDisplayName(providerEntry: MyModelProviderEntry): string {
	return getProviderLabelParts(providerEntry).primaryLabel
}
