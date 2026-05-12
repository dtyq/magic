import { useState } from "react"
import { DownloadIcon, Trash2Icon } from "lucide-react"
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
import type { StoredSessionHistory } from "@/services/recordSummary/RecordingSessionHistoryDB"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface SessionHistoryTableProps {
	sessions: StoredSessionHistory[]
	loading: boolean
	onExport: (session: StoredSessionHistory) => void
	onDelete: (session: StoredSessionHistory) => void
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

function SessionHistoryTable({ sessions, loading, onExport, onDelete }: SessionHistoryTableProps) {
	const [pendingDelete, setPendingDelete] = useState<StoredSessionHistory | null>(null)

	if (!loading && sessions.length === 0) {
		return (
			<Empty className="h-[52vh]">
				<EmptyHeader>
					<EmptyTitle>暂无历史会话</EmptyTitle>
					<EmptyDescription>30 天内没有发起过录音会话，或数据已被清理。</EmptyDescription>
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
							<TableHead className="w-[170px]">开始时间</TableHead>
							<TableHead className="w-[110px]">时长</TableHead>
							<TableHead className="w-[90px]">状态</TableHead>
							<TableHead>工作区 / 项目 / 主题</TableHead>
							<TableHead className="w-[80px] text-right">文本</TableHead>
							<TableHead className="w-[80px] text-right">笔记</TableHead>
							<TableHead className="w-[160px] text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sessions.map((session) => {
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
												data-testid="recording-history-export"
											>
												<DownloadIcon className="h-3.5 w-3.5" />
												导出
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
						<AlertDialogTitle>删除该条历史会话？</AlertDialogTitle>
						<AlertDialogDescription>
							该操作不可撤销。已上传的音频分片与服务端数据不受影响。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>取消</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingDelete) onDelete(pendingDelete)
								setPendingDelete(null)
							}}
						>
							确认删除
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default SessionHistoryTable
