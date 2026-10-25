import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("virtual HTML storage host", () => {
	beforeEach(async () => {
		const { resetVirtualStorageForTests } = await import("../virtual-storage")
		resetVirtualStorageForTests()
		vi.spyOn(console, "log").mockImplementation(() => undefined)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("persists accepted localStorage operations by namespace", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			buildHtmlVirtualStorageNamespace,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "project-1",
			fileId: "file-1",
		})
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const handler = createVirtualStorageMessageHandler()

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
					renderId: context.renderId,
					token: context.token,
					namespace,
					area: "localStorage",
					seq: 1,
					op: "setItem",
					payload: { key: "theme", value: "dark" },
				},
			}),
		)

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.localStorage).toEqual({ theme: "dark" })
	})

	it("serializes storage operations per namespace to avoid stale snapshot overwrites", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:storage-queue"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const handler = createVirtualStorageMessageHandler()

		await Promise.all([
			handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
						renderId: context.renderId,
						token: context.token,
						namespace,
						area: "localStorage",
						seq: 1,
						op: "setItem",
						payload: { key: "user-key", value: "kept" },
					},
				}),
			),
			handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
						renderId: context.renderId,
						token: context.token,
						namespace,
						area: "localStorage",
						seq: 2,
						op: "removeItem",
						payload: { key: "__probe__" },
					},
				}),
			),
		])

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.localStorage).toEqual({ "user-key": "kept" })
	})

	it("rejects storage operations with the wrong token", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:file-2"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const handler = createVirtualStorageMessageHandler()

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
					renderId: context.renderId,
					token: "wrong-token",
					namespace,
					area: "localStorage",
					seq: 1,
					op: "setItem",
					payload: { key: "theme", value: "dark" },
				},
			}),
		)

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.localStorage).toEqual({})
	})

	it("logs registry lifecycle and context-not-found token tails", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:registry-token-tail"
		const context = await createVirtualStorageContext({
			namespace,
			source: window,
			token: "token-tail-12345678",
		})
		const logSpy = vi.mocked(console.log)

		virtualStorageRegistry.register(context)
		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageRegistry] register",
			expect.objectContaining({
				contextCount: 1,
				namespace,
				renderId: context.renderId,
				sourcePresent: true,
				tokenTail: "12345678",
			}),
		)

		const handler = createVirtualStorageMessageHandler()
		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
					renderId: context.renderId,
					token: "wrong-token-87654321",
					namespace,
					area: "localStorage",
					seq: 1,
					op: "setItem",
					payload: { key: "theme", value: "dark" },
				},
			}),
		)

		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageRegistry] context-not-found",
			expect.objectContaining({
				contextCount: 1,
				namespace,
				renderId: context.renderId,
				sameNamespaceContexts: [
					expect.objectContaining({
						namespace,
						renderId: context.renderId,
						tokenTail: "12345678",
					}),
				],
				tokenTail: "87654321",
			}),
		)
		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageHost] rejected",
			expect.objectContaining({
				namespace,
				reason: "context-not-found",
				tokenTail: "87654321",
			}),
		)

		virtualStorageRegistry.unregister(context)
		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageRegistry] unregister",
			expect.objectContaining({
				contextCount: 0,
				namespace,
				removed: true,
				renderId: context.renderId,
				tokenTail: "12345678",
			}),
		)
	})

	it("rejects storage operations from the wrong origin", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			getVirtualStorageDebugEvents,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:origin-reject"
		const context = await createVirtualStorageContext({
			namespace,
			source: window,
			origin: window.location.origin,
		})
		virtualStorageRegistry.register(context)
		const handler = createVirtualStorageMessageHandler()

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: "https://attacker.example.com",
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
					renderId: context.renderId,
					token: context.token,
					namespace,
					area: "localStorage",
					seq: 1,
					op: "setItem",
					payload: { key: "theme", value: "dark" },
				},
			}),
		)

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.localStorage).toEqual({})
		expect(getVirtualStorageDebugEvents().at(-1)).toEqual(
			expect.objectContaining({
				namespace,
				reason: "origin-mismatch",
				status: "rejected",
			}),
		)
	})

	it("logs parent rejection reason and persistence location", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:console-log"
		const context = await createVirtualStorageContext({
			namespace,
			source: window,
			origin: window.location.origin,
		})
		virtualStorageRegistry.register(context)
		const handler = createVirtualStorageMessageHandler()
		const logSpy = vi.mocked(console.log)

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: "https://wrong.example.com",
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
					renderId: context.renderId,
					token: context.token,
					namespace,
					area: "localStorage",
					seq: 1,
					op: "setItem",
					payload: { key: "theme", value: "dark" },
				},
			}),
		)

		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageHost] rejected",
			expect.objectContaining({
				namespace,
				reason: "origin-mismatch",
				renderId: context.renderId,
			}),
		)

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.OP,
					renderId: context.renderId,
					token: context.token,
					namespace,
					area: "localStorage",
					seq: 2,
					op: "setItem",
					payload: { key: "theme", value: "dark" },
				},
			}),
		)

		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageHost] persisted",
			expect.objectContaining({
				dbName: "MagicHtmlVirtualStorage",
				namespace,
				storeName: "namespaces",
			}),
		)
		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageHost] accepted",
			expect.objectContaining({
				area: "localStorage",
				key: "theme",
				namespace,
				op: "setItem",
				seq: 2,
			}),
		)
	})

	it("handles IndexedDB put/get requests through the parent store", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
		const handler = createVirtualStorageMessageHandler()

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
					renderId: context.renderId,
					token: context.token,
					namespace,
					requestId: "store-1",
					action: "createObjectStore",
					payload: {
						dbName: "app-db",
						storeName: "items",
						options: { keyPath: "id" },
					},
				},
			}),
		)
		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
					renderId: context.renderId,
					token: context.token,
					namespace,
					requestId: "put-1",
					action: "put",
					payload: {
						dbName: "app-db",
						storeName: "items",
						key: "item-1",
						value: { id: "item-1", name: "Preview" },
					},
				},
			}),
		)

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
					renderId: context.renderId,
					token: context.token,
					namespace,
					requestId: "get-1",
					action: "get",
					payload: {
						dbName: "app-db",
						storeName: "items",
						key: "item-1",
					},
				},
			}),
		)

		expect(postMessageSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_RESPONSE,
				requestId: "get-1",
				success: true,
				result: { id: "item-1", name: "Preview" },
			}),
			window.location.origin,
		)

		postMessageSpy.mockRestore()
	})

	it("serializes IndexedDB writes per namespace to avoid stale snapshot overwrites", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb-queue"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const handler = createVirtualStorageMessageHandler()

		await handler(
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
					renderId: context.renderId,
					token: context.token,
					namespace,
					requestId: "store-1",
					action: "createObjectStore",
					payload: {
						dbName: "app-db",
						storeName: "items",
						options: { keyPath: "id" },
					},
				},
			}),
		)
		const createIdbEvent = (requestId: string, key: string, value: Record<string, unknown>) =>
			new MessageEvent("message", {
				source: window,
				origin: window.location.origin,
				data: {
					protocol: context.protocol,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
					renderId: context.renderId,
					token: context.token,
					namespace,
					requestId,
					action: "put",
					payload: {
						dbName: "app-db",
						storeName: "items",
						key,
						value,
					},
				},
			})

		await Promise.all([
			handler(createIdbEvent("put-1", "item-1", { id: "item-1", name: "First" })),
			handler(createIdbEvent("put-2", "item-2", { id: "item-2", name: "Second" })),
		])

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.indexedDB["app-db"].objectStores.items.records).toEqual({
			"item-1": { id: "item-1", name: "First" },
			"item-2": { id: "item-2", name: "Second" },
		})
	})

	it("rejects IndexedDB operations against missing object stores", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb-missing-store"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
		const logSpy = vi.mocked(console.log)
		const handler = createVirtualStorageMessageHandler()

		const sendIdb = async (
			requestId: string,
			action: string,
			payload: Record<string, unknown>,
		) => {
			await handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
						renderId: context.renderId,
						token: context.token,
						namespace,
						requestId,
						action,
						payload,
					},
				}),
			)
			return postMessageSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
		}

		await sendIdb("open", "open", { dbName: "schema-db", version: 1 })
		expect(
			await sendIdb("add", "add", {
				dbName: "schema-db",
				storeName: "records",
				value: { name: "Lost" },
			}),
		).toEqual(
			expect.objectContaining({
				error: expect.stringContaining("NotFoundError"),
				success: false,
			}),
		)
		expect(logSpy).toHaveBeenCalledWith(
			"[VirtualStorageHost] error",
			expect.objectContaining({
				action: "add",
				dbName: "schema-db",
				namespace,
				reason: expect.stringContaining("NotFoundError"),
				requestId: "add",
				storeName: "records",
			}),
		)
		for (const [requestId, action] of [
			["get-all", "getAll"],
			["count", "count"],
		] as const) {
			expect(
				await sendIdb(requestId, action, {
					dbName: "schema-db",
					storeName: "records",
					value: { name: "Lost" },
				}),
			).toEqual(
				expect.objectContaining({
					error: expect.stringContaining("NotFoundError"),
					success: false,
				}),
			)
		}

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.indexedDB["schema-db"].objectStores.records).toBeUndefined()
		postMessageSpy.mockRestore()
	})

	it("allows same-version upgrade repair for existing empty IndexedDB schemas", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb-empty-schema-repair"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
		const handler = createVirtualStorageMessageHandler()

		const sendIdb = async (
			requestId: string,
			action: string,
			payload: Record<string, unknown>,
		) => {
			await handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
						renderId: context.renderId,
						token: context.token,
						namespace,
						requestId,
						action,
						payload,
					},
				}),
			)
			return postMessageSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
		}

		await sendIdb("open-1", "open", { dbName: "storage-api-lab", version: 1 })
		expect(
			await sendIdb("repair-open", "open", {
				dbName: "storage-api-lab",
				version: 1,
			}),
		).toEqual(
			expect.objectContaining({
				result: expect.objectContaining({
					oldVersion: 1,
					upgraded: true,
				}),
				success: true,
			}),
		)
		await sendIdb("store", "createObjectStore", {
			dbName: "storage-api-lab",
			storeName: "records",
			options: { autoIncrement: true, keyPath: "id" },
			version: 1,
		})
		expect(
			await sendIdb("add", "add", {
				dbName: "storage-api-lab",
				storeName: "records",
				value: { name: "Recovered" },
			}),
		).toEqual(expect.objectContaining({ result: 1, success: true }))

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(
			nextContext.snapshot.indexedDB["storage-api-lab"].objectStores.records.records,
		).toEqual({
			"1": { id: 1, name: "Recovered" },
		})
		postMessageSpy.mockRestore()
	})

	it("repairs partial same-version IndexedDB schemas left by older virtual stores", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb-partial-schema-repair"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
		const handler = createVirtualStorageMessageHandler()

		const sendIdb = async (
			requestId: string,
			action: string,
			payload: Record<string, unknown>,
		) => {
			await handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
						renderId: context.renderId,
						token: context.token,
						namespace,
						requestId,
						action,
						payload,
					},
				}),
			)
			return postMessageSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
		}

		await sendIdb("open-1", "open", { dbName: "storage-api-lab", version: 1 })
		await sendIdb("legacy-records", "createObjectStore", {
			dbName: "storage-api-lab",
			storeName: "records",
			options: {},
			version: 1,
		})
		await sendIdb("legacy-index", "createIndex", {
			dbName: "storage-api-lab",
			storeName: "records",
			indexName: "by_title",
			keyPath: "title",
		})
		expect(
			await sendIdb("missing-kv", "getAll", {
				dbName: "storage-api-lab",
				storeName: "kv",
			}),
		).toEqual(expect.objectContaining({ success: false }))
		expect(
			await sendIdb("missing-files", "getAll", {
				dbName: "storage-api-lab",
				storeName: "files",
			}),
		).toEqual(expect.objectContaining({ success: false }))

		expect(
			await sendIdb("repair-open", "open", {
				dbName: "storage-api-lab",
				version: 1,
			}),
		).toEqual(
			expect.objectContaining({
				result: expect.objectContaining({
					objectStores: [],
					oldVersion: 1,
					upgraded: true,
				}),
				success: true,
			}),
		)

		await sendIdb("records-store", "createObjectStore", {
			dbName: "storage-api-lab",
			storeName: "records",
			options: { autoIncrement: true, keyPath: "id" },
			version: 1,
		})
		await sendIdb("kv-store", "createObjectStore", {
			dbName: "storage-api-lab",
			storeName: "kv",
			options: { keyPath: "key" },
			version: 1,
		})
		await sendIdb("files-store", "createObjectStore", {
			dbName: "storage-api-lab",
			storeName: "files",
			options: { autoIncrement: true, keyPath: "id" },
			version: 1,
		})

		expect(
			await sendIdb("kv-get-all", "getAll", {
				dbName: "storage-api-lab",
				storeName: "kv",
			}),
		).toEqual(expect.objectContaining({ result: [], success: true }))
		expect(
			await sendIdb("files-get-all", "getAll", {
				dbName: "storage-api-lab",
				storeName: "files",
			}),
		).toEqual(expect.objectContaining({ result: [], success: true }))
		expect(
			await sendIdb("record-add", "add", {
				dbName: "storage-api-lab",
				storeName: "records",
				value: { title: "Recovered" },
			}),
		).toEqual(expect.objectContaining({ result: 1, success: true }))

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(
			nextContext.snapshot.indexedDB["storage-api-lab"].objectStores.records.records,
		).toEqual({
			"1": { id: 1, title: "Recovered" },
		})
		postMessageSpy.mockRestore()
	})

	it("writes generated autoIncrement keys back to keyPath values", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb-auto-increment"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
		const handler = createVirtualStorageMessageHandler()

		const sendIdb = async (
			requestId: string,
			action: string,
			payload: Record<string, unknown>,
		) => {
			await handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
						renderId: context.renderId,
						token: context.token,
						namespace,
						requestId,
						action,
						payload,
					},
				}),
			)
			return postMessageSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
		}

		await sendIdb("store", "createObjectStore", {
			dbName: "lab-db",
			storeName: "records",
			options: { autoIncrement: true, keyPath: "id" },
		})

		expect(
			await sendIdb("add", "add", {
				dbName: "lab-db",
				storeName: "records",
				value: { name: "Auto" },
			}),
		).toEqual(expect.objectContaining({ result: 1, success: true }))

		const nextContext = await createVirtualStorageContext({ namespace, source: window })
		expect(nextContext.snapshot.indexedDB["lab-db"].objectStores.records.records).toEqual({
			"1": { id: 1, name: "Auto" },
		})
		postMessageSpy.mockRestore()
	})

	it("handles IndexedDB createIndex, index getAll, count, and cursor requests", async () => {
		const {
			VIRTUAL_STORAGE_MESSAGE_TYPES,
			createVirtualStorageContext,
			createVirtualStorageMessageHandler,
			virtualStorageRegistry,
		} = await import("../virtual-storage")

		const namespace = "magic-html:test:idb-indexes"
		const context = await createVirtualStorageContext({ namespace, source: window })
		virtualStorageRegistry.register(context)
		const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
		const handler = createVirtualStorageMessageHandler()

		const sendIdb = async (
			requestId: string,
			action: string,
			payload: Record<string, unknown>,
		) => {
			await handler(
				new MessageEvent("message", {
					source: window,
					origin: window.location.origin,
					data: {
						protocol: context.protocol,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST,
						renderId: context.renderId,
						token: context.token,
						namespace,
						requestId,
						action,
						payload,
					},
				}),
			)
			return postMessageSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>
		}

		await sendIdb("store", "createObjectStore", {
			dbName: "lab-db",
			storeName: "items",
			options: { keyPath: "id" },
		})
		await sendIdb("index", "createIndex", {
			dbName: "lab-db",
			storeName: "items",
			indexName: "byType",
			keyPath: "type",
		})
		await sendIdb("put-1", "put", {
			dbName: "lab-db",
			storeName: "items",
			value: { id: "1", type: "fruit", name: "Apple" },
		})
		await sendIdb("put-2", "put", {
			dbName: "lab-db",
			storeName: "items",
			value: { id: "2", type: "fruit", name: "Pear" },
		})
		await sendIdb("put-3", "put", {
			dbName: "lab-db",
			storeName: "items",
			value: { id: "3", type: "tool", name: "Hammer" },
		})

		expect(
			await sendIdb("count", "count", {
				dbName: "lab-db",
				storeName: "items",
				indexName: "byType",
				query: { type: "only", value: "fruit" },
			}),
		).toEqual(expect.objectContaining({ success: true, result: 2 }))
		expect(
			await sendIdb("index-get-all", "indexGetAll", {
				dbName: "lab-db",
				storeName: "items",
				indexName: "byType",
				query: { type: "only", value: "fruit" },
			}),
		).toEqual(
			expect.objectContaining({
				success: true,
				result: [
					{ id: "1", type: "fruit", name: "Apple" },
					{ id: "2", type: "fruit", name: "Pear" },
				],
			}),
		)
		expect(
			await sendIdb("cursor", "openCursor", {
				dbName: "lab-db",
				storeName: "items",
				indexName: "byType",
				query: { type: "only", value: "fruit" },
			}),
		).toEqual(
			expect.objectContaining({
				success: true,
				result: [
					{
						key: "fruit",
						primaryKey: "1",
						value: { id: "1", type: "fruit", name: "Apple" },
					},
					{
						key: "fruit",
						primaryKey: "2",
						value: { id: "2", type: "fruit", name: "Pear" },
					},
				],
			}),
		)

		postMessageSpy.mockRestore()
	})

	it("injects IndexedDB upgrade transaction schema ordering", async () => {
		const { createVirtualStorageContext, getVirtualStorageBridgeScript } =
			await import("../virtual-storage")

		const context = await createVirtualStorageContext({
			namespace: "magic-html:test:idb-upgrade-order",
			targetOrigin: "https://parent.example.com",
		})
		const bridgeScript = getVirtualStorageBridgeScript(context)

		expect(bridgeScript).toContain("createUpgradeTransaction")
		expect(bridgeScript).toContain("trackUpgradeSchemaPromise")
		expect(bridgeScript).toContain("waitForUpgradeTransaction")
		expect(bridgeScript).toContain("request.transaction = upgradeTransaction")
		expect(bridgeScript).toContain("return waitForUpgradeTransaction(upgradeTransaction)")
	})

	it("injects parent origin validation for IndexedDB responses", async () => {
		const { createVirtualStorageContext, getVirtualStorageBridgeScript } =
			await import("../virtual-storage")

		const context = await createVirtualStorageContext({
			namespace: "magic-html:test:origin",
			targetOrigin: "https://parent.example.com",
		})

		expect(getVirtualStorageBridgeScript(context)).toContain(
			'context.targetOrigin !== "*" && event.origin !== context.targetOrigin',
		)
	})

	it("injects cookie deletion persistence for expired cookies", async () => {
		const { createVirtualStorageContext, getVirtualStorageBridgeScript } =
			await import("../virtual-storage")

		const context = await createVirtualStorageContext({
			namespace: "magic-html:test:cookie-delete",
			targetOrigin: "https://parent.example.com",
		})
		const bridgeScript = getVirtualStorageBridgeScript(context)

		expect(bridgeScript).toContain('optionName === "max-age"')
		expect(bridgeScript).toContain('postStorageOp("cookies", "removeCookie"')
	})

	it("injects IndexedDB request target and transaction completion semantics", async () => {
		const { createVirtualStorageContext, getVirtualStorageBridgeScript } =
			await import("../virtual-storage")

		const context = await createVirtualStorageContext({
			namespace: "magic-html:test:idb-events",
			targetOrigin: "https://parent.example.com",
		})
		const bridgeScript = getVirtualStorageBridgeScript(context)

		expect(bridgeScript).toContain('Object.defineProperty(event, "target"')
		expect(bridgeScript).toContain('dispatchEventLike(transaction, "oncomplete", "complete")')
	})

	it("injects bridge debug visibility and common IndexedDB API shims", async () => {
		const { createVirtualStorageContext, getVirtualStorageBridgeScript } =
			await import("../virtual-storage")

		const context = await createVirtualStorageContext({
			namespace: "magic-html:test:debug",
			targetOrigin: "https://parent.example.com",
		})
		const bridgeScript = getVirtualStorageBridgeScript(context)

		expect(bridgeScript).toContain("__MAGIC_HTML_VIRTUAL_STORAGE__")
		expect(bridgeScript).toContain("VirtualStorageBridge")
		expect(bridgeScript).toContain("namespace: context.namespace")
		expect(bridgeScript).toContain('console.log("[VirtualStorageBridge] postMessage skipped"')
		expect(bridgeScript).toContain('console.log("[VirtualStorageBridge] postMessage sent"')
		expect(bridgeScript).toContain('console.log("[VirtualStorageBridge] postMessage failed"')
		expect(bridgeScript).toContain("snapshot: Object.assign({}, state[area])")
		expect(bridgeScript).toContain("createIndex")
		expect(bridgeScript).toContain("openCursor")
		expect(bridgeScript).toContain("IDBKeyRange")
	})
})

