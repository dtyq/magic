import { cloneDeep } from "lodash-es"
import { serializeScriptData } from "./serialize-script-data"
import { VirtualStorageTransactions, transactionError } from "./virtual-storage-transactions"

export const VIRTUAL_STORAGE_PROTOCOL = "magic-html-virtual-storage/v1"

export const VIRTUAL_STORAGE_MESSAGE_TYPES = {
	OP: "HTML_SANDBOX_STORAGE_OP",
	ACK: "HTML_SANDBOX_STORAGE_ACK",
	IDB_REQUEST: "HTML_SANDBOX_STORAGE_IDB_REQUEST",
	IDB_RESPONSE: "HTML_SANDBOX_STORAGE_IDB_RESPONSE",
} as const

export type VirtualStorageArea = "localStorage" | "sessionStorage" | "cookies"
export type VirtualStorageRecord = Record<string, string>

export interface VirtualIndexedDBObjectStoreSnapshot {
	keyPath?: string | string[]
	autoIncrement?: boolean
	schemaReady?: boolean
	nextKey: number
	records: Record<string, unknown>
	indexes: Record<string, VirtualIndexedDBIndexSnapshot>
}

export interface VirtualIndexedDBIndexSnapshot {
	name: string
	keyPath: string | string[]
	unique?: boolean
	multiEntry?: boolean
}

export interface VirtualIndexedDBDatabaseSnapshot {
	name: string
	version: number
	objectStores: Record<string, VirtualIndexedDBObjectStoreSnapshot>
}

export interface VirtualStorageSnapshot {
	localStorage: VirtualStorageRecord
	sessionStorage: VirtualStorageRecord
	cookies: VirtualStorageRecord
	/** Optional to preserve old snapshots that stored only cookie strings. */
	cookieExpires?: Record<string, number>
	indexedDB: Record<string, VirtualIndexedDBDatabaseSnapshot>
}

export interface VirtualStorageRuntimeContext {
	protocol: typeof VIRTUAL_STORAGE_PROTOCOL
	renderId: string
	token: string
	namespace: string
	targetOrigin: string
	snapshot: VirtualStorageSnapshot
}

export interface RegisteredVirtualStorageContext extends VirtualStorageRuntimeContext {
	source?: Window | null
	origin?: string
	expiresAt?: number
}

interface CreateVirtualStorageContextOptions {
	namespace: string
	source?: Window | null
	origin?: string
	targetOrigin?: string
	renderId?: string
	token?: string
	snapshot?: VirtualStorageSnapshot
}

interface BuildNamespaceOptions {
	projectId?: string
	fileId?: string
	markerId?: string
}

interface PersistedVirtualStorageState extends VirtualStorageSnapshot {
	namespace: string
	updatedAt: number
}

interface StorageMessageBase {
	protocol: typeof VIRTUAL_STORAGE_PROTOCOL
	type: string
	renderId: string
	token: string
	namespace: string
}

interface StorageOpMessage extends StorageMessageBase {
	type: typeof VIRTUAL_STORAGE_MESSAGE_TYPES.OP
	area: VirtualStorageArea
	seq: number
	op: "setItem" | "removeItem" | "clear" | "setCookie" | "removeCookie"
	snapshot?: Record<string, unknown>
	payload?: {
		key?: unknown
		value?: unknown
		expiresAt?: unknown
	}
}

interface StorageIdbMessage extends StorageMessageBase {
	type: typeof VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST
	requestId: string
	action:
		| "transactionCommit"
		| "transactionAbort"
		| "open"
		| "deleteDatabase"
		| "databases"
		| "createObjectStore"
		| "put"
		| "add"
		| "get"
		| "delete"
		| "clear"
		| "getAll"
		| "createIndex"
		| "indexGetAll"
		| "indexGet"
		| "count"
		| "openCursor"
	payload?: Record<string, unknown>
}

export interface VirtualStorageDebugEvent {
	timestamp: number
	direction: "parent"
	status: "accepted" | "rejected" | "error"
	reason?: string
	type?: string
	namespace?: string
	renderId?: string
	requestId?: string
	origin?: string
	tokenTail?: string
	area?: string
	op?: string
	seq?: number
	key?: string
	action?: string
	dbName?: string
	storeName?: string
}

interface VirtualStorageDebugGlobal {
	__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG__?: boolean
	__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG_LOGS__?: VirtualStorageDebugEvent[]
}

const DB_NAME = "MagicHtmlVirtualStorage"
const DB_VERSION = 1
const STORE_NAME = "namespaces"
const DEFAULT_CONTEXT_TTL_MS = 30 * 60 * 1000
const NAMESPACE_ROOT = "magic-html-storage"
const NAMESPACE_PROJECT_PREFIX = `${NAMESPACE_ROOT}:project:`
const NAMESPACE_FILE_SEPARATOR = ":file:"
/**
 * 旧命名空间曾包含话题段：`magic-html-storage:project:{p}:topic:{t}:file:{f}`。
 * 虚拟存储现已改为只按 project + file 隔离，这里保留该分隔符用于读取并迁移旧数据。
 */
const LEGACY_NAMESPACE_TOPIC_SEPARATOR = ":topic:"
const RUNTIME_POST_MESSAGE_TARGET_HELPER = `
function __magicGetVirtualStoragePostMessageTarget() {
	var strategy = window.__MAGIC_POST_MESSAGE_TARGET_STRATEGY__ || "same-origin-ancestor";
	var w = window;
	while (true) {
		var p = w.parent;
		if (p === w) return w;
		try {
			void p.location.href;
			w = p;
		} catch (e) {
			return strategy === "cross-origin-parent" ? p : w;
		}
	}
}
`.trim()

let dbPromise: Promise<IDBDatabase | null> | null = null
let memoryStore = new Map<string, PersistedVirtualStorageState>()
let debugEvents: VirtualStorageDebugEvent[] = []
let namespaceOperationQueues = new Map<string, Promise<void>>()
const indexedDBTransactions = new VirtualStorageTransactions()
let indexedDBSchemaRepairRequests = new Set<string>()
/** 已经尝试过旧话题命名空间回退的命名空间，避免每次读取都全表扫 key。 */
let legacyMigrationChecked = new Set<string>()

const DEBUG_EVENT_LIMIT = 200
const TOKEN_TAIL_LENGTH = 8

const emptySnapshot = (): VirtualStorageSnapshot => ({
	localStorage: {},
	sessionStorage: {},
	cookies: {},
	indexedDB: {},
})

function getDebugGlobal(): (typeof globalThis & VirtualStorageDebugGlobal) | undefined {
	return typeof globalThis === "undefined"
		? undefined
		: (globalThis as typeof globalThis & VirtualStorageDebugGlobal)
}

function isParentDebugEnabled(): boolean {
	const debugGlobal = getDebugGlobal()
	if (debugGlobal?.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG__ === true) return true
	try {
		return globalThis.localStorage?.getItem("MAGIC_HTML_VIRTUAL_STORAGE_DEBUG") === "true"
	} catch {
		return false
	}
}

function recordVirtualStorageDebugEvent(event: Omit<VirtualStorageDebugEvent, "timestamp">): void {
	const entry = { ...event, timestamp: Date.now() }
	debugEvents = [...debugEvents.slice(-DEBUG_EVENT_LIMIT + 1), entry]

	const debugGlobal = getDebugGlobal()
	if (debugGlobal) {
		const logs = debugGlobal.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG_LOGS__ ?? []
		logs.push(entry)
		if (logs.length > DEBUG_EVENT_LIMIT) logs.splice(0, logs.length - DEBUG_EVENT_LIMIT)
		debugGlobal.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG_LOGS__ = logs
	}

	if (isParentDebugEnabled()) {
		console.debug("[VirtualStorageHost]", entry)
	}
}

function enqueueNamespaceOperation<T>(namespace: string, operation: () => Promise<T>): Promise<T> {
	const previous = namespaceOperationQueues.get(namespace) ?? Promise.resolve()
	// The persisted value is one namespace-sized document, so every read-modify-write for
	// storage and virtual IndexedDB must share this tail to avoid stale writes.
	const current = previous.catch(() => undefined).then(operation)
	const tail = current.then(
		() => undefined,
		() => undefined,
	)
	namespaceOperationQueues.set(namespace, tail)
	void tail.finally(() => {
		if (namespaceOperationQueues.get(namespace) === tail) {
			namespaceOperationQueues.delete(namespace)
		}
	})
	return current
}

export function getVirtualStorageDebugEvents(): VirtualStorageDebugEvent[] {
	return cloneValue(debugEvents)
}

function cloneValue<T>(value: T): T {
	return cloneDeep(value)
}

function getTokenTail(token: unknown): string | undefined {
	if (typeof token !== "string") return undefined
	return token.slice(-TOKEN_TAIL_LENGTH)
}

