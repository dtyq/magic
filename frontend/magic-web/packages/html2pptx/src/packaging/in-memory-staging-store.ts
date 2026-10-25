import type { MediaSourceDescriptor } from "../media/source-descriptor"
import type { StreamingStagingOperationOptions, StreamingStagingStore } from "../runtime"
import { throwIfAborted, withAbort } from "../sandbox/abort"

export interface InMemoryStreamingStagingStoreOptions {
	/** Optional fetch adapter used by tests and non-window runtimes. */
	fetch?: typeof globalThis.fetch
}

interface InMemoryStagingSession {
	slides: Map<number, unknown>
	media: Map<string, MediaSourceDescriptor>
}

/**
 * Heap-backed staging for browsers that cannot use OPFS.
 *
 * This store only replaces the replay boundary. It does not package slides or
 * materialize media, so every replayed record still crosses the normal
 * Packaging Worker and host-provided media hooks.
 */
export function createInMemoryStreamingStagingStore(
	options: InMemoryStreamingStagingStoreOptions = {},
): StreamingStagingStore {
	let activeSessionId: string | undefined
	let activeSession: InMemoryStagingSession | undefined

	const requireSession = (): InMemoryStagingSession => {
		if (!activeSessionId || !activeSession) {
			throw new Error("In-memory staging session has not been created")
		}
		return activeSession
	}

	return {
		stagingKind: "memory",
		async createSession(sessionId, operationOptions = {}) {
			throwIfAborted(operationOptions.signal)
			if (typeof sessionId !== "string" || !sessionId.trim()) {
				throw new TypeError("In-memory staging sessionId must be a non-empty string")
			}
			activeSessionId = sessionId
			activeSession = { slides: new Map(), media: new Map() }
			throwIfAborted(operationOptions.signal)
		},

		async stage(source, stageOptions = {}) {
			throwIfAborted(stageOptions.signal)
			const session = requireSession()
			const cached = session.media.get(source.key)
			if (cached) return cached

			let staged: MediaSourceDescriptor
			switch (source.kind) {
				case "blob":
					staged = source
					break
				case "bytes":
					// Snapshot caller-owned bytes immediately. Worker transfer may detach
					// the original ArrayBuffer after the first replay.
					if (!(source.data instanceof ArrayBuffer)) {
						throw new TypeError(
							`Media source "${source.key}" bytes are not an ArrayBuffer`,
						)
					}
					staged = { ...source, data: source.data.slice(0) }
					break
				case "url":
					staged = await fetchAsBlobDescriptor(
						source,
						source.url,
						options.fetch,
						stageOptions,
					)
					break
				case "path":
					staged = await fetchAsBlobDescriptor(
						source,
						source.path,
						options.fetch,
						stageOptions,
					)
					break
				case "opfs":
					throw new TypeError(
						`In-memory staging cannot read OPFS media source "${source.key}"`,
					)
			}

			throwIfAborted(stageOptions.signal)
			session.media.set(source.key, staged)
			return staged
		},

		async putSlideIr(slideIndex, value, operationOptions = {}) {
			validateSlideIndex(slideIndex)
			throwIfAborted(operationOptions.signal)
			const cloned = cloneStagedValue(value)
			throwIfAborted(operationOptions.signal)
			requireSession().slides.set(slideIndex, cloned)
		},

		async getSlideIr<T>(
			slideIndex: number,
			operationOptions: StreamingStagingOperationOptions = {},
		): Promise<T> {
			validateSlideIndex(slideIndex)
			throwIfAborted(operationOptions.signal)
			const slides = requireSession().slides
			if (!slides.has(slideIndex)) {
				throw new Error(`In-memory SlideIR ${slideIndex} was not found`)
			}
			const cloned = cloneStagedValue(slides.get(slideIndex)) as T
			throwIfAborted(operationOptions.signal)
			return cloned
		},

		async deleteSlideIr(slideIndex, operationOptions = {}) {
			validateSlideIndex(slideIndex)
			throwIfAborted(operationOptions.signal)
			requireSession().slides.delete(slideIndex)
			throwIfAborted(operationOptions.signal)
		},

		async cleanupSession(sessionId) {
			if (sessionId !== activeSessionId) return
			activeSession?.slides.clear()
			activeSession?.media.clear()
			activeSession = undefined
			activeSessionId = undefined
		},
	}
}

async function fetchAsBlobDescriptor(
	source: Extract<MediaSourceDescriptor, { kind: "url" | "path" }>,
	resource: string,
	fetchAdapter: typeof globalThis.fetch | undefined,
	options: {
		signal?: AbortSignal
		onProgress?: (loaded: number, total?: number) => void
	},
): Promise<MediaSourceDescriptor> {
	throwIfAborted(options.signal)
	const activeFetch = fetchAdapter ?? globalThis.fetch
	if (typeof activeFetch !== "function") {
		throw new TypeError(`Cannot stage media source "${source.key}": fetch is unavailable`)
	}

	const response = await withAbort({
		task: Promise.resolve().then(() => activeFetch(resource, { signal: options.signal })),
		signal: options.signal,
	})
	throwIfAborted(options.signal)
	if (!response.ok) {
		throw new Error(
			`Unable to stage media source "${source.key}" from "${resource}": HTTP ${response.status}`,
		)
	}

	const responseBlob = await withAbort({
		task: Promise.resolve().then(() => response.blob()),
		signal: options.signal,
	})
	throwIfAborted(options.signal)
	const blob =
		responseBlob.type === source.contentType
			? responseBlob
			: responseBlob.slice(0, responseBlob.size, source.contentType)
	if (source.size !== undefined && blob.size !== source.size) {
		throw new RangeError(
			`Staged media size mismatch (${blob.size} !== ${source.size}) for "${source.key}"`,
		)
	}
	options.onProgress?.(blob.size, source.size ?? blob.size)
	return {
		kind: "blob",
		blob,
		size: blob.size,
		key: source.key,
		contentType: source.contentType,
		extn: source.extn,
		metadataOrigin: source.metadataOrigin,
	}
}

function validateSlideIndex(value: number): void {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new RangeError("slideIndex must be a positive safe integer")
	}
}

/** Structured clone preserves Blob/ArrayBuffer records without JSON data loss. */
function cloneStagedValue<T>(value: T): T {
	if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value)
	return cloneStagedValueFallback(value, new WeakMap<object, unknown>())
}

function cloneStagedValueFallback<T>(value: T, seen: WeakMap<object, unknown>): T {
	if (value === null || typeof value !== "object") return value
	const existing = seen.get(value)
	if (existing !== undefined) return existing as T
	if (value instanceof ArrayBuffer) return value.slice(0) as T
	if (typeof Blob !== "undefined" && value instanceof Blob) {
		return value.slice(0, value.size, value.type) as T
	}
	if (Array.isArray(value)) {
		const clone: unknown[] = []
		seen.set(value, clone)
		for (const entry of value) clone.push(cloneStagedValueFallback(entry, seen))
		return clone as T
	}

	const clone: Record<PropertyKey, unknown> = {}
	seen.set(value, clone)
	for (const key of Reflect.ownKeys(value)) {
		clone[key] = cloneStagedValueFallback((value as Record<PropertyKey, unknown>)[key], seen)
	}
	return clone as T
}