const STORAGE_DB_NAME = "MagicHtmlVirtualStorage"
const STORAGE_STORE_NAME = "namespaces"

interface SeededPersistedState {
	namespace: string
	localStorage?: Record<string, string>
	updatedAt?: number
}

/** 直接向底层 IndexedDB 写入历史记录，模拟旧版本的持久化数据。 */
async function seedPersistedState(record: SeededPersistedState): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.open(STORAGE_DB_NAME, 1)

		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORAGE_STORE_NAME)) {
				db.createObjectStore(STORAGE_STORE_NAME, { keyPath: "namespace" })
			}
		}
		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const db = request.result
			const tx = db.transaction(STORAGE_STORE_NAME, "readwrite")
			tx.objectStore(STORAGE_STORE_NAME).put({
				namespace: record.namespace,
				localStorage: record.localStorage ?? {},
				sessionStorage: {},
				cookies: {},
				indexedDB: {},
				updatedAt: record.updatedAt ?? Date.now(),
			})
			tx.oncomplete = () => {
				db.close()
				resolve()
			}
			tx.onerror = () => reject(tx.error)
			tx.onabort = () => reject(tx.error)
		}
	})
}

async function readSeededState(namespace: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(STORAGE_DB_NAME, 1)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const db = request.result
			const tx = db.transaction(STORAGE_STORE_NAME, "readonly")
			const getRequest = tx.objectStore(STORAGE_STORE_NAME).get(namespace)
			getRequest.onsuccess = () => {
				db.close()
				resolve(getRequest.result)
			}
			getRequest.onerror = () => {
				db.close()
				reject(getRequest.error)
			}
		}
	})
}

