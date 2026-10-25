import { beforeEach, describe, expect, it, vi } from "vitest"

const getTemporaryDownloadUrlMock = vi.fn()
const downloadFileWithAnchorMock = vi.fn()

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: (...args: unknown[]) => getTemporaryDownloadUrlMock(...args),
}))

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: (...args: unknown[]) => downloadFileWithAnchorMock(...args),
}))

describe("downloadRecordingAudioFile", () => {
	beforeEach(() => {
		getTemporaryDownloadUrlMock.mockReset()
		downloadFileWithAnchorMock.mockReset()
	})

	it("downloads the resolved original audio file with the attachment filename", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([
			{ file_id: "audio-file-001", url: "https://example.invalid/audio/story.wav" },
		])

		const { downloadRecordingAudioFile } = await import("../download-recording-audio")
		const result = await downloadRecordingAudioFile({
			fileId: "audio-file-001",
			audioFile: {
				file_id: "audio-file-001",
				file_name: "fictional-story.wav",
			},
			fallbackName: "fallback-name",
		})

		expect(result).toBe(true)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["audio-file-001"],
			is_download: true,
			download_mode: "download",
			access: undefined,
		})
		expect(downloadFileWithAnchorMock).toHaveBeenCalledWith(
			"https://example.invalid/audio/story.wav",
			"fictional-story.wav",
		)
	})

	it("returns false when file id is missing", async () => {
		const { downloadRecordingAudioFile } = await import("../download-recording-audio")
		const result = await downloadRecordingAudioFile({
			fileId: "",
			fallbackName: "fallback-name",
		})

		expect(result).toBe(false)
		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()
		expect(downloadFileWithAnchorMock).not.toHaveBeenCalled()
	})

	it("returns false when the backend cannot provide a download url", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([{ file_id: "audio-file-001", url: "" }])

		const { downloadRecordingAudioFile } = await import("../download-recording-audio")
		const result = await downloadRecordingAudioFile({
			fileId: "audio-file-001",
			fallbackName: "fallback-name",
		})

		expect(result).toBe(false)
		expect(downloadFileWithAnchorMock).not.toHaveBeenCalled()
	})
})
