import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	clearAllFileInfoCache,
	cleanupFileInfoCache,
	getFileInfoById,
	getFileInfoByPath,
	getFileResourceMetaByPath,
	setFileInfoCache,
} from "../designFileInfoCache"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

function fileItem(
	partial: Partial<FileItem> & Pick<FileItem, "file_id">,
): FileItem & { relative_file_path: string } {
	return {
		is_directory: false,
		relative_file_path: "",
		file_name: "",
		...partial,
	}
}

function deferred<T>(): {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (error: Error) => void
} {
	let resolve!: (value: T) => void
	let reject!: (error: Error) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

describe("getFileResourceMetaByPath", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
		clearAllFileInfoCache()
	})

	afterEach(() => {
		vi.useRealTimers()
		clearAllFileInfoCache()
	})

	it("returns metadata-only resource version without fetching a signed url", async () => {
		const files = [
			fileItem({
				file_id: "file-1",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				updated_at: "2026-06-05 10:00:00",
				file_size: 1024,
			}),
		]

		const meta = await getFileResourceMetaByPath("images/a.png", files)

		expect(meta).toMatchObject({
			status: "exists",
			fileName: "a.png",
			resourceVersion: "file-1:2026-06-05 10:00:00:1024",
			updatedAt: "2026-06-05 10:00:00",
			contentLength: 1024,
		})
		expect(meta).not.toHaveProperty("file_id")
	})

	it("returns deleted only when an attachment snapshot exists", async () => {
		const files = [
			fileItem({
				file_id: "file-1",
				relative_file_path: "images/a.png",
			}),
		]

		await expect(getFileResourceMetaByPath("images/missing.png", files)).resolves.toEqual({
			status: "deleted",
		})
		await expect(getFileResourceMetaByPath("images/missing.png", [])).resolves.toEqual({
			status: "unknown",
		})
		await expect(
			getFileResourceMetaByPath("images/missing.png", [], {
				hasAttachmentSnapshot: true,
			}),
		).resolves.toEqual({
			status: "deleted",
		})
	})

	it("treats a fresh optimistic upload as existing before attachments catch up", async () => {
		const oldFiles = [
			fileItem({
				file_id: "file-existing",
				relative_file_path: "images/existing.png",
				file_name: "existing.png",
			}),
		]
		setFileInfoCache(
			"/images/uploaded.png",
			{
				src: "https://example.test/uploaded.png?signature=1",
				fileName: "uploaded.png",
				resource_version: "file-uploaded:2026-07-21 10:00:00:2048",
				updated_at: "2026-07-21 10:00:00",
				content_length: 2048,
			},
			oldFiles,
			undefined,
			"project-1",
			undefined,
			{ allowMissingAttachment: true },
		)

		await expect(
			getFileResourceMetaByPath("/images/uploaded.png", oldFiles, {
				designProjectId: "project-1",
				hasAttachmentSnapshot: true,
			}),
		).resolves.toEqual({
			status: "exists",
			fileName: "uploaded.png",
			resourceVersion: "file-uploaded:2026-07-21 10:00:00:2048",
			updatedAt: "2026-07-21 10:00:00",
			contentLength: 2048,
		})
	})

	it("does not classify an ambiguous historical bare path as deleted", async () => {
		const files = [
			fileItem({
				file_id: "canvas-file",
				relative_file_path: "画布A/images/a.png",
			}),
			fileItem({
				file_id: "workspace-file",
				relative_file_path: "images/a.png",
			}),
		]

		await expect(
			getFileResourceMetaByPath("images/a.png", files, {
				designProjectBasePath: "画布A",
				hasAttachmentSnapshot: true,
			}),
		).resolves.toEqual({ status: "unknown" })
	})

	it("does not read an explicit-path cache while a legacy bare path awaits attachment evidence", async () => {
		setFileInfoCache(
			"/images/a.png",
			{
				src: "https://example.test/root-a.png",
				fileName: "a.png",
			},
			[],
			"画布A",
			"project-1",
			undefined,
			{ allowMissingAttachment: true },
		)

		await expect(
			getFileInfoByPath("images/a.png", [], {
				designProjectBasePath: "画布A",
				designProjectId: "project-1",
				hasAttachmentSnapshot: false,
			}),
		).resolves.toBeNull()
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("respects explicit pending readiness even when an incremental attachment batch is non-empty", async () => {
		const partialFiles = [
			fileItem({
				file_id: "unrelated-file",
				relative_file_path: "画布A/images/unrelated.png",
				file_name: "unrelated.png",
			}),
		]

		await expect(
			getFileResourceMetaByPath("./images/missing.png", partialFiles, {
				designProjectBasePath: "画布A",
				hasAttachmentSnapshot: false,
			}),
		).resolves.toEqual({ status: "unknown" })
	})

	it("does not prime either resource cache from an ambiguous historical bare path", async () => {
		const files = [
			fileItem({
				file_id: "canvas-file",
				relative_file_path: "画布A/images/a.png",
				file_name: "a.png",
			}),
			fileItem({
				file_id: "workspace-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
			}),
		]
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "canvas-file",
				url: "https://example.test/canvas-a.png",
			},
		])

		setFileInfoCache(
			"images/a.png",
			{
				src: "https://example.test/ambiguous.png",
				fileName: "a.png",
			},
			files,
			"画布A",
			"project-1",
			undefined,
			{ hasAttachmentSnapshot: true },
		)

		await expect(
			getFileInfoByPath("./images/a.png", files, {
				designProjectBasePath: "画布A",
				designProjectId: "project-1",
				hasAttachmentSnapshot: true,
				priority: "critical",
			}),
		).resolves.toMatchObject({ src: "https://example.test/canvas-a.png" })
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("preserves raw get-file-url version but uses metadata-visible version for comparison", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-2",
				url: "https://example.test/b.png?signature=1",
				expires_at: "2026-06-05 17:10:30",
				version: "object-version-1",
				updated_at: "2026-06-05 10:00:00",
			},
		])

		const fileInfo = await getFileInfoById("file-2", "b.png", 2048)

		expect(fileInfo).toMatchObject({
			src: "https://example.test/b.png?signature=1",
			fileName: "b.png",
			file_id: "file-2",
			version: "object-version-1",
			resource_version: "file-2:2026-06-05 10:00:00:2048",
			updated_at: "2026-06-05 10:00:00",
			content_length: 2048,
		})
	})

	it("refreshes a cached URL inside the expiry safety window", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-09-14T10:00:00Z"))
		const files = [
			fileItem({
				file_id: "expiring-file",
				relative_file_path: "images/expiring.png",
				file_name: "expiring.png",
				file_size: 1024,
			}),
		]
		vi.mocked(getTemporaryDownloadUrl)
			.mockResolvedValueOnce([
				{
					file_id: "expiring-file",
					url: "https://example.test/expiring.png?signature=old",
					expires_at: "2026-09-14T10:00:20Z",
				},
			])
			.mockResolvedValueOnce([
				{
					file_id: "expiring-file",
					url: "https://example.test/expiring.png?signature=fresh",
					expires_at: "2026-09-14T10:05:00Z",
				},
			])

		const first = getFileInfoByPath("images/expiring.png", files, { priority: "critical" })
		await vi.advanceTimersByTimeAsync(0)
		await expect(first).resolves.toMatchObject({
			src: "https://example.test/expiring.png?signature=old",
		})

		const refreshed = getFileInfoByPath("images/expiring.png", files, {
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)
		await expect(refreshed).resolves.toMatchObject({
			src: "https://example.test/expiring.png?signature=fresh",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("does not expose host file id in path-based file info", async () => {
		vi.useFakeTimers()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-2",
				url: "https://example.test/b.png?signature=1",
				version: "object-version-1",
				updated_at: "2026-06-05 10:00:00",
			},
		])

		const fileInfoPromise = getFileInfoByPath("images/b.png", [
			fileItem({
				file_id: "file-2",
				relative_file_path: "images/b.png",
				file_name: "b.png",
				updated_at: "2026-06-05 10:00:00",
				file_size: 2048,
			}),
		])
		await vi.advanceTimersByTimeAsync(100)

		const fileInfo = await fileInfoPromise
		expect(fileInfo).toMatchObject({
			src: "https://example.test/b.png?signature=1",
			fileName: "b.png",
			version: "object-version-1",
			resource_version: "file-2:2026-06-05 10:00:00:2048",
			updated_at: "2026-06-05 10:00:00",
			content_length: 2048,
		})
		expect(fileInfo).not.toHaveProperty("file_id")
	})

	it("re-signs URL after a module reload without durable path metadata", async () => {
		const files = [
			fileItem({
				file_id: "file-4",
				relative_file_path: "images/c.png",
				file_name: "c.png",
				updated_at: "2026-06-05 12:00:00",
				file_size: 4096,
			}),
		]
		const cachedSrc = "https://example.test/c.png?signature=cached"
		const freshSrc = "https://example.test/c.png?signature=fresh"

		setFileInfoCache(
			"images/c.png",
			{
				src: cachedSrc,
				fileName: "c.png",
				expires_at: "2099-01-01T00:00:00Z",
				resource_version: "file-4:2026-06-05 12:00:00:4096",
				updated_at: "2026-06-05 12:00:00",
				content_length: 4096,
			},
			files,
			undefined,
			"project-1",
		)

		vi.resetModules()
		const apiModule = await import("@/pages/superMagic/utils/api")
		vi.mocked(apiModule.getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "file-4",
				url: freshSrc,
				expires_at: "2099-01-01T00:00:00Z",
			},
		])
		const cacheModule = await import("../designFileInfoCache")

		const fileInfo = await cacheModule.getFileInfoByPath("images/c.png", files, {
			designProjectId: "project-1",
		})

		expect(fileInfo).toMatchObject({
			src: freshSrc,
			fileName: "c.png",
			resource_version: "file-4:2026-06-05 12:00:00:4096",
			updated_at: "2026-06-05 12:00:00",
			content_length: 4096,
		})
		expect(apiModule.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		cacheModule.clearAllFileInfoCache()
	})

	it("does not delete restored path cache before attachments are ready", async () => {
		const files = [
			fileItem({
				file_id: "file-5",
				relative_file_path: "images/d.png",
				file_name: "d.png",
				updated_at: "2026-06-05 13:00:00",
				file_size: 8192,
			}),
		]
		const cachedSrc = "https://example.test/d.png?signature=cached"

		setFileInfoCache(
			"images/d.png",
			{
				src: cachedSrc,
				fileName: "d.png",
				expires_at: "2099-01-01T00:00:00Z",
				resource_version: "file-5:2026-06-05 13:00:00:8192",
				updated_at: "2026-06-05 13:00:00",
				content_length: 8192,
			},
			files,
			undefined,
			"project-1",
		)

		cleanupFileInfoCache([], "project-1")
		vi.mocked(getTemporaryDownloadUrl).mockClear()

		const fileInfo = await getFileInfoByPath("images/d.png", files, {
			designProjectId: "project-1",
		})

		expect(fileInfo?.src).toBe(cachedSrc)
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("returns missing immediately for a known empty attachment snapshot", async () => {
		vi.useFakeTimers()

		const fileInfoPromise = getFileInfoByPath("images/missing.png", [], {
			hasAttachmentSnapshot: true,
		})
		await vi.advanceTimersByTimeAsync(0)

		await expect(fileInfoPromise).resolves.toBeNull()
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("keeps optimistic upload cache while attachments catch up", async () => {
		const oldFiles = [
			fileItem({
				file_id: "file-existing",
				relative_file_path: "images/existing.png",
				file_name: "existing.png",
			}),
		]
		const cachedSrc = "https://example.test/new.png?signature=uploaded"

		setFileInfoCache(
			"/images/new.png",
			{
				src: cachedSrc,
				fileName: "new.png",
				expires_at: "2099-01-01T00:00:00Z",
			},
			oldFiles,
			undefined,
			"project-1",
			undefined,
			{ allowMissingAttachment: true },
		)

		const cachedInfo = await getFileInfoByPath("/images/new.png", oldFiles, {
			designProjectId: "project-1",
			hasAttachmentSnapshot: true,
		})

		expect(cachedInfo?.src).toBe(cachedSrc)
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()

		const nextFiles = [
			fileItem({
				file_id: "file-other",
				relative_file_path: "images/other.png",
				file_name: "other.png",
			}),
		]
		await expect(
			getFileInfoByPath("/images/new.png", nextFiles, {
				designProjectId: "project-1",
				hasAttachmentSnapshot: true,
			}),
		).resolves.toMatchObject({ src: cachedSrc })
	})

	it("preserves unchanged resource URLs when unrelated attachments change", async () => {
		const originalFiles = [
			fileItem({
				file_id: "file-a",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				updated_at: "2026-07-20 10:00:00",
				file_size: 1024,
			}),
		]
		const cachedSrc = "https://example.test/a.png?signature=cached"
		setFileInfoCache(
			"images/a.png",
			{
				src: cachedSrc,
				fileName: "a.png",
				expires_at: "2099-01-01T00:00:00Z",
			},
			originalFiles,
			undefined,
			"project-1",
		)

		const nextFiles = [
			...originalFiles,
			fileItem({
				file_id: "file-b",
				relative_file_path: "images/b.png",
				file_name: "b.png",
			}),
		]
		cleanupFileInfoCache(nextFiles, "project-1", { hasAttachmentSnapshot: true })

		await expect(
			getFileInfoByPath("images/a.png", nextFiles, {
				designProjectId: "project-1",
				hasAttachmentSnapshot: true,
			}),
		).resolves.toMatchObject({ src: cachedSrc })
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("invalidates only the path whose file id was replaced", async () => {
		vi.useRealTimers()
		const originalFiles = [
			fileItem({
				file_id: "old-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
			}),
		]
		setFileInfoCache(
			"images/a.png",
			{
				src: "https://example.test/old.png?signature=1",
				fileName: "a.png",
				expires_at: "2099-01-01T00:00:00Z",
			},
			originalFiles,
			undefined,
			"project-1",
		)
		const nextFiles = [
			fileItem({
				file_id: "new-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
			}),
			fileItem({
				file_id: "old-file",
				relative_file_path: "archive/a.png",
				file_name: "a.png",
			}),
		]
		cleanupFileInfoCache(nextFiles, "project-1", { hasAttachmentSnapshot: true })
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "new-file",
				url: "https://example.test/new.png?signature=1",
			},
		])

		const request = getFileInfoByPath("images/a.png", nextFiles, {
			designProjectId: "project-1",
			hasAttachmentSnapshot: true,
		})
		await new Promise((resolve) => setTimeout(resolve, 150))

		await expect(request).resolves.toMatchObject({
			src: "https://example.test/new.png?signature=1",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith(
			expect.objectContaining({ file_ids: ["new-file"] }),
		)
	})

	it("expires optimistic upload cache if attachments never include the uploaded path", async () => {
		const startTime = new Date("2026-01-01T00:00:00Z").getTime()
		const nowSpy = vi.spyOn(Date, "now")
		const oldFiles = [
			fileItem({
				file_id: "file-existing",
				relative_file_path: "images/existing.png",
				file_name: "existing.png",
			}),
		]
		const cachedSrc = "https://example.test/new.png?signature=uploaded"

		try {
			nowSpy.mockReturnValue(startTime)
			setFileInfoCache(
				"/images/new.png",
				{
					src: cachedSrc,
					fileName: "new.png",
					expires_at: "2099-01-01T00:00:00Z",
				},
				oldFiles,
				undefined,
				"project-1",
				undefined,
				{ allowMissingAttachment: true },
			)
			cleanupFileInfoCache(oldFiles, "project-1", { hasAttachmentSnapshot: true })
			await expect(
				getFileInfoByPath("/images/new.png", oldFiles, {
					designProjectId: "project-1",
					hasAttachmentSnapshot: true,
				}),
			).resolves.toMatchObject({ src: cachedSrc })

			nowSpy.mockReturnValue(startTime + 15_001)
			await expect(
				getFileResourceMetaByPath("/images/new.png", oldFiles, {
					designProjectId: "project-1",
					hasAttachmentSnapshot: true,
				}),
			).resolves.toEqual({ status: "deleted" })
			cleanupFileInfoCache(oldFiles, "project-1", { hasAttachmentSnapshot: true })
			await expect(
				getFileInfoByPath("/images/new.png", oldFiles, {
					designProjectId: "project-1",
					hasAttachmentSnapshot: true,
				}),
			).resolves.toBeNull()
		} finally {
			nowSpy.mockRestore()
		}
	})

	it("allows a previously missing path to load after attachments are restored", async () => {
		vi.useFakeTimers()

		const missingPromise = getFileInfoByPath("images/restored.png", [], {
			hasAttachmentSnapshot: true,
		})
		await vi.advanceTimersByTimeAsync(0)
		await expect(missingPromise).resolves.toBeNull()

		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-restored",
				url: "https://example.test/restored.png?signature=1",
			},
		])
		const restoredFiles = [
			fileItem({
				file_id: "file-restored",
				relative_file_path: "images/restored.png",
				file_name: "restored.png",
			}),
		]
		const restoredPromise = getFileInfoByPath("images/restored.png", restoredFiles, {
			hasAttachmentSnapshot: true,
		})
		await vi.advanceTimersByTimeAsync(100)

		await expect(restoredPromise).resolves.toMatchObject({
			src: "https://example.test/restored.png?signature=1",
			fileName: "restored.png",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("chunks large path-based get-file-url batches", async () => {
		vi.useRealTimers()
		const files = Array.from({ length: 250 }, (_, index) =>
			fileItem({
				file_id: `file-${index}`,
				relative_file_path: `images/${index}.png`,
				file_name: `${index}.png`,
				file_size: 1024,
			}),
		)
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png?signature=1`,
			})),
		)

		const promises = files.map((file) =>
			getFileInfoByPath(file.relative_file_path, files, {
				useImageProcess: true,
			}),
		)
		await new Promise((resolve) => setTimeout(resolve, 150))
		await expect(Promise.all(promises)).resolves.toHaveLength(250)

		const calls = vi.mocked(getTemporaryDownloadUrl).mock.calls
		expect(calls).toHaveLength(3)
		expect(calls.map(([request]) => request.file_ids.length)).toEqual([100, 100, 50])
		calls.forEach(([request]) => {
			expect(request.options).toEqual({
				xMagicImageProcess: {
					autoOrient: 1,
					format: "webp",
				},
			})
		})
	})

	it("places critical file ids in the first chunk ahead of queued background work", async () => {
		vi.useRealTimers()
		const backgroundFiles = Array.from({ length: 101 }, (_, index) =>
			fileItem({
				file_id: `background-${index}`,
				relative_file_path: `images/background-${index}.png`,
				file_name: `background-${index}.png`,
			}),
		)
		const criticalFile = fileItem({
			file_id: "critical-file",
			relative_file_path: "images/critical.png",
			file_name: "critical.png",
		})
		const files = [...backgroundFiles, criticalFile]
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png`,
			})),
		)

		const backgroundRequests = backgroundFiles.map((file) =>
			getFileInfoByPath(file.relative_file_path, files, { priority: "background" }),
		)
		const criticalRequest = getFileInfoByPath(criticalFile.relative_file_path, files, {
			priority: "critical",
		})
		await expect(Promise.all([...backgroundRequests, criticalRequest])).resolves.toHaveLength(
			102,
		)

		const calls = vi.mocked(getTemporaryDownloadUrl).mock.calls
		expect(calls).toHaveLength(2)
		expect(calls[0]?.[0].file_ids).toContain("critical-file")
		expect(calls[1]?.[0].file_ids).not.toContain("critical-file")
	})

	it("promotes an admitted background group before the next chunk is sent", async () => {
		vi.useRealTimers()
		const backgroundFiles = Array.from({ length: 201 }, (_, index) =>
			fileItem({
				file_id: `background-${index}`,
				relative_file_path: `images/background-${index}.png`,
				file_name: `background-${index}.png`,
			}),
		)
		const files = backgroundFiles
		const firstResponse = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		let requestCount = 0
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) => {
			requestCount += 1
			if (requestCount === 1) return firstResponse.promise
			return file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png`,
			}))
		})

		const backgroundRequests = backgroundFiles.map((file) =>
			getFileInfoByPath(file.relative_file_path, files, { priority: "background" }),
		)
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))
		const firstFileIds = vi.mocked(getTemporaryDownloadUrl).mock.calls[0]?.[0].file_ids ?? []
		expect(firstFileIds).not.toContain("background-200")

		const promotedRequest = getFileInfoById("background-200", "promoted.png", undefined, {
			priority: "critical",
		})
		firstResponse.resolve(
			firstFileIds.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png`,
			})),
		)
		await vi.waitFor(() =>
			expect(vi.mocked(getTemporaryDownloadUrl).mock.calls.length).toBeGreaterThanOrEqual(2),
		)

		const secondFileIds = vi.mocked(getTemporaryDownloadUrl).mock.calls[1]?.[0].file_ids ?? []
		expect(secondFileIds).toContain("background-200")
		await expect(Promise.all([...backgroundRequests, promotedRequest])).resolves.toHaveLength(
			202,
		)
	})

	it("dedupes duplicate file ids inside a path-based batch", async () => {
		vi.useFakeTimers()
		const files = [
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
			}),
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/alias-a.png",
				file_name: "alias-a.png",
			}),
		]
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "shared-file",
				url: "https://example.test/shared-file.png?signature=1",
			},
		])

		const requests = files.map((file) =>
			getFileInfoByPath(file.relative_file_path, files, { useImageProcess: true }),
		)
		await vi.advanceTimersByTimeAsync(100)

		await expect(Promise.all(requests)).resolves.toHaveLength(2)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		expect(vi.mocked(getTemporaryDownloadUrl).mock.calls[0]?.[0].file_ids).toEqual([
			"shared-file",
		])
	})

	it("shares one in-flight URL request across different paths for the same file id", async () => {
		vi.useFakeTimers()
		const response = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		vi.mocked(getTemporaryDownloadUrl).mockReturnValue(response.promise)
		const files = [
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				file_size: 1024,
			}),
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/alias-a.png",
				file_name: "alias-a.png",
				file_size: 1024,
			}),
		]

		const firstRequest = getFileInfoByPath("images/a.png", files, {
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		const aliasRequest = getFileInfoByPath("images/alias-a.png", files, {
			priority: "visible",
		})
		await vi.advanceTimersByTimeAsync(100)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		response.resolve([
			{
				file_id: "shared-file",
				url: "https://example.test/shared-file.png?signature=1",
			},
		])
		await expect(Promise.all([firstRequest, aliasRequest])).resolves.toHaveLength(2)
		await vi.runAllTimersAsync()
	})

	it("shares one URL request between path-based and file-id consumers", async () => {
		vi.useFakeTimers()
		const response = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		vi.mocked(getTemporaryDownloadUrl).mockReturnValue(response.promise)
		const files = [
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				file_size: 1024,
			}),
		]

		const pathRequest = getFileInfoByPath("images/a.png", files, {
			designProjectId: "project-1",
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)
		const idRequest = getFileInfoById("shared-file", "upload-a.png", 1024, {
			designProjectId: "project-1",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		response.resolve([
			{
				file_id: "shared-file",
				url: "https://example.test/shared-file.png?signature=1",
			},
		])
		await expect(Promise.all([pathRequest, idRequest])).resolves.toHaveLength(2)
		await vi.runAllTimersAsync()
	})

	it("reuses a completed identity result and lets force refresh bypass it", async () => {
		vi.useFakeTimers()
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png?request=${vi.mocked(getTemporaryDownloadUrl).mock.calls.length}`,
			})),
		)
		const files = [
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				file_size: 1024,
			}),
		]

		const pathRequest = getFileInfoByPath("images/a.png", files, {
			designProjectId: "project-1",
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)
		await pathRequest

		await expect(
			getFileInfoById("shared-file", "upload-a.png", 1024, {
				designProjectId: "project-1",
			}),
		).resolves.toMatchObject({ file_id: "shared-file" })
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		const refreshed = getFileInfoByPath("images/a.png", files, {
			designProjectId: "project-1",
			forceRefresh: true,
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)
		await expect(refreshed).resolves.toBeTruthy()
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
		await vi.runAllTimersAsync()
	})

	it("keeps raw and image-process URL identities separate", async () => {
		vi.useFakeTimers()
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids, options }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png?rendition=${options ? "webp" : "raw"}`,
			})),
		)
		const files = [
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				file_size: 1024,
			}),
		]

		const rawRequest = getFileInfoByPath("images/a.png", files, {
			useImageProcess: false,
			priority: "critical",
		})
		const processedRequest = getFileInfoByPath("images/a.png", files, {
			useImageProcess: true,
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)

		const [raw, processed] = await Promise.all([rawRequest, processedRequest])
		expect(raw?.src).toContain("rendition=raw")
		expect(processed?.src).toContain("rendition=webp")
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
		expect(vi.mocked(getTemporaryDownloadUrl).mock.calls[0]?.[0].options).toBeUndefined()
		expect(vi.mocked(getTemporaryDownloadUrl).mock.calls[1]?.[0].options).toBeDefined()
		await vi.runAllTimersAsync()
	})

	it("promotes a queued near URL request when a critical subscriber arrives", async () => {
		vi.useFakeTimers()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{
				file_id: "shared-file",
				url: "https://example.test/shared-file.png?signature=1",
			},
		])
		const files = [
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				file_size: 1024,
			}),
			fileItem({
				file_id: "shared-file",
				relative_file_path: "images/alias-a.png",
				file_name: "alias-a.png",
				file_size: 1024,
			}),
		]

		const nearRequest = getFileInfoByPath("images/a.png", files, { priority: "near" })
		await vi.advanceTimersByTimeAsync(50)
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()

		const criticalRequest = getFileInfoByPath("images/alias-a.png", files, {
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		await expect(Promise.all([nearRequest, criticalRequest])).resolves.toHaveLength(2)
		await vi.runAllTimersAsync()
	})

	it("preserves unchanged in-flight URL work across attachment snapshot updates", async () => {
		vi.useFakeTimers()
		const response = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		vi.mocked(getTemporaryDownloadUrl).mockReturnValue(response.promise)
		const originalFiles = [
			fileItem({
				file_id: "file-a",
				relative_file_path: "images/a.png",
				file_name: "a.png",
				file_size: 1024,
			}),
		]
		const firstRequest = getFileInfoByPath("images/a.png", originalFiles, {
			designProjectId: "project-1",
			priority: "critical",
		})
		await vi.advanceTimersByTimeAsync(0)

		const nextFiles = [
			...originalFiles,
			fileItem({
				file_id: "file-b",
				relative_file_path: "images/b.png",
				file_name: "b.png",
			}),
		]
		cleanupFileInfoCache(nextFiles, "project-1", { hasAttachmentSnapshot: true })
		const secondRequest = getFileInfoByPath("images/a.png", nextFiles, {
			designProjectId: "project-1",
			priority: "visible",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		response.resolve([
			{
				file_id: "file-a",
				url: "https://example.test/file-a.png?signature=1",
			},
		])
		await expect(Promise.all([firstRequest, secondRequest])).resolves.toHaveLength(2)
		await vi.runAllTimersAsync()
	})

	it("uses strong resource version when attachment metadata exposes it", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-2",
				url: "https://example.test/b.png?signature=1",
				version: "object-version-1",
				updated_at: "2026-06-05 10:00:00",
			},
		])

		const fileInfo = await getFileInfoById("file-2", undefined, undefined, {
			filesList: [
				fileItem({
					file_id: "file-2",
					file_name: "b.png",
					resource_version: "attachment-version-1",
					updated_at: "2026-06-05 10:00:00",
					file_size: 2048,
				}),
			],
		})

		expect(fileInfo.resource_version).toBe("attachment-version-1")
		expect(fileInfo.version).toBe("object-version-1")
		expect(fileInfo.content_length).toBe(2048)
	})

	it("falls back to file id, updated_at and file size when get-file-url version is null", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-3",
				url: "https://example.test/c.png?signature=1",
				version: null,
				updated_at: "2026-06-05 11:00:00",
			},
		])

		const fileInfo = await getFileInfoById("file-3", "c.png", 4096)

		expect(fileInfo.resource_version).toBe("file-3:2026-06-05 11:00:00:4096")
		expect(fileInfo.updated_at).toBe("2026-06-05 11:00:00")
		expect(fileInfo.content_length).toBe(4096)
	})

	it("invalidates a completed path URL when the same file id gets a new resource version", async () => {
		vi.useRealTimers()
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png?request=${vi.mocked(getTemporaryDownloadUrl).mock.calls.length}`,
			})),
		)
		const firstFiles = [
			fileItem({
				file_id: "versioned-file",
				relative_file_path: "images/versioned.png",
				updated_at: "2026-06-05 10:00:00",
				file_size: 1024,
			}),
		]
		await expect(
			getFileInfoByPath("images/versioned.png", firstFiles, { priority: "critical" }),
		).resolves.toBeTruthy()

		const updatedFiles = [
			fileItem({
				file_id: "versioned-file",
				relative_file_path: "images/versioned.png",
				updated_at: "2026-06-05 11:00:00",
				file_size: 2048,
			}),
		]
		await expect(
			getFileInfoByPath("images/versioned.png", updatedFiles, { priority: "critical" }),
		).resolves.toBeTruthy()
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("derives a resource version when manually primed cache metadata omits it", async () => {
		vi.useRealTimers()
		const originalFiles = [
			fileItem({
				file_id: "primed-versioned-file",
				relative_file_path: "images/primed-versioned.png",
				updated_at: "2026-06-05 10:00:00",
				file_size: 1024,
			}),
		]
		setFileInfoCache(
			"images/primed-versioned.png",
			{
				src: "https://example.test/primed-versioned.png?request=1",
				fileName: "primed-versioned.png",
				expires_at: "2099-01-01T00:00:00Z",
			},
			originalFiles,
			undefined,
			"project-1",
		)
		const updatedFiles = [
			fileItem({
				file_id: "primed-versioned-file",
				relative_file_path: "images/primed-versioned.png",
				updated_at: "2026-06-05 11:00:00",
				file_size: 2048,
			}),
		]
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "primed-versioned-file",
				url: "https://example.test/primed-versioned.png?request=2",
			},
		])

		await expect(
			getFileInfoByPath("images/primed-versioned.png", updatedFiles, {
				designProjectId: "project-1",
				priority: "critical",
			}),
		).resolves.toMatchObject({
			src: "https://example.test/primed-versioned.png?request=2",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("does not let an older path request overwrite a manually primed URL", async () => {
		vi.useRealTimers()
		const request = deferred<Array<{ file_id: string; url: string; expires_at?: string }>>()
		vi.mocked(getTemporaryDownloadUrl).mockReturnValueOnce(request.promise)
		const files = [
			fileItem({
				file_id: "primed-race-file",
				relative_file_path: "images/primed-race.png",
				updated_at: "2026-06-05 10:00:00",
				file_size: 1024,
			}),
		]

		const oldRequest = getFileInfoByPath("images/primed-race.png", files, {
			designProjectId: "project-1",
			priority: "critical",
		})
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))
		setFileInfoCache(
			"images/primed-race.png",
			{
				src: "https://example.test/primed-race.png?request=2",
				fileName: "primed-race.png",
				expires_at: "2099-01-01T00:00:00Z",
			},
			files,
			undefined,
			"project-1",
		)
		request.resolve([
			{
				file_id: "primed-race-file",
				url: "https://example.test/primed-race.png?request=1",
			},
		])
		await expect(oldRequest).resolves.toMatchObject({
			src: "https://example.test/primed-race.png?request=1",
		})

		await expect(
			getFileInfoByPath("images/primed-race.png", files, {
				designProjectId: "project-1",
				priority: "critical",
			}),
		).resolves.toMatchObject({
			src: "https://example.test/primed-race.png?request=2",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)

		clearAllFileInfoCache()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "primed-race-file",
				url: "https://example.test/primed-race.png?request=3",
			},
		])
		await expect(
			getFileInfoByPath("images/primed-race.png", files, {
				designProjectId: "project-1",
				priority: "critical",
			}),
		).resolves.toMatchObject({
			src: "https://example.test/primed-race.png?request=3",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("keeps unversioned identity results separate from versioned results", async () => {
		vi.useRealTimers()
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png?request=${vi.mocked(getTemporaryDownloadUrl).mock.calls.length}`,
			})),
		)
		const files = [
			fileItem({
				file_id: "versioned-file",
				file_name: "versioned.png",
				resource_version: "resource-v1",
			}),
		]

		await expect(
			getFileInfoById("versioned-file", "versioned.png", undefined, { filesList: files }),
		).resolves.toMatchObject({ src: "https://example.test/versioned-file.png?request=1" })
		await expect(getFileInfoById("versioned-file", "versioned.png")).resolves.toMatchObject({
			src: "https://example.test/versioned-file.png?request=2",
		})

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("does not batch the same file id across different resource versions", async () => {
		vi.useRealTimers()
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(async ({ file_ids }) =>
			file_ids.map((fileId) => ({
				file_id: fileId,
				url: `https://example.test/${fileId}.png?request=${vi.mocked(getTemporaryDownloadUrl).mock.calls.length}`,
			})),
		)
		const firstFiles = [
			fileItem({
				file_id: "same-file-different-version",
				file_name: "versioned.png",
				resource_version: "resource-v1",
			}),
		]
		const secondFiles = [
			fileItem({
				file_id: "same-file-different-version",
				file_name: "versioned.png",
				resource_version: "resource-v2",
			}),
		]

		const [firstResult, secondResult] = await Promise.all([
			getFileInfoById("same-file-different-version", "versioned.png", undefined, {
				filesList: firstFiles,
			}),
			getFileInfoById("same-file-different-version", "versioned.png", undefined, {
				filesList: secondFiles,
			}),
		])

		expect(firstResult.src).not.toBe(secondResult.src)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("does not reuse an old URL after a failed force refresh", async () => {
		vi.useRealTimers()
		vi.mocked(getTemporaryDownloadUrl)
			.mockResolvedValueOnce([
				{ file_id: "refresh-file", url: "https://example.test/refresh?request=1" },
			])
			.mockRejectedValueOnce(new Error("expired signature"))
			.mockResolvedValueOnce([
				{ file_id: "refresh-file", url: "https://example.test/refresh?request=3" },
			])
		const files = [
			fileItem({
				file_id: "refresh-file",
				relative_file_path: "images/refresh.png",
				file_size: 1024,
			}),
		]

		await expect(
			getFileInfoByPath("images/refresh.png", files, { priority: "critical" }),
		).resolves.toBeTruthy()
		await expect(
			getFileInfoByPath("images/refresh.png", files, {
				forceRefresh: true,
				priority: "critical",
			}),
		).rejects.toThrow("expired signature")
		await expect(
			getFileInfoByPath("images/refresh.png", files, { priority: "critical" }),
		).resolves.toMatchObject({
			src: "https://example.test/refresh?request=3",
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(3)
	})

	it("invalidates the old path result as soon as force refresh starts", async () => {
		vi.useRealTimers()
		const refreshedResponse = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		vi.mocked(getTemporaryDownloadUrl)
			.mockResolvedValueOnce([
				{
					file_id: "refresh-start-file",
					url: "https://example.test/refresh-start?request=1",
				},
			])
			.mockReturnValueOnce(refreshedResponse.promise)
		const files = [
			fileItem({
				file_id: "refresh-start-file",
				relative_file_path: "images/refresh-start.png",
				file_size: 1024,
			}),
		]

		await expect(
			getFileInfoByPath("images/refresh-start.png", files, { priority: "critical" }),
		).resolves.toMatchObject({ src: "https://example.test/refresh-start?request=1" })
		const forceRequest = getFileInfoByPath("images/refresh-start.png", files, {
			forceRefresh: true,
			priority: "critical",
		})
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2))

		let normalRequestSettled = false
		const normalRequest = getFileInfoByPath("images/refresh-start.png", files, {
			priority: "critical",
		}).finally(() => {
			normalRequestSettled = true
		})
		await Promise.resolve()
		expect(normalRequestSettled).toBe(false)

		refreshedResponse.resolve([
			{ file_id: "refresh-start-file", url: "https://example.test/refresh-start?request=2" },
		])
		await expect(Promise.all([forceRequest, normalRequest])).resolves.toEqual([
			expect.objectContaining({ src: "https://example.test/refresh-start?request=2" }),
			expect.objectContaining({ src: "https://example.test/refresh-start?request=2" }),
		])
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("does not let an older URL generation overwrite a completed force refresh", async () => {
		vi.useRealTimers()
		const oldResponse = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		const refreshedResponse = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		vi.mocked(getTemporaryDownloadUrl)
			.mockReturnValueOnce(oldResponse.promise)
			.mockReturnValueOnce(refreshedResponse.promise)
		const files = [
			fileItem({
				file_id: "generation-file",
				relative_file_path: "images/generation.png",
				file_size: 1024,
			}),
		]

		const oldRequest = getFileInfoByPath("images/generation.png", files, {
			priority: "critical",
		})
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))
		const forceRequest = getFileInfoByPath("images/generation.png", files, {
			forceRefresh: true,
			priority: "critical",
		})
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2))

		refreshedResponse.resolve([
			{ file_id: "generation-file", url: "https://example.test/generation?request=2" },
		])
		await expect(forceRequest).resolves.toMatchObject({
			src: "https://example.test/generation?request=2",
		})
		oldResponse.resolve([
			{ file_id: "generation-file", url: "https://example.test/generation?request=1" },
		])
		await expect(oldRequest).resolves.toMatchObject({
			src: "https://example.test/generation?request=1",
		})

		await expect(
			getFileInfoByPath("images/generation.png", files, { priority: "critical" }),
		).resolves.toMatchObject({ src: "https://example.test/generation?request=2" })
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("does not let an older force refresh overwrite the newest path cache", async () => {
		vi.useRealTimers()
		const olderRefresh = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		const newestRefresh = deferred<Awaited<ReturnType<typeof getTemporaryDownloadUrl>>>()
		vi.mocked(getTemporaryDownloadUrl)
			.mockReturnValueOnce(olderRefresh.promise)
			.mockReturnValueOnce(newestRefresh.promise)
		const files = [
			fileItem({
				file_id: "force-generation-file",
				relative_file_path: "images/force-generation.png",
				file_size: 1024,
			}),
		]

		const olderRequest = getFileInfoByPath("images/force-generation.png", files, {
			forceRefresh: true,
			priority: "critical",
		})
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))
		const newestRequest = getFileInfoByPath("images/force-generation.png", files, {
			forceRefresh: true,
			priority: "critical",
		})
		await vi.waitFor(() => expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2))

		newestRefresh.resolve([
			{
				file_id: "force-generation-file",
				url: "https://example.test/force-generation?request=2",
			},
		])
		await expect(newestRequest).resolves.toMatchObject({
			src: "https://example.test/force-generation?request=2",
		})
		olderRefresh.resolve([
			{
				file_id: "force-generation-file",
				url: "https://example.test/force-generation?request=1",
			},
		])
		await expect(olderRequest).resolves.toMatchObject({
			src: "https://example.test/force-generation?request=1",
		})

		await expect(
			getFileInfoByPath("images/force-generation.png", files, { priority: "critical" }),
		).resolves.toMatchObject({ src: "https://example.test/force-generation?request=2" })
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})
})
