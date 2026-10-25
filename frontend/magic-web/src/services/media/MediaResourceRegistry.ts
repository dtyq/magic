import { useCallback, useEffect, useSyncExternalStore } from "react"
import type {
	MediaResourceRef,
	MediaResourceResolveResult,
	MediaResourceResolver,
	MediaResourceRendition,
	MediaResourceSnapshot,
} from "./MediaResourceTypes"

export type {
	MediaResourceProvider,
	MediaResourceRef,
	MediaResourceResolveResult,
	MediaResourceResolver,
	MediaResourceRendition,
	MediaResourceSnapshot,
	MediaResourceStatus,
} from "./MediaResourceTypes"

const URL_EXPIRY_SAFETY_WINDOW_MS = 30_000
const MAX_IDLE_ENTRIES = 256
const EMPTY_SNAPSHOT: MediaResourceSnapshot = Object.freeze({ identity: "", status: "idle" })

interface RegistryEntry {
	snapshot: MediaResourceSnapshot
	listeners: Set<() => void>
	inFlight: Partial<Record<MediaResourceRendition, Promise<void>>>
	controllers: Partial<Record<MediaResourceRendition, AbortController>>
	refCount: number
	lastAccessAt: number
}

function now() {
	return Date.now()
}

function normalizeExpiry(value: string | number | undefined): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null
	if (!value) return null
	const parsed = Date.parse(value.includes(" ") ? value.replace(" ", "T") : value)
	return Number.isFinite(parsed) ? parsed : null
}

function isExpired(snapshot: MediaResourceSnapshot): boolean {
	const expiresAt = normalizeExpiry(snapshot.expiresAt)
	return expiresAt !== null && expiresAt - now() <= URL_EXPIRY_SAFETY_WINDOW_MS
}

function buildKey(ref: MediaResourceRef): string {
	const baseKey = [ref.provider, ref.projectId ?? "", ref.identity, ref.mediaType].join("|")
	const versionKey = [ref.fileVersion ?? "", ref.updatedAt ?? "", ref.resourceVersion ?? ""].join(
		"|",
	)
	const hasVersion = Boolean(
		ref.fileVersion !== undefined || ref.updatedAt || ref.resourceVersion,
	)
	const scopedKey = hasVersion ? `${baseKey}|version:${versionKey}` : baseKey
	return ref.scope?.trim() ? `${scopedKey}|scope:${ref.scope.trim()}` : scopedKey
}

function createIdleSnapshot(identity: string): MediaResourceSnapshot {
	return { identity, status: "idle" }
}

function emit(entry: RegistryEntry) {
	entry.listeners.forEach((listener) => listener())
}

function mergeSnapshot(
	previous: MediaResourceSnapshot,
	result: MediaResourceResolveResult,
	identity: string,
): MediaResourceSnapshot {
	const definedResult = Object.fromEntries(
		Object.entries(result).filter(([, value]) => value !== undefined),
	) as MediaResourceResolveResult

	return {
		...previous,
		...definedResult,
		identity,
		status: definedResult.status ?? "ready",
	}
}

function hasRendition(
	ref: MediaResourceRef,
	snapshot: MediaResourceSnapshot,
	rendition: MediaResourceRendition,
) {
	if (rendition === "thumbnail") {
		return Boolean(snapshot.thumbnailUrl || (ref.mediaType === "video" && snapshot.posterUrl))
	}
	return Boolean(snapshot.previewUrl || snapshot.audioUrl)
}

class MediaResourceRegistry {
	private readonly entries = new Map<string, RegistryEntry>()

	private getOrCreateEntry(ref: MediaResourceRef): RegistryEntry {
		const key = buildKey(ref)
		const existing = this.entries.get(key)
		if (existing) {
			existing.lastAccessAt = now()
			return existing
		}

		const entry: RegistryEntry = {
			snapshot: createIdleSnapshot(ref.identity),
			listeners: new Set(),
			inFlight: {},
			controllers: {},
			refCount: 0,
			lastAccessAt: now(),
		}
		this.entries.set(key, entry)
		this.evictIdleEntries()
		return entry
	}

	private evictIdleEntries() {
		if (this.entries.size <= MAX_IDLE_ENTRIES) return
		const candidates = [...this.entries.entries()]
			.filter(([, entry]) => entry.refCount === 0 && Object.keys(entry.inFlight).length === 0)
			.sort(([, left], [, right]) => left.lastAccessAt - right.lastAccessAt)
		while (this.entries.size > MAX_IDLE_ENTRIES && candidates.length > 0) {
			const candidate = candidates.shift()
			if (!candidate) break
			const [key] = candidate
			this.entries.delete(key)
		}
	}

	getSnapshot(ref: MediaResourceRef): MediaResourceSnapshot {
		return this.getOrCreateEntry(ref).snapshot
	}

	/**
	 * Publish a provider-owned snapshot without starting a request. Canvas
	 * resource managers use this to expose their existing lifecycle/cache through
	 * the shared facade while retaining their own release semantics.
	 */
	prime(
		ref: MediaResourceRef,
		snapshot: Partial<MediaResourceSnapshot>,
		options: { cancelPending?: boolean } = {},
	) {
		const entry = this.getOrCreateEntry(ref)
		if (options.cancelPending) {
			// 获取层开始强制续期时终止旧请求，保留当前快照，旧响应不能覆盖新地址。
			Object.values(entry.controllers).forEach((controller) => controller?.abort())
			entry.controllers = {}
			entry.inFlight = {}
		}
		const next: MediaResourceSnapshot = {
			...snapshot,
			identity: ref.identity,
			status: snapshot.status ?? "ready",
		}
		const unchanged = Object.keys(next).every(
			(key) =>
				next[key as keyof MediaResourceSnapshot] ===
				entry.snapshot[key as keyof MediaResourceSnapshot],
		)
		if (unchanged && Object.keys(entry.snapshot).length === Object.keys(next).length) return
		entry.snapshot = next
		emit(entry)
	}

