import { useCallback } from "react"
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
import type { StoredSessionHistory } from "@/services/recordSummary/RecordingSessionHistoryDB"
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
	const { loading, sessions, scope, setScope, refresh, removeOne, cleanupExpired } =
		useSessionHistory(open)

	const handleExportOne = useCallback(async (session: StoredSessionHistory) => {
		try {
			await exportSessionAsZip(session)
			magicToast.success("已导出单条会话")
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			magicToast.error(`导出失败: ${reason}`)
		}
	}, [])

	const handleExportAll = useCallback(async () => {
		if (sessions.length === 0) {
			magicToast.warning("当前列表为空")
			return
		}
		try {
			await exportAllSessionsAsZip(sessions)
			magicToast.success(`已导出 ${sessions.length} 条会话`)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			magicToast.error(`导出失败: ${reason}`)
		}
	}, [sessions])

	const handleCleanup = useCallback(async () => {
		try {
			const count = await cleanupExpired()
			magicToast.success(count > 0 ? `已清理 ${count} 条过期会话` : "无过期会话需要清理")
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			magicToast.error(`清理失败: ${reason}`)
		}
	}, [cleanupExpired])

	const handleDelete = useCallback(
		async (session: StoredSessionHistory) => {
			try {
				await removeOne(session.id)
				magicToast.success("已删除会话")
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				magicToast.error(`删除失败: ${reason}`)
			}
		},
		[removeOne],
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-[960px] gap-4 sm:max-w-[min(960px,92vw)]"
				data-testid="recording-history-panel"
			>
				<DialogHeader>
					<DialogTitle>录音会话历史</DialogTitle>
					<DialogDescription>
						保留最近 30 天发起的录音会话，可导出为 zip（session.json + note.md +
						transcript.md）。
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-wrap items-center justify-between gap-2">
					<Tabs value={scope} onValueChange={(value) => setScope(value as SessionScope)}>
						<TabsList>
							<TabsTrigger value="current">当前用户</TabsTrigger>
							<TabsTrigger value="all">全部</TabsTrigger>
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
							刷新
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExportAll}
							data-testid="recording-history-export-all"
						>
							<PackageIcon className="h-3.5 w-3.5" />
							全部导出
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCleanup}
							data-testid="recording-history-cleanup"
						>
							<TrashIcon className="h-3.5 w-3.5" />
							清理过期
						</Button>
					</div>
				</div>

				<SessionHistoryTable
					sessions={sessions}
					loading={loading}
					onExport={handleExportOne}
					onDelete={handleDelete}
				/>

				<DialogFooter>
					<div className="mr-auto text-xs text-muted-foreground">
						共 {sessions.length} 条记录
					</div>
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
						关闭
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default RecordingHistoryPanel
export { RecordingHistoryPanel }
