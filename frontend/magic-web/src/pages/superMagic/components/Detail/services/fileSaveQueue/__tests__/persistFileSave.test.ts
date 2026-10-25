import { beforeEach, describe, expect, it, vi } from "vitest"
import { shadowV2 } from "@/utils/shadow"
import { persistFileSave } from "../persistFileSave"
import { FileSaveConflictError, FileSaveRetryableError } from "../types"
import { isRetryableSaveError } from "../FileSaveQueue"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getFileInfo: vi.fn(),
		replaceFile: vi.fn(),
		saveFileContent: vi.fn(),
	},
}))

vi.mock("@/stores/folderUpload/uploadService", () => ({
	ossUploadService: {
		uploadContentByFileKey: vi.fn(),
	},
}))

import { SuperMagicApi } from "@/apis"
import { ossUploadService } from "@/stores/folderUpload/uploadService"

describe("persistFileSave", () => {
	beforeEach(() => vi.clearAllMocks())

	it("开启解码时无前缀正文仍原样上传", async () => {
		vi.mocked(ossUploadService.uploadContentByFileKey).mockResolvedValue("mock-key")
		vi.mocked(SuperMagicApi.replaceFile).mockResolvedValue({} as never)
		await persistFileSave(
			{ fileId: "mock-file", content: "저 raw text", enableShadow: true },
			{ getFileMeta: () => ({ fileKey: "mock-key", projectId: "mock-project" }) },
		)
		expect(vi.mocked(ossUploadService.uploadContentByFileKey).mock.calls[0]?.[0]).toBe(
			"저 raw text",
		)
	})

	it("V2 在 OSS 分支上传原文，在 API 分支保持编码与标记一致", async () => {
		const plain = "<p>저\u1000\ufeff</p>"
		const encoded = shadowV2(plain)
		vi.mocked(ossUploadService.uploadContentByFileKey).mockResolvedValue("mock-key")
		vi.mocked(SuperMagicApi.replaceFile).mockResolvedValue({} as never)
		const request = { fileId: "mock-file", content: encoded, enableShadow: true }
		await persistFileSave(request, {
			getFileMeta: () => ({ fileKey: "mock-key", projectId: "mock-project" }),
		})
		expect(ossUploadService.uploadContentByFileKey).toHaveBeenCalledWith(
			plain,
			"mock-key",
			"mock-project",
			"content.html",
			undefined,
		)
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue({
			success_files: [{ data: {} }],
		} as never)
		await persistFileSave(request, { getFileMeta: () => ({}) })
		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledWith([
			{ file_id: "mock-file", content: encoded, enable_shadow: true },
		])
	})

	it("明文保留编码前缀，损坏 V2 不触发上传或替换", async () => {
		vi.mocked(ossUploadService.uploadContentByFileKey).mockResolvedValue("mock-key")
		vi.mocked(SuperMagicApi.replaceFile).mockResolvedValue({} as never)
		const context = { getFileMeta: () => ({ fileKey: "mock-key", projectId: "mock-project" }) }
		await persistFileSave(
			{ fileId: "mock-file", content: "SHADOWED2_!", enableShadow: false },
			context,
		)
		expect(vi.mocked(ossUploadService.uploadContentByFileKey).mock.calls[0]?.[0]).toBe(
			"SHADOWED2_!",
		)
		vi.clearAllMocks()
		await expect(
			persistFileSave(
				{ fileId: "mock-file", content: "SHADOWED2_!", enableShadow: true },
				context,
			),
		).rejects.toThrow("Invalid shadow payload")
		expect(ossUploadService.uploadContentByFileKey).not.toHaveBeenCalled()
		expect(SuperMagicApi.replaceFile).not.toHaveBeenCalled()
		expect(SuperMagicApi.saveFileContent).not.toHaveBeenCalled()
	})

	it("rejects when the remote version moved past the baseline", async () => {
		vi.mocked(SuperMagicApi.getFileInfo).mockResolvedValue({ version: 4 } as never)
		await expect(
			persistFileSave(
				{
					fileId: "file-1",
					content: "<p>Local</p>",
					enableShadow: false,
					baselineVersion: "3",
				},
				{
					getFileMeta: () => ({ fileKey: "k", projectId: "p" }),
				},
			),
		).rejects.toBeInstanceOf(FileSaveConflictError)
		expect(ossUploadService.uploadContentByFileKey).not.toHaveBeenCalled()
	})

	it("uploads by file key then replaces the file", async () => {
		vi.mocked(SuperMagicApi.getFileInfo).mockResolvedValue({ version: 3 } as never)
		vi.mocked(ossUploadService.uploadContentByFileKey).mockResolvedValue("new-key")
		vi.mocked(SuperMagicApi.replaceFile).mockResolvedValue({} as never)
		await persistFileSave(
			{
				fileId: "file-1",
				content: "<p>Local</p>",
				enableShadow: false,
				baselineVersion: "3",
			},
			{
				getFileMeta: () => ({
					fileKey: "old-key",
					projectId: "project-1",
					fileName: "slide.html",
				}),
			},
		)
		expect(ossUploadService.uploadContentByFileKey).toHaveBeenCalledWith(
			"<p>Local</p>",
			"old-key",
			"project-1",
			"slide.html",
			undefined,
		)
		expect(SuperMagicApi.replaceFile).toHaveBeenCalledWith({
			id: "file-1",
			file_key: "new-key",
		})
	})

	it("treats empty saveFileContent results as retryable", async () => {
		vi.mocked(SuperMagicApi.getFileInfo).mockResolvedValue({ version: 1 } as never)
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue({ success_files: [] } as never)
		const error = await persistFileSave(
			{
				fileId: "file-1",
				content: "<p>Local</p>",
				enableShadow: false,
			},
			{
				getFileMeta: () => ({}),
			},
		).catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(FileSaveRetryableError)
		expect(isRetryableSaveError(error)).toBe(true)
	})

	it("reports the version returned by saveFileContent", async () => {
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue({
			success_files: [{ file_id: "file-1", data: { version: 5 } }],
		} as never)
		await expect(
			persistFileSave(
				{ fileId: "file-1", content: "<p>Local</p>", enableShadow: false },
				{ getFileMeta: () => ({}) },
			),
		).resolves.toEqual({ version: "5" })
	})

	it("reads the new remote version after replacing a file", async () => {
		vi.mocked(SuperMagicApi.getFileInfo)
			.mockResolvedValueOnce({ version: 3 } as never)
			.mockResolvedValueOnce({ version: 4 } as never)
		vi.mocked(ossUploadService.uploadContentByFileKey).mockResolvedValue("new-key")
		vi.mocked(SuperMagicApi.replaceFile).mockResolvedValue({} as never)
		await expect(
			persistFileSave(
				{
					fileId: "file-1",
					content: "<p>Local</p>",
					enableShadow: false,
					baselineVersion: "3",
				},
				{ getFileMeta: () => ({ fileKey: "k", projectId: "p" }) },
			),
		).resolves.toEqual({ version: "4" })
	})
})
