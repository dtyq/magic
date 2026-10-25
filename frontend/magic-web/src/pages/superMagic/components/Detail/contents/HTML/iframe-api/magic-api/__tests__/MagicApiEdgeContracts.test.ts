import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MagicFSApi } from "../MagicFSApi"
import { MagicDatabaseApi } from "../MagicDatabaseApi"
import { MagicLLMApi } from "../MagicLLMApi"
import { MagicUserApi } from "../MagicUserApi"
import { callMagic, createMagicApiHarness } from "./magic-api-test-helpers"

describe("Magic API uncovered payload and validation contracts", () => {
	let host: ReturnType<typeof createMagicApiHarness>
	beforeEach(() => {
		host = createMagicApiHarness()
		vi.useFakeTimers()
		for (const Plugin of [MagicFSApi, MagicDatabaseApi, MagicLLMApi, MagicUserApi]) {
			new Plugin().install()
		}
	})
	afterEach(() => host.cleanup())

	it("getAppBasePath returns the workspace-relative application root", async () => {
		const pending = callMagic("getAppBasePath")
		expect(host.latestRequest()).toEqual({
			type: "MAGIC_FS_GET_APP_BASE_PATH_REQUEST",
			requestId: expect.any(String),
		})
		host.respond({ content: "apps/finance/" })
		await expect(pending).resolves.toBe("apps/finance/")
	})

	it.each(["blob", "buffer"])(
		"writeFile uses the binary protocol for %s content",
		async (kind) => {
			const content =
				kind === "blob"
					? new Blob(["binary"], { type: "text/plain" })
					: new Uint8Array([1, 2, 3]).buffer
			const pending = callMagic("fs.writeFile", "./file.bin", content)
			const request = host.latestRequest()
			expect(request).toMatchObject({
				type: "MAGIC_FS_WRITE_BLOB_REQUEST",
				path: "./file.bin",
			})
			expect(request.blob).toBeInstanceOf(Blob)
			expect((request.blob as Blob).size).toBe(kind === "blob" ? 6 : 3)
			if (kind === "blob") expect(request.blob).toBe(content)
			expect(request).not.toHaveProperty("content")
			host.respond()
			await pending
		},
	)

	it.each([
		["fs.deleteFile", "MAGIC_FS_DELETE_FILE_REQUEST"],
		["fs.deleteDir", "MAGIC_FS_DELETE_DIR_REQUEST"],
	])("%s sends the requested path", async (method, type) => {
		const pending = callMagic(method, "./target")
		expect(host.latestRequest()).toMatchObject({ type, path: "./target" })
		host.respond()
		await pending
	})

	it.each(["fs.deleteFile", "fs.deleteDir"])(
		"%s rejects a non-string path locally",
		async (method) => {
			await expect(callMagic(method, null)).rejects.toThrow("path must be a string")
			expect(host.postMessage).not.toHaveBeenCalled()
		},
	)

	it("listDir falls back to an empty list for malformed entries", async () => {
		const pending = callMagic("fs.listDir")
		host.respond({ content: { entries: "invalid" } })
		await expect(pending).resolves.toEqual([])
	})

	it.each(["db.getTables", "db.getRelations"])(
		"%s falls back to an empty list for malformed content",
		async (method) => {
			const pending = callMagic(method)
			host.respond({ content: {} })
			await expect(pending).resolves.toEqual([])
		},
	)

	it.each([true, false, "true", 1, undefined])(
		"normalizes project access without treating %j as truthy authorization",
		async (isAdmin) => {
			const pending = callMagic("db.getProjectAdminAccess")
			host.respond({ content: { project_id: 42, is_admin: isAdmin } })
			await expect(pending).resolves.toEqual({ project_id: "42", is_admin: isAdmin === true })
		},
	)

	it.each([
		["db.queryRows", ["", {}], "tableId"],
		["db.getRow", ["", "row"], "tableId"],
		["db.updateRow", ["", "row", {}], "tableId"],
		["db.updateRow", ["table", "", {}], "recordId"],
		["db.deleteRow", ["table", ""], "recordId"],
	] as const)(
		"%s rejects a missing %s before creating a request",
		async (method, args, field) => {
			await expect(callMagic(method, ...args)).rejects.toThrow(
				`${field} must be a non-empty string`,
			)
			expect(host.postMessage).not.toHaveBeenCalled()
			expect(host.pendingListeners()).toHaveLength(0)
			expect(vi.getTimerCount()).toBe(0)
		},
	)

	it("queryRows defaults an omitted query and preserves selected fields on updates", async () => {
		const query = callMagic("db.queryRows", "table")
		expect(host.latestRequest()).toMatchObject({ tableId: "table", query: {} })
		host.respond({ content: { rows: [] } })
		await expect(query).resolves.toEqual({ rows: [] })
		const update = callMagic("db.updateRow", "table", "row", { name: "Bob" }, ["name"])
		expect(host.latestRequest()).toMatchObject({
			tableId: "table",
			recordId: "row",
			data: { name: "Bob" },
			select: ["name"],
		})
		host.respond({ content: { name: "Bob" } })
		await expect(update).resolves.toEqual({ name: "Bob" })
	})

	it("getInfo without options sends no implicit permission scopes", async () => {
		const pending = callMagic("user.getInfo")
		expect(host.latestRequest()).toEqual({
			type: "MAGIC_GET_USER_INFO_REQUEST",
			requestId: expect.any(String),
		})
		host.respond({ userInfo: { name: "Alice", avatar: "avatar.png" } })
		await expect(pending).resolves.toEqual({ name: "Alice", avatar: "avatar.png" })
	})

	it("getModels honors a caller-provided timeout", async () => {
		const pending = callMagic("llm.getModels", { timeout: 20 })
		const rejected = expect(pending).rejects.toThrow("timed out")
		await vi.advanceTimersByTimeAsync(19)
		expect(host.pendingListeners()).toHaveLength(1)
		await vi.advanceTimersByTimeAsync(1)
		await rejected
		expect(host.pendingListeners()).toHaveLength(0)
	})
})
