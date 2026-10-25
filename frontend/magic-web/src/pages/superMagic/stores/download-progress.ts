import type { ToolResponseState } from "./types"

export type DownloadItemStatus =
	"pending" | "downloading" | "retrying" | "completed" | "skipped" | "failed" | "cancelled"
export interface DownloadItemProgress {
	index: number
	fileName: string
	status: DownloadItemStatus
	downloadedBytes: number
	totalBytes: number | null
}
export interface DownloadProgressState {
	started: boolean
	truncated?: boolean
	items: DownloadItemProgress[]
}
const TERMINAL_STATUSES = new Set(["finished", "error", "suspended", "response_missing"])
const ITEM_TERMINAL_STATUSES = new Set<DownloadItemStatus>([
	"completed",
	"skipped",
	"failed",
	"cancelled",
])
const PREVIEW_LIMIT = 8

/** 仅在 canonical 响应通过身份、版本校验后调用；不保存原事件快照或另建消息历史。 */
export function mergeDownloadProgress(
	current: ToolResponseState | undefined,
	incoming: ToolResponseState,
): DownloadProgressState | undefined {
	if (incoming.name !== "download_from_urls" && current?.name !== "download_from_urls") return
	if (TERMINAL_STATUSES.has(incoming.status || "")) return
	if (TERMINAL_STATUSES.has(current?.status || "")) return current?.downloadProgress
	const data: unknown = incoming.detail?.data
	if (!data || typeof data !== "object" || Array.isArray(data)) return current?.downloadProgress
	const event = data as Record<string, unknown>
	const previous = current?.downloadProgress
	const started =
		previous?.started ||
		(event.status === "starting" &&
			event.current_file_index === undefined &&
			event.completed_files === 0)
	if (event.status === "cancelled" && event.current_file_index === undefined)
		return {
			started: false,
			truncated: previous?.truncated,
			items: (previous?.items || []).map((item) =>
				ITEM_TERMINAL_STATUSES.has(item.status) ? item : { ...item, status: "cancelled" },
			),
		}
	const index = event.current_file_index
	if (typeof index !== "number" || !Number.isInteger(index) || index < 0)
		return { started, truncated: previous?.truncated, items: previous?.items || [] }
	const statuses: Record<string, DownloadItemStatus> = {
		item_completed: "completed",
		item_skipped: "skipped",
		failed: "failed",
		cancelled: "cancelled",
		retrying: "retrying",
		downloading: "downloading",
		connecting: "downloading",
		starting: "downloading",
	}
	const status = typeof event.status === "string" ? statuses[event.status] : undefined
	if (!status) return { started, items: previous?.items || [] }
	const old = previous?.items.find((item) => item.index === index)
	// 传输百分比不能宣布业务完成；只有原 item_completed 事件标记文件成功。
	if (old && ITEM_TERMINAL_STATUSES.has(old.status)) return previous
	const downloadedBytes =
		typeof event.downloaded_bytes === "number" && Number.isFinite(event.downloaded_bytes)
			? Math.max(0, event.downloaded_bytes)
			: old?.downloadedBytes || 0
	const totalBytes =
		typeof event.total_bytes === "number" &&
		Number.isFinite(event.total_bytes) &&
		event.total_bytes > 0
			? event.total_bytes
			: (old?.totalBytes ?? null)
	const next: DownloadItemProgress = {
		index,
		fileName: typeof event.current_file === "string" ? event.current_file : old?.fileName || "",
		status,
		downloadedBytes,
		totalBytes,
	}
	const items = (previous?.items || []).filter((item) => item.index !== index)
	items.push(next)
	// 活动项优先保留；超过预算的历史项不补造成成功或等待状态。
	items.sort(
		(left, right) =>
			Number(ITEM_TERMINAL_STATUSES.has(left.status)) -
				Number(ITEM_TERMINAL_STATUSES.has(right.status)) || left.index - right.index,
	)
	return {
		started,
		truncated: previous?.truncated || items.length > PREVIEW_LIMIT,
		items: items.slice(0, PREVIEW_LIMIT),
	}
}
