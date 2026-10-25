import { AlertCircle, Cpu, RefreshCw } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { PageHeaderFilterButton } from "@magic-admin-v2/components/page-header-filter-button"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import { CapabilityCardList } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-card-list"
import { CapabilityConfigDialog } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-config-dialog"
import { CapabilityListSkeleton } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-list-skeleton"
import {
	CapabilityFilters,
	createDefaultCapabilityFilterDraft,
	getCapabilityFilterActiveCount,
} from "@magic-admin-v2/features/platform-system-capabilities/components/capability-filters"
import { ALL_VALUE } from "@magic-admin-v2/features/platform-system-capabilities/consts"
import { useUpdateSystemCapabilityMutation } from "@magic-admin-v2/features/platform-system-capabilities/mutations"
import { useSystemCapabilityListQuery } from "@magic-admin-v2/features/platform-system-capabilities/queries"
import {
	aiPowerStatus,
	type AiPower,
} from "@magic-admin-v2/features/platform-system-capabilities/types"
import {
	getApiErrorMessage,
	getCapabilityDisplayText,
} from "@magic-admin-v2/features/platform-system-capabilities/utils"
import { useRights } from "@magic-admin-v2/hooks/use-rights"
import { useRowPendingIds } from "@magic-admin-v2/hooks/use-row-pending-ids"
import { cn } from "@magic-admin-v2/utils/cn"

export default function PlatformSystemCapabilitiesPage() {
	const { t } = useTranslation()
	const hasEditRight = useRights(PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT)
	const [filters, setFilters] = useState(createDefaultCapabilityFilterDraft)
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
	const activeFilterCount = getCapabilityFilterActiveCount(filters)
	const { keyword, status: statusFilter } = filters
	const [configTarget, setConfigTarget] = useState<AiPower | null>(null)
	const listQuery = useSystemCapabilityListQuery()
	const updateMutation = useUpdateSystemCapabilityMutation()
	const { pendingIds: statusPendingIds, run: runStatusPending } = useRowPendingIds()
	const items = useMemo(() => {
		const search = keyword.trim().toLowerCase()
		return (listQuery.data ?? []).filter((item) => {
			const matchesKeyword =
				!search ||
				[
					getCapabilityDisplayText(item.name),
					getCapabilityDisplayText(item.description),
					item.code,
				]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(search))
			const matchesStatus =
				statusFilter === ALL_VALUE ||
				item.status ===
					(statusFilter === "enabled" ? aiPowerStatus.enabled : aiPowerStatus.disabled)

			return matchesKeyword && matchesStatus
		})
	}, [keyword, listQuery.data, statusFilter])

	const handleStatusChange = useCallback(
		(item: AiPower, checked: boolean) => {
			if (!hasEditRight) return

			void runStatusPending(item.code, async () => {
				try {
					await updateMutation.mutateAsync({
						code: item.code,
						status: checked ? aiPowerStatus.enabled : aiPowerStatus.disabled,
					})
					toast.success(t("systemCapabilities.message.updateSuccess"))
				} catch (error) {
					toast.error(getApiErrorMessage(error, t("common.requestFailed")))
				}
			})
		},
		[hasEditRight, runStatusPending, t, updateMutation],
	)

	const handleConfig = useCallback(
		(item: AiPower) => {
			if (hasEditRight) setConfigTarget(item)
		},
		[hasEditRight],
	)

	return (
		<>
			<ListShell
				testId="platform-system-capabilities-page"
				actions={
					<>
						<PageHeaderFilterButton
							data-testid="platform-system-capabilities-mobile-filters"
							count={activeFilterCount}
							label={t("systemCapabilities.filter.title")}
							onClick={() => setMobileFilterOpen(true)}
						/>
						<PageHeaderActionButton
							data-testid="platform-system-capabilities-refresh-button"
							disabled={listQuery.isFetching}
							onClick={() => listQuery.refetch()}
							variant="outline"
						>
							<RefreshCw
								aria-hidden="true"
								className={cn("size-4", listQuery.isFetching && "animate-spin")}
							/>
							{t("common.refresh")}
						</PageHeaderActionButton>
					</>
				}
				description={t("nav.desc.systemCapabilities")}
				title={t("nav.item.systemCapabilities")}
				contentHeader={
					<CapabilityFilters
						mobileOpen={mobileFilterOpen}
						onChange={setFilters}
						onMobileOpenChange={setMobileFilterOpen}
						value={filters}
					/>
				}
			>
				{listQuery.isLoading ? (
					<CapabilityListSkeleton  testId="platform-system-capabilities-loading" />
				) : (
					<div className="space-y-4 pb-6">
						{listQuery.error ? (
							<div className="rounded-lg border border-border/50 p-4">
								<EmptyState
									description={getApiErrorMessage(
										listQuery.error,
										t("common.requestFailed"),
									)}
									icon={AlertCircle}
									testId="platform-system-capabilities-error"
									title={t("systemCapabilities.error.loadTitle")}
								/>
							</div>
						) : items.length ? (
							<CapabilityCardList
								canEdit={hasEditRight}
								items={items}
								onConfig={handleConfig}
								onStatusChange={handleStatusChange}
								statusPendingIds={statusPendingIds}
							/>
						) : (
							<div className="rounded-lg border border-dashed bg-muted/20 p-4">
								<EmptyState
									description={t("systemCapabilities.empty.description")}
									icon={Cpu}
									testId="platform-system-capabilities-empty"
									title={t("systemCapabilities.empty.title")}
								/>
							</div>
						)}
					</div>
				)}
			</ListShell>

			<CapabilityConfigDialog
				canEdit={hasEditRight}
				onOpenChange={(open) => {
					if (!open) setConfigTarget(null)
				}}
				open={Boolean(configTarget)}
				target={configTarget}
			/>
		</>
	)
}
