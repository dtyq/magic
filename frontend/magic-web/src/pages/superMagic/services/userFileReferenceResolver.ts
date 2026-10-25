import { reaction } from "mobx"
import { SuperMagicApi } from "@/apis"
import type { FileReferenceResult, FileReferenceSelector } from "@/apis/modules/superMagic"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"

// 与服务端单批查询上限一致；短缓存只合并当前交互，不长期保存权限或文件路径。
const MAX_REFERENCES = 500
const CACHE_TTL_MS = 30_000

interface PendingReference {
	generation: number
	selector: FileReferenceSelector
	promise: Promise<FileReferenceResult>
	resolve: (result: FileReferenceResult) => void
	reject: (reason: unknown) => void
}

interface CachedReference {
	result: FileReferenceResult
	expiresAt: number
}

export function getFileReferenceIdentityKey(): string | null {
	const user = userStore.user.userInfo
	const organization = userStore.user.organizationCode || user?.organization_code
	if (!user?.user_id || !organization) return null
	return JSON.stringify([configStore.cluster.clusterCode || "global", organization, user.user_id])
}

function selectorKey(selector: FileReferenceSelector): string {
	return "file_id" in selector ? "id:" + selector.file_id : "user:" + selector.space_relative_path
}

function cancelled(): DOMException {
	return new DOMException("File reference request cancelled", "AbortError")
}

class UserFileReferenceResolver {
	private identity: string | null = null
	private generation = 0
	private controller = new AbortController()
	private pending = new Map<string, PendingReference>()
	private queued = new Map<string, PendingReference>()
	private cache = new Map<string, CachedReference>()

	constructor() {
		reaction(getFileReferenceIdentityKey, (identity) => this.activateIdentity(identity))
	}

	resolve(selector: FileReferenceSelector, signal?: AbortSignal): Promise<FileReferenceResult> {
		this.activateIdentity(getFileReferenceIdentityKey())
		if (signal?.aborted) return Promise.reject(cancelled())
		if (!this.identity) return Promise.resolve({ status: "unavailable" })

		const key = selectorKey(selector)
		const cached = this.cache.get(key)
		if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result)
		this.cache.delete(key)

		let pending = this.pending.get(key)
		if (!pending) {
			let resolve!: PendingReference["resolve"]
			let reject!: PendingReference["reject"]
			const promise = new Promise<FileReferenceResult>((onResolve, onReject) => {
				resolve = onResolve
				reject = onReject
			})
			pending = { selector, promise, resolve, reject, generation: this.generation }
			this.pending.set(key, pending)
			this.queued.set(key, pending)
			if (this.queued.size === 1) queueMicrotask(() => this.flush())
		}
		return this.withCancellation(pending.promise, signal)
	}

	invalidate(): void {
		this.generation += 1
		// 已排队的旧读取仍完成各自的 Promise；新的操作不能复用它们或重新缓存旧路径。
		void this.flush()
		this.pending.clear()
		this.cache.clear()
	}

	private activateIdentity(identity: string | null): void {
		if (identity === this.identity) return
		this.controller.abort()
		this.controller = new AbortController()
		this.identity = identity
		this.cache.clear()
		for (const pending of this.pending.values()) pending.reject(cancelled())
		this.pending.clear()
		this.queued.clear()
	}

	private async flush(): Promise<void> {
		const identity = this.identity
		const signal = this.controller.signal
		const entries = [...this.queued.entries()]
		this.queued.clear()
		for (let offset = 0; offset < entries.length; offset += MAX_REFERENCES) {
			const batch = entries.slice(offset, offset + MAX_REFERENCES)
			try {
				if (signal.aborted) throw cancelled()
				const { results } = await SuperMagicApi.resolveFileReferences(
					batch.map(([, pending]) => pending.selector),
					signal,
				)
				if (signal.aborted || identity !== getFileReferenceIdentityKey()) throw cancelled()
				if (results.length !== batch.length)
					throw new Error("Invalid file reference response")

				batch.forEach(([key, pending], index) => {
					const result = results[index]
					// 不缓存失败；恢复权限或创建文件后的下一次查询可以立即生效。
					if (result.status === "resolved" && pending.generation === this.generation) {
						this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS })
						while (this.cache.size > MAX_REFERENCES) {
							const oldest = this.cache.keys().next().value
							if (oldest !== undefined) this.cache.delete(oldest)
						}
					}
					pending.resolve(result)
				})
			} catch (error) {
				batch.forEach(([, pending]) => pending.reject(error))
			} finally {
				batch.forEach(([key, pending]) => {
					if (this.pending.get(key) === pending) this.pending.delete(key)
				})
			}
		}
	}

	private withCancellation(
		promise: Promise<FileReferenceResult>,
		signal?: AbortSignal,
	): Promise<FileReferenceResult> {
		if (!signal) return promise
		return new Promise((resolve, reject) => {
			const onAbort = () => reject(cancelled())
			signal.addEventListener("abort", onAbort, { once: true })
			promise
				.then(resolve, reject)
				.finally(() => signal.removeEventListener("abort", onAbort))
		})
	}
}

const resolver = new UserFileReferenceResolver()

export function resolveFileReference(
	selector: FileReferenceSelector,
	signal?: AbortSignal,
): Promise<FileReferenceResult> {
	return resolver.resolve(selector, signal)
}

export function invalidateFileReferenceCache(): void {
	resolver.invalidate()
}
