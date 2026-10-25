import { MagicFSApi, SuperMagicApi } from "@/apis"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"

export type PPTFileMutationErrorKind = "conflict" | "unknown" | "failed" | "stale"

export class PPTFileMutationError extends Error {
	constructor(public readonly kind: PPTFileMutationErrorKind) {
		super(`PPT file mutation: ${kind}`)
		this.name = "PPTFileMutationError"
	}
}

export interface PPTFileSnapshot {
	readonly fileId: string
	readonly content: string
	readonly revision: number
}

const CONFLICT_CODE = 51152
const SNAPSHOT_ATTEMPTS = 3

/**
 * This client detects changes before submission and uses the existing revision
 * check. Metadata and OSS content are separate writes on the server: neither
 * double reads nor this client serialize AGFS, AI, or legacy direct uploads.
 * Each client belongs to one session identity and one editor lifecycle.
 */
export function createPPTFileMutationClient(
	fileApi: FileApi,
	{ isCurrent }: { isCurrent: () => boolean },
) {
	const snapshots = new WeakSet<PPTFileSnapshot>()
	const pending = new Map<string, Promise<unknown>>()
	const identityKey = fileApi.identityKey

	function assertCurrent(signal?: AbortSignal) {
		if (!identityKey.startsWith("session:") || !isCurrent())
			throw new PPTFileMutationError("stale")
		if (signal?.aborted) throw new DOMException("Read cancelled", "AbortError")
	}

	async function read(fileId: string, signal?: AbortSignal): Promise<PPTFileSnapshot> {
		for (let attempt = 0; attempt < SNAPSHOT_ATTEMPTS; attempt += 1) {
			assertCurrent(signal)
			const before = (await MagicFSApi.getFileInfo(fileId, { signal })).file
			assertCurrent(signal)
			const content = await fileApi.getFileContentById(fileId, {
				responseType: "text",
				forceRefresh: true,
				signal,
			})
			assertCurrent(signal)
			const after = (await MagicFSApi.getFileInfo(fileId, { signal })).file
			assertCurrent(signal)
			if (
				before.id !== fileId ||
				after.id !== fileId ||
				typeof content !== "string" ||
				!Number.isSafeInteger(after.version) ||
				after.version <= 0
			)
				throw new PPTFileMutationError("failed")
			if (before.version === after.version) {
				const snapshot = Object.freeze({ fileId, content, revision: after.version })
				snapshots.add(snapshot)
				return snapshot
			}
		}
		throw new PPTFileMutationError("conflict")
	}

	async function confirmUnknown(
		snapshot: PPTFileSnapshot,
		content: string,
	): Promise<{ revision: number }> {
		try {
			const current = await read(snapshot.fileId)
			// Content can become visible before metadata is committed. Require both
			// the requested content and a newer revision before reporting completion.
			if (current.content === content && current.revision > snapshot.revision)
				return { revision: current.revision }
		} catch {
			// A failed read or changed identity cannot prove that an in-flight write failed.
		}
		throw new PPTFileMutationError("unknown")
	}

	async function performSave(snapshot: PPTFileSnapshot, content: string) {
		assertCurrent()
		if (!snapshots.has(snapshot)) throw new PPTFileMutationError("stale")
		const current = await read(snapshot.fileId)
		if (current.revision !== snapshot.revision || current.content !== snapshot.content)
			throw new PPTFileMutationError("conflict")
		assertCurrent()
		if (content === current.content) return { revision: current.revision }
		return submit(snapshot, content)
	}

	async function submit(snapshot: PPTFileSnapshot, content: string) {
		let response
		try {
			// Never refresh the revision and reuse old derived content. The original
			// snapshot is the editing baseline even after the preflight succeeds.
			response = await SuperMagicApi.saveFileContent([
				{ file_id: snapshot.fileId, content, expected_revision: snapshot.revision },
			])
		} catch {
			return confirmUnknown(snapshot, content)
		}

		// Submitted requests settle even after navigation. Callers must separately
		// guard their view updates; cancellation cannot roll back a server write.
		const failure = response?.error_files?.find((file) => file.file_id === snapshot.fileId)
		if (failure)
			throw new PPTFileMutationError(
				failure.error_code === CONFLICT_CODE ? "conflict" : "failed",
			)
		const saved = response?.success_files?.find((file) => file.file_id === snapshot.fileId)
		if (!saved) return confirmUnknown(snapshot, content)
		const revision = saved.data.revision
		if (
			typeof revision !== "number" ||
			!Number.isSafeInteger(revision) ||
			revision <= snapshot.revision
		)
			return confirmUnknown(snapshot, content)
		return { revision }
	}

	function enqueue(fileId: string, operation: () => Promise<{ revision: number }>) {
		// Serialize only this client's file operations. This is not a cross-tab lock.
		const previous = pending.get(fileId) ?? Promise.resolve()
		const result = previous.catch(() => undefined).then(operation)
		pending.set(fileId, result)
		void result
			.finally(() => {
				if (pending.get(fileId) === result) pending.delete(fileId)
			})
			.catch(() => undefined)
		return result
	}

	function save(snapshot: PPTFileSnapshot, content: string): Promise<{ revision: number }> {
		return enqueue(snapshot.fileId, () => performSave(snapshot, content))
	}

	/** Only pass a node returned by createFile(ignore_duplicate: false). An empty
	 * node has no readable OSS object yet; check its identity and metadata instead.
	 */
	function initializeCreatedFile(fileId: string, content: string): Promise<{ revision: number }> {
		return enqueue(fileId, async () => {
			assertCurrent()
			const { file } = await MagicFSApi.getFileInfo(fileId)
			assertCurrent()
			if (
				file.id !== fileId ||
				file.is_directory ||
				file.size !== 0 ||
				!Number.isSafeInteger(file.version) ||
				file.version <= 0
			)
				throw new PPTFileMutationError("conflict")
			return submit({ fileId, content: "", revision: file.version }, content)
		})
	}

	return { read, save, initializeCreatedFile }
}
