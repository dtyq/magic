import { loadJSZip } from "@/lib/jszip"
import type { StoredSessionHistory } from "../RecordingSessionHistoryDB"

const DEFAULT_TRANSCRIPT_HEADER = "# Transcript"
const DEFAULT_NOTE_HEADER = "# Note"

const pad = (n: number) => n.toString().padStart(2, "0")

/**
 * Format ms timestamp to YYYY-MM-DD HH:mm:ss
 * 将毫秒时间戳格式化为日期字符串
 */
function formatTimestamp(ms: number): string {
	if (!ms) return "-"
	const date = new Date(ms)
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Format clock time HH:mm:ss from epoch ms
 * 毫秒时间戳 → HH:mm:ss
 */
function formatClockTime(ms: number): string {
	if (!ms) return "--:--:--"
	const date = new Date(ms)
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Format milliseconds to hh:mm:ss
 * 毫秒 → hh:mm:ss
 */
function formatDuration(ms: number): string {
	if (!ms || ms < 0) return "00:00:00"
	const total = Math.floor(ms / 1000)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/**
 * Get elapsed ms since session start for an utterance epoch ms
 * 计算相对会话开始的偏移毫秒
 */
function getOffsetMs(utteranceMs: number, sessionStart: number): number {
	if (!utteranceMs || !sessionStart) return 0
	const diff = utteranceMs - sessionStart
	return diff > 0 ? diff : 0
}

/**
 * Sanitize string for safe file/folder name
 * 清理字符串用于文件/目录名
 */
function sanitize(input: string): string {
	return input.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "session"
}

/**
 * Build metadata header markdown block for a session
 * 构建会话元信息 Markdown 头部
 */
function buildSessionMetaBlock(session: StoredSessionHistory): string {
	return [
		`- Session ID: \`${session.id}\``,
		`- Status: \`${session.status}\``,
		`- Start: ${formatTimestamp(session.startTime)}`,
		`- Last Activity: ${formatTimestamp(session.lastActivityTime)}`,
		`- Duration: ${formatDuration(session.totalDuration)}`,
		`- Workspace: ${session.workspace?.name ?? "-"}`,
		`- Project: ${session.project?.project_name ?? "-"}`,
		`- Topic: ${session.topic?.topic_name ?? "-"}`,
		`- User: ${session.userId ?? "-"}`,
		`- Organization: ${session.organizationName ?? session.organizationCode ?? "-"}`,
	].join("\n")
}

/**
 * Build note.md content from session
 * 根据会话构造 note.md
 */
export function buildNoteMarkdown(session: StoredSessionHistory): string {
	const meta = buildSessionMetaBlock(session)
	const body = session.note?.content?.trim() || "(empty)"
	return `${DEFAULT_NOTE_HEADER} - ${session.id}\n\n${meta}\n\n---\n\n${body}\n`
}

/**
 * Build transcript.md content from session
 * 根据会话构造 transcript.md
 */
export function buildTranscriptMarkdown(session: StoredSessionHistory): string {
	const meta = buildSessionMetaBlock(session)
	const utterances = [...(session.textContent ?? [])].sort(
		(a, b) => (a.add_time ?? 0) - (b.add_time ?? 0),
	)

	if (utterances.length === 0) {
		return `${DEFAULT_TRANSCRIPT_HEADER} - ${session.id}\n\n${meta}\n\n---\n\n(empty)\n`
	}

	const sessionStart = session.startTime ?? 0

	const lines = utterances.map((item) => {
		const addTime = item.add_time ?? 0
		const offset = formatDuration(getOffsetMs(addTime, sessionStart))
		const clock = formatClockTime(addTime)
		const anyItem = item as unknown as {
			speaker?: string | number
			user_id?: string
			text?: string
			result?: string
			content?: string
		}
		const speaker =
			(anyItem.speaker !== undefined && anyItem.speaker !== null
				? String(anyItem.speaker)
				: "") ||
			anyItem.user_id ||
			"speaker"
		const text = anyItem.text || anyItem.result || anyItem.content || ""
		return `- [${offset}] (${clock}) ${speaker}: ${text}`
	})

	return `${DEFAULT_TRANSCRIPT_HEADER} - ${session.id}\n\n${meta}\n\n---\n\n${lines.join("\n")}\n`
}

/**
 * Trigger a browser download for the given blob
 * 触发浏览器下载
 */
function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	document.body.removeChild(anchor)
	URL.revokeObjectURL(url)
}

/**
 * Export a single session as zip (session.json + note.md + transcript.md)
 * 将单个会话导出为 zip
 */
export async function exportSessionAsZip(session: StoredSessionHistory): Promise<void> {
	const JSZip = await loadJSZip()
	const zip = new JSZip()
	const folder = zip.folder(sanitize(session.id)) ?? zip
	folder.file("session.json", JSON.stringify(session, null, 2))
	folder.file("note.md", buildNoteMarkdown(session))
	folder.file("transcript.md", buildTranscriptMarkdown(session))

	const blob = await zip.generateAsync({ type: "blob" })
	triggerDownload(blob, `recording-${sanitize(session.id)}.zip`)
}

/**
 * Export all sessions as one zip file
 * 将多个会话打包导出
 */
export async function exportAllSessionsAsZip(sessions: StoredSessionHistory[]): Promise<void> {
	if (sessions.length === 0) return
	const JSZip = await loadJSZip()
	const zip = new JSZip()

	sessions.forEach((session) => {
		const folder = zip.folder(sanitize(session.id))
		if (!folder) return
		folder.file("session.json", JSON.stringify(session, null, 2))
		folder.file("note.md", buildNoteMarkdown(session))
		folder.file("transcript.md", buildTranscriptMarkdown(session))
	})

	const blob = await zip.generateAsync({ type: "blob" })
	triggerDownload(blob, `recording-history-${Date.now()}.zip`)
}
