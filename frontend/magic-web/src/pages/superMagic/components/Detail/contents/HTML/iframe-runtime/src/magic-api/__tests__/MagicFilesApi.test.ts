import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicFilesApi } from "../MagicFilesApi"

describe("MagicFilesApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicFilesApi

	beforeEach(() => {
		; (window as any).Magic = undefined
		// mockImplementation prevents jsdom from echoing postMessage back to the same window
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => { })
		api = new MagicFilesApi()
		api.install()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
			; (window as any).Magic = undefined
	})

	function simulateResponse(data: Record<string, unknown>) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: window.parent,
			}),
		)
	}

	function makeFile(content = "data", name = "test.txt", type = "text/plain"): File {
		return new File([content], name, { type })
	}

	// ─── uploadFiles ─────────────────────────────────────────────────────────────

	describe("uploadFiles()", () => {
		it("files 非数组时立即 reject", async () => {
			await expect((window as any).Magic.uploadFiles("not-array")).rejects.toThrow(
				"files must be an array",
			)
			expect(postMessageSpy).not.toHaveBeenCalled()
		})

		it("files 为空数组时立即 reject", async () => {
			await expect((window as any).Magic.uploadFiles([])).rejects.toThrow(
				"files array cannot be empty",
			)
			expect(postMessageSpy).not.toHaveBeenCalled()
		})

		it("files[i].file 不是 File 实例时立即 reject", async () => {
			await expect(
				(window as any).Magic.uploadFiles([
					{ file: "not-a-file", path: "./a.txt", filename: "a.txt" },
				]),
			).rejects.toThrow("must be a File object")
			expect(postMessageSpy).not.toHaveBeenCalled()
		})

		it("files[i].path 不是字符串时立即 reject", async () => {
			await expect(
				(window as any).Magic.uploadFiles([
					{ file: makeFile(), path: 123, filename: "a.txt" },
				]),
			).rejects.toThrow("path must be a string")
		})

		it("files[i].filename 不是字符串时立即 reject", async () => {
			await expect(
				(window as any).Magic.uploadFiles([
					{ file: makeFile(), path: "./a.txt", filename: 123 },
				]),
			).rejects.toThrow("filename must be a string")
		})

		it("合法输入直接发送 File 对象到 MAGIC_UPLOAD_FILES_REQUEST", async () => {
			const file = makeFile("hello content", "hello.txt")
			const promise = (window as any).Magic.uploadFiles([
				{ file, path: "./hello.txt", filename: "hello.txt" },
			])

			// Synchronous — no FileReader needed, postMessage fires immediately
			await new Promise((r) => setTimeout(r, 0))

			expect(postMessageSpy).toHaveBeenCalledOnce()
			const [req, origin] = postMessageSpy.mock.calls[0]
			expect(req.type).toBe("MAGIC_UPLOAD_FILES_REQUEST")
			expect(Array.isArray(req.files)).toBe(true)
			expect(req.files[0].filename).toBe("hello.txt")
			expect(req.files[0].path).toBe("./hello.txt")
			expect(req.files[0].file).toBeInstanceOf(File)
			expect(req.files[0].fileSize).toBe(file.size)
			expect(origin).toBe("*")

			simulateResponse({
				requestId: req.requestId,
				type: "MAGIC_UPLOAD_FILES_RESPONSE",
				success: true,
				results: [{ filename: "hello.txt", success: true }],
			})
			const results = await promise
			expect(results[0].filename).toBe("hello.txt")
		})

		it("upload 响应 success:false 时 reject", async () => {
			const file = makeFile()
			const promise = (window as any).Magic.uploadFiles([
				{ file, path: "./a.txt", filename: "a.txt" },
			])
			await new Promise((r) => setTimeout(r, 0))
			const [req] = postMessageSpy.mock.calls[0]

			simulateResponse({
				requestId: req.requestId,
				type: "MAGIC_UPLOAD_FILES_RESPONSE",
				success: false,
				error: "Upload failed",
			})

			await expect(promise).rejects.toThrow("Upload failed")
		})

		it("install() 幂等：uploadFiles 引用不变", () => {
			const first = (window as any).Magic.uploadFiles
			api.install()
			expect((window as any).Magic.uploadFiles).toBe(first)
		})
	})

	// ─── addFilesToMessage ────────────────────────────────────────────────────────

	describe("addFilesToMessage()", () => {
		it("filePaths 非数组时立即 reject", async () => {
			await expect((window as any).Magic.addFilesToMessage("not-array")).rejects.toThrow(
				"filePaths must be an array",
			)
			expect(postMessageSpy).not.toHaveBeenCalled()
		})

		it("filePaths 为空数组时立即 reject", async () => {
			await expect((window as any).Magic.addFilesToMessage([])).rejects.toThrow(
				"filePaths array cannot be empty",
			)
		})

		it("filePaths[i] 不是字符串时立即 reject", async () => {
			await expect((window as any).Magic.addFilesToMessage([123])).rejects.toThrow(
				"filePaths[0] must be a string",
			)
		})

		it("合法 filePaths 发送 MAGIC_ADD_FILES_TO_MESSAGE_REQUEST", () => {
			; (window as any).Magic.addFilesToMessage(["./output.csv"])
			expect(postMessageSpy).toHaveBeenCalledOnce()
			const [req] = postMessageSpy.mock.calls[0]
			expect(req.type).toBe("MAGIC_ADD_FILES_TO_MESSAGE_REQUEST")
			expect(req.filePaths).toEqual(["./output.csv"])
		})

		it("传入 agentMode 时消息包含 agentMode 字段", () => {
			; (window as any).Magic.addFilesToMessage(["./a.csv"], "super_magic")
			const [req] = postMessageSpy.mock.calls[0]
			expect(req.agentMode).toBe("super_magic")
		})

		it("响应 success:true 时 resolve 结果", async () => {
			const promise = (window as any).Magic.addFilesToMessage(["./a.csv"])
			const [req] = postMessageSpy.mock.calls[0]

			simulateResponse({
				type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
				requestId: req.requestId,
				success: true,
				result: { foundCount: 1, notFoundPaths: [] },
			})

			await expect(promise).resolves.toMatchObject({ foundCount: 1 })
		})

		it("响应 success:false 时 reject", async () => {
			const promise = (window as any).Magic.addFilesToMessage(["./a.csv"])
			const [req] = postMessageSpy.mock.calls[0]

			simulateResponse({
				type: "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE",
				requestId: req.requestId,
				success: false,
				error: "No project selected",
			})

			await expect(promise).rejects.toThrow("No project selected")
		})
	})

	// ─── downloadFiles ────────────────────────────────────────────────────────────

	describe("downloadFiles()", () => {
		it("filePaths 非数组时立即 reject", async () => {
			await expect((window as any).Magic.downloadFiles("not-array")).rejects.toThrow(
				"filePaths must be an array",
			)
			expect(postMessageSpy).not.toHaveBeenCalled()
		})

		it("filePaths 为空数组时立即 reject", async () => {
			await expect((window as any).Magic.downloadFiles([])).rejects.toThrow(
				"filePaths array cannot be empty",
			)
		})

		it("filePaths[i] 不是字符串时立即 reject", async () => {
			await expect((window as any).Magic.downloadFiles([42])).rejects.toThrow(
				"filePaths[0] must be a string",
			)
		})

		it("合法 filePaths 发送 MAGIC_DOWNLOAD_FILES_REQUEST", () => {
			; (window as any).Magic.downloadFiles(["./report.pdf"])
			expect(postMessageSpy).toHaveBeenCalledOnce()
			const [req] = postMessageSpy.mock.calls[0]
			expect(req.type).toBe("MAGIC_DOWNLOAD_FILES_REQUEST")
			expect(req.filePaths).toEqual(["./report.pdf"])
		})

		it("响应 success:true 时 resolve 结果", async () => {
			const promise = (window as any).Magic.downloadFiles(["./report.pdf"])
			const [req] = postMessageSpy.mock.calls[0]

			simulateResponse({
				type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
				requestId: req.requestId,
				success: true,
				result: { successCount: 1, failedCount: 0, notFoundPaths: [], failedResults: [] },
			})

			await expect(promise).resolves.toMatchObject({ successCount: 1, failedCount: 0 })
		})

		it("响应 success:false 时 reject", async () => {
			const promise = (window as any).Magic.downloadFiles(["./missing.pdf"])
			const [req] = postMessageSpy.mock.calls[0]

			simulateResponse({
				type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
				requestId: req.requestId,
				success: false,
				error: "Download failed",
			})

			await expect(promise).rejects.toThrow("Download failed")
		})

		it("忽略 type 不匹配的响应消息", async () => {
			const promise = (window as any).Magic.downloadFiles(["./a.pdf"])
			const [req] = postMessageSpy.mock.calls[0]
			let resolved = false
			promise
				.then(() => {
					resolved = true
				})
				.catch(() => { })

			simulateResponse({
				type: "WRONG_TYPE",
				requestId: req.requestId,
				success: true,
				result: {},
			})

			await Promise.resolve()
			expect(resolved).toBe(false)

			// 清理
			simulateResponse({
				type: "MAGIC_DOWNLOAD_FILES_RESPONSE",
				requestId: req.requestId,
				success: true,
				result: { successCount: 0 },
			})
			await promise
		})
	})
})
