import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"
import { downloadFileContent, getFileContentsByIds } from "../api"

vi.mock("@/infrastructure/network/http/runtime", () => ({ defaultMagicClient: { post: vi.fn() } }))

describe("downloadFileContent", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("should forward the abort signal to fetch", async () => {
		const controller = new AbortController()
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: vi.fn().mockResolvedValue("<html></html>"),
		})
		vi.stubGlobal("fetch", fetchMock)

		const result = await downloadFileContent("https://example.com/slide.html", {
			signal: controller.signal,
		})

		expect(result).toBe("<html></html>")
		expect(fetchMock).toHaveBeenCalledWith("https://example.com/slide.html", {
			method: "GET",
			signal: controller.signal,
		})
	})

	it("streams the body and reports progress when asked", async () => {
		const chunks = [new TextEncoder().encode("<html>"), new TextEncoder().encode("</html>")]
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				chunks.forEach((chunk) => controller.enqueue(chunk))
				controller.close()
			},
		})
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				headers: new Headers({ "content-length": "13" }),
				body,
			}),
		)
		const onProgress = vi.fn()

		const result = await downloadFileContent("https://example.com/a.html", { onProgress })

		expect(result).toBe("<html></html>")
		expect(onProgress).toHaveBeenLastCalledWith({ loaded: 13, total: 13 })
	})

	it("hides the total when the length is encoded or unknown", async () => {
		const makeBody = () =>
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("abc"))
					controller.close()
				},
			})
		const onProgress = vi.fn()
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				headers: new Headers({ "content-length": "2", "content-encoding": "gzip" }),
				body: makeBody(),
			}),
		)
		await downloadFileContent("https://example.com/a.html", { onProgress })
		expect(onProgress).toHaveBeenLastCalledWith({ loaded: 3, total: undefined })
	})

	it("gets URLs once and downloads each requested file independently", async () => {
		vi.mocked(magicClient.post).mockResolvedValue([
			{ file_id: "file-a", url: "https://cdn.test/a" },
			{ file_id: "file-b", url: "https://cdn.test/b" },
		] as never)
		const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
			ok: true,
			text: vi.fn().mockResolvedValue(url.endsWith("/a") ? "A" : "B"),
		}))
		vi.stubGlobal("fetch", fetchMock)

		const result = await getFileContentsByIds(["file-a", "file-b"])

		expect(magicClient.post).toHaveBeenCalledTimes(1)
		expect(vi.mocked(magicClient.post).mock.calls[0][1]).toEqual(
			expect.objectContaining({ file_ids: ["file-a", "file-b"] }),
		)
		expect(result.successes.get("file-a")).toBe("A")
		expect(result.successes.get("file-b")).toBe("B")
		expect(result.failures.size).toBe(0)
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	it("keeps missing URL and download failures isolated by file ID", async () => {
		vi.mocked(magicClient.post).mockResolvedValue([
			{ file_id: "file-a", url: "https://cdn.test/a" },
			{ file_id: "file-b", url: "https://cdn.test/b" },
		] as never)
		const fetchMock = vi.fn().mockImplementation(async (url: string) => {
			if (url.endsWith("/a")) throw new Error("download failed")
			return { ok: true, text: vi.fn().mockResolvedValue("B") }
		})
		vi.stubGlobal("fetch", fetchMock)

		const result = await getFileContentsByIds(["file-a", "file-b", "file-c"])

		expect(result.successes.get("file-b")).toBe("B")
		expect(result.failures.get("file-a")?.message).toBe("download failed")
		expect(result.failures.get("file-c")?.message).toBe("无法获取文件下载地址: file-c")
	})

	it("serializes object API errors as JSON", async () => {
		vi.mocked(magicClient.post).mockRejectedValue({
			code: 403,
			message: "forbidden",
		})

		const result = await getFileContentsByIds(["file-a"])

		expect(result.failures.get("file-a")?.message).toBe('{"code":403,"message":"forbidden"}')
	})
})
