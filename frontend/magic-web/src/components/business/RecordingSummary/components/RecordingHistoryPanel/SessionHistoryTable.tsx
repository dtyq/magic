import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckIcon, CopyIcon, DownloadIcon, Trash2Icon } from "lucide-react"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/shadcn-ui/table"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/shadcn-ui/empty"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Spinner } from "@/components/shadcn-ui/spinner"
import {
	RECORDING_HISTORY_RETENTION_DAYS,
	type StoredSessionHistory,
} from "@/services/recordSummary/RecordingSessionHistoryDB"
import { clipboard } from "@/utils/clipboard-helpers"
import magicToast from "@/components/base/MagicToaster/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface SessionHistoryTableProps {
	sessions: StoredSessionHistory[]
	loading: boolean
	onExport: (session: StoredSessionHistory) => void
	onDelete: (session: StoredSessionHistory) => void
	exportingSessionId?: string | null
	exportDisabled?: boolean
}

// Format ms to hh:mm:ss
function formatDuration(ms: number): string {
	if (!ms || ms < 0) return "00:00:00"
	const total = Math.floor(ms / 1000)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const pad = (n: number) => n.toString().padStart(2, "0")
	return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function formatDate(ms: number): string {
	if (!ms) return "-"
	const date = new Date(ms)
	const pad = (n: number) => n.toString().padStart(2, "0")
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}`
}

function getStatusVariant(status: string): BadgeVariant {
	switch (status) {
		case "recording":
			return "destructive"
		case "paused":
			return "default"
		default:
			return "secondary"
	}
}

export function buildSessionKeyInfo(session: StoredSessionHistory): string {
	return [
		`Session ID: ${session.id || "-"}`,
		`Topic ID: ${session.topic?.id || session.chatTopic?.id || "-"}`,
		`Status: ${session.status || "-"}`,
		`Start Time: ${formatDate(session.startTime)}`,
		`Last Activity Time: ${formatDate(session.lastActivityTime)}`,
		`Duration: ${formatDuration(session.totalDuration)}`,
		`Current Chunk Index: ${session.currentChunkIndex ?? "-"}`,
	].join("\n")
}

function SessionHistoryTable({
	sessions,
	loading,
	onExport,
	onDelete,
	exportingSessionId,
	exportDisabled = false,
}: SessionHistoryTableProps) {
	const { t } = useTranslation("accountSetting")
	const [pendingDelete, setPendingDelete] = useState<StoredSessionHistory | null>(null)
	const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null)
	const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current)
		}
	}, [])

	const handleCopyKeyInfo = async (session: StoredSessionHistory) => {
		try {
			await clipboard.writeText(buildSessionKeyInfo(session))
			setCopiedSessionId(session.id)
			if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current)
			copyResetTimerRef.current = setTimeout(() => {
				setCopiedSessionId(null)
				copyResetTimerRef.current = null
			}, 2000)
			magicToast.success({
				content: t("recordingHistoryPanel.toastCopySuccess"),
				key: `recording-history-copy-info-${session.id}`,
			})
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			magicToast.error(t("recordingHistoryPanel.toastCopyFailed", { reason }))
		}
	}

	if (!loading && sessions.length === 0) {
		return (
			<Empty className="h-[52vh]">
				<EmptyHeader>
					<EmptyTitle>{t("recordingHistoryPanel.emptyTitle")}</EmptyTitle>
					<EmptyDescription>
						{t("recordingHistoryPanel.emptyDescription", {
							days: RECORDING_HISTORY_RETENTION_DAYS,
						})}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<>
			<ScrollArea className="h-[52vh] rounded-md border">
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-card">
						<TableRow>
							<TableHead className="w-[170px]">
								{t("recordingHistoryPanel.table.startTime")}
							</TableHead>
							<TableHead className="w-[110px]">
								{t("recordingHistoryPanel.table.duration")}
							</TableHead>
							<TableHead className="w-[90px]">
								{t("recordingHistoryPanel.table.status")}
							</TableHead>
							<TableHead>{t("recordingHistoryPanel.table.scope")}</TableHead>
							<TableHead className="w-[80px] text-right">
								{t("recordingHistoryPanel.table.text")}
							</TableHead>
							<TableHead className="w-[80px] text-right">
								{t("recordingHistoryPanel.table.note")}
							</TableHead>
							<TableHead className="w-[220px] text-right">
								{t("recordingHistoryPanel.table.actions")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sessions.map((session) => {
							const exporting = exportingSessionId === session.id
							const copied = copiedSessionId === session.id
							const noteLength = session.note?.content?.length ?? 0
							const textCount = session.textContent?.length ?? 0
							const scope =
								[
									session.workspace?.name,
									session.project?.project_name,
									session.topic?.topic_name,
								]
									.filter(Boolean)
									.join(" / ") || "-"

							return (
								<TableRow key={session.id} data-testid="recording-history-row">
									<TableCell className="font-mono text-xs">
										{formatDate(session.startTime)}
									</TableCell>
									<TableCell className="font-mono text-xs">
										{formatDuration(session.totalDuration)}
									</TableCell>
									<TableCell>
										<Badge variant={getStatusVariant(session.status)}>
											{session.status}
										</Badge>
									</TableCell>
									<TableCell
										className="max-w-[320px] truncate text-sm text-muted-foreground"
										title={scope}
									>
										{scope}
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{textCount}
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{noteLength}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button
												variant="outline"
												size="sm"
												onClick={() => onExport(session)}
												disabled={exporting || exportDisabled}
												data-testid="recording-history-export"
											>
												{exporting ? (
													<Spinner className="h-3.5 w-3.5" />
												) : (
													<DownloadIcon className="h-3.5 w-3.5" />
												)}
												{exporting
													? t("recordingHistoryPanel.exporting")
													: t("recordingHistoryPanel.export")}
											</Button>
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={() => void handleCopyKeyInfo(session)}
												aria-label={
													copied
														? t("recordingHistoryPanel.copiedKeyInfo")
														: t("recordingHistoryPanel.copyKeyInfo")
												}
												title={
													copied
														? t("recordingHistoryPanel.copied")
														: t("recordingHistoryPanel.copyKeyInfo")
												}
												data-testid="recording-history-copy-info"
											>
												{copied ? (
													<CheckIcon className="h-3.5 w-3.5" />
												) : (
													<CopyIcon className="h-3.5 w-3.5" />
												)}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setPendingDelete(session)}
												data-testid="recording-history-delete"
											>
												<Trash2Icon className="h-3.5 w-3.5" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</ScrollArea>

			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null)
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("recordingHistoryPanel.deleteTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("recordingHistoryPanel.deleteDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingDelete) onDelete(pendingDelete)
								setPendingDelete(null)
							}}
						>
							{t("recordingHistoryPanel.confirmDelete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default SessionHistoryTable
