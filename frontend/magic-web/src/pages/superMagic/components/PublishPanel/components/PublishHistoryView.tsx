import { useState } from "react"
import { CircleAlert, CirclePlus, Info, LayoutTemplate, Loader2, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/shadcn-ui/table"
import { cn } from "@/lib/utils"
import { usePublishPanelStore } from "../context"
import { getInternalTargetUiKey, getPublishToCopyKeys } from "../publishCopy"
import type { PublishHistoryRecord, PublishRecordStatus } from "../types"

interface PublishHistoryViewProps {
	onClose: () => void
	onCreateNewVersion?: () => Promise<void> | void
}

const statusClassNameMap: Record<PublishRecordStatus, string> = {
	under_review: "bg-indigo-500 text-primary-foreground",
	rejected: "bg-destructive text-primary-foreground",
	published: "bg-secondary text-secondary-foreground",
}

export default observer(function PublishHistoryView({
	onClose,
	onCreateNewVersion,
}: PublishHistoryViewProps) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const [isOpeningCreateView, setIsOpeningCreateView] = useState(false)

	async function handleOpenCreateView() {
		if (isOpeningCreateView) return

		setIsOpeningCreateView(true)

		try {
			if (onCreateNewVersion) {
				await onCreateNewVersion()
				return
			}

			store.openCreateView()
		} finally {
			setIsOpeningCreateView(false)
		}
	}

	return (
		<div
			className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background"
			data-testid="skill-publish-history-panel"
		>
			<div className="flex items-center gap-2 px-3.5 pb-3 pt-3.5">
				<h2 className="min-w-0 flex-1 truncate text-2xl font-medium text-foreground">
					{t("skillEditPage.publishPanel.history.title")}
				</h2>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 rounded-md"
					onClick={onClose}
					data-testid="skill-publish-history-close-button"
				>
					<X className="size-4" />
				</Button>
			</div>

			<Separator />

			<div className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					{store.hasUnpublishedChanges ? (
						<Badge
							variant="secondary"
							className="gap-1.5 rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-500"
							data-testid="skill-publish-history-unpublished-badge"
						>
							<CircleAlert className="size-3" />
							{t("skillEditPage.publishPanel.history.unpublishedChanges")}
						</Badge>
					) : (
						<div />
					)}

					<Button
						type="button"
						className="h-9 rounded-md px-4"
						onClick={() => void handleOpenCreateView()}
						disabled={isOpeningCreateView}
						data-testid="skill-publish-history-open-create-button"
					>
						{isOpeningCreateView ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<CirclePlus className="size-4" />
						)}
						{t("skillEditPage.publishPanel.history.publishNewVersion")}
					</Button>
				</div>

				<div className="min-h-0 flex-1 overflow-auto">
					{store.historyRecords.length === 0 ? (
						<div
							className="flex h-full min-h-48 flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-border bg-background px-6 py-6"
							data-testid="skill-publish-history-empty"
						>
							<div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-card p-2 shadow-sm">
								<LayoutTemplate className="size-6 text-foreground" aria-hidden />
							</div>
							<div className="flex max-w-sm flex-col gap-2 text-center">
								<p className="text-lg font-medium leading-7 text-foreground">
									{t("skillEditPage.publishPanel.history.empty.title")}
								</p>
								<p className="text-sm leading-5 text-muted-foreground">
									{t("skillEditPage.publishPanel.history.empty.description")}
								</p>
							</div>
						</div>
					) : (
						<Table data-testid="skill-publish-history-table">
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="px-2 py-3 text-sm font-medium text-muted-foreground">
										{t("skillEditPage.publishPanel.history.columns.version")}
									</TableHead>
									<TableHead className="px-2 py-3 text-sm font-medium text-muted-foreground">
										{t("skillEditPage.publishPanel.history.columns.status")}
									</TableHead>
									<TableHead className="px-2 py-3 text-sm font-medium text-muted-foreground">
										{t("skillEditPage.publishPanel.history.columns.publishTo")}
									</TableHead>
									<TableHead className="px-2 py-3 text-sm font-medium text-muted-foreground">
										{t("skillEditPage.publishPanel.history.columns.publisher")}
									</TableHead>
									<TableHead className="px-2 py-3 text-sm font-medium text-muted-foreground">
										{t(
											"skillEditPage.publishPanel.history.columns.publishedDate",
										)}
									</TableHead>
									<TableHead className="px-2 py-3 text-right text-sm font-medium text-muted-foreground">
										{t("skillEditPage.publishPanel.history.columns.actions")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{store.historyRecords.map((record) => (
									<PublishHistoryRow key={record.id} record={record} />
								))}
							</TableBody>
						</Table>
					)}
				</div>
			</div>
		</div>
	)
})

const PublishHistoryRow = observer(function PublishHistoryRow({
	record,
}: {
	record: PublishHistoryRecord
}) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const publishToCopy = getPublishToCopyKeys({
		publishTo: record.publishTo,
		marketCopy: store.marketCopy,
	})
	const internalTargetUiKey = record.internalTarget
		? getInternalTargetUiKey(record.internalTarget)
		: null

	return (
		<TableRow
			className="hover:bg-transparent"
			data-testid={`skill-publish-history-row-${record.id}`}
		>
			<TableCell className="px-2 py-3 text-sm font-medium text-foreground">
				{record.version}
			</TableCell>
			<TableCell className="px-2 py-3">
				<Badge
					variant="secondary"
					className={cn(
						"rounded-md px-2 py-0.5 text-xs",
						statusClassNameMap[record.status],
					)}
				>
					{t(`skillEditPage.publishPanel.statuses.${record.status}`)}
					{record.status === "rejected" ? <Info className="size-3" /> : null}
				</Badge>
			</TableCell>
			<TableCell className="px-2 py-3 text-sm text-foreground">
				<div className="flex flex-col gap-0.5">
					<span>{t(publishToCopy.labelKey)}</span>
					{internalTargetUiKey ? (
						<span className="text-xs text-muted-foreground">
							{t(`skillEditPage.publishPanel.targets.${internalTargetUiKey}.label`)}
						</span>
					) : null}
				</div>
			</TableCell>
			<TableCell className="px-2 py-3 text-sm text-foreground">
				{record.publisherName}
			</TableCell>
			<TableCell className="px-2 py-3 text-sm text-foreground">
				{record.publishedAt}
			</TableCell>
			<TableCell className="px-2 py-3 text-right">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 rounded-md px-3 text-xs"
					onClick={() => store.viewRecord(record)}
					data-testid={`skill-publish-history-view-button-${record.id}`}
				>
					{t("skillEditPage.publishPanel.history.view")}
				</Button>
			</TableCell>
		</TableRow>
	)
})
