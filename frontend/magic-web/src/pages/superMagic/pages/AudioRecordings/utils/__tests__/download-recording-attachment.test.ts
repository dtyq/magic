import { beforeEach, describe, expect, it, vi } from "vitest"

const getTemporaryDownloadUrlMock = vi.fn()
const downloadFileWithAnchorMock = vi.fn()

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: (...args: unknown[]) => getTemporaryDownloadUrlMock(...args),
}))

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: (...args: unknown[]) => downloadFileWithAnchorMock(...args),
}))

describe("downloadRecordingAttachmentFile", () => {
	beforeEach(() => {
		getTemporaryDownloadUrlMock.mockReset()
		downloadFileWithAnchorMock.mockReset()
	})

	it("downloads the resolved attachment with the provided filename", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([
			{ file_id: "file-alpha", url: "https://example.invalid/export/transcript.md" },
		])

		const { downloadRecordingAttachmentFile } = await import("../download-recording-attachment")
		const result = await downloadRecordingAttachmentFile({
			fileId: "file-alpha",
			fileName: "session-transcript.md",
		})

		expect(result).toBe(true)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-alpha"],
			is_download: true,
			download_mode: "download",
		})
		expect(downloadFileWithAnchorMock).toHaveBeenCalledWith(
			"https://example.invalid/export/transcript.md",
			"session-transcript.md",
		)
	})

	it("returns false when the backend cannot provide a download url", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([{ file_id: "file-alpha", url: "" }])

		const { downloadRecordingAttachmentFile } = await import("../download-recording-attachment")
		const result = await downloadRecordingAttachmentFile({
			fileId: "file-alpha",
			fileName: "session-transcript.md",
		})

		expect(result).toBe(false)
		expect(downloadFileWithAnchorMock).not.toHaveBeenCalled()
	})

	it("returns false when the resolver throws", async () => {
		getTemporaryDownloadUrlMock.mockRejectedValue(new Error("network failed"))

		const { downloadRecordingAttachmentFile } = await import("../download-recording-attachment")
		const result = await downloadRecordingAttachmentFile({
			fileId: "file-alpha",
			fileName: "session-transcript.md",
		})

		expect(result).toBe(false)
		expect(downloadFileWithAnchorMock).not.toHaveBeenCalled()
	})
})