	subscribe(ref: MediaResourceRef, listener: () => void): () => void {
		const entry = this.getOrCreateEntry(ref)
		entry.listeners.add(listener)
		entry.refCount += 1
		return () => {
			entry.listeners.delete(listener)
			entry.refCount = Math.max(0, entry.refCount - 1)
			entry.lastAccessAt = now()
			this.evictIdleEntries()
		}
	}

	retain(ref: MediaResourceRef) {
		this.getOrCreateEntry(ref).refCount += 1
	}

	release(ref: MediaResourceRef) {
		const entry = this.entries.get(buildKey(ref))
		if (!entry) return
		entry.refCount = Math.max(0, entry.refCount - 1)
		entry.lastAccessAt = now()
		this.evictIdleEntries()
	}

	async ensure(
		ref: MediaResourceRef,
		rendition: MediaResourceRendition,
		resolver: MediaResourceResolver,
	): Promise<void> {
		const entry = this.getOrCreateEntry(ref)
		if (hasRendition(ref, entry.snapshot, rendition) && !isExpired(entry.snapshot)) return

		const existing = entry.inFlight[rendition]
		if (existing) return existing

		entry.controllers[rendition]?.abort()
		const controller = new AbortController()
		entry.controllers[rendition] = controller
		entry.snapshot = {
			...entry.snapshot,
			status: "loading",
			errorCode: undefined,
		}
		if (rendition === "thumbnail") {
			delete entry.snapshot.thumbnailUrl
			delete entry.snapshot.posterUrl
		} else {
			delete entry.snapshot.previewUrl
			delete entry.snapshot.audioUrl
		}
		emit(entry)

		const pending = resolver(ref, rendition, controller.signal)
			.then((result) => {
				if (controller.signal.aborted) return
				if (!result) {
					entry.snapshot = {
						...entry.snapshot,
						status: "error",
						errorCode: "empty-result",
					}
					emit(entry)
					return
				}
				entry.snapshot = mergeSnapshot(entry.snapshot, result, ref.identity)
				emit(entry)
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return
				const status =
					error instanceof Error && error.name === "AbortError" ? "error" : "error"
				entry.snapshot = {
					...entry.snapshot,
					status,
					errorCode:
						error instanceof Error ? error.name || "resolve-failed" : "resolve-failed",
				}
				emit(entry)
			})
			.finally(() => {
				if (entry.inFlight[rendition] === pending) delete entry.inFlight[rendition]
				if (entry.controllers[rendition] === controller) delete entry.controllers[rendition]
				entry.lastAccessAt = now()
				this.evictIdleEntries()
			})

		entry.inFlight[rendition] = pending
		return pending
	}

	ensureThumbnail(ref: MediaResourceRef, resolver: MediaResourceResolver) {
		return this.ensure(ref, "thumbnail", resolver)
	}

	ensurePreview(ref: MediaResourceRef, resolver: MediaResourceResolver) {
		return this.ensure(ref, "preview", resolver)
	}

	invalidate(ref: MediaResourceRef) {
		const key = buildKey(ref)
		const entry = this.entries.get(key)
		if (!entry) return
		Object.values(entry.controllers).forEach((controller) => controller?.abort())
		entry.snapshot = { identity: ref.identity, status: "expired" }
		emit(entry)
	}

	clearScope(scope: { provider?: string; projectId?: string }) {
		for (const [key, entry] of this.entries) {
			const [provider, projectId] = key.split("|")
			if (scope.provider && provider !== scope.provider) continue
			if (scope.projectId && projectId !== scope.projectId) continue
			Object.values(entry.controllers).forEach((controller) => controller?.abort())
			this.entries.delete(key)
			emit(entry)
			entry.listeners.clear()
		}
	}

	clear() {
		const entries = [...this.entries.values()]
		this.entries.clear()
		for (const entry of entries) {
			Object.values(entry.controllers).forEach((controller) => controller?.abort())
			emit(entry)
			entry.listeners.clear()
		}
	}
}

export const mediaResourceRegistry = new MediaResourceRegistry()

export function useMediaResourceSnapshot(
	ref: MediaResourceRef | null,
	options: {
		enabled?: boolean
		loadThumbnail?: boolean
		resolver: MediaResourceResolver
	},
) {
	const enabled = options.enabled ?? true
	const loadThumbnail = options.loadThumbnail ?? true
	const key = ref ? buildKey(ref) : "media-resource-empty"
	const subscribe = useCallback(
		(listener: () => void) =>
			ref ? mediaResourceRegistry.subscribe(ref, listener) : () => undefined,
		[ref],
	)
	const getSnapshot = useCallback(
		() => (ref ? mediaResourceRegistry.getSnapshot(ref) : EMPTY_SNAPSHOT),
		[ref],
	)
	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	const resolver = options.resolver
	const loadPreview = useCallback(
		() => (ref ? mediaResourceRegistry.ensurePreview(ref, resolver) : Promise.resolve()),
		[ref, resolver],
	)

	useEffect(() => {
		// Keep the thumbnail policy opt-in so audio and offscreen video mentions do not resolve URLs.
		if (!enabled || !loadThumbnail || !ref) return
		void mediaResourceRegistry.ensureThumbnail(ref, resolver)
	}, [enabled, loadThumbnail, ref, resolver])

	return {
		key,
		snapshot,
		loadPreview,
	}
}

export const mediaResourceRegistryTestUtils = {
	buildKey,
	normalizeExpiry,
	isExpired,
	MAX_IDLE_ENTRIES,
	EMPTY_SNAPSHOT,
}
