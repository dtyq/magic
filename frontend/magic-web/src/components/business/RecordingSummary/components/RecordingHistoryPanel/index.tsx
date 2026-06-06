import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCwIcon, PackageIcon, TrashIcon } from "lucide-react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { Spinner } from "@/components/shadcn-ui/spinner"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	RECORDING_HISTORY_RETENTION_DAYS,
	type StoredSessionHistory,
} from "@/services/recordSummary/RecordingSessionHistoryDB"
import {
	exportAllSessionsAsZip,
	exportSessionAsZip,
} from "@/services/recordSummary/utils/exportSessionHistory"
import SessionHistoryTable from "./SessionHistoryTable"
import { useSessionHistory, type SessionScope } from "./useSessionHistory"

interface RecordingHistoryPanelProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

function RecordingHistoryPanel({ open, onOpenChange }: RecordingHistoryPanelProps) {
	const { t } = useTranslation("accountSetting")
	const { loading, sessions, scope, setScope, refresh, removeOne, cleanupExpired } =
		useSessionHistory(open)
	const [exportingSessionId, setExportingSessionId] = useState<string | null>(null)
	const [exportingAll, setExportingAll] = useState(false)

	const handleExportOne = useCallback(
		async (session: StoredSessionHistory) => {
			if (exportingSessionId || exportingAll) return
			setExportingSessionId(session.id)
			try {
				await exportSessionAsZip(session)
				magicToast.success(t("recordingHistoryPanel.toastExportOneSuccess"))
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				magicToast.error(t("recordingHistoryPanel.toastExportFailed", { reason }))
			} finally {
				setExportingSessionId(null)
			}
		},
		[exportingAll, exportingSessionId, t],
	)

	const handleExportAll = useCallback(async () => {
		if (exportingAll || exportingSessionId) return
		if (sessions.length === 0) {
			magicToast.warning(t("recordingHistoryPanel.toastEmptyList"))
			return
		}
		setExportingAll(true)
		try {
			await exportAllSessionsAsZip(sessions)
			magicToast.success(
				t("recordingHistoryPanel.toastExportAllSuccess", { count: sessions.length }),
			)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			magicToast.error(t("recordingHistoryPanel.toastExportFailed", { reason }))
		} finally {
			setExportingAll(false)
		}
	}, [exportingAll, exportingSessionId, sessions, t])

	const handleCleanup = useCallback(async () => {
		try {
			const count = await cleanupExpired()
			magicToast.success(
				count > 0
					? t("recordingHistoryPanel.toastCleanupSuccess", { count })
					: t("recordingHistoryPanel.toastCleanupNone"),
			)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			magicToast.error(t("recordingHistoryPanel.toastCleanupFailed", { reason }))
		}
	}, [cleanupExpired, t])

	const handleDelete = useCallback(
		async (session: StoredSessionHistory) => {
			try {
				await removeOne(session.id)
				magicToast.success(t("recordingHistoryPanel.toastDeleteSuccess"))
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				magicToast.error(t("recordingHistoryPanel.toastDeleteFailed", { reason }))
			}
		},
		[removeOne, t],
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-[960px] gap-4 sm:max-w-[min(960px,92vw)]"
				data-testid="recording-history-panel"
			>
				<DialogHeader>
					<DialogTitle>{t("recordingHistoryPanel.title")}</DialogTitle>
					<DialogDescription>
						{t("recordingHistoryPanel.description", {
							days: RECORDING_HISTORY_RETENTION_DAYS,
						})}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<Tabs value={scope} onValueChange={(value) => setScope(value as SessionScope)}>
						<TabsList>
							<TabsTrigger value="current">
								{t("recordingHistoryPanel.scopeCurrent")}
							</TabsTrigger>
							<TabsTrigger value="all">
								{t("recordingHistoryPanel.scopeAll")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={refresh}
							disabled={loading}
							data-testid="recording-history-refresh"
						>
							{loading ? (
								<Spinner className="h-3.5 w-3.5" />
							) : (
								<RefreshCwIcon className="h-3.5 w-3.5" />
							)}
							{t("recordingHistoryPanel.refresh")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExportAll}
							disabled={exportingAll || Boolean(exportingSessionId)}
							data-testid="recording-history-export-all"
						>
							{exportingAll ? (
								<Spinner className="h-3.5 w-3.5" />
							) : (
								<PackageIcon className="h-3.5 w-3.5" />
							)}
							{exportingAll
								? t("recordingHistoryPanel.exporting")
								: t("recordingHistoryPanel.exportAll")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCleanup}
							data-testid="recording-history-cleanup"
						>
							<TrashIcon className="h-3.5 w-3.5" />
							{t("recordingHistoryPanel.cleanupExpired")}
						</Button>
					</div>
				</div>

				<SessionHistoryTable
					sessions={sessions}
					loading={loading}
					onExport={handleExportOne}
					onDelete={handleDelete}
					exportingSessionId={exportingSessionId}
					exportDisabled={exportingAll}
				/>

				<DialogFooter>
					<div className="mr-auto text-xs text-muted-foreground">
						{t("recordingHistoryPanel.totalRecords", { count: sessions.length })}
					</div>
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
						{t("recordingHistoryPanel.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default RecordingHistoryPanel
export { RecordingHistoryPanel }
