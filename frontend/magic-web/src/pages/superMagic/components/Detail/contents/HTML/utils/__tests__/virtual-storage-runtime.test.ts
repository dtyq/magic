import { IDBFactory, IDBObjectStore } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	createVirtualStorageContext,
	loadVirtualStorageSnapshot,
	resetVirtualStorageForTests,
} from "../virtual-storage"
import {
	createStorageRuntime,
	requestResult,
	transactionDone,
} from "./virtual-storage-runtime-harness"

describe.each(["memory", "indexedDB"])("virtual storage real bridge contracts (%s)", (backend) => {
	let runtime: Awaited<ReturnType<typeof createStorageRuntime>>
	let database: IDBDatabase
	beforeEach(async () => {
		vi.stubGlobal("indexedDB", backend === "memory" ? undefined : new IDBFactory())
		vi.spyOn(console, "log").mockImplementation(() => undefined)
		resetVirtualStorageForTests()
		runtime = await createStorageRuntime("runtime-contract")
		runtime.frame.console.log = () => undefined
		const opening = runtime.frame.indexedDB.open("app", 1)
		opening.onupgradeneeded = () => opening.result.createObjectStore("rows")
		database = await requestResult(opening)
	})
	afterEach(async () => {
		await runtime.flush()
		runtime.close()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		resetVirtualStorageForTests()
	})

	it("commits all requests once, after success handlers enqueue additional work", async () => {
		const transaction = database.transaction("rows", "readwrite")
		const done = transactionDone(transaction)
		const completed = vi.fn()
		transaction.addEventListener("complete", completed)
		const store = transaction.objectStore("rows")
		await new Promise<void>((resolve, reject) => {
			const first = store.put("first", "a")
			first.onerror = () => reject(first.error)
			first.onsuccess = () => {
				const second = store.put("second", "b")
				second.onsuccess = () => resolve()
				second.onerror = () => reject(second.error)
			}
		})
		await done
		expect(completed).toHaveBeenCalledOnce()
		const read = database.transaction("rows")
		const readDone = transactionDone(read)
		expect(await requestResult(read.objectStore("rows").getAll())).toEqual(["first", "second"])
		await readDone
	})

	it("abort before dispatch rejects pending writes without persisting or completing", async () => {
		const transaction = database.transaction("rows", "readwrite")
		const completed = vi.fn()
		transaction.addEventListener("complete", completed)
		const done = transactionDone(transaction).catch((error: DOMException) => error.name)
		const request = requestResult(transaction.objectStore("rows").put("discard", "key")).catch(
			(error: DOMException) => error.name,
		)
		transaction.abort()
		expect(await request).toBe("AbortError")
		expect(await done).toBe("AbortError")
		await runtime.flush()
		expect(completed).not.toHaveBeenCalled()
		expect(
			(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores.rows
				.records,
		).toEqual({})
	})

	it("abort inside request success discards the staged write", async () => {
		const transaction = database.transaction("rows", "readwrite")
		const completed = vi.fn()
		transaction.addEventListener("complete", completed)
		const done = transactionDone(transaction).catch((error: DOMException) => error.name)
		const request = transaction.objectStore("rows").put("discard", "key")
		request.onsuccess = () => transaction.abort()
		expect(await done).toBe("AbortError")
		await runtime.flush()
		expect(completed).not.toHaveBeenCalled()
		expect(
			(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores.rows
				.records,
		).toEqual({})
	})

	it("readonly writes fail synchronously before allocating host work", async () => {
		const transaction = database.transaction("rows", "readonly")
		const done = transactionDone(transaction)
		const store = transaction.objectStore("rows")
		for (const write of [
			() => store.put("bad", "key"),
			() => store.add("bad", "key"),
			() => store.delete("key"),
			() => store.clear(),
		]) {
			try {
				write()
				throw new Error("Expected ReadOnlyError")
			} catch (error) {
				expect((error as DOMException).name).toBe("ReadOnlyError")
			}
		}
		expect(() => store.createIndex("bypass", "field")).toThrow(
			expect.objectContaining({ name: "InvalidStateError" }),
		)
		await done
		expect(
			(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores.rows
				.records,
		).toEqual({})
	})

	it("one failed request aborts all staged writes without partial commits", async () => {
		const transaction = database.transaction("rows", "readwrite")
		const done = transactionDone(transaction).catch(() => "aborted")
		const store = transaction.objectStore("rows")
		const requests = await Promise.allSettled([
			requestResult(store.add("first", "duplicate")),
			requestResult(store.add("second", "duplicate")),
			requestResult(store.put("late message must not restart aborted transaction", "late")),
		])
		expect(requests[0].status).toBe("fulfilled")
		expect(requests[1]).toMatchObject({
			status: "rejected",
			reason: { message: "Key already exists" },
		})
		expect(requests[2]).toMatchObject({ status: "rejected", reason: { name: "AbortError" } })
		expect(await done).toBe("aborted")
		expect(
			(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores.rows
				.records,
		).toEqual({})
	})

	it("concurrent writes conflict explicitly instead of overwriting the committed value", async () => {
		const first = database.transaction("rows", "readwrite")
		const second = database.transaction("rows", "readwrite")
		const firstDone = transactionDone(first)
		const secondDone = transactionDone(second).catch((error: DOMException) => error.name)
		await Promise.all([
			requestResult(first.objectStore("rows").put("winner", "key")),
			requestResult(second.objectStore("rows").put("conflict", "key")),
		])
		await firstDone
		expect(await secondDone).toBe("AbortError")
		const read = database.transaction("rows")
		const done = transactionDone(read)
		expect(await requestResult(read.objectStore("rows").get("key"))).toBe("winner")
		await done
	})

	it("committing one database preserves another database and intervening storage writes", async () => {
		const opening = runtime.frame.indexedDB.open("other", 1)
		opening.onupgradeneeded = () => opening.result.createObjectStore("rows")
		const other = await requestResult(opening)
		const a = database.transaction("rows", "readwrite")
		const b = other.transaction("rows", "readwrite")
		const done = Promise.all([transactionDone(a), transactionDone(b)])
		await Promise.all([
			requestResult(a.objectStore("rows").put("a", "key")),
			requestResult(b.objectStore("rows").put("b", "key")),
		])
		runtime.frame.localStorage.setItem("theme", "dark")
		await done
		await runtime.flush()
		const snapshot = await loadVirtualStorageSnapshot("runtime-contract")
		expect(snapshot.localStorage).toEqual({ theme: "dark" })
		expect(Object.values(snapshot.indexedDB.app.objectStores.rows.records)).toEqual(["a"])
		expect(Object.values(snapshot.indexedDB.other.objectStores.rows.records)).toEqual(["b"])
	})

	it("cookies expire in the document and future snapshots with Max-Age taking precedence", async () => {
		const now = Date.now()
		const hostTime = vi.spyOn(Date, "now").mockReturnValue(now)
		const frameTime = vi.spyOn(runtime.frame.Date, "now").mockReturnValue(now)
		runtime.frame.document.cookie = "short=1; max-age=1"
		runtime.frame.document.cookie =
			"priority=1; max-age=60; expires=Thu, 01 Jan 1970 00:00:00 GMT"
		await runtime.flush()
		hostTime.mockReturnValue(now + 1001)
		frameTime.mockReturnValue(now + 1001)
		// Snapshot loading must expire cookies even if no old document getter ran.
		expect((await loadVirtualStorageSnapshot("runtime-contract")).cookies).toEqual({
			priority: "1",
		})
		expect(runtime.frame.document.cookie).toBe("priority=1")
		await runtime.flush()
	})

	it("resetting a cookie without expiry removes its previous deadline", async () => {
		const now = Date.now()
		const hostTime = vi.spyOn(Date, "now").mockReturnValue(now)
		const frameTime = vi.spyOn(runtime.frame.Date, "now").mockReturnValue(now)
		runtime.frame.document.cookie = "keep=1; max-age=1"
		runtime.frame.document.cookie = "keep=2"
		await runtime.flush()
		hostTime.mockReturnValue(now + 2000)
		frameTime.mockReturnValue(now + 2000)
		expect(runtime.frame.document.cookie).toBe("keep=2")
		expect((await loadVirtualStorageSnapshot("runtime-contract")).cookies).toEqual({
			keep: "2",
		})
	})
	it("cursor continuation keeps its transaction active until the final success", async () => {
		const write = database.transaction("rows", "readwrite")
		const writeDone = transactionDone(write)
		await Promise.all([
			requestResult(write.objectStore("rows").put("a", "a")),
			requestResult(write.objectStore("rows").put("b", "b")),
		])
		await writeDone
		const transaction = database.transaction("rows", "readwrite")
		const done = transactionDone(transaction)
		const store = transaction.objectStore("rows")
		const seen: unknown[] = []
		await new Promise<void>((resolve, reject) => {
			const cursor = store.openCursor()
			cursor.onerror = () => reject(cursor.error)
			cursor.onsuccess = () => {
				if (!cursor.result) {
					resolve()
					return
				}
				seen.push(cursor.result.value)
				store.put("updated", cursor.result.key)
				cursor.result.continue()
			}
		})
		await done
		expect(seen).toEqual(["a", "b"])
		expect(
			Object.values(
				(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores
					.rows.records,
			),
		).toEqual(["updated", "updated"])
		expect(() => store.get("a")).toThrow(
			expect.objectContaining({ name: "TransactionInactiveError" }),
		)
		expect(() => store.index("unused").get("a")).toThrow(
			expect.objectContaining({ name: "TransactionInactiveError" }),
		)
	})

	it("reading an expired cookie in an old frame cannot delete a newer frame's renewed value", async () => {
		const now = Date.now()
		const hostTime = vi.spyOn(Date, "now").mockReturnValue(now)
		const oldTime = vi.spyOn(runtime.frame.Date, "now").mockReturnValue(now)
		runtime.frame.document.cookie = "shared=old; max-age=1"
		await runtime.flush()
		const newer = await createStorageRuntime("runtime-contract")
		try {
			vi.spyOn(newer.frame.Date, "now").mockReturnValue(now)
			newer.frame.document.cookie = "shared=renewed; max-age=60"
			await newer.flush()
			hostTime.mockReturnValue(now + 2000)
			oldTime.mockReturnValue(now + 2000)
			expect(runtime.frame.document.cookie).toBe("")
			await runtime.flush()
			expect((await loadVirtualStorageSnapshot("runtime-contract")).cookies).toEqual({
				shared: "renewed",
			})
		} finally {
			newer.close()
		}
	})
	it.runIf(backend === "indexedDB")(
		"persistence failure aborts without exposing staged data or completing",
		async () => {
			const transaction = database.transaction("rows", "readwrite")
			const completed = vi.fn()
			transaction.addEventListener("complete", completed)
			const done = transactionDone(transaction).catch((error: DOMException) => error.name)
			await requestResult(transaction.objectStore("rows").put("discard", "key"))
			const failPut = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
				throw new DOMException("Quota exceeded", "QuotaExceededError")
			})
			expect(await done).toBe("QuotaExceededError")
			failPut.mockRestore()
			expect(completed).not.toHaveBeenCalled()
			expect(
				(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores
					.rows.records,
			).toEqual({})
			const next = database.transaction("rows", "readwrite")
			const nextDone = transactionDone(next)
			await requestResult(next.objectStore("rows").put("recovered", "key"))
			await nextDone
			expect(
				Object.values(
					(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app
						.objectStores.rows.records,
				),
			).toEqual(["recovered"])
		},
	)
	it.runIf(backend === "indexedDB")(
		"an older read in another host cannot overwrite a completed database transaction",
		async () => {
			vi.resetModules()
			const secondHost = await import("../virtual-storage")
			const second = await createStorageRuntime("runtime-contract", secondHost)
			try {
				let release: (() => void) | undefined
				let captured: (() => void) | undefined
				const capturedRead = new Promise<void>((resolve) => {
					captured = resolve
				})
				const nativeGet = IDBObjectStore.prototype.get
				const interception = vi
					.spyOn(IDBObjectStore.prototype, "get")
					.mockImplementationOnce(function (this: IDBObjectStore, key) {
						const request = nativeGet.call(this, key)
						Object.defineProperty(request, "onsuccess", {
							configurable: true,
							set(listener: ((event: Event) => void) | null) {
								Object.defineProperty(request, "onsuccess", {
									configurable: true,
									value: (event: Event) => {
										release = () => listener?.call(request, event)
										captured?.()
									},
								})
							},
						})
						return request
					})
				second.frame.localStorage.setItem("theme", "dark")
				await capturedRead
				interception.mockRestore()
				const transaction = database.transaction("rows", "readwrite")
				const done = transactionDone(transaction)
				await requestResult(transaction.objectStore("rows").put("committed", "key"))
				await done
				if (!release) throw new Error("Expected captured native read")
				release()
				await second.flush()
				const snapshot = await loadVirtualStorageSnapshot("runtime-contract")
				expect(snapshot.localStorage).toEqual({ theme: "dark" })
				expect(Object.values(snapshot.indexedDB.app.objectStores.rows.records)).toEqual([
					"committed",
				])
			} finally {
				second.close()
				secondHost.resetVirtualStorageForTests()
			}
		},
	)
	it.each(["request", "cursor"])(
		"a throwing %s success property handler aborts without committing",
		async (kind) => {
			const transaction = database.transaction("rows", "readwrite")
			const completed = vi.fn()
			transaction.addEventListener("complete", completed)
			const done = transactionDone(transaction).catch((error: DOMException) => error.name)
			const store = transaction.objectStore("rows")
			const writing = store.put("must-rollback", "key")
			if (kind === "request")
				writing.onsuccess = () => {
					throw new Error("application failure")
				}
			else {
				await requestResult(writing)
				store.openCursor().onsuccess = () => {
					throw new Error("application failure")
				}
			}
			expect(await done).toBe("AbortError")
			await runtime.flush()
			expect(completed).not.toHaveBeenCalled()
			expect(
				(await loadVirtualStorageSnapshot("runtime-contract")).indexedDB.app.objectStores
					.rows.records,
			).toEqual({})
		},
	)
	it("a new document snapshot waits for already accepted writes without an explicit flush", async () => {
		runtime.frame.localStorage.setItem("draft", "first")
		runtime.frame.localStorage.setItem("draft", "latest")
		runtime.frame.sessionStorage.setItem("tab", "saved")
		// The real handler has accepted these operations, but its queued asynchronous
		// persistence has not run yet. Creating the new context must be the barrier.
		const next = await createVirtualStorageContext({ namespace: "runtime-contract" })
		expect(next.snapshot.localStorage).toEqual({ draft: "latest" })
		expect(next.snapshot.sessionStorage).toEqual({ tab: "saved" })
	})
})
