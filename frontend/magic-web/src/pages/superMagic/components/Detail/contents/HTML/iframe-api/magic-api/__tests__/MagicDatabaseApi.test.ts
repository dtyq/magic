import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MagicDatabaseApi } from "../MagicDatabaseApi"

describe("MagicDatabaseApi", () => {
	let postMessageSpy: ReturnType<typeof vi.spyOn>
	let api: MagicDatabaseApi

	beforeEach(() => {
		;(window as any).Magic = undefined
		postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {})
		api = new MagicDatabaseApi()
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
				origin: window.location.origin,
			}),
		)
	}

	// ─── getTables ──────────────────────────────────────────────────────────────

	it("getTables() 发送 MAGIC_DB_GET_TABLES_REQUEST 并在响应成功时 resolve", async () => {
		const promise = (window as any).Magic.db.getTables()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_GET_TABLES_REQUEST")
		expect(typeof req.requestId).toBe("string")

		simulateResponse({
			type: "MAGIC_DB_GET_TABLES_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: [{ id: "t1", name: "users" }],
		})

		await expect(promise).resolves.toEqual([{ id: "t1", name: "users" }])
	})

	it("getTables() 响应 success:false 时 reject", async () => {
		const promise = (window as any).Magic.db.getTables()
		const [req] = postMessageSpy.mock.calls[0]

		simulateResponse({
			type: "MAGIC_DB_GET_TABLES_RESPONSE",
			requestId: req.requestId,
			success: false,
			error: "Permission denied",
		})

		await expect(promise).rejects.toThrow("Permission denied")
	})

	it("getProjectAdminAccess() resolves the current user's admin result", async () => {
		const promise = (window as any).Magic.db.getProjectAdminAccess()

		expect(postMessageSpy).toHaveBeenCalledOnce()
		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_GET_PROJECT_ADMIN_ACCESS_REQUEST")

		simulateResponse({
			type: "MAGIC_DB_GET_PROJECT_ADMIN_ACCESS_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: { project_id: "project-1", is_admin: true },
		})

		await expect(promise).resolves.toEqual({ project_id: "project-1", is_admin: true })
	})

	// ─── getTable ───────────────────────────────────────────────────────────────

	it("getTable() 发送 MAGIC_DB_GET_TABLE_REQUEST", async () => {
		const promise = (window as any).Magic.db.getTable("table-1")

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_GET_TABLE_REQUEST")
		expect(req.tableId).toBe("table-1")

		simulateResponse({
			type: "MAGIC_DB_GET_TABLE_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: { id: "table-1", fields: [] },
		})

		await expect(promise).resolves.toEqual({ id: "table-1", fields: [] })
	})

	it("getTable() 传入空 tableId 时立即 reject", async () => {
		await expect((window as any).Magic.db.getTable("")).rejects.toThrow(
			"getTable: tableId must be a non-empty string",
		)
		expect(postMessageSpy).not.toHaveBeenCalled()
	})

	// ─── createRow ──────────────────────────────────────────────────────────────

	it("createRow() 发送 MAGIC_DB_CREATE_ROW_REQUEST", async () => {
		const promise = (window as any).Magic.db.createRow("t1", { name: "Alice" })

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_CREATE_ROW_REQUEST")
		expect(req.tableId).toBe("t1")
		expect(req.data).toEqual({ name: "Alice" })

		simulateResponse({
			type: "MAGIC_DB_CREATE_ROW_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: { id: "row-1", name: "Alice" },
		})

		await expect(promise).resolves.toEqual({ id: "row-1", name: "Alice" })
	})

	it("createRow() 传入空 tableId 时立即 reject", async () => {
		await expect((window as any).Magic.db.createRow("", { a: 1 })).rejects.toThrow(
			"createRow: tableId must be a non-empty string",
		)
	})

	it("createRow() 传入非对象 data 时立即 reject", async () => {
		await expect((window as any).Magic.db.createRow("t1", null)).rejects.toThrow(
			"createRow: data must be an object",
		)
	})

	// ─── queryRows ──────────────────────────────────────────────────────────────

	it("queryRows() 发送 MAGIC_DB_QUERY_ROWS_REQUEST", async () => {
		const query = { filter: { name: "Alice" }, page: 1, page_size: 10 }
		const promise = (window as any).Magic.db.queryRows("t1", query)

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_QUERY_ROWS_REQUEST")
		expect(req.tableId).toBe("t1")
		expect(req.query).toEqual(query)

		simulateResponse({
			type: "MAGIC_DB_QUERY_ROWS_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: { rows: [{ id: "r1" }], total: 1 },
		})

		await expect(promise).resolves.toEqual({ rows: [{ id: "r1" }], total: 1 })
	})

	// ─── getRow ─────────────────────────────────────────────────────────────────

	it("getRow() 发送 MAGIC_DB_GET_ROW_REQUEST", async () => {
		const promise = (window as any).Magic.db.getRow("t1", "r1")

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_GET_ROW_REQUEST")
		expect(req.tableId).toBe("t1")
		expect(req.recordId).toBe("r1")

		simulateResponse({
			type: "MAGIC_DB_GET_ROW_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: { id: "r1", name: "Alice" },
		})

		await expect(promise).resolves.toEqual({ id: "r1", name: "Alice" })
	})

	it("getRow() 传入空 recordId 时立即 reject", async () => {
		await expect((window as any).Magic.db.getRow("t1", "")).rejects.toThrow(
			"getRow: recordId must be a non-empty string",
		)
	})

	// ─── updateRow ──────────────────────────────────────────────────────────────

	it("updateRow() 发送 MAGIC_DB_UPDATE_ROW_REQUEST", async () => {
		const promise = (window as any).Magic.db.updateRow("t1", "r1", { name: "Bob" })

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_UPDATE_ROW_REQUEST")
		expect(req.tableId).toBe("t1")
		expect(req.recordId).toBe("r1")
		expect(req.data).toEqual({ name: "Bob" })

		simulateResponse({
			type: "MAGIC_DB_UPDATE_ROW_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: { id: "r1", name: "Bob" },
		})

		await expect(promise).resolves.toEqual({ id: "r1", name: "Bob" })
	})

	it("updateRow() 传入非对象 data 时立即 reject", async () => {
		await expect((window as any).Magic.db.updateRow("t1", "r1", "bad")).rejects.toThrow(
			"updateRow: data must be an object",
		)
	})

	// ─── deleteRow ──────────────────────────────────────────────────────────────

	it("deleteRow() 发送 MAGIC_DB_DELETE_ROW_REQUEST 并 resolve void", async () => {
		const promise = (window as any).Magic.db.deleteRow("t1", "r1")

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_DELETE_ROW_REQUEST")
		expect(req.tableId).toBe("t1")
		expect(req.recordId).toBe("r1")

		simulateResponse({
			type: "MAGIC_DB_DELETE_ROW_RESPONSE",
			requestId: req.requestId,
			success: true,
		})

		await expect(promise).resolves.toBeUndefined()
	})

	it("deleteRow() 传入空 tableId 时立即 reject", async () => {
		await expect((window as any).Magic.db.deleteRow("", "r1")).rejects.toThrow(
			"deleteRow: tableId must be a non-empty string",
		)
	})

	// ─── getRelations ───────────────────────────────────────────────────────────

	it("getRelations() 发送 MAGIC_DB_GET_RELATIONS_REQUEST", async () => {
		const promise = (window as any).Magic.db.getRelations()

		const [req] = postMessageSpy.mock.calls[0]
		expect(req.type).toBe("MAGIC_DB_GET_RELATIONS_REQUEST")

		simulateResponse({
			type: "MAGIC_DB_GET_RELATIONS_RESPONSE",
			requestId: req.requestId,
			success: true,
			content: [{ id: "rel-1" }],
		})

		await expect(promise).resolves.toEqual([{ id: "rel-1" }])
	})

	// ─── install 幂等性 ─────────────────────────────────────────────────────────

	it("install() 多次调用不会覆盖已有 db 命名空间", () => {
		const original = (window as any).Magic.db
		api.install()
		expect((window as any).Magic.db).toBe(original)
	})
})
