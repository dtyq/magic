import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { ImageProcessOptions } from "@/utils/image-processing"
import { packAndDownloadFileEntries } from "../utils"

const mocks = vi.hoisted(() => ({
	getTemporaryDownloadUrl: vi.fn(),
	downloadFileWithAnchor: vi.fn(),
	fetch: vi.fn(),
	zipFiles: [] as string[],
}))

class FakeZip {
	file(fileName: string) {
		mocks.zipFiles.push(fileName)
	}

	async generateAsync(
		_options: { type: string },
		onUpdate?: (metadata: { percent: number }) => void,
	) {
		onUpdate?.({ percent: 50 })
		onUpdate?.({ percent: 100 })
		return new Blob(["zip"])
	}
}

vi.mock("@/infrastructure/vendors/jszip", () => ({
	loadJSZip: vi.fn().mockResolvedValue(FakeZip),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
	getTemporaryDownloadUrl: mocks.getTemporaryDownloadUrl,
}))

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: mocks.downloadFileWithAnchor,
}))

function createFile(fileId: string, fileName: string): FileItem {
	return {
		file_id: fileId,
		file_name: fileName,
		file_extension: fileName.split(".").pop(),
	} as FileItem
}

function createCrop(x: number): ImageProcessOptions {
	return {
		crop: { x, y: 0, w: 100, h: 100 },
		format: "png",
	}
}

describe("packAndDownloadFileEntries", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.zipFiles.length = 0
		vi.stubGlobal("fetch", mocks.fetch)
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:canvas-media")
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
		mocks.getTemporaryDownloadUrl.mockImplementation(
			async ({ file_ids, options }: { file_ids: string[]; options?: unknown }) =>
				file_ids.map((fileId) => ({
					file_id: fileId,
					url: `https://download.test/${fileId}?processed=${Boolean(options)}`,
				})),
		)
		mocks.fetch.mockResolvedValue({
			ok: true,
			statusText: "OK",
			blob: async () => new Blob(["media"]),
		})
	})

	it("keeps duplicate sources as separate element entries with independent crops", async () => {
		const file = createFile("file-1", "source.png")
		const progress: number[] = []
		const leftCrop = createCrop(0)
		const rightCrop = createCrop(120)

		const result = await packAndDownloadFileEntries(
			[
				{ key: "left", file, fileName: "Left crop.png", imageProcess: leftCrop },
				{ key: "right", file, fileName: "Right crop.png", imageProcess: rightCrop },
			],
			undefined,
			"board-media.zip",
			{ onProgress: (value) => progress.push(value) },
		)

		expect(result.successCount).toBe(2)
		expect(mocks.zipFiles).toEqual(["Left crop.png", "Right crop.png"])
		expect(mocks.getTemporaryDownloadUrl).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				file_ids: ["file-1"],
				is_download: true,
				options: { xMagicImageProcess: leftCrop },
			}),
		)
		expect(mocks.getTemporaryDownloadUrl).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				file_ids: ["file-1"],
				is_download: true,
				options: { xMagicImageProcess: rightCrop },
			}),
		)
		expect(mocks.downloadFileWithAnchor).toHaveBeenCalledWith(
			"blob:canvas-media",
			"board-media.zip",
			undefined,
			expect.objectContaining({ onModalClose: expect.any(Function) }),
		)
		expect(URL.revokeObjectURL).not.toHaveBeenCalled()
		const downloadOptions = mocks.downloadFileWithAnchor.mock.calls[0][3]
		downloadOptions.onModalClose()
		expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:canvas-media")
		expect(progress.at(-1)).toBe(100)
	})

	it("retries a failed element once and still downloads the successful subset", async () => {
		mocks.fetch.mockImplementation(async (url: string) => {
			if (url.includes("file-2")) throw new Error("network failure")
			return {
				ok: true,
				statusText: "OK",
				blob: async () => new Blob(["media"]),
			}
		})

		const result = await packAndDownloadFileEntries(
			[
				{ key: "one", file: createFile("file-1", "one.png") },
				{ key: "two", file: createFile("file-2", "two.mp4") },
			],
			undefined,
			"mixed-media.zip",
			{ retryCount: 1 },
		)

		expect(result.successCount).toBe(1)
		expect(result.results).toEqual([
			expect.objectContaining({ success: true, fileName: "one.png" }),
			expect.objectContaining({ success: false, fileName: "two.mp4" }),
		])
		expect(mocks.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		expect(mocks.zipFiles).toEqual(["one.png"])
		expect(mocks.downloadFileWithAnchor).toHaveBeenCalledWith(
			"blob:canvas-media",
			"mixed-media.zip",
			undefined,
			expect.objectContaining({ onModalClose: expect.any(Function) }),
		)
	})
})
