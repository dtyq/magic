import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoredAudioChunk, UploadStatus } from "../../MediaRecorderService/AudioChunkDB"
import type { StoredSessionHistory } from "../../RecordingSessionHistoryDB"

const testState = vi.hoisted(() => ({
	chunks: new Map<string, StoredAudioChunk[]>(),
	files: new Map<string, unknown>(),
	getSessionChunks: vi.fn(),
	getChunksByUploadStatus: vi.fn(),
}))

class FakeZip {
	folderName: string

	constructor(folderName = "") {
		this.folderName = folderName
	}

	folder(name: string) {
		return new FakeZip(name)
	}

	file(name: string, content: unknown) {
		const key = this.folderName ? `${this.folderName}/${name}` : name
		testState.files.set(key, content)
	}

	async generateAsync() {
		return new Blob(["zip"], { type: "application/zip" })
	}
}

vi.mock("@/lib/jszip", () => ({
	loadJSZip: vi.fn().mockResolvedValue(FakeZip),
}))

vi.mock("../../MediaRecorderService/AudioChunkDB", () => ({
	AudioChunkDB: vi.fn().mockImplementation(() => ({
		getSessionChunks: testState.getSessionChunks,
		getChunksByUploadStatus: testState.getChunksByUploadStatus,
	})),
}))

const createWavChunk = (
	sessionId: string,
	index: number,
	uploadStatus: UploadStatus,
): StoredAudioChunk => {
	const buffer = new ArrayBuffer(46)
	const view = new DataView(buffer)
	const write = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) {
			view.setUint8(offset + i, value.charCodeAt(i))
		}
	}
	write(0, "RIFF")
	view.setUint32(4, 38, true)
	write(8, "WAVE")
	write(12, "fmt ")
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, 16000, true)
	view.setUint32(28, 32000, true)
	view.setUint16(32, 2, true)
	view.setUint16(34, 16, true)
	write(36, "data")
	view.setUint32(40, 2, true)
	view.setUint16(44, index, true)

	const chunkBlob = {
		type: "audio/wav",
		arrayBuffer: () => Promise.resolve(buffer),
	} as Blob

	return {
		id: `${sessionId}-${index}`,
		sessionId,
		chunk: chunkBlob,
		index,
		timestamp: index,
		size: buffer.byteLength,
		mimeType: "audio/wav",
		uploadStatus,
	}
}

const createSession = (id: string): StoredSessionHistory =>
	({
		id,
		startTime: 1,
		lastActivityTime: 1,
		totalDuration: 1,
		status: "paused",
		textContent: [],
		metadata: {},
		userId: "user-1",
		model: null,
		workspace: null,
		project: null,
		topic: null,
		createdAt: 1,
		updatedAt: 1,
	}) as StoredSessionHistory

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
	if (typeof blob.arrayBuffer === "function") {
		return blob.arrayBuffer()
	}

	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as ArrayBuffer)
		reader.onerror = () => reject(reader.error)
		reader.readAsArrayBuffer(blob)
	})
}

describe("exportSessionHistory", () => {
	beforeEach(() => {
		testState.chunks.clear()
		testState.files.clear()
		testState.getSessionChunks.mockReset()
		testState.getChunksByUploadStatus.mockReset()
		testState.getSessionChunks.mockImplementation((sessionId: string) =>
			Promise.resolve(testState.chunks.get(sessionId) ?? []),
		)
		testState.getChunksByUploadStatus.mockImplementation(
			(sessionId: string, status: UploadStatus) =>
				Promise.resolve(
					(testState.chunks.get(sessionId) ?? []).filter(
						(chunk) => chunk.uploadStatus === status,
					),
				),
		)

		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => "blob:test"),
			revokeObjectURL: vi.fn(),
		})
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
	})

	it("exports merged audio from all local chunks for a single session", async () => {
		const { exportSessionAsZip } = await import("../exportSessionHistory")
		const session = createSession("session-1")
		testState.chunks.set("session-1", [
			createWavChunk("session-1", 0, "uploaded"),
			createWavChunk("session-1", 1, "pending"),
			createWavChunk("session-1", 2, "failed"),
		])

		await exportSessionAsZip(session)

		expect(testState.getSessionChunks).toHaveBeenCalledWith("session-1")
		expect(testState.getChunksByUploadStatus).not.toHaveBeenCalled()
		expect(testState.files.has("session-1/recording.wav")).toBe(true)
	})

	it("merges local chunks by index order when IndexedDB returns them out of order", async () => {
		const { exportSessionAsZip } = await import("../exportSessionHistory")
		const session = createSession("session-1")
		testState.chunks.set("session-1", [
			createWavChunk("session-1", 2, "pending"),
			createWavChunk("session-1", 0, "uploaded"),
			createWavChunk("session-1", 1, "failed"),
		])

		await exportSessionAsZip(session)

		const recording = testState.files.get("session-1/recording.wav")
		expect(recording).toBeInstanceOf(Blob)

		const buffer = await readBlobAsArrayBuffer(recording as Blob)
		const view = new DataView(buffer)
		expect(view.getUint16(44, true)).toBe(0)
		expect(view.getUint16(46, true)).toBe(1)
		expect(view.getUint16(48, true)).toBe(2)
	})

	it("exports merged audio from all local chunks for every session in batch export", async () => {
		const { exportAllSessionsAsZip } = await import("../exportSessionHistory")
		const sessions = [createSession("session-1"), createSession("session-2")]
		testState.chunks.set("session-1", [
			createWavChunk("session-1", 0, "uploaded"),
			createWavChunk("session-1", 1, "pending"),
		])
		testState.chunks.set("session-2", [
			createWavChunk("session-2", 0, "failed"),
			createWavChunk("session-2", 1, "uploaded"),
		])

		await exportAllSessionsAsZip(sessions)

		expect(testState.getSessionChunks).toHaveBeenCalledWith("session-1")
		expect(testState.getSessionChunks).toHaveBeenCalledWith("session-2")
		expect(testState.getChunksByUploadStatus).not.toHaveBeenCalled()
		expect(testState.files.has("session-1/recording.wav")).toBe(true)
		expect(testState.files.has("session-2/recording.wav")).toBe(true)
	})
})
