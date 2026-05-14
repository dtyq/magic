import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicFSApi } from "../MagicFSApi"

describe("MagicFSApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicFSApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		// mockImplementation prevents jsdom from echoing postMessage back to the same window
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		api = new MagicFSApi()
		api.install()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
		;(window as any).Magic = undefined
	})

	// ─── 辅助：模拟来自 parent 的响应 ──────────────────────────────────────────
	function simulateResponse(data: Record<string, unknown>) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data,
				source: window.parent,
			}),
		)
	}

	// ─── readFile ───────────────────────────────────────────────────────────────

	it("readFile() 发送 MAGIC_FS_READ_REQUEST 并在响应成功时 resolve 文件内容", async () => {
		const promise = (window as any).Magic.fs.readFile("./config.json")

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_FS_READ_REQUEST")
		expect(req.path).toBe("./config.json")
		expect(typeof req.requestId).toBe("string")

		simulateResponse({
			type: "MAGIC_FS_READ_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: '{"key":"value"}',
		})

		await expect(promise).resolves.toBe('{"key":"value"}')
	})

	it("readFile() 响应 success:false 时 reject 并附带错误信息", async () => {
		const promise = (window as any).Magic.fs.readFile("./missing.txt")
		const [req] = postMessageSpy.mock.calls[0]

		simulateResponse({
			type: "MAGIC_FS_READ_RESPONSE",
			requestId: req.requestId,
			success: false,
			error: "File not found",
		})

		await expect(promise).rejects.toThrow("File not found")
	})

	it("readFile() 传入非字符串路径时立即 reject", async () => {
		await expect((window as any).Magic.fs.readFile(123)).rejects.toThrow(
			"readFile: path must be a string",
		)
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	// ─── writeFile ──────────────────────────────────────────────────────────────

	it("writeFile() 发送 MAGIC_FS_WRITE_REQUEST 并在响应成功时 resolve", async () => {
		const promise = (window as any).Magic.fs.writeFile("./output.txt", "hello")

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_FS_WRITE_REQUEST")
		expect(req.path).toBe("./output.txt")
		expect(req.content).toBe("hello")

		simulateResponse({
			type: "MAGIC_FS_WRITE_RESPONSE",
			requestId: req.requestId,
			success: true,
		})

		// writeFile is void; just verify it resolves without throwing
		await promise
	})

	it("writeFile() 传入非字符串路径时立即 reject", async () => {
		await expect((window as any).Magic.fs.writeFile(null, "content")).rejects.toThrow(
			"writeFile: path must be a string",
		)
	})

	it("writeFile() 传入非字符串内容时立即 reject", async () => {
		await expect((window as any).Magic.fs.writeFile("./file.txt", 42)).rejects.toThrow(
			"writeFile: content must be a string",
		)
	})

	// ─── listFiles ──────────────────────────────────────────────────────────────

	it("listFiles() 发送 MAGIC_FS_LIST_REQUEST 并在响应成功时 resolve 文件列表", async () => {
		const promise = (window as any).Magic.fs.listFiles("./data/")

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_FS_LIST_REQUEST")
		expect(req.dir).toBe("./data/")

		simulateResponse({
			type: "MAGIC_FS_LIST_RESPONSE",
			requestId: req.requestId,
			success: true,
			files: ["./data/a.json", "./data/b.json"],
		})

		await expect(promise).resolves.toEqual(["./data/a.json", "./data/b.json"])
	})

	it("listFiles() 不传目录时使用默认路径 ./", async () => {
		const promise = (window as any).Magic.fs.listFiles()
		const [req] = postMessageSpy.mock.calls[0]
		expect(req.dir).toBe("./")

		simulateResponse({
			type: "MAGIC_FS_LIST_RESPONSE",
			requestId: req.requestId,
			success: true,
			files: [],
		})
		await expect(promise).resolves.toEqual([])
	})

	it("listFiles() 响应中无 files 字段时 resolve 空数组", async () => {
		const promise = (window as any).Magic.fs.listFiles()
		const [req] = postMessageSpy.mock.calls[0]

		simulateResponse({
			type: "MAGIC_FS_LIST_RESPONSE",
			requestId: req.requestId,
			success: true,
		})
		await expect(promise).resolves.toEqual([])
	})

	// ─── watchFile ──────────────────────────────────────────────────────────────

	it("watchFile() 发送 MAGIC_FS_WATCH_REGISTER 并在文件变更时触发回调", () => {
		const cb = vi.fn()
		;(window as any).Magic.fs.watchFile("./data.json", cb)

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_FS_WATCH_REGISTER")
		expect(req.path).toBe("./data.json")

		simulateResponse({
			type: "MAGIC_FS_FILE_CHANGED",
			path: "./data.json",
			timestamp: 12345,
		})

		expect(cb).toHaveBeenCalledOnce()
		expect(cb.mock.calls[0][0]).toEqual({ path: "./data.json", timestamp: 12345 })
	})

	it("watchFile() 只响应匹配路径的 MAGIC_FS_FILE_CHANGED 消息", () => {
		const cb = vi.fn()
		;(window as any).Magic.fs.watchFile("./a.json", cb)

		simulateResponse({
			type: "MAGIC_FS_FILE_CHANGED",
			path: "./b.json", // 不同路径
			timestamp: 12345,
		})

		expect(cb).not.toHaveBeenCalled()
	})

	it("watchFile() 返回的取消函数调用后发送 MAGIC_FS_WATCH_UNREGISTER 并停止回调", () => {
		const cb = vi.fn()
		const unwatch = (window as any).Magic.fs.watchFile("./data.json", cb)
		postMessageSpy.mockClear()

		unwatch()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_FS_WATCH_UNREGISTER")
		expect(req.path).toBe("./data.json")

		simulateResponse({
			type: "MAGIC_FS_FILE_CHANGED",
			path: "./data.json",
			timestamp: 99999,
		})
		expect(cb).not.toHaveBeenCalled()
	})

	it("watchFile() 传入非字符串路径时抛出错误", () => {
		expect(() => {
			;(window as any).Magic.fs.watchFile(123, vi.fn())
		}).toThrow("watchFile: path must be a string")
	})

	it("watchFile() 传入非函数回调时抛出错误", () => {
		expect(() => {
			;(window as any).Magic.fs.watchFile("./data.json", "not-a-function")
		}).toThrow("watchFile: callback must be a function")
	})

	// ─── 超时 ───────────────────────────────────────────────────────────────────

	it("readFile() 在 15s 内无响应时 reject 超时错误", async () => {
		vi.useFakeTimers()
		const promise = (window as any).Magic.fs.readFile("./slow.txt")

		vi.advanceTimersByTime(15001)

		await expect(promise).rejects.toThrow("timed out")
		vi.useRealTimers()
	})

	// ─── install 幂等 ────────────────────────────────────────────────────────────

	it("install() 幂等：多次调用 fs 引用不变", () => {
		const firstFs = (window as any).Magic.fs
		api.install()
		expect((window as any).Magic.fs).toBe(firstFs)
	})
})
