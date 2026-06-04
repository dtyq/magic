import { loadJSZip } from "@/lib/jszip"
import type { StoredSessionHistory } from "../RecordingSessionHistoryDB"
import { AudioChunkDB, type StoredAudioChunk } from "../MediaRecorderService/AudioChunkDB"

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
 * Add audio chunks from IndexedDB to a zip folder
 * 从 IndexedDB 读取已上传的音频分片，合并后添加到 zip 目录
 */
async function addAudioChunksToZip(
	folder: InstanceType<Awaited<ReturnType<typeof loadJSZip>>>,
	chunks: StoredAudioChunk[],
): Promise<void> {
	if (!folder || chunks.length === 0) return

	// Sort chunks by index to ensure correct order
	const sorted = [...chunks].sort((a, b) => a.index - b.index)

	// Detect format: prefer explicit mimeType field, fall back to Blob.type
	const detectedMime = detectChunksMimeType(sorted)
	const merged = await mergeAudioChunks(sorted, detectedMime)
	if (merged) {
		const ext = mimeToExtension(detectedMime)
		folder.file(`recording.${ext}`, merged)
	}
}

/** MIME → file extension mapping */
const MIME_EXT_MAP: Record<string, string> = {
	"audio/wav": "wav",
	"audio/webm": "webm",
	"audio/mp4": "mp4",
	"audio/mpeg": "mp3",
	"audio/ogg": "ogg",
	"audio/pcm": "pcm",
}

/**
 * Detect the MIME type of audio chunks.
 * Priority: explicit mimeType field > Blob.type > fallback "audio/wav"
 *
 * 检测分片的 MIME 类型。优先使用显式的 mimeType 字段，其次 Blob.type
 */
function detectChunksMimeType(chunks: StoredAudioChunk[]): string {
	for (const chunk of chunks) {
		// Prefer the explicitly stored mimeType (new field)
		if (chunk.mimeType) {
			return chunk.mimeType.split(";")[0]
		}
		// Fall back to Blob.type (may survive IndexedDB round-trip)
		if (chunk.chunk.type) {
			return chunk.chunk.type.split(";")[0]
		}
	}
	return "audio/wav"
}

/**
 * Get file extension from MIME type
 */
function mimeToExtension(mime: string): string {
	return MIME_EXT_MAP[mime] || "wav"
}

/**
 * Merge audio chunks based on detected format.
 * Dispatches to format-specific merge strategies.
 *
 * 根据格式分发到不同的合并策略
 */
async function mergeAudioChunks(
	chunks: StoredAudioChunk[],
	mimeType: string,
): Promise<Blob | null> {
	if (chunks.length === 0) return null

	switch (mimeType) {
		case "audio/wav":
			return mergeWavChunks(chunks)
		case "audio/webm":
		case "audio/mp4":
		case "audio/ogg":
			// Container formats: simple concatenation works for
			// MediaRecorder-produced chunks (first chunk has init segment)
			return mergeBlobChunks(chunks, mimeType)
		case "audio/pcm":
			// Raw PCM: direct concatenation, no headers
			return mergeBlobChunks(chunks, mimeType)
		default:
			return mergeBlobChunks(chunks, mimeType)
	}
}

/**
 * Simple blob concatenation for container formats (WebM, MP4, OGG) and raw PCM.
 * MediaRecorder splits output into continuation segments that can be concatenated.
 *
 * 简单拼接：适用于容器格式（WebM/MP4/OGG）和原始 PCM
 */
function mergeBlobChunks(chunks: StoredAudioChunk[], mimeType: string): Blob {
	const blobs = chunks.map((c) => c.chunk)
	return new Blob(blobs, { type: mimeType })
}

/**
 * WAV header size in bytes
 */
const WAV_HEADER_SIZE = 44

/**
 * Merge multiple WAV chunks into a single WAV blob.
 * Each chunk is a complete WAV file (44-byte header + PCM data).
 * We extract PCM data from each, concatenate, and write a new header.
 *
 * 将多个 WAV 分片合并为单个 WAV 文件。
 * 每个分片都是完整的 WAV（44 字节头 + PCM 数据），
 * 提取各分片的 PCM 数据拼接后重新写入头部。
 */
