import type { ColumnDef } from "@tanstack/react-table"
import { CheckCircle2, Eye, ServerCog, Trash2, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CopyableValue } from "@magic-admin-v2/components/copyable-value"
import { DataTable } from "@magic-admin-v2/components/data-table"
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import {
	ListFilterPanel,
	type ListFilterPanelFieldsProps,
} from "@magic-admin-v2/components/list-filter-panel"
import { ListPagination } from "@magic-admin-v2/components/list-pagination"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { ProviderStatusSwitch } from "@magic-admin-v2/features/platform-provider-list/components/provider-status-switch"
import {
	canDeleteProvider,
	type ProviderCategoryAccessMap,
} from "@magic-admin-v2/features/platform-provider-list/permissions"
import {
	providerSelectAllValue,
	providerStatus,
	providerType,
	type ProviderListItem,
	type ProviderTemplate,
	type ProviderType,
} from "@magic-admin-v2/features/platform-provider-list/types"
import {
	createDefaultProviderFilterDraft,
	type ProviderFilterDraft,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-list"
import {
	defaultProviderIcon,
	getProviderLogoSrc,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-icons"

type ProviderStatusStats = {
	disabled: number
	enabled: number
	total: number
}

export function ProviderListContent({
	categoryAccess,
	mobileFilterOpen,
	filter,
	items,
	deleting,
	loading,
	onDelete,
	onFilterChange,
	onMobileFilterOpenChange,
	onOpenDetail,
	onPageChange,
	onPageSizeChange,
	onStatusChange,
	page,
	pageSize,
	stats,
	statusPendingIds,
	total,
}: {
	categoryAccess: ProviderCategoryAccessMap
	deleting: boolean
	filter: ProviderFilterDraft
	items: ProviderListItem[]
	mobileFilterOpen?: boolean
	loading: boolean
	onDelete: (provider: ProviderListItem) => Promise<void>
	onFilterChange: (filter: ProviderFilterDraft) => void
	onMobileFilterOpenChange?: (open: boolean) => void
	onOpenDetail: (provider: ProviderListItem) => void
	onPageChange: (page: number) => void
	onPageSizeChange: (pageSize: number) => void
	onStatusChange: (provider: ProviderListItem, checked: boolean) => Promise<void>
	page: number
	pageSize: number
	stats: ProviderStatusStats
	statusPendingIds: ReadonlySet<string>
	total: number
}) {
	const { t } = useTranslation()
	const [deleteTarget, setDeleteTarget] = useState<ProviderListItem | null>(null)
	const columns = useMemo<Array<ColumnDef<ProviderListItem>>>(
		() => [
			{
				id: "name",
				size: 320,
				header: t("providerList.column.name"),
				cell: ({ row }) => <ProviderNameCell provider={row.original} />,
			},
			{
				id: "id",
				size: 200,
				header: t("providerList.column.id"),
				cell: ({ row }) => <ProviderIdCell value={row.original.id} />,
			},
			{
				id: "status",
				size: 96,
				header: t("providerList.column.status"),
				cell: ({ row }) => {
					const provider = row.original
					const canEdit = categoryAccess[provider.category]?.canEdit ?? false

					return (
						<ProviderStatusSwitch
							disabled={!canEdit}
							loading={statusPendingIds.has(provider.id)}
							provider={provider}
							onChange={(checked) => void onStatusChange(provider, checked)}
						/>
					)
				},
			},
			{
				id: "sort",
				size: 140,
				header: t("providerList.column.sort"),
				cell: ({ row }) => <span className="text-sm">{row.original.sort ?? 0}</span>,
			},
			{
				id: "created_at",
				size: 220,
				header: t("providerList.column.createdAt"),
				cell: ({ row }) => <ProviderDateCell value={row.original.created_at} />,
			},
			{
				id: "actions",
				// size: 96,
				meta: { fitContent: true },
				header: t("providerList.column.actions"),
				cell: ({ row }) => {
					const provider = row.original
					const canEdit = categoryAccess[provider.category]?.canEdit ?? false
					const canDelete = canDeleteProvider(categoryAccess, provider)

					return (
						<div className="flex justify-end gap-2">
							<Button
								className="whitespace-nowrap md:w-auto md:gap-1.5 md:px-2.5"
								data-testid="provider-list-configure-button"
								onClick={() => onOpenDetail(provider)}
								size="icon-sm"
								variant="outline"
							>
								<Eye className="size-4" aria-hidden="true" />
								<span className="hidden md:inline">
									{t(
										canEdit
											? "providerList.action.configure"
											: "providerList.action.view",
									)}
								</span>
							</Button>
							{canDelete ? (
								<Button
									aria-label={t("common.delete")}
									data-testid="provider-list-delete-button"
									disabled={deleting}
									onClick={() => setDeleteTarget(provider)}
									size="icon-sm"
									variant="outline"
									className="text-destructive hover:text-destructive md:w-auto md:gap-1.5 md:px-2.5"
								>
									<Trash2 className="size-4" aria-hidden="true" />
									<span className="hidden md:inline">{t("common.delete")}</span>
								</Button>
							) : null}
						</div>
					)
				},
			},
		],
		[categoryAccess, deleting, onOpenDetail, onStatusChange, statusPendingIds, t],
	)

	async function confirmDelete() {
		if (!deleteTarget) return

		try {
			await onDelete(deleteTarget)
			setDeleteTarget(null)
		} catch {
			// The page reports the request error and the dialog remains open for retry.
		}
	}

	return (
		<>
			<div className="mt-5 grid gap-3 sm:grid-cols-3">
				<ProviderStatCard
					icon={<ServerCog className="size-4" aria-hidden="true" />}
					label={t("providerList.stat.total")}
					value={stats.total}
				/>
				<ProviderStatCard
					icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
					label={t("providerList.stat.enabled")}
					value={stats.enabled}
				/>
				<ProviderStatCard
					icon={<X className="size-4" aria-hidden="true" />}
					label={t("providerList.stat.disabled")}
					value={stats.disabled}
				/>
			</div>

			<ListFilterPanel
				applyLabel={t("providerList.action.applyFilters")}
				mobileOpen={mobileFilterOpen}
				onMobileOpenChange={onMobileFilterOpenChange}
				showMobileTrigger={false}
				className="mt-5"
				desktopResetTestId="provider-list-reset-button"
				desktopTestId="provider-desktop-filters"
				mobileApplyTestId="provider-advanced-apply-button"
				mobileBodyTestId="provider-advanced-body"
				mobileCloseButtonTestId="provider-advanced-close-button"
				mobileContentTestId="provider-advanced-content"
				mobileResetTestId="provider-advanced-reset-button"
				createDefaultValue={createDefaultProviderFilterDraft}
				onChange={(patch) => onFilterChange({ ...filter, ...patch })}
				onReset={() => onFilterChange(createDefaultProviderFilterDraft())}
				renderFields={(props) => <ProviderFilterFields {...props} />}
				resetLabel={t("providerList.action.reset")}
				title={t("providerList.filter.title")}
				value={filter}
			/>

			<DataTable
				columns={columns}
				containerClassName="mt-5"
				containerTestId="provider-list-table"
				data={items}
				emptyState={
					<EmptyState
						icon={ServerCog}
						testId="provider-list-empty"
						title={t("providerList.empty.title")}
						description={t("providerList.empty.description")}
					/>
				}
				getRowId={(row) => row.id}
				isLoading={loading}
				loadingTestId="provider-list-loading"
				minWidth={1064}
				rowTestId="provider-list-row"
				stickyRightColumnId="actions"
			/>

			<ListPagination
				showQuickJumper
				className="mt-4 px-1"
				jumpInputTestId="provider-list-jump-input"
				nextButtonTestId="provider-list-next-button"
				onPageChange={onPageChange}
				onPageSizeChange={onPageSizeChange}
				page={page}
				pageSize={pageSize}
				pageSizeOptionTestId="provider-list-page-size-option"
				pageSizeTriggerTestId="provider-list-page-size-trigger"
				previousButtonTestId="provider-list-previous-button"
				testId="provider-list-pagination"
				total={total}
			/>

			<DeleteConfirmDialog
				cancelButtonTestId="provider-delete-cancel-button"
				confirmButtonTestId="provider-delete-confirm-button"
				contentTestId="provider-delete-dialog"
				description={t("providerList.delete.description")}
				isPending={deleting}
				onConfirm={confirmDelete}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				open={deleteTarget !== null}
				title={t("providerList.delete.title")}
			/>
		</>
	)
}

function ProviderFilterFields({
	layout,
	onChange,
	value,
}: ListFilterPanelFieldsProps<ProviderFilterDraft>) {
	const { t } = useTranslation()
	const isSheet = layout === "sheet"

	return (
		<>
			<FilterControlField label={t("providerList.filter.name")}>
				<FilterSearchInput
					aria-label={t("providerList.filter.name")}
					clearButtonTestId={
						isSheet ? "provider-name-clear-button" : "provider-list-name-clear-button"
					}
					clearLabel={t("providerList.action.clearSearch")}
					inputTestId={isSheet ? "provider-name-input" : "provider-list-name-input"}
					onValueChange={(name) => onChange({ name })}
					placeholder={t("providerList.placeholder.searchName")}
					value={value.name}
				/>
			</FilterControlField>
			<FilterControlField label={t("providerList.filter.alias")}>
				<FilterSearchInput
					aria-label={t("providerList.filter.alias")}
					clearButtonTestId={
						isSheet ? "provider-alias-clear-button" : "provider-list-alias-clear-button"
					}
					clearLabel={t("providerList.action.clearSearch")}
					inputTestId={isSheet ? "provider-alias-input" : "provider-list-alias-input"}
					onValueChange={(alias) => onChange({ alias })}
					placeholder={t("providerList.placeholder.searchAlias")}
					value={value.alias}
				/>
			</FilterControlField>
			<FilterControlField label={t("providerList.filter.providerId")}>
				<FilterSearchInput
					aria-label={t("providerList.filter.providerId")}
					clearButtonTestId={
						isSheet ? "provider-id-clear-button" : "provider-list-id-clear-button"
					}
					clearLabel={t("providerList.action.clearSearch")}
					inputTestId={isSheet ? "provider-id-input" : "provider-list-id-input"}
					onValueChange={(id) => onChange({ id })}
					placeholder={t("providerList.placeholder.searchProviderId")}
					value={value.id}
				/>
			</FilterControlField>
			<FilterControlField label={t("providerList.filter.status")}>
				<ProviderStatusSelect
					className="w-full"
					onChange={(status) => onChange({ status })}
					testId={
						isSheet ? "provider-advanced-status-trigger" : "provider-status-trigger"
					}
					value={value.status}
				/>
			</FilterControlField>
			<FilterControlField label={t("providerList.filter.providerType")}>
				<ProviderTypeSelect
					className="w-full"
					onChange={(provider_type) => onChange({ provider_type })}
					testId={isSheet ? "provider-advanced-type-trigger" : "provider-type-trigger"}
					value={value.provider_type}
				/>
			</FilterControlField>
		</>
	)
}

function ProviderStatCard({
	icon,
	label,
	value,
}: {
	icon: ReactNode
	label: string
	value: number
}) {
	return (
		<div className="rounded-lg border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="text-sm text-muted-foreground">{label}</div>
				<div className="flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground">
					{icon}
				</div>
			</div>
			<div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
		</div>
	)
}

function ProviderNameCell({ provider }: { provider: ProviderListItem }) {
	const alias = provider.alias?.trim()
	const primaryName = alias || provider.name

	return (
		<div className="flex min-w-0 items-center gap-3">
			<ProviderIcon provider={provider} />
			<div className="min-w-0">
				<span className="block truncate text-sm font-medium text-foreground">
					{primaryName}
				</span>
				<span className="mt-1 block truncate text-xs text-muted-foreground">
					{provider.name}
				</span>
			</div>
		</div>
	)
}

export function ProviderIcon({
	provider,
	size = "md",
}: {
	provider: ProviderListItem | ProviderTemplate
	size?: "sm" | "md" | "lg"
}) {
	const iconSize = size === "lg" ? "size-12" : size === "sm" ? "size-7" : "size-9"
	const src = getProviderLogoSrc({
		code: provider.provider_code,
		icon: provider.icon,
		type: provider.provider_type,
	})

	return (
		<EntityAvatarRender
			className={iconSize}
			fallbackIcon={
				<ServerCog className={size === "lg" ? "size-5" : "size-4"} aria-hidden="true" />
			}
			fallbackImageSrc={defaultProviderIcon}
			imageClassName="object-contain p-1.5"
			name={provider.name || provider.provider_code}
			src={src || defaultProviderIcon}
		/>
	)
}

function ProviderDateCell({ value }: { value?: string }) {
	const { t } = useTranslation()

	return value ? (
		<span className="whitespace-nowrap text-sm text-muted-foreground">{value}</span>
	) : (
		<span className="text-muted-foreground">{t("common.emptyValue")}</span>
	)
}

function ProviderIdCell({ value }: { value: string }) {
	const { t } = useTranslation()

	return (
		<CopyableValue
			className="text-left hover:text-muted-foreground"
			copyLabel={t("providerList.action.copyId")}
			value={value}
		/>
	)
}

function ProviderStatusSelect({
	className,
	onChange,
	testId,
	value,
}: {
	className?: string
	onChange: (value: string) => void
	testId?: string
	value: string
}) {
	const { t } = useTranslation()

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className={className} data-testid={testId}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent data-testid="platform-provider-list-filter-content">
				<SelectItem
					data-testid="platform-provider-list-option"
					value={providerSelectAllValue}
				>
					{t("common.all")}
				</SelectItem>
				<SelectItem
					data-testid="platform-provider-list-option"
					value={String(providerStatus.enabled)}
				>
					{t("providerList.status.enabled")}
				</SelectItem>
				<SelectItem
					data-testid="platform-provider-list-option"
					value={String(providerStatus.disabled)}
				>
					{t("providerList.status.disabled")}
				</SelectItem>
			</SelectContent>
		</Select>
	)
}

function ProviderTypeSelect({
	className,
	onChange,
	testId,
	value,
}: {
	className?: string
	onChange: (value: string) => void
	testId?: string
	value: string
}) {
	const { t } = useTranslation()

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className={className} data-testid={testId}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent data-testid="platform-provider-list-platform-provider-list-content">
				<SelectItem
					data-testid="platform-provider-list-option"
					value={providerSelectAllValue}
				>
					{t("common.all")}
				</SelectItem>
				<SelectItem
					data-testid="platform-provider-list-option"
					value={String(providerType.official)}
				>
					{getProviderTypeLabel(providerType.official, t)}
				</SelectItem>
				<SelectItem
					data-testid="platform-provider-list-option"
					value={String(providerType.nonOfficial)}
				>
					{getProviderTypeLabel(providerType.nonOfficial, t)}
				</SelectItem>
				<SelectItem
					data-testid="platform-provider-list-option"
					value={String(providerType.custom)}
				>
					{getProviderTypeLabel(providerType.custom, t)}
				</SelectItem>
			</SelectContent>
		</Select>
	)
}

function getProviderTypeLabel(type: ProviderType, t: (key: string) => string) {
	switch (type) {
		case providerType.official:
			return t("providerList.providerType.official")
		case providerType.custom:
			return t("providerList.providerType.custom")
		case providerType.nonOfficial:
		default:
			return t("providerList.providerType.nonOfficial")
	}
}
