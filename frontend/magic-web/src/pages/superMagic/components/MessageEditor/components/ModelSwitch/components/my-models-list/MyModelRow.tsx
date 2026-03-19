import { useRef } from "react"
import type { MenuProps } from "antd"
import type React from "react"
import { useTranslation } from "react-i18next"
import { MagicDropdown } from "@/components/base"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import { serviceProviderModelToModelItem } from "@/services/superMagic/SuperMagicCustomModelService"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import type { ModelItem } from "../../types"
import { ProviderTypeIcon } from "../ProviderTypeIcon"
import type { MyModelGroup, MyModelProviderEntry } from "./utils"

interface MyModelRowProps {
	group: MyModelGroup
	isSelected?: boolean
	onSelect?: (model: ModelItem) => void
	selectedItemRef?: React.RefObject<HTMLDivElement>
	onEdit: (model: MyModelProviderEntry["model"]) => void
	onDelete: (modelId: string) => void
}

export function MyModelRow({
	group,
	isSelected = false,
	onSelect,
	selectedItemRef,
	onEdit,
	onDelete,
}: MyModelRowProps) {
	const { t } = useTranslation("super")
	const isActionMenuOpenRef = useRef(false)
	const shouldSkipNextSelectRef = useRef(false)
	const { representativeModel, providerEntries } = group
	const hasMultipleProviders = providerEntries.length > 1
	const primaryProviderEntry = providerEntries[0]
	const primaryProviderName = primaryProviderEntry
		? getProviderDisplayName(primaryProviderEntry)
		: ""
	const extraProviderEntries = providerEntries.slice(1)
	const moreProviderCount = extraProviderEntries.length

	const handleSelect = () => onSelect?.(serviceProviderModelToModelItem(representativeModel))

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

	return (
		<div
			ref={isSelected ? selectedItemRef : null}
			className={cn(
				"group flex cursor-pointer items-center gap-2.5 rounded px-3 py-2",
				"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
			)}
			data-testid={`my-model-item-${representativeModel.id}`}
			data-model-id={representativeModel.model_id}
			data-selected={isSelected}
			data-provider-count={providerEntries.length}
			onClick={handleItemClick}
		>
			<div className="min-w-0 flex-1">
				<div>
					<p className="text-sm font-medium leading-5 text-foreground">
						{representativeModel.name}
					</p>
					<p
						className={cn(
							"line-clamp-2 text-xs leading-4 text-muted-foreground",
							"empty:hidden",
						)}
					>
						{representativeModel.description}
					</p>
				</div>
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
							<Button
								variant="outline"
								size="sm"
								className="h-5 w-5 shrink-0 border p-0 shadow-none"
								data-stop-model-select="true"
								onPointerDown={handleActionTriggerPointerDown}
								data-testid={`my-model-actions-${representativeModel.id}`}
							>
								<Ellipsis size={16} />
							</Button>
						</span>
					</MagicDropdown>
				</div>
			</div>
			<Checkbox
				checked={isSelected}
				onCheckedChange={handleSelect}
				onClick={(event) => event.stopPropagation()}
				className={cn(
					"shrink-0",
					"invisible opacity-0 transition-opacity",
					"[@media(hover:hover)_and_(pointer:fine)]:group-hover:visible",
					"[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
					isSelected && "visible opacity-100",
				)}
			/>
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