function createId(prefix: string): string {
	const random =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`
	return `${prefix}-${random}`
}

function normalizeNamespacePart(value: string | undefined, fallback: string): string {
	const raw = value || fallback
	return raw.replace(/[^a-zA-Z0-9_.:-]/g, "_")
}

export function buildHtmlVirtualStorageNamespace(options: BuildNamespaceOptions): string {
	const projectPart = normalizeNamespacePart(options.projectId, "no-project")
	const filePart = normalizeNamespacePart(options.fileId || options.markerId, "default")
	return `${NAMESPACE_PROJECT_PREFIX}${projectPart}${NAMESPACE_FILE_SEPARATOR}${filePart}`
}

/** 拆出新命名空间里的 project / file 片段，无法识别时返回 null。 */
function parseNamespaceScope(namespace: string): { projectPart: string; filePart: string } | null {
	if (!namespace.startsWith(NAMESPACE_PROJECT_PREFIX)) return null
	const rest = namespace.slice(NAMESPACE_PROJECT_PREFIX.length)
	// project / file 片段都可能含 ":"，因此按最后一个 ":file:" 切分。
	const separatorIndex = rest.lastIndexOf(NAMESPACE_FILE_SEPARATOR)
	if (separatorIndex <= 0) return null
	return {
		projectPart: rest.slice(0, separatorIndex),
		filePart: rest.slice(separatorIndex + NAMESPACE_FILE_SEPARATOR.length),
	}
}

/** 构造匹配同一 project + file 的旧话题命名空间的判定函数，不含自身。 */
function getLegacyNamespaceMatcher(namespace: string): ((candidate: string) => boolean) | null {
	const scope = parseNamespaceScope(namespace)
	if (!scope) return null

	const legacyPrefix = `${NAMESPACE_PROJECT_PREFIX}${scope.projectPart}${LEGACY_NAMESPACE_TOPIC_SEPARATOR}`
	const legacySuffix = `${NAMESPACE_FILE_SEPARATOR}${scope.filePart}`

	return (candidate: string) =>
		candidate !== namespace &&
		candidate.startsWith(legacyPrefix) &&
		candidate.endsWith(legacySuffix) &&
		candidate.length > legacyPrefix.length + legacySuffix.length
}

/** 多个话题都存有同一文件的数据时，以最近写入的一份作为迁移来源。 */
function pickLatestPersistedState(
	states: PersistedVirtualStorageState[],
): PersistedVirtualStorageState | null {
	return states.reduce<PersistedVirtualStorageState | null>(
		(latest, state) =>
			!latest || (state.updatedAt ?? 0) > (latest.updatedAt ?? 0) ? state : latest,
		null,
	)
}

function canUseIndexedDB(): boolean {
	return typeof indexedDB !== "undefined" && typeof indexedDB.open === "function"
}

function openDatabase(): Promise<IDBDatabase | null> {
	if (!canUseIndexedDB()) return Promise.resolve(null)
	if (dbPromise) return dbPromise

	dbPromise = new Promise((resolve) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "namespace" })
			}
		}

		request.onsuccess = () => resolve(request.result)
		request.onerror = () => resolve(null)
		request.onblocked = () => resolve(null)
	})

	return dbPromise
}

function emptyPersistedState(namespace: string): PersistedVirtualStorageState {
	return { namespace, ...emptySnapshot(), updatedAt: Date.now() }
}

/** 只读取当前命名空间已持久化的数据，不做任何回退或迁移。 */
async function readPersistedStateRaw(
	namespace: string,
): Promise<PersistedVirtualStorageState | null> {
	const db = await openDatabase()
	if (!db) return memoryStore.get(namespace) ?? null

	return new Promise((resolve) => {
		const tx = db.transaction(STORE_NAME, "readonly")
		const store = tx.objectStore(STORE_NAME)
		const request = store.get(namespace)

		request.onsuccess = () =>
			resolve((request.result as PersistedVirtualStorageState | undefined) ?? null)
		request.onerror = () => resolve(memoryStore.get(namespace) ?? null)
	})
}

/**
 * 把旧话题命名空间的数据惰性迁移到当前命名空间。
 * 只在当前命名空间尚无数据时补写一次，且不删除旧记录，因此可重复执行、可回滚。
 */
async function migrateLegacyTopicNamespaceState(namespace: string): Promise<void> {
	const matchesLegacy = getLegacyNamespaceMatcher(namespace)
	if (!matchesLegacy) return

	const db = await openDatabase()
	if (!db) {
		if (memoryStore.has(namespace)) return
		const latest = pickLatestPersistedState(
			Array.from(memoryStore.values()).filter((state) => matchesLegacy(state.namespace)),
		)
		if (latest) memoryStore.set(namespace, { ...cloneValue(latest), namespace })
		return
	}

	await new Promise<void>((resolve) => {
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			resolve()
		}

		let tx: IDBTransaction
		try {
			// 用单个 readwrite 事务完成「判存 + 选源 + 补写」，避免多标签页并发时相互覆盖。
			tx = db.transaction(STORE_NAME, "readwrite")
		} catch {
			finish()
			return
		}

		const store = tx.objectStore(STORE_NAME)
		tx.oncomplete = finish
		tx.onerror = finish
		tx.onabort = finish

		const existingRequest = store.get(namespace)
		existingRequest.onerror = finish
		existingRequest.onsuccess = () => {
			if (existingRequest.result !== undefined) {
				finish()
				return
			}

			const keysRequest = store.getAllKeys()
			keysRequest.onerror = finish
			keysRequest.onsuccess = () => {
				const legacyKeys = (keysRequest.result ?? []).filter(
					(key): key is string => typeof key === "string" && matchesLegacy(key),
				)
				if (legacyKeys.length === 0) {
					finish()
					return
				}

				const states: PersistedVirtualStorageState[] = []
				let pending = legacyKeys.length
				const collect = () => {
					pending -= 1
					if (pending > 0) return
					const latest = pickLatestPersistedState(states)
					// 保留原 updatedAt，避免迁移本身改变数据的时序语义。
					if (latest) store.put({ ...cloneValue(latest), namespace })
				}

				for (const key of legacyKeys) {
					const getRequest = store.get(key)
					getRequest.onsuccess = () => {
						const row = getRequest.result as PersistedVirtualStorageState | undefined
						if (row) states.push(row)
						collect()
					}
					getRequest.onerror = collect
				}
			}
		}
	})
}

async function readPersistedState(namespace: string): Promise<PersistedVirtualStorageState> {
	const persisted = await readPersistedStateRaw(namespace)
	if (persisted) return persisted

	// 历史数据写在带话题段的旧命名空间下，读取时按 project + file 回退迁移一份。
	if (!legacyMigrationChecked.has(namespace)) {
		legacyMigrationChecked.add(namespace)
		await migrateLegacyTopicNamespaceState(namespace)
	}

	const migrated = await readPersistedStateRaw(namespace)
	return migrated ?? emptyPersistedState(namespace)
}

function logPersistedState(state: PersistedVirtualStorageState, backend: string): void {
	console.log("[VirtualStorageHost] persisted", {
		backend,
		dbName: DB_NAME,
		storeName: STORE_NAME,
		namespace: state.namespace,
		localStorageKeys: Object.keys(state.localStorage),
		sessionStorageKeys: Object.keys(state.sessionStorage),
		cookieKeys: Object.keys(state.cookies),
		indexedDBNames: Object.keys(state.indexedDB),
	})
}

/** Read the latest snapshot and apply only the requested mutation under one native lock. */
async function updatePersistedState<T>(
	namespace: string,
	update: (state: PersistedVirtualStorageState, changed: () => Promise<void>) => Promise<T>,
): Promise<T> {
	// Perform any legacy namespace migration before opening the mutation transaction.
	await readPersistedState(namespace)
	const db = await openDatabase()
	let dirty = false
	const changed = async () => {
		dirty = true
	}
	if (!db) {
		const current = cloneValue(await readPersistedState(namespace))
		const result = await update(current, changed)
		if (dirty) {
			current.updatedAt = Date.now()
			memoryStore.set(namespace, current)
			logPersistedState(current, "memory-fallback")
		}
		return result
	}
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite")
		const store = tx.objectStore(STORE_NAME)
		const request = store.get(namespace)
		let committed: PersistedVirtualStorageState | undefined
		let result: T
		let failure: unknown
		request.onsuccess = () => {
			const current =
				(request.result as PersistedVirtualStorageState | undefined) ??
				emptyPersistedState(namespace)
			// Updates are local operations only. Their promise continuations run in this
			// request's microtask checkpoint, while the native transaction is active.
			update(current, changed)
				.then((value) => {
					result = value
					if (dirty) {
						current.updatedAt = Date.now()
						store.put(current)
						committed = current
					}
				})
				.catch((error: unknown) => {
					failure = error
					tx.abort()
				})
		}
		tx.oncomplete = () => {
			if (committed) {
				memoryStore.set(namespace, cloneValue(committed))
				logPersistedState(committed, "indexedDB")
			}
			resolve(result)
		}
		tx.onerror = () =>
			reject(failure ?? tx.error ?? transactionError("AbortError", "Storage update failed"))
		tx.onabort = () =>
			reject(failure ?? tx.error ?? transactionError("AbortError", "Storage update aborted"))
	})
}

export async function loadVirtualStorageSnapshot(
	namespace: string,
): Promise<VirtualStorageSnapshot> {
	// This external read must include writes already accepted from the retired
	// document. Queue operations use readPersistedState directly, avoiding self-wait.
	await namespaceOperationQueues.get(namespace)
	const state = await readPersistedState(namespace)
	for (const [key, expiresAt] of Object.entries(state.cookieExpires ?? {})) {
		if (expiresAt <= Date.now()) {
			delete state.cookies[key]
			delete state.cookieExpires?.[key]
		}
	}
	return {
		...(state.cookieExpires ? { cookieExpires: cloneValue(state.cookieExpires) } : {}),
		localStorage: cloneValue(state.localStorage),
		sessionStorage: cloneValue(state.sessionStorage),
		cookies: cloneValue(state.cookies),
		indexedDB: cloneValue(state.indexedDB),
	}
}

export async function createVirtualStorageContext(
	options: CreateVirtualStorageContextOptions,
): Promise<RegisteredVirtualStorageContext> {
	const snapshot = options.snapshot ?? (await loadVirtualStorageSnapshot(options.namespace))
	return {
		protocol: VIRTUAL_STORAGE_PROTOCOL,
		renderId: options.renderId ?? createId("html-storage-render"),
		token: options.token ?? createId("html-storage-token"),
		namespace: options.namespace,
		targetOrigin: options.targetOrigin ?? "*",
		snapshot,
		source: options.source,
		origin: options.origin,
		expiresAt: Date.now() + DEFAULT_CONTEXT_TTL_MS,
	}
}

export function createEphemeralVirtualStorageContext(
	markerId?: string,
): VirtualStorageRuntimeContext {
	return {
		protocol: VIRTUAL_STORAGE_PROTOCOL,
		renderId: `html-storage-ephemeral-${normalizeNamespacePart(markerId, "default")}`,
		token: "",
		namespace: `magic-html-storage:ephemeral:${normalizeNamespacePart(markerId, "default")}`,
		targetOrigin: "*",
		snapshot: emptySnapshot(),
	}
}

class VirtualStorageRegistry {
	private contexts = new Map<string, RegisteredVirtualStorageContext>()

	register(context: RegisteredVirtualStorageContext): void {
		this.cleanup()
		const key = this.getKey(context.renderId, context.token)
		this.contexts.set(key, context)
		console.log("[VirtualStorageRegistry] register", {
			...this.toContextLog(context),
			contextCount: this.contexts.size,
		})
	}

	unregister(
		context: Pick<RegisteredVirtualStorageContext, "renderId" | "token"> &
			Partial<Pick<RegisteredVirtualStorageContext, "namespace">>,
	): void {
		const key = this.getKey(context.renderId, context.token)
		const removed = this.contexts.delete(key)
		console.log("[VirtualStorageRegistry] unregister", {
			...this.toContextLog(context),
			contextCount: this.contexts.size,
			removed,
		})
	}

	get(message: Pick<StorageMessageBase, "renderId" | "token" | "namespace">) {
		this.cleanup()
		const context = this.contexts.get(this.getKey(message.renderId, message.token))
		if (!context || context.namespace !== message.namespace) return undefined
		return context
	}

	getContextNotFoundLog(message: Pick<StorageMessageBase, "renderId" | "token" | "namespace">) {
		this.cleanup()
		return {
			namespace: message.namespace,
			renderId: message.renderId,
			tokenTail: getTokenTail(message.token),
			contextCount: this.contexts.size,
			sameNamespaceContexts: this.getContextLogs(
				(context) => context.namespace === message.namespace,
			),
			sameRenderIdContexts: this.getContextLogs(
				(context) => context.renderId === message.renderId,
			),
		}
	}

	reset(): void {
		this.contexts.clear()
	}

	private getKey(renderId: string, token: string): string {
		return `${renderId}:${token}`
	}

	private toContextLog(
		context: Pick<RegisteredVirtualStorageContext, "renderId" | "token"> &
			Partial<
				Pick<
					RegisteredVirtualStorageContext,
					"namespace" | "origin" | "source" | "expiresAt"
				>
			>,
	) {
		return {
			namespace: context.namespace,
			renderId: context.renderId,
			tokenTail: getTokenTail(context.token),
			origin: context.origin,
			sourcePresent: Boolean(context.source),
			expiresAt: context.expiresAt,
		}
	}

	private getContextLogs(predicate: (context: RegisteredVirtualStorageContext) => boolean) {
		return Array.from(this.contexts.values()).filter(predicate).map(this.toContextLog)
	}

	private cleanup(): void {
		const now = Date.now()
		for (const [key, context] of this.contexts.entries()) {
			if (context.expiresAt && context.expiresAt <= now) this.contexts.delete(key)
		}
	}
}

export const virtualStorageRegistry = new VirtualStorageRegistry()

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function isStorageMessage(data: unknown): data is StorageOpMessage | StorageIdbMessage {
	if (!isObject(data)) return false
	return (
		data.protocol === VIRTUAL_STORAGE_PROTOCOL &&
		(data.type === VIRTUAL_STORAGE_MESSAGE_TYPES.OP ||
			data.type === VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_REQUEST) &&
		typeof data.renderId === "string" &&
		typeof data.token === "string" &&
		typeof data.namespace === "string"
	)
}

function getMessageDebugMetadata(data?: unknown) {
	if (!isObject(data)) return {}
	const payload = isObject(data.payload) ? data.payload : undefined
	const key = payload?.key
	return {
		tokenTail: getTokenTail(data.token),
		area: typeof data.area === "string" ? data.area : undefined,
		op: typeof data.op === "string" ? data.op : undefined,
		seq: typeof data.seq === "number" ? data.seq : undefined,
		key: key == null ? undefined : String(key),
		action: typeof data.action === "string" ? data.action : undefined,
		dbName: payload?.dbName == null ? undefined : String(payload.dbName),
		storeName: payload?.storeName == null ? undefined : String(payload.storeName),
	}
}

function getSourceRejectionReason(
	event: MessageEvent,
	context: RegisteredVirtualStorageContext,
): string | undefined {
	if (context.source && event.source !== context.source) return "source-mismatch"
	if (context.origin && event.origin !== context.origin) return "origin-mismatch"
	return undefined
}

function recordRejectedStorageMessage(
	event: MessageEvent,
	reason: string,
	data?: Partial<StorageMessageBase> & { requestId?: string },
): void {
	const debugEvent = {
		direction: "parent",
		status: "rejected",
		reason,
		type: typeof data?.type === "string" ? data.type : undefined,
		namespace: typeof data?.namespace === "string" ? data.namespace : undefined,
		renderId: typeof data?.renderId === "string" ? data.renderId : undefined,
		requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
		origin: event.origin,
		tokenTail: getTokenTail(data?.token),
		...getMessageDebugMetadata(data),
	} satisfies Omit<VirtualStorageDebugEvent, "timestamp">
	recordVirtualStorageDebugEvent(debugEvent)
	console.log("[VirtualStorageHost] rejected", debugEvent)
}

function postToSource(event: MessageEvent, message: Record<string, unknown>): void {
	const source = event.source as Window | null
	if (!source || typeof source.postMessage !== "function") return
	source.postMessage(message, event.origin || "*")
}

function getAreaRecord(state: PersistedVirtualStorageState, area: VirtualStorageArea) {
	return state[area]
}

function normalizeStorageSnapshot(snapshot: unknown): VirtualStorageRecord | undefined {
	if (!isObject(snapshot)) return undefined
	return Object.fromEntries(
		Object.entries(snapshot).map(([key, value]) => [key, String(value ?? "")]),
	)
}

function replaceAreaRecord(
	state: PersistedVirtualStorageState,
	area: VirtualStorageArea,
	snapshot: VirtualStorageRecord,
): void {
	const areaRecord = getAreaRecord(state, area)
	for (const existingKey of Object.keys(areaRecord)) delete areaRecord[existingKey]
	Object.assign(areaRecord, snapshot)
}

async function applyStorageOperation(message: StorageOpMessage): Promise<void> {
	return updatePersistedState(message.namespace, async (state, persist) => {
		const areaRecord = getAreaRecord(state, message.area)
		const areaSnapshot = normalizeStorageSnapshot(message.snapshot)
		const key = message.payload?.key == null ? "" : String(message.payload.key)

		if (areaSnapshot) {
			replaceAreaRecord(state, message.area, areaSnapshot)
		} else {
			switch (message.op) {
				case "setItem":
				case "setCookie":
					if (!key) return
					areaRecord[key] = String(message.payload?.value ?? "")
					break
				case "removeItem":
				case "removeCookie":
					if (!key) return
					delete areaRecord[key]
					break
				case "clear":
					for (const existingKey of Object.keys(areaRecord))
						delete areaRecord[existingKey]
					break
				default:
					return
			}
		}

		if (message.area === "cookies") {
			state.cookieExpires ??= {}
			for (const name of Object.keys(state.cookieExpires)) {
				if (!(name in state.cookies)) delete state.cookieExpires[name]
			}
			if (message.op === "setCookie" && key) {
				const expiresAt = message.payload?.expiresAt
				if (typeof expiresAt === "number" && Number.isFinite(expiresAt))
					state.cookieExpires[key] = expiresAt
				else delete state.cookieExpires[key]
			}
		}
		await persist()
	})
}

function getIndexedDBSchemaRepairKey(namespace: string, dbName: string): string {
	return `${namespace}\n${dbName}`
}

function markIndexedDBSchemaRepairNeeded(namespace: string, dbName: string): void {
	indexedDBSchemaRepairRequests.add(getIndexedDBSchemaRepairKey(namespace, dbName))
}

function hasLegacyEmptyStoreSchema(store: VirtualIndexedDBObjectStoreSnapshot): boolean {
	return (
		store.schemaReady !== true &&
		store.keyPath === undefined &&
		store.autoIncrement !== true &&
		Object.keys(store.records ?? {}).length === 0
	)
}

function shouldRepairSameVersionSchema(
	state: PersistedVirtualStorageState,
	dbName: string,
	db: VirtualIndexedDBDatabaseSnapshot,
): boolean {
	return (
		Object.keys(db.objectStores).length === 0 ||
		indexedDBSchemaRepairRequests.has(getIndexedDBSchemaRepairKey(state.namespace, dbName)) ||
		Object.values(db.objectStores).some(hasLegacyEmptyStoreSchema)
	)
}

function ensureDatabase(
	state: PersistedVirtualStorageState,
	dbName: string,
	version?: number,
): {
	db: VirtualIndexedDBDatabaseSnapshot
	upgraded: boolean
	oldVersion: number
	repairing: boolean
} {
	const existing = state.indexedDB[dbName]
	const requestedVersion = Math.max(1, Number(version || existing?.version || 1))
	if (!existing) {
		const db = {
			name: dbName,
			version: requestedVersion,
			objectStores: {},
		}
		state.indexedDB[dbName] = db
		return { db, upgraded: true, oldVersion: 0, repairing: false }
	}

	const oldVersion = existing.version
	if (requestedVersion > existing.version) {
		existing.version = requestedVersion
		indexedDBSchemaRepairRequests.delete(getIndexedDBSchemaRepairKey(state.namespace, dbName))
		return { db: existing, upgraded: true, oldVersion, repairing: false }
	}
	if (
		requestedVersion === existing.version &&
		shouldRepairSameVersionSchema(state, dbName, existing)
	) {
		// Older virtual IDB builds could leave a database shell or empty object-store
		// metadata behind. Let one same-version open run upgrade code so generated HTML
		// can replay its createObjectStore/createIndex schema operations.
		indexedDBSchemaRepairRequests.delete(getIndexedDBSchemaRepairKey(state.namespace, dbName))
		return { db: existing, upgraded: true, oldVersion, repairing: true }
	}

	return { db: existing, upgraded: false, oldVersion, repairing: false }
}

function ensureObjectStore(
	db: VirtualIndexedDBDatabaseSnapshot,
	storeName: string,
	options: Record<string, unknown> = {},
): VirtualIndexedDBObjectStoreSnapshot {
	if (!db.objectStores[storeName]) {
		db.objectStores[storeName] = {
			keyPath: undefined,
			autoIncrement: false,
			schemaReady: false,
			nextKey: 1,
			records: {},
			indexes: {},
		}
	}
	const store = db.objectStores[storeName]
	if (!isObject(store.records)) store.records = {}
	if (!store.indexes) store.indexes = {}
	if (typeof store.nextKey !== "number" || !Number.isFinite(store.nextKey)) {
		store.nextKey = 1
	}
	if (typeof options.keyPath === "string" || Array.isArray(options.keyPath)) {
		store.keyPath = options.keyPath as string | string[]
	}
	if (Object.prototype.hasOwnProperty.call(options, "autoIncrement")) {
		store.autoIncrement = Boolean(options.autoIncrement)
	}
	store.schemaReady = true
	return store
}

function normalizeObjectStoreSnapshot(store: VirtualIndexedDBObjectStoreSnapshot): void {
	if (!isObject(store.records)) store.records = {}
	if (!store.indexes) store.indexes = {}
	if (typeof store.nextKey !== "number" || !Number.isFinite(store.nextKey)) {
		store.nextKey = 1
	}
}

function createNotFoundError(message: string): Error {
	const error = new Error(`NotFoundError: ${message}`)
	error.name = "NotFoundError"
	return error
}

function getExistingDatabase(
	state: PersistedVirtualStorageState,
	dbName: string,
): VirtualIndexedDBDatabaseSnapshot {
	const db = state.indexedDB[dbName]
	if (!db) throw createNotFoundError(`IndexedDB database not found: ${dbName}`)
	return db
}

function getExistingObjectStore(
	db: VirtualIndexedDBDatabaseSnapshot,
	storeName: string,
	repairContext?: { namespace: string; dbName: string },
): VirtualIndexedDBObjectStoreSnapshot {
	const store = db.objectStores[storeName]
	if (!store) {
		if (repairContext) {
			markIndexedDBSchemaRepairNeeded(repairContext.namespace, repairContext.dbName)
		}
		throw createNotFoundError(`IndexedDB object store not found: ${storeName}`)
	}
	normalizeObjectStoreSnapshot(store)
	return store
}

function getKeyPathValue(value: unknown, keyPath: string | string[] | undefined): unknown {
	if (!keyPath || !isObject(value)) return undefined
	if (Array.isArray(keyPath)) return keyPath.map((key) => value[key])
	return value[keyPath]
}

function setGeneratedKeyPathValue(
	value: unknown,
	keyPath: string | string[] | undefined,
	keyValue: unknown,
): void {
	if (typeof keyPath !== "string" || !isObject(value)) return
	value[keyPath] = keyValue
}

function normalizeIdbKey(key: unknown): string | undefined {
	if (key === undefined || key === null) return undefined
	return typeof key === "string" ? key : JSON.stringify(key)
}

function compareIdbKeys(left: unknown, right: unknown): number {
	if (Array.isArray(left) || Array.isArray(right)) {
		const leftArray = Array.isArray(left) ? left : [left]
		const rightArray = Array.isArray(right) ? right : [right]
		const length = Math.max(leftArray.length, rightArray.length)
		for (let index = 0; index < length; index += 1) {
			if (index >= leftArray.length) return -1
			if (index >= rightArray.length) return 1
			const partCompare = compareIdbKeys(leftArray[index], rightArray[index])
			if (partCompare !== 0) return partCompare
		}
		return 0
	}
	if (left === right) return 0
	if (typeof left === "number" && typeof right === "number") return left < right ? -1 : 1
	const leftString = String(left)
	const rightString = String(right)
	if (leftString === rightString) return 0
	return leftString < rightString ? -1 : 1
}

function matchesKeyRange(key: unknown, query: unknown): boolean {
	if (query === undefined || query === null) return true
	if (!isObject(query) || typeof query.type !== "string") return compareIdbKeys(key, query) === 0

	switch (query.type) {
		case "only":
			return compareIdbKeys(key, query.value) === 0
		case "lowerBound": {
			const compared = compareIdbKeys(key, query.lower)
			return query.open === true ? compared > 0 : compared >= 0
		}
		case "upperBound": {
			const compared = compareIdbKeys(key, query.upper)
			return query.open === true ? compared < 0 : compared <= 0
		}
		case "bound": {
			const lowerCompared = compareIdbKeys(key, query.lower)
			const upperCompared = compareIdbKeys(key, query.upper)
			const lowerMatches = query.lowerOpen === true ? lowerCompared > 0 : lowerCompared >= 0
			const upperMatches = query.upperOpen === true ? upperCompared < 0 : upperCompared <= 0
			return lowerMatches && upperMatches
		}
		default:
			return true
	}
}

function getIndexKeys(value: unknown, index: VirtualIndexedDBIndexSnapshot): unknown[] {
	const keyPathValue = getKeyPathValue(value, index.keyPath)
	if (index.multiEntry && Array.isArray(keyPathValue)) return keyPathValue
	return [keyPathValue]
}

function getFilteredStoreRecords(
	store: VirtualIndexedDBObjectStoreSnapshot,
	query: unknown,
	indexName?: string,
) {
	const index = indexName ? store.indexes[indexName] : undefined
	if (indexName && !index) throw new Error(`IndexedDB index not found: ${indexName}`)

	const entries = Object.entries(store.records).flatMap(([primaryKey, value]) => {
		const keys = index ? getIndexKeys(value, index) : [primaryKey]
		return keys
			.filter((key) => key !== undefined && matchesKeyRange(key, query))
			.map((key) => ({
				key,
				primaryKey,
				value,
			}))
	})

	return entries.sort((left, right) => {
		const keyCompare = compareIdbKeys(left.key, right.key)
		if (keyCompare !== 0) return keyCompare
		return compareIdbKeys(left.primaryKey, right.primaryKey)
	})
}

function resolveObjectStoreKey(
	store: VirtualIndexedDBObjectStoreSnapshot,
	value: unknown,
	key: unknown,
): { recordKey: string; keyValue: unknown } {
	const explicitKey = normalizeIdbKey(key)
	if (explicitKey !== undefined) return { recordKey: explicitKey, keyValue: key }

	const rawKeyPathValue = getKeyPathValue(value, store.keyPath)
	const keyPathValue = normalizeIdbKey(rawKeyPathValue)
	if (keyPathValue !== undefined) return { recordKey: keyPathValue, keyValue: rawKeyPathValue }

	if (store.autoIncrement) {
		const nextKey = store.nextKey
		store.nextKey += 1
		setGeneratedKeyPathValue(value, store.keyPath, nextKey)
		return { recordKey: String(nextKey), keyValue: nextKey }
	}

	throw new Error("IndexedDB key is required")
}

async function handleIndexedDBRequest(message: StorageIdbMessage): Promise<unknown> {
	const payload = message.payload ?? {}
	const transactionId =
		typeof payload.transactionId === "string" ? payload.transactionId : undefined
	const key = transactionId
		? JSON.stringify([message.namespace, message.renderId, message.token, transactionId])
		: undefined
	if (message.action === "transactionAbort") {
		if (!key) throw transactionError("InvalidStateError", "Transaction ID is required")
		indexedDBTransactions.abort(key)
		return true
	}
	if (message.action === "transactionCommit") {
		if (!key) throw transactionError("InvalidStateError", "Transaction ID is required")
		await updatePersistedState(message.namespace, async (current, persist) => {
			if (indexedDBTransactions.commit(key, current)) await persist()
		})
		return true
	}
	if (!key)
		return updatePersistedState(message.namespace, (current, persist) =>
			executeIndexedDBRequest(message, current, persist),
		)
	const current = await readPersistedState(message.namespace)
	try {
		const transaction = indexedDBTransactions.begin(
			key,
			String(payload.dbName ?? ""),
			payload.transactionMode,
			payload.transactionStores,
			current,
		)
		indexedDBTransactions.assertOperation(transaction, message.action, payload.storeName)
		const staged = Object.assign(transaction.state, {
			namespace: message.namespace,
			updatedAt: current.updatedAt,
		})
		return await executeIndexedDBRequest(message, staged, async () => undefined)
	} catch (error) {
		indexedDBTransactions.abort(key)
		throw error
	}
}

async function executeIndexedDBRequest(
	message: StorageIdbMessage,
	state: PersistedVirtualStorageState,
	persist: () => Promise<void>,
): Promise<unknown> {
	const payload = message.payload ?? {}
	const dbName = String(payload.dbName ?? "")
	if (!dbName && message.action !== "databases") throw new Error("IndexedDB dbName is required")

	switch (message.action) {
		case "databases":
			return Object.values(state.indexedDB).map((db) => ({
				name: db.name,
				version: db.version,
			}))
		case "deleteDatabase":
			delete state.indexedDB[dbName]
			await persist()
			return true
		case "open": {
			const { db, upgraded, oldVersion, repairing } = ensureDatabase(
				state,
				dbName,
				Number(payload.version || 1),
			)
			await persist()
			return {
				name: db.name,
				version: db.version,
				objectStores: repairing ? [] : Object.keys(db.objectStores),
				upgraded,
				oldVersion,
			}
		}
		case "createObjectStore": {
			const { db } = ensureDatabase(state, dbName, Number(payload.version || 1))
			const storeName = String(payload.storeName ?? "")
			if (!storeName) throw new Error("IndexedDB storeName is required")
			const options = isObject(payload.options) ? payload.options : {}
			ensureObjectStore(db, storeName, options)
			await persist()
			return {
				name: storeName,
				objectStores: Object.keys(db.objectStores),
			}
		}
		case "createIndex": {
			const db = getExistingDatabase(state, dbName)
			const storeName = String(payload.storeName ?? "")
			const indexName = String(payload.indexName ?? "")
			if (!storeName) throw new Error("IndexedDB storeName is required")
			if (!indexName) throw new Error("IndexedDB indexName is required")
			const store = getExistingObjectStore(db, storeName, {
				namespace: state.namespace,
				dbName,
			})
			const options = isObject(payload.options) ? payload.options : {}
			const keyPath = payload.keyPath
			if (!(typeof keyPath === "string" || Array.isArray(keyPath))) {
				throw new Error("IndexedDB index keyPath is required")
			}
			store.indexes[indexName] = {
				name: indexName,
				keyPath,
				unique: Boolean(options.unique),
				multiEntry: Boolean(options.multiEntry),
			}
			await persist()
			return {
				name: indexName,
				keyPath,
			}
		}
		case "put":
		case "add": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			const recordValue = cloneValue(payload.value)
			const { keyValue, recordKey } = resolveObjectStoreKey(store, recordValue, payload.key)
			if (
				message.action === "add" &&
				Object.prototype.hasOwnProperty.call(store.records, recordKey)
			) {
				throw new Error("Key already exists")
			}
			store.records[recordKey] = recordValue
			await persist()
			return keyValue
		}
		case "get": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			return cloneValue(store.records[normalizeIdbKey(payload.key) ?? ""])
		}
		case "delete": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			delete store.records[normalizeIdbKey(payload.key) ?? ""]
			await persist()
			return true
		}
		case "clear": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			store.records = {}
			await persist()
			return true
		}
		case "indexGet": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			const [entry] = getFilteredStoreRecords(
				store,
				payload.query,
				String(payload.indexName ?? ""),
			)
			return cloneValue(entry?.value)
		}
		case "getAll": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			const limit = Number(payload.count || 0)
			const records = getFilteredStoreRecords(
				store,
				payload.query,
				typeof payload.indexName === "string" ? payload.indexName : undefined,
			).map((entry) => cloneValue(entry.value))
			return limit > 0 ? records.slice(0, limit) : records
		}
		case "indexGetAll": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			const limit = Number(payload.count || 0)
			const records = getFilteredStoreRecords(
				store,
				payload.query,
				String(payload.indexName ?? ""),
			).map((entry) => cloneValue(entry.value))
			return limit > 0 ? records.slice(0, limit) : records
		}
		case "count": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			return getFilteredStoreRecords(
				store,
				payload.query,
				typeof payload.indexName === "string" ? payload.indexName : undefined,
			).length
		}
		case "openCursor": {
			const db = getExistingDatabase(state, dbName)
			const store = getExistingObjectStore(db, String(payload.storeName ?? "default"), {
				namespace: state.namespace,
				dbName,
			})
			const records = getFilteredStoreRecords(
				store,
				payload.query,
				typeof payload.indexName === "string" ? payload.indexName : undefined,
			).map((entry) => ({
				key: cloneValue(entry.key),
				primaryKey: entry.primaryKey,
				value: cloneValue(entry.value),
			}))
			return payload.direction === "prev" || payload.direction === "prevunique"
				? records.reverse()
				: records
		}
		default:
			throw new Error(`Unsupported IndexedDB action: ${message.action}`)
	}
}

export function createVirtualStorageMessageHandler(
	registry: VirtualStorageRegistry = virtualStorageRegistry,
) {
	return async (event: MessageEvent): Promise<void> => {
		if (!isStorageMessage(event.data)) {
			if (isObject(event.data) && event.data.protocol === VIRTUAL_STORAGE_PROTOCOL) {
				recordRejectedStorageMessage(event, "malformed-message", event.data)
			}
			return
		}

		const message = event.data
		const context = registry.get(message)
		if (!context) {
			console.log(
				"[VirtualStorageRegistry] context-not-found",
				registry.getContextNotFoundLog(message),
			)
			recordRejectedStorageMessage(event, "context-not-found", message)
			return
		}

		const sourceRejectionReason = getSourceRejectionReason(event, context)
		if (sourceRejectionReason) {
			recordRejectedStorageMessage(event, sourceRejectionReason, message)
			return
		}

		const acceptedEvent = {
			direction: "parent",
			status: "accepted",
			type: message.type,
			namespace: message.namespace,
			renderId: message.renderId,
			requestId: "requestId" in message ? message.requestId : undefined,
			origin: event.origin,
			...getMessageDebugMetadata(message),
		} satisfies Omit<VirtualStorageDebugEvent, "timestamp">
		recordVirtualStorageDebugEvent(acceptedEvent)
		console.log("[VirtualStorageHost] accepted", acceptedEvent)

		if (message.type === VIRTUAL_STORAGE_MESSAGE_TYPES.OP) {
			await enqueueNamespaceOperation(message.namespace, async () => {
				try {
					await applyStorageOperation(message)
					postToSource(event, {
						protocol: VIRTUAL_STORAGE_PROTOCOL,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.ACK,
						renderId: message.renderId,
						namespace: message.namespace,
						seq: message.seq,
						success: true,
					})
				} catch (error) {
					const errorEvent = {
						direction: "parent",
						status: "error",
						reason: error instanceof Error ? error.message : String(error),
						type: message.type,
						namespace: message.namespace,
						renderId: message.renderId,
						origin: event.origin,
						...getMessageDebugMetadata(message),
					} satisfies Omit<VirtualStorageDebugEvent, "timestamp">
					recordVirtualStorageDebugEvent(errorEvent)
					console.log("[VirtualStorageHost] error", errorEvent)
					postToSource(event, {
						protocol: VIRTUAL_STORAGE_PROTOCOL,
						type: VIRTUAL_STORAGE_MESSAGE_TYPES.ACK,
						renderId: message.renderId,
						namespace: message.namespace,
						seq: message.seq,
						success: false,
						error: error instanceof Error ? error.message : String(error),
					})
				}
			})
			return
		}

		await enqueueNamespaceOperation(message.namespace, async () => {
			try {
				const result = await handleIndexedDBRequest(message)
				postToSource(event, {
					protocol: VIRTUAL_STORAGE_PROTOCOL,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_RESPONSE,
					renderId: message.renderId,
					namespace: message.namespace,
					requestId: message.requestId,
					success: true,
					result,
				})
			} catch (error) {
				const errorEvent = {
					direction: "parent",
					status: "error",
					reason: error instanceof Error ? error.message : String(error),
					type: message.type,
					namespace: message.namespace,
					renderId: message.renderId,
					requestId: message.requestId,
					origin: event.origin,
					...getMessageDebugMetadata(message),
				} satisfies Omit<VirtualStorageDebugEvent, "timestamp">
				recordVirtualStorageDebugEvent(errorEvent)
				console.log("[VirtualStorageHost] error", errorEvent)
				postToSource(event, {
					protocol: VIRTUAL_STORAGE_PROTOCOL,
					type: VIRTUAL_STORAGE_MESSAGE_TYPES.IDB_RESPONSE,
					renderId: message.renderId,
					namespace: message.namespace,
					requestId: message.requestId,
					success: false,
					error: error instanceof Error ? error.message : String(error),
					errorName:
						isObject(error) && typeof error.name === "string" ? error.name : "Error",
				})
			}
		})
	}
}

export function getSerializableVirtualStorageContext(
	context: VirtualStorageRuntimeContext,
): VirtualStorageRuntimeContext {
	return {
		protocol: context.protocol,
		renderId: context.renderId,
		token: context.token,
		namespace: context.namespace,
		targetOrigin: context.targetOrigin,
		snapshot: context.snapshot,
	}
}

export function getVirtualStorageBridgeScript(context: VirtualStorageRuntimeContext): string {
	// Cached HTML can contain </script>; keep the snapshot inside its script element.
	const serializedContext = serializeScriptData(getSerializableVirtualStorageContext(context))
	const messageTypes = JSON.stringify(VIRTUAL_STORAGE_MESSAGE_TYPES)

	return `
	(function setupMagicVirtualStorage() {
		var context = ${serializedContext};
		var MSG = ${messageTypes};
		var seq = 0;
		var idbRequestSeq = 0;
		var state = {
			localStorage: Object.assign({}, context.snapshot && context.snapshot.localStorage || {}),
			sessionStorage: Object.assign({}, context.snapshot && context.snapshot.sessionStorage || {}),
			cookies: Object.assign({}, context.snapshot && context.snapshot.cookies || {}),
			cookieExpires: Object.assign({}, context.snapshot && context.snapshot.cookieExpires || {})
		};
		var debugEntries = [];

		${RUNTIME_POST_MESSAGE_TARGET_HELPER}

		function isBridgeDebugEnabled() {
			try {
				return context.debug === true || window.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG__ === true;
			} catch (error) {
				return false;
			}
		}

		function bridgeDebug(event, details) {
			var entry = Object.assign({
				timestamp: Date.now(),
				event: event,
				namespace: context.namespace,
				renderId: context.renderId
			}, details || {});
			debugEntries.push(entry);
			if (debugEntries.length > 200) debugEntries.shift();
			try {
				var globalLogs = window.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG_LOGS__ || [];
				globalLogs.push(entry);
				if (globalLogs.length > 200) globalLogs.splice(0, globalLogs.length - 200);
				window.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG_LOGS__ = globalLogs;
			} catch (error) {}
			if (isBridgeDebugEnabled() && console && typeof console.debug === "function") {
				console.debug("[VirtualStorageBridge]", event, entry);
			}
		}

		window.__MAGIC_HTML_VIRTUAL_STORAGE__ = {
			protocol: context.protocol,
			namespace: context.namespace,
			renderId: context.renderId,
			targetOrigin: context.targetOrigin,
			getDebugEvents: function() {
				return debugEntries.slice();
			},
			setDebugEnabled: function(enabled) {
				window.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG__ = enabled !== false;
			}
		};
		bridgeDebug("init", {
			localStorageKeys: Object.keys(state.localStorage),
			sessionStorageKeys: Object.keys(state.sessionStorage),
			cookieKeys: Object.keys(state.cookies)
		});

		function getMessageTarget() {
			try {
				if (typeof __magicGetVirtualStoragePostMessageTarget === "function") {
					return __magicGetVirtualStoragePostMessageTarget();
				}
			} catch (error) {}
			return window.parent || window;
		}

		function postToParent(type, payload) {
			if (!context.token) {
				console.log("[VirtualStorageBridge] postMessage skipped", {
					reason: "missing-token",
					namespace: context.namespace,
					renderId: context.renderId,
					type: type
				});
				return;
			}
			var targetOrigin = context.targetOrigin || "*";
			var message = Object.assign({
				protocol: context.protocol,
				type: type,
				renderId: context.renderId,
				token: context.token,
				namespace: context.namespace
			}, payload || {});
			try {
				getMessageTarget().postMessage(message, targetOrigin);
				console.log("[VirtualStorageBridge] postMessage sent", {
					namespace: context.namespace,
					renderId: context.renderId,
					type: type,
					targetOrigin: targetOrigin,
					payload: payload || {}
				});
				bridgeDebug("postMessage", {
					type: type,
					targetOrigin: targetOrigin,
					payload: payload || {}
				});
			} catch (error) {
				console.warn("Virtual storage postMessage failed:", error && error.message);
				console.log("[VirtualStorageBridge] postMessage failed", {
					namespace: context.namespace,
					renderId: context.renderId,
					type: type,
					targetOrigin: targetOrigin,
					error: error && error.message
				});
				bridgeDebug("postMessage:error", {
					type: type,
					error: error && error.message
				});
			}
		}

		function postStorageOp(area, op, payload) {
			postToParent(MSG.OP, {
				area: area,
				op: op,
				seq: ++seq,
				payload: payload || {},
				snapshot: Object.assign({}, state[area])
			});
		}

		function orderedKeys(data) {
			return Object.keys(data);
		}

		function createStorageFacade(area) {
			var data = state[area];
			var api = {
				getItem: function(key) {
					key = String(key);
					return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
				},
				setItem: function(key, value) {
					key = String(key);
					value = String(value);
					data[key] = value;
					postStorageOp(area, "setItem", { key: key, value: value });
				},
				removeItem: function(key) {
					key = String(key);
					delete data[key];
					postStorageOp(area, "removeItem", { key: key });
				},
				clear: function() {
					for (var i = 0, keys = orderedKeys(data); i < keys.length; i++) {
						delete data[keys[i]];
					}
					postStorageOp(area, "clear", {});
				},
				key: function(index) {
					var keys = orderedKeys(data);
					return keys[index] || null;
				}
			};
			Object.defineProperty(api, "length", {
				enumerable: false,
				configurable: true,
				get: function() {
					return orderedKeys(data).length;
				}
			});

			if (typeof Proxy !== "function") return api;
			return new Proxy(api, {
				get: function(target, prop) {
					if (prop in target) return target[prop];
					if (typeof prop === "string") return target.getItem(prop);
					return undefined;
				},
				set: function(target, prop, value) {
					if (typeof prop === "string") target.setItem(prop, value);
					return true;
				},
				deleteProperty: function(target, prop) {
					if (typeof prop === "string") target.removeItem(prop);
					return true;
				},
				ownKeys: function() {
					return orderedKeys(data);
				},
				getOwnPropertyDescriptor: function(_target, prop) {
					if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(data, prop)) {
						return { enumerable: true, configurable: true, value: data[prop] };
					}
					return undefined;
				}
			});
		}

		function parseCookieString(cookieStr) {
			var parts = String(cookieStr || "").split(";");
			var eq = parts[0].indexOf("=");
			if (eq <= 0) return null;
			var expiresAt;
			var maxAge;
			for (var i = 1; i < parts.length; i++) {
				var option = parts[i].trim();
				var optionEq = option.indexOf("=");
				var optionName = (optionEq >= 0 ? option.slice(0, optionEq) : option).trim().toLowerCase();
				var optionValue = optionEq >= 0 ? option.slice(optionEq + 1).trim() : "";
				if (optionName === "max-age" && /^-?[0-9]+$/.test(optionValue)) maxAge = Number(optionValue);
				if (optionName === "expires" && !isNaN(Date.parse(optionValue))) expiresAt = Date.parse(optionValue);
			}
			if (maxAge !== undefined) expiresAt = Date.now() + maxAge * 1000;
			return { name: parts[0].slice(0, eq).trim(), value: decodeURIComponent(parts[0].slice(eq + 1) || ""), expiresAt: expiresAt, remove: expiresAt !== undefined && expiresAt <= Date.now() };
		}

		function formatCookies() {
			Object.keys(state.cookieExpires).forEach(function(name) {
				if (state.cookieExpires[name] <= Date.now()) {
					delete state.cookies[name];
					delete state.cookieExpires[name];
				}
			});
			return Object.keys(state.cookies).map(function(name) { return name + "=" + encodeURIComponent(state.cookies[name]); }).join("; ");
		}

		function setupCookieFacade() {
			try {
				Object.defineProperty(document, "cookie", {
					configurable: true,
					get: function() {
						return formatCookies();
					},
					set: function(cookieString) {
						var parsed = parseCookieString(cookieString);
						if (!parsed || !parsed.name) return cookieString;
						if (parsed.remove) {
							delete state.cookies[parsed.name];
							delete state.cookieExpires[parsed.name];
							postStorageOp("cookies", "removeCookie", { key: parsed.name });
							return cookieString;
						}
						state.cookies[parsed.name] = parsed.value;
						if (parsed.expiresAt !== undefined) state.cookieExpires[parsed.name] = parsed.expiresAt;
						else delete state.cookieExpires[parsed.name];
						postStorageOp("cookies", "setCookie", { key: parsed.name, value: parsed.value, expiresAt: parsed.expiresAt });
						return cookieString;
					}
				});
			} catch (error) {
				console.warn("Virtual cookie storage skipped:", error && error.message);
			}
		}

		function createDomStringList(names) {
			return {
				contains: function(name) { return names.indexOf(name) !== -1; },
				item: function(index) { return names[index] || null; },
				get length() { return names.length; }
			};
		}

		function createKeyRange(type, payload) {
			return Object.assign({
				__magicVirtualKeyRange: true,
				type: type
			}, payload || {});
		}

		function serializeKeyRange(query) {
			if (query === undefined || query === null) return undefined;
			if (query.__magicVirtualKeyRange) return {
				type: query.type,
				value: query.value,
				lower: query.lower,
				upper: query.upper,
				open: query.open,
				lowerOpen: query.lowerOpen,
				upperOpen: query.upperOpen
			};
			if (typeof query === "object" && ("lower" in query || "upper" in query)) {
				if ("lower" in query && "upper" in query) {
					return {
						type: "bound",
						lower: query.lower,
						upper: query.upper,
						lowerOpen: !!query.lowerOpen,
						upperOpen: !!query.upperOpen
					};
				}
				if ("lower" in query) return { type: "lowerBound", lower: query.lower, open: !!query.lowerOpen };
				return { type: "upperBound", upper: query.upper, open: !!query.upperOpen };
			}
			return { type: "only", value: query };
		}

		function setupKeyRangeFacade() {
			try {
				Object.defineProperty(window, "IDBKeyRange", {
					value: {
						only: function(value) {
							return createKeyRange("only", { value: value });
						},
						lowerBound: function(lower, open) {
							return createKeyRange("lowerBound", { lower: lower, open: !!open });
						},
						upperBound: function(upper, open) {
							return createKeyRange("upperBound", { upper: upper, open: !!open });
						},
						bound: function(lower, upper, lowerOpen, upperOpen) {
							return createKeyRange("bound", {
								lower: lower,
								upper: upper,
								lowerOpen: !!lowerOpen,
								upperOpen: !!upperOpen
							});
						}
					},
					writable: false,
					configurable: true
				});
			} catch (error) {
				console.warn("Virtual IDBKeyRange skipped:", error && error.message);
			}
		}

		function createEvent(type, target) {
			var event = new Event(type);
			try {
				Object.defineProperty(event, "target", { value: target, configurable: true });
				Object.defineProperty(event, "currentTarget", { value: target, configurable: true });
			} catch (error) {}
			return event;
		}

		function dispatchEventLike(target, propName, type) {
			var event = createEvent(type, target);
			if (typeof target[propName] === "function") target[propName].call(target, event);
			target.dispatchEvent(event);
		}

		var transactionSeq = 0;
		function transactionPayload(tx) {
			return { dbName: tx.dbName, transactionId: tx.__magicId, transactionMode: tx.mode, transactionStores: tx.__magicStores };
		}
		function abortTransaction(tx, error) {
			if (tx.__magicState !== "active" && tx.__magicState !== "committing") return;
			tx.__magicState = "aborted";
			tx.error = error || null;
			clearTimeout(tx.__magicCommitTimer);
			requestIdb("transactionAbort", transactionPayload(tx)).catch(function() {});
			setTimeout(function() { dispatchEventLike(tx, "onabort", "abort"); }, 0);
		}
		function scheduleTransactionCommit(tx) {
			clearTimeout(tx.__magicCommitTimer);
			tx.__magicCommitTimer = setTimeout(function() {
				if (tx.__magicState !== "active" || tx.__magicPending !== 0) return;
				tx.__magicState = "committing";
				requestIdb("transactionCommit", transactionPayload(tx)).then(function() {
					if (tx.__magicState !== "committing") return;
					tx.__magicState = "complete";
					dispatchEventLike(tx, "oncomplete", "complete");
				}, function(error) { abortTransaction(tx, error); });
			}, 0);
		}
		function assertTransactionActive(tx, writing) {
			if (!tx || !tx.__magicId) return;
			if (tx.__magicState !== "active") throw new DOMException("Transaction is inactive", "TransactionInactiveError");
			if (writing && tx.mode === "readonly") throw new DOMException("Transaction is readonly", "ReadOnlyError");
		}
		function createNormalTransaction(dbName, dbVersion, storeNames, mode) {
			var stores = Array.isArray(storeNames) ? storeNames.map(String) : [String(storeNames)];
			if (!stores.length) throw new DOMException("A transaction requires an object store", "InvalidAccessError");
			if (mode !== undefined && mode !== "readonly" && mode !== "readwrite") throw new TypeError("Invalid transaction mode");
			var tx = new EventTarget();
			tx.__magicId = "transaction_" + (++transactionSeq) + "_" + Date.now();
			tx.__magicState = "active";
			tx.__magicStores = stores;
			tx.__magicPending = 0;
			tx.dbName = dbName;
			tx.mode = mode || "readonly";
			tx.error = null;
			tx.objectStoreNames = createDomStringList(stores);
			tx.oncomplete = null;
			tx.onerror = null;
			tx.onabort = null;
			tx.objectStore = function(name) {
				assertTransactionActive(tx, false);
				name = name || stores[0];
				if (stores.indexOf(name) === -1) throw new DOMException("Object store is outside the transaction scope", "NotFoundError");
				return createObjectStore(dbName, dbVersion, name, tx);
			};
			tx.abort = function() {
				if (tx.__magicState !== "active") throw new DOMException("Transaction is already finished", "InvalidStateError");
				abortTransaction(tx, null);
			};
			scheduleTransactionCommit(tx);
			return tx;
		}

		function trackTransactionPromise(transaction, promise) {
			if (!transaction) return promise;
			if (transaction.__magicId) {
				transaction.__magicPending += 1;
				clearTimeout(transaction.__magicCommitTimer);
				return promise.then(function(result) {
					transaction.__magicPending -= 1;
					if (transaction.__magicState === "aborted") throw new DOMException("Transaction aborted", "AbortError");
					if (transaction.__magicPending === 0) scheduleTransactionCommit(transaction);
					return result;
				}, function(error) {
					transaction.__magicPending -= 1;
					abortTransaction(transaction, error);
					throw error;
				});
			}
			transaction.__magicPending = (transaction.__magicPending || 0) + 1;
			return promise.then(
				function(result) {
					transaction.__magicPending -= 1;
					if (transaction.__magicPending === 0) {
						setTimeout(function() {
							dispatchEventLike(transaction, "oncomplete", "complete");
						}, 0);
					}
					return result;
				},
				function(error) {
					transaction.__magicPending -= 1;
					setTimeout(function() {
						dispatchEventLike(transaction, "onerror", "error");
					}, 0);
					throw error;
				}
			);
		}

		function createUpgradeTransaction(dbName, dbVersion) {
			var transaction = new EventTarget();
			transaction.mode = "versionchange";
			transaction.dbName = dbName;
			transaction.dbVersion = dbVersion;
			transaction.objectStoreNames = createDomStringList([]);
			transaction.oncomplete = null;
			transaction.onerror = null;
			transaction.onabort = null;
			transaction.__magicUpgradePromises = [];
			return transaction;
		}

		function trackUpgradeSchemaPromise(transaction, promise) {
			if (!transaction || !transaction.__magicUpgradePromises) return promise;
			var tracked = trackTransactionPromise(transaction, promise);
			transaction.__magicUpgradePromises.push(tracked);
			return tracked;
		}

		function waitForUpgradeTransaction(transaction) {
			if (!transaction || !transaction.__magicUpgradePromises) return Promise.resolve();
			return Promise.all(transaction.__magicUpgradePromises);
		}

		function createRequestExecutor(executor, transaction) {
			var request = new EventTarget();
			request.result = undefined;
			request.error = null;
			request.onsuccess = null;
			request.onerror = null;
			request.onupgradeneeded = null;

			function fire(type) {
				if (type === "success") dispatchEventLike(request, "onsuccess", type);
				if (type === "error") dispatchEventLike(request, "onerror", type);
				if (type === "upgradeneeded") dispatchEventLike(request, "onupgradeneeded", type);
			}

			Promise.resolve()
				.then(executor)
				.then(function(result) {
					request.result = result;
					try { fire("success"); } catch (error) {
						if (transaction && transaction.__magicId) abortTransaction(transaction, new DOMException("Request success handler threw", "AbortError"));
						else throw error;
					}
				})
				.catch(function(error) {
					request.error = error instanceof Error ? error : new Error(String(error));
					fire("error");
				});

			request.__magicFireUpgrade = fire;
			return request;
		}

		function createCursorRequest(executor, transaction) {
			var request = new EventTarget();
			request.result = undefined;
			request.error = null;
			request.onsuccess = null;
			request.onerror = null;
			var entries = [];
			var index = 0;

			function queueContinuation(count) {
				assertTransactionActive(transaction, false);
				index += count;
				if (transaction && transaction.__magicId) {
					transaction.__magicPending += 1;
					clearTimeout(transaction.__magicCommitTimer);
				}
				setTimeout(function() {
					if (transaction && transaction.__magicId) {
						transaction.__magicPending -= 1;
						if (transaction.__magicState === "aborted") return;
					}
					emitSuccess();
				}, 0);
			}
			function emitSuccess() {
				var entry = entries[index];
				request.result = entry ? {
					key: entry.key,
					primaryKey: entry.primaryKey,
					value: entry.value,
					continue: function() {
						queueContinuation(1);
					},
					advance: function(count) {
						queueContinuation(Math.max(1, Number(count || 1)));
					}
				} : null;
				try { dispatchEventLike(request, "onsuccess", "success"); } catch (error) {
					if (transaction && transaction.__magicId) {
						abortTransaction(transaction, new DOMException("Cursor success handler threw", "AbortError"));
						return;
					}
					throw error;
				}
				if (transaction && transaction.__magicId && transaction.__magicPending === 0) scheduleTransactionCommit(transaction);
			}

			Promise.resolve()
				.then(executor)
				.then(function(result) {
					entries = Array.isArray(result) ? result : [];
					emitSuccess();
				})
				.catch(function(error) {
					request.error = error instanceof Error ? error : new Error(String(error));
					dispatchEventLike(request, "onerror", "error");
				});

			return request;
		}

		function requestIdb(action, payload) {
			return new Promise(function(resolve, reject) {
				if (!context.token) {
					reject(new Error("Virtual IndexedDB persistence is unavailable"));
					return;
				}
				var requestId = "idb_" + (++idbRequestSeq) + "_" + Date.now();
				var timeout = setTimeout(function() {
					window.removeEventListener("message", onMessage);
					reject(new Error("Virtual IndexedDB request timeout"));
				}, 10000);
				function onMessage(event) {
					var data = event.data || {};
					if (context.targetOrigin && context.targetOrigin !== "*" && event.origin !== context.targetOrigin) {
						return;
					}
					if (
						data.protocol === context.protocol &&
						data.type === MSG.IDB_RESPONSE &&
						data.renderId === context.renderId &&
						data.namespace === context.namespace &&
						data.requestId === requestId
					) {
						clearTimeout(timeout);
						window.removeEventListener("message", onMessage);
						if (data.success) resolve(data.result);
						else reject(data.errorName && data.errorName !== "Error" ? new DOMException(data.error || "Virtual IndexedDB request failed", data.errorName) : new Error(data.error || "Virtual IndexedDB request failed"));
					}
				}
				window.addEventListener("message", onMessage);
				postToParent(MSG.IDB_REQUEST, {
					requestId: requestId,
					action: action,
					payload: payload || {}
				});
			});
		}

		function createDatabase(meta, upgradeTransaction) {
			var dbName = meta && meta.name;
			var dbVersion = meta && meta.version || 1;
			var objectStoreNames = meta && meta.objectStores || [];
			return {
				name: dbName,
				version: dbVersion,
				objectStoreNames: createDomStringList(objectStoreNames),
				createObjectStore: function(name, options) {
					if (objectStoreNames.indexOf(name) === -1) objectStoreNames.push(name);
					if (upgradeTransaction) {
						upgradeTransaction.objectStoreNames = createDomStringList(objectStoreNames);
					}
					var schemaPromise = requestIdb("createObjectStore", {
						dbName: dbName,
						version: dbVersion,
						storeName: name,
						options: options || {}
					});
					if (upgradeTransaction) {
						trackUpgradeSchemaPromise(upgradeTransaction, schemaPromise);
					} else {
						schemaPromise.catch(function(error) { console.warn(error && error.message); });
					}
					return createObjectStore(dbName, dbVersion, name, upgradeTransaction);
				},
				transaction: function(storeNames, mode) {
					var names = Array.isArray(storeNames) ? storeNames : [storeNames];
					for (var i = 0; i < names.length; i++) {
						if (objectStoreNames.indexOf(names[i]) === -1) throw new DOMException("Object store not found", "NotFoundError");
					}
					return createNormalTransaction(dbName, dbVersion, storeNames, mode);
				},
				close: function() {}
			};
		}

		function createObjectStore(dbName, dbVersion, storeName, transaction) {
			function executeInTransaction(action, payload) {
				if (transaction && transaction.__magicId) {
					if (transaction.__magicState === "aborted") return Promise.reject(new DOMException("Transaction aborted", "AbortError"));
					payload = Object.assign({}, payload, transactionPayload(transaction));
				}
				return trackTransactionPromise(transaction, requestIdb(action, payload));
			}
			function createIndexFacade(indexName) {
				return {
					name: indexName,
					get: function(query) {
						assertTransactionActive(transaction, false);
						return createRequestExecutor(function() {
							return executeInTransaction("indexGet", {
								dbName: dbName,
								version: dbVersion,
								storeName: storeName,
								indexName: indexName,
								query: serializeKeyRange(query)
							});
						}, transaction);
					},
					getAll: function(query, count) {
					assertTransactionActive(transaction, false);
						return createRequestExecutor(function() {
							return executeInTransaction("indexGetAll", {
								dbName: dbName,
								version: dbVersion,
								storeName: storeName,
								indexName: indexName,
								query: serializeKeyRange(query),
								count: count
							});
						}, transaction);
					},
					count: function(query) {
					assertTransactionActive(transaction, false);
						return createRequestExecutor(function() {
							return executeInTransaction("count", {
								dbName: dbName,
								version: dbVersion,
								storeName: storeName,
								indexName: indexName,
								query: serializeKeyRange(query)
							});
						}, transaction);
					},
					openCursor: function(query, direction) {
					assertTransactionActive(transaction, false);
						return createCursorRequest(function() {
							return executeInTransaction("openCursor", {
								dbName: dbName,
								version: dbVersion,
								storeName: storeName,
								indexName: indexName,
								query: serializeKeyRange(query),
								direction: direction
							});
						}, transaction);
					}
				};
			}
			return {
				name: storeName,
				createIndex: function(indexName, keyPath, options) {
					if (!transaction || transaction.mode !== "versionchange") throw new DOMException("Indexes require an upgrade transaction", "InvalidStateError");
					var schemaPromise = requestIdb("createIndex", {
						dbName: dbName,
						version: dbVersion,
						storeName: storeName,
						indexName: indexName,
						keyPath: keyPath,
						options: options || {}
					});
					if (transaction && transaction.__magicUpgradePromises) {
						trackUpgradeSchemaPromise(transaction, schemaPromise);
					} else {
						schemaPromise.catch(function(error) { console.warn(error && error.message); });
					}
					return createIndexFacade(indexName);
				},
				index: function(indexName) {
					return createIndexFacade(indexName);
				},
				put: function(value, key) {
					assertTransactionActive(transaction, true);
					return createRequestExecutor(function() {
						return executeInTransaction("put", { dbName: dbName, version: dbVersion, storeName: storeName, value: value, key: key });
					}, transaction);
				},
				add: function(value, key) {
					assertTransactionActive(transaction, true);
					return createRequestExecutor(function() {
						return executeInTransaction("add", { dbName: dbName, version: dbVersion, storeName: storeName, value: value, key: key });
					}, transaction);
				},
				get: function(key) {
					assertTransactionActive(transaction, false);
					return createRequestExecutor(function() {
						return executeInTransaction("get", { dbName: dbName, version: dbVersion, storeName: storeName, key: key });
					}, transaction);
				},
				delete: function(key) {
					assertTransactionActive(transaction, true);
					return createRequestExecutor(function() {
						return executeInTransaction("delete", { dbName: dbName, version: dbVersion, storeName: storeName, key: key });
					}, transaction);
				},
				clear: function() {
					assertTransactionActive(transaction, true);
					return createRequestExecutor(function() {
						return executeInTransaction("clear", { dbName: dbName, version: dbVersion, storeName: storeName });
					}, transaction);
				},
				getAll: function(query, count) {
					assertTransactionActive(transaction, false);
					return createRequestExecutor(function() {
						return executeInTransaction("getAll", { dbName: dbName, version: dbVersion, storeName: storeName, query: serializeKeyRange(query), count: count });
					}, transaction);
				},
				count: function(query) {
					assertTransactionActive(transaction, false);
					return createRequestExecutor(function() {
						return executeInTransaction("count", { dbName: dbName, version: dbVersion, storeName: storeName, query: serializeKeyRange(query) });
					}, transaction);
				},
				openCursor: function(query, direction) {
					assertTransactionActive(transaction, false);
					return createCursorRequest(function() {
						return executeInTransaction("openCursor", { dbName: dbName, version: dbVersion, storeName: storeName, query: serializeKeyRange(query), direction: direction });
					}, transaction);
				}
			};
		}

		function setupIndexedDBFacade() {
			try {
				var factory = {
					open: function(name, version) {
						var request = createRequestExecutor(function() {
							return requestIdb("open", { dbName: String(name || ""), version: version }).then(function(meta) {
								var upgradeTransaction = meta && meta.upgraded ? createUpgradeTransaction(String(name || ""), meta.version || version || 1) : null;
								var db = createDatabase(meta, upgradeTransaction);
								request.result = db;
								if (meta && meta.upgraded) {
									request.transaction = upgradeTransaction;
									request.__magicFireUpgrade("upgradeneeded");
									return waitForUpgradeTransaction(upgradeTransaction).then(function() {
										request.transaction = null;
										return db;
									});
								}
								return db;
							});
						});
						return request;
					},
					deleteDatabase: function(name) {
						return createRequestExecutor(function() {
							return requestIdb("deleteDatabase", { dbName: String(name || "") });
						});
					},
					databases: function() {
						return requestIdb("databases", {});
					}
				};
				Object.defineProperty(window, "indexedDB", {
					value: factory,
					writable: false,
					configurable: true
				});
			} catch (error) {
				console.warn("Virtual IndexedDB skipped:", error && error.message);
			}
		}

		try {
			Object.defineProperty(window, "localStorage", {
				value: createStorageFacade("localStorage"),
				writable: false,
				configurable: true
			});
			Object.defineProperty(window, "sessionStorage", {
				value: createStorageFacade("sessionStorage"),
				writable: false,
				configurable: true
			});
		} catch (error) {
			console.warn("Virtual Web Storage skipped:", error && error.message);
		}

		setupCookieFacade();
		setupKeyRangeFacade();
		setupIndexedDBFacade();
	})();
	`
}

export function resetVirtualStorageForTests(): void {
	memoryStore = new Map()
	dbPromise = null
	debugEvents = []
	namespaceOperationQueues = new Map()
	indexedDBSchemaRepairRequests = new Set()
	indexedDBTransactions.reset()
	legacyMigrationChecked = new Set()
	const debugGlobal = getDebugGlobal()
	if (debugGlobal) debugGlobal.__MAGIC_HTML_VIRTUAL_STORAGE_DEBUG_LOGS__ = []
	virtualStorageRegistry.reset()
}