describe("virtual HTML storage legacy topic namespace migration", () => {
	beforeEach(async () => {
		const { resetVirtualStorageForTests } = await import("../virtual-storage")
		resetVirtualStorageForTests()
		vi.spyOn(console, "log").mockImplementation(() => undefined)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("reads legacy per-topic data when the folded namespace has no record", async () => {
		const { buildHtmlVirtualStorageNamespace, createVirtualStorageContext } =
			await import("../virtual-storage")

		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-read-project:topic:topic-a:file:index-file",
			localStorage: { theme: "dark" },
			updatedAt: 1_700_000_000_000,
		})

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "legacy-read-project",
			fileId: "index-file",
		})
		const context = await createVirtualStorageContext({ namespace })

		expect(context.snapshot.localStorage).toEqual({ theme: "dark" })
	})

	it("picks the most recently updated topic as the migration source", async () => {
		const { buildHtmlVirtualStorageNamespace, createVirtualStorageContext } =
			await import("../virtual-storage")

		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-latest-project:topic:topic-old:file:index-file",
			localStorage: { theme: "light" },
			updatedAt: 1_600_000_000_000,
		})
		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-latest-project:topic:topic-new:file:index-file",
			localStorage: { theme: "dark" },
			updatedAt: 1_700_000_000_000,
		})

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "legacy-latest-project",
			fileId: "index-file",
		})
		const context = await createVirtualStorageContext({ namespace })

		expect(context.snapshot.localStorage).toEqual({ theme: "dark" })
	})

	it("never overwrites existing folded-namespace data", async () => {
		const { buildHtmlVirtualStorageNamespace, createVirtualStorageContext } =
			await import("../virtual-storage")

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "legacy-existing-project",
			fileId: "index-file",
		})
		await seedPersistedState({
			namespace,
			localStorage: { theme: "solarized" },
			updatedAt: 1_500_000_000_000,
		})
		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-existing-project:topic:topic-a:file:index-file",
			localStorage: { theme: "dark" },
			updatedAt: 1_700_000_000_000,
		})

		const context = await createVirtualStorageContext({ namespace })

		expect(context.snapshot.localStorage).toEqual({ theme: "solarized" })

		// 二次读取保持幂等，不因旧记录更新而重新覆盖。
		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-existing-project:topic:topic-b:file:index-file",
			localStorage: { theme: "nord" },
			updatedAt: 1_900_000_000_000,
		})
		const reread = await createVirtualStorageContext({ namespace })
		expect(reread.snapshot.localStorage).toEqual({ theme: "solarized" })
	})

	it("does not migrate legacy records from another project or file", async () => {
		const { buildHtmlVirtualStorageNamespace, createVirtualStorageContext } =
			await import("../virtual-storage")

		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-isolation-other:topic:topic-a:file:index-file",
			localStorage: { theme: "dark" },
		})
		await seedPersistedState({
			namespace:
				"magic-html-storage:project:legacy-isolation-project:topic:topic-a:file:other-file",
			localStorage: { theme: "dark" },
		})

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "legacy-isolation-project",
			fileId: "index-file",
		})
		const context = await createVirtualStorageContext({ namespace })

		expect(context.snapshot.localStorage).toEqual({})
	})

	it("keeps legacy records in place after migrating", async () => {
		const { buildHtmlVirtualStorageNamespace, createVirtualStorageContext } =
			await import("../virtual-storage")

		const legacyNamespace =
			"magic-html-storage:project:legacy-keep-project:topic:topic-a:file:index-file"
		await seedPersistedState({
			namespace: legacyNamespace,
			localStorage: { theme: "dark" },
			updatedAt: 1_700_000_000_000,
		})

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "legacy-keep-project",
			fileId: "index-file",
		})
		await createVirtualStorageContext({ namespace })

		expect(await readSeededState(legacyNamespace)).toMatchObject({
			namespace: legacyNamespace,
			localStorage: { theme: "dark" },
		})
		expect(await readSeededState(namespace)).toMatchObject({
			namespace,
			localStorage: { theme: "dark" },
		})
	})

	it("does not treat an unrelated ephemeral namespace as a migration source", async () => {
		const { buildHtmlVirtualStorageNamespace, createVirtualStorageContext } =
			await import("../virtual-storage")

		await seedPersistedState({
			namespace: "magic-html-storage:ephemeral:legacy-ephemeral-file",
			localStorage: { theme: "dark" },
			updatedAt: 1_900_000_000_000,
		})

		const namespace = buildHtmlVirtualStorageNamespace({
			projectId: "legacy-ephemeral-project",
			fileId: "legacy-ephemeral-file",
		})
		const context = await createVirtualStorageContext({ namespace })

		expect(context.snapshot.localStorage).toEqual({})
	})
})