async function mergeWavChunks(chunks: StoredAudioChunk[]): Promise<Blob | null> {
	if (chunks.length === 0) return null

	// Read the first chunk to extract WAV parameters from its header
	const firstBuffer = await chunks[0].chunk.arrayBuffer()
	if (firstBuffer.byteLength < WAV_HEADER_SIZE) return null

	const headerView = new DataView(firstBuffer)

	// Validate RIFF/WAVE magic — if not valid, fall back to blob concat
	const riff =
		String.fromCharCode(headerView.getUint8(0)) +
		String.fromCharCode(headerView.getUint8(1)) +
		String.fromCharCode(headerView.getUint8(2)) +
		String.fromCharCode(headerView.getUint8(3))
	const wave =
		String.fromCharCode(headerView.getUint8(8)) +
		String.fromCharCode(headerView.getUint8(9)) +
		String.fromCharCode(headerView.getUint8(10)) +
		String.fromCharCode(headerView.getUint8(11))

	if (riff !== "RIFF" || wave !== "WAVE") {
		return mergeBlobChunks(chunks, "audio/wav")
	}

	// Extract header params from first chunk
	const numChannels = headerView.getUint16(22, true)
	const sampleRate = headerView.getUint32(24, true)
	const bitsPerSample = headerView.getUint16(34, true)

	// Extract PCM data from all chunks (skip 44-byte header each)
	const pcmParts: ArrayBuffer[] = []
	let totalPcmBytes = 0

	for (const chunk of chunks) {
		const buf = chunk === chunks[0] ? firstBuffer : await chunk.chunk.arrayBuffer()
		if (buf.byteLength <= WAV_HEADER_SIZE) continue
		const pcm = buf.slice(WAV_HEADER_SIZE)
		pcmParts.push(pcm)
		totalPcmBytes += pcm.byteLength
	}

	if (totalPcmBytes === 0) return null

	// Build new WAV file
	const bytesPerSample = bitsPerSample / 8
	const blockAlign = numChannels * bytesPerSample
	const byteRate = sampleRate * blockAlign
	const bufferSize = WAV_HEADER_SIZE + totalPcmBytes
	const buffer = new ArrayBuffer(bufferSize)
	const view = new DataView(buffer)

	// Write WAV header
	writeString(view, 0, "RIFF")
	view.setUint32(4, bufferSize - 8, true)
	writeString(view, 8, "WAVE")
	writeString(view, 12, "fmt ")
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true) // PCM
	view.setUint16(22, numChannels, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, byteRate, true)
	view.setUint16(32, blockAlign, true)
	view.setUint16(34, bitsPerSample, true)
	writeString(view, 36, "data")
	view.setUint32(40, totalPcmBytes, true)

	// Copy PCM data
	const dest = new Uint8Array(buffer, WAV_HEADER_SIZE)
	let offset = 0
	for (const pcm of pcmParts) {
		dest.set(new Uint8Array(pcm), offset)
		offset += pcm.byteLength
	}

	return new Blob([buffer], { type: "audio/wav" })
}

/**
 * Write ASCII string to DataView at offset
 */
function writeString(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i))
	}
}

/**
 * Export a single session as zip (session.json + note.md + transcript.md + audio/)
 * 将单个会话导出为 zip
 */
export async function exportSessionAsZip(session: StoredSessionHistory): Promise<void> {
	const JSZip = await loadJSZip()
	const zip = new JSZip()
	const folder = zip.folder(sanitize(session.id)) ?? zip
	folder.file("session.json", JSON.stringify(session, null, 2))
	folder.file("note.md", buildNoteMarkdown(session))
	folder.file("transcript.md", buildTranscriptMarkdown(session))

	const audioChunkDB = new AudioChunkDB()
	const audioChunks = await audioChunkDB.getChunksByUploadStatus(session.id, "uploaded")
	if (audioChunks.length > 0) {
		await addAudioChunksToZip(folder, audioChunks)
	}

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

	const audioChunkDB = new AudioChunkDB()

	for (const session of sessions) {
		const folder = zip.folder(sanitize(session.id))
		if (!folder) continue
		folder.file("session.json", JSON.stringify(session, null, 2))
		folder.file("note.md", buildNoteMarkdown(session))
		folder.file("transcript.md", buildTranscriptMarkdown(session))

		const audioChunks = await audioChunkDB.getChunksByUploadStatus(session.id, "uploaded")
		if (audioChunks.length > 0) {
			await addAudioChunksToZip(folder, audioChunks)
		}
	}

	const blob = await zip.generateAsync({ type: "blob" })
	triggerDownload(blob, `recording-history-${Date.now()}.zip`)
}
