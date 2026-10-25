import { Activity, AlertCircle, Bot, Database, Plus, RefreshCcw } from "lucide-react"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { PageHeader } from "@magic-admin-v2/components/page-header"
import { StatusCard } from "@magic-admin-v2/components/status-card"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { useTranslation } from "react-i18next"

export default function DashboardPage() {
	const { t } = useTranslation()

	return (
		<>
			<PageHeader
				testId="dashboard-page"
				title={t("nav.item.overview")}
				description={t("dashboard.description")}
				actions={
					<>
						<PageHeaderActionButton variant="outline" data-testid="dashboard-refresh-button">
							<RefreshCcw className="size-4" aria-hidden="true" />
							{t("common.refresh")}
						</PageHeaderActionButton>
						<PageHeaderActionButton data-testid="dashboard-create-button">
							<Plus className="size-4" aria-hidden="true" />
							{t("common.createAgent")}
						</PageHeaderActionButton>
					</>
				}
			/>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<StatusCard
					title={t("dashboard.activeAgents")}
					value="--"
					description={t("dashboard.activeAgentsDescription")}
					icon={Bot}
					tone="info"
				/>
				<StatusCard
					title={t("dashboard.recentRuns")}
					value="--"
					description={t("dashboard.recentRunsDescription")}
					icon={Activity}
					tone="neutral"
				/>
				<StatusCard
					title={t("dashboard.knowledgeSources")}
					value="--"
					description={t("dashboard.knowledgeSourcesDescription")}
					icon={Database}
					tone="success"
				/>
				<StatusCard
					title={t("dashboard.alerts")}
					value="--"
					description={t("dashboard.alertsDescription")}
					icon={AlertCircle}
					tone="warning"
				/>
			</section>

			<section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
				<div className="rounded-lg border bg-card">
					<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
						<div>
							<h2 className="text-base font-semibold">
								{t("dashboard.recentActivity")}
							</h2>
							<p className="text-sm text-muted-foreground">
								{t("dashboard.recentActivityDescription")}
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							disabled
							data-testid="dashboard-view-all-button"
						>
							{t("common.viewAll")}
						</Button>
					</div>
					<div className="space-y-3 p-4">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-5/6" />
					</div>
				</div>

				<EmptyState
					icon={Bot}
					title={t("dashboard.pendingTitle")}
					description={t("dashboard.pendingDescription")}
					actionLabel={t("common.createAgent")}
					testId="dashboard-pending-empty"
				/>
			</section>
		</>
	)
}
