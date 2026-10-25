import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import { getFileUrlDownloadModeForNoWatermark } from "@/utils/aiWatermarkPreviewFileUrlMode"
import type { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import {
	clearSharedMediaUrlCache,
	getCachedSharedMediaUrls,
	invalidateSharedMediaUrl,
	requestSharedMediaUrls,
	resolveSharedMediaUrl,
	seedSharedMediaUrls,
	sharedMediaUrlCacheTestUtils,
} from "../sharedMediaUrlCache"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/utils/aiWatermarkPreviewFileUrlMode", () => ({
	getFileUrlDownloadModeForNoWatermark: vi.fn(() => undefined),
}))

const getSharedMediaResourceScopeMock = vi.hoisted(() => vi.fn(() => "scope-a"))
vi.mock("../sharedMediaResourceScope", () => ({
	getSharedMediaResourceScope: getSharedMediaResourceScopeMock,
}))

const getTemporaryDownloadUrlMock = vi.mocked(getTemporaryDownloadUrl)
const getFileUrlDownloadModeMock = vi.mocked(getFileUrlDownloadModeForNoWatermark)

function createUrlItem(
	fileId: string,
	url = `https://oss.test/${fileId}`,
	expiresAt = "2026-08-20 10:05:00",
): GetTemporaryDownloadUrlItem {
	return {
		file_id: fileId,
		url,
		expires_at: expiresAt,
	}
}

describe("shared media URL cache", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-08-20T10:00:00"))
		clearSharedMediaUrlCache()
		getTemporaryDownloadUrlMock.mockReset()
		getFileUrlDownloadModeMock.mockReset()
		getFileUrlDownloadModeMock.mockReturnValue(undefined)
		getSharedMediaResourceScopeMock.mockReset()
		getSharedMediaResourceScopeMock.mockReturnValue("scope-a")
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("coalesces a batch request with a concurrent single-file request", async () => {
		getTemporaryDownloadUrlMock.mockResolvedValue([
			createUrlItem("file-a"),
			createUrlItem("file-b"),
		])

		const batch = requestSharedMediaUrls(["file-a", "file-b"])
		const single = resolveSharedMediaUrl({ fileId: "file-a" })

		await expect(single).resolves.toEqual(expect.objectContaining({ file_id: "file-a" }))
		await expect(batch).resolves.toEqual([
			expect.objectContaining({ file_id: "file-a" }),
			expect.objectContaining({ file_id: "file-b" }),
		])
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(1)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-a", "file-b"],
			file_versions: undefined,
			download_mode: undefined,
			is_download: undefined,
			cache: undefined,
			options: undefined,
			enableErrorMessagePrompt: false,
		})
	})

	it("only requests the missing items in a batch", async () => {
		seedSharedMediaUrls({ items: [createUrlItem("file-a")] })
		getTemporaryDownloadUrlMock.mockResolvedValue([createUrlItem("file-b")])

		const result = await requestSharedMediaUrls(["file-a", "file-b", "file-a"])

		expect(result.map((item) => item.file_id)).toEqual(["file-a", "file-b"])
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(1)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith(
			expect.objectContaining({ file_ids: ["file-b"] }),
		)
	})

	it("keeps thumbnail and other image-process renditions separate", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/thumb")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/preview")])

		const thumbnail = await resolveSharedMediaUrl({
			fileId: "file-a",
			imageProcess: { format: "webp", quality: 10 },
		})
		const preview = await resolveSharedMediaUrl({
			fileId: "file-a",
			imageProcess: { quality: 45, format: "webp" },
		})

		expect(thumbnail?.url).toBe("https://oss.test/thumb")
		expect(preview?.url).toBe("https://oss.test/preview")
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("reuses an attachment-list URL for image previews regardless of image processing", async () => {
		seedSharedMediaUrls({
			items: [createUrlItem("file-a", "https://oss.test/attachment-preview")],
			options: {
				fileVersions: new Map([["file-a", 7]]),
				fileUpdatedAtMap: new Map([["file-a", "updated-7"]]),
				fileResourceVersionMap: new Map([["file-a", "resource-7"]]),
			},
			source: "attachment-list",
		})

		await expect(
			resolveSharedMediaUrl({
				fileId: "file-a",
				fileVersion: 7,
				updatedAt: "updated-7",
				resourceVersion: "resource-7",
				imageProcess: { resize: { w: 320, h: 320 }, quality: 45 },
				allowAttachmentListUrl: true,
			}),
		).resolves.toEqual(expect.objectContaining({ url: "https://oss.test/attachment-preview" }))
		await expect(
			resolveSharedMediaUrl({
				fileId: "file-a",
				imageProcess: { resize: { w: 320, h: 320 }, quality: 45 },
				allowAttachmentListUrl: true,
			}),
		).resolves.toEqual(expect.objectContaining({ url: "https://oss.test/attachment-preview" }))

		expect(getTemporaryDownloadUrlMock).not.toHaveBeenCalled()
	})

	it("does not use an attachment-list URL for downloads or opt-out preview requests", async () => {
		seedSharedMediaUrls({
			items: [createUrlItem("file-a", "https://oss.test/attachment-preview")],
			source: "attachment-list",
		})
		getTemporaryDownloadUrlMock.mockResolvedValue([
			createUrlItem("file-a", "https://oss.test/new"),
		])

		await resolveSharedMediaUrl({ fileId: "file-a", isDownload: true })
		await resolveSharedMediaUrl({ fileId: "file-a", allowAttachmentListUrl: false })

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("does not reuse a signed URL across permission scopes", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/org-a")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/org-b")])

		await expect(
			resolveSharedMediaUrl({ fileId: "file-a", scope: "org:org-a|user:user-a" }),
		).resolves.toEqual(expect.objectContaining({ url: "https://oss.test/org-a" }))
		await expect(
			resolveSharedMediaUrl({ fileId: "file-a", scope: "org:org-b|user:user-b" }),
		).resolves.toEqual(expect.objectContaining({ url: "https://oss.test/org-b" }))

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("does not batch or reuse a signed URL across share identities", async () => {
		const firstAccess = createShareFileAccess({
			token: "share-token-a",
			projectId: "project-a",
		})
		const secondAccess = createShareFileAccess({
			token: "share-token-b",
			projectId: "project-a",
		})
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/share-a")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/share-b")])

		await expect(requestSharedMediaUrls(["file-a"], { access: firstAccess })).resolves.toEqual([
			expect.objectContaining({ url: "https://oss.test/share-a" }),
		])
		await expect(requestSharedMediaUrls(["file-a"], { access: secondAccess })).resolves.toEqual(
			[expect.objectContaining({ url: "https://oss.test/share-b" })],
		)

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
		expect(getTemporaryDownloadUrlMock.mock.calls.map(([params]) => params.access)).toEqual([
			firstAccess,
			secondAccess,
		])
	})

	it("normalizes image-process property order in cache keys", () => {
		const first = sharedMediaUrlCacheTestUtils.buildRequestKey({
			fileId: "file-a",
			imageProcess: { resize: { w: 320, h: 320 }, quality: 10 },
		})
		const second = sharedMediaUrlCacheTestUtils.buildRequestKey({
			fileId: "file-a",
			imageProcess: { quality: 10, resize: { h: 320, w: 320 } },
		})

		expect(first).toBe(second)
	})

	it("refreshes URLs inside the expiry safety window", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([
				createUrlItem("file-a", "https://oss.test/old", "2026-08-20 10:00:20"),
			])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/new")])

		await resolveSharedMediaUrl({ fileId: "file-a" })
		const refreshed = await resolveSharedMediaUrl({ fileId: "file-a" })

		expect(refreshed?.url).toBe("https://oss.test/new")
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("uses a bounded fallback TTL when the URL response omits expires_at", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([{ file_id: "file-a", url: "https://oss.test/old" }])
			.mockResolvedValueOnce([{ file_id: "file-a", url: "https://oss.test/new" }])

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/old" }),
		)
		await vi.advanceTimersByTimeAsync(15 * 60 * 1000)

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/new" }),
		)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("force-refreshes a cached URL without changing its identity key", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/old")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/new")])

		await resolveSharedMediaUrl({ fileId: "file-a" })
		const refreshed = await resolveSharedMediaUrl({ fileId: "file-a", forceRefresh: true })

		expect(refreshed?.url).toBe("https://oss.test/new")
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("does not reuse an auto-mode URL after the watermark policy changes", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/watermarked")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/plain")])

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/watermarked" }),
		)
		getFileUrlDownloadModeMock.mockReturnValue("download" as DownloadImageMode)

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/plain" }),
		)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
		expect(getTemporaryDownloadUrlMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ download_mode: "download" }),
		)
	})

	it("evicts the default-scope working set after an auth-context switch", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/scope-a")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/scope-b")])

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/scope-a" }),
		)
		getSharedMediaResourceScopeMock.mockReturnValue("scope-b")

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/scope-b" }),
		)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("does not let an older request overwrite a forced refresh result", async () => {
		let resolveOldRequest: (value: GetTemporaryDownloadUrlItem[]) => void = () => undefined
		let resolveNewRequest: (value: GetTemporaryDownloadUrlItem[]) => void = () => undefined
		getTemporaryDownloadUrlMock
			.mockImplementationOnce(
				() =>
					new Promise<GetTemporaryDownloadUrlItem[]>((resolve) => {
						resolveOldRequest = resolve
					}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<GetTemporaryDownloadUrlItem[]>((resolve) => {
						resolveNewRequest = resolve
					}),
			)

		const oldRequest = resolveSharedMediaUrl({ fileId: "file-a" })
		const newRequest = resolveSharedMediaUrl({ fileId: "file-a", forceRefresh: true })
		resolveNewRequest([createUrlItem("file-a", "https://oss.test/new")])
		await expect(newRequest).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/new" }),
		)
		resolveOldRequest([createUrlItem("file-a", "https://oss.test/old")])
		await oldRequest

		await expect(resolveSharedMediaUrl({ fileId: "file-a" })).resolves.toEqual(
			expect.objectContaining({ url: "https://oss.test/new" }),
		)
		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(2)
	})

	it("does not repopulate the cache when a request finishes after clear", async () => {
		let resolveRequest: (value: GetTemporaryDownloadUrlItem[]) => void = () => undefined
		getTemporaryDownloadUrlMock.mockImplementation(
			() =>
				new Promise<GetTemporaryDownloadUrlItem[]>((resolve) => {
					resolveRequest = resolve
				}),
		)

		const pending = resolveSharedMediaUrl({ fileId: "file-a" })
		clearSharedMediaUrlCache()
		resolveRequest([createUrlItem("file-a")])
		await pending

		expect(sharedMediaUrlCacheTestUtils.getCacheSize()).toBe(0)
	})

	it("does not repopulate the cache when a request finishes after file invalidation", async () => {
		let resolveRequest: (value: GetTemporaryDownloadUrlItem[]) => void = () => undefined
		getTemporaryDownloadUrlMock.mockImplementation(
			() =>
				new Promise<GetTemporaryDownloadUrlItem[]>((resolve) => {
					resolveRequest = resolve
				}),
		)

		const pending = resolveSharedMediaUrl({ fileId: "file-a" })
		invalidateSharedMediaUrl("file-a")
		resolveRequest([createUrlItem("file-a")])
		await pending

		expect(sharedMediaUrlCacheTestUtils.getCacheSize()).toBe(0)
	})

	it("does not reuse a URL after the file version, updatedAt, or resource version changes", async () => {
		getTemporaryDownloadUrlMock
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/v1")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/v2")])
			.mockResolvedValueOnce([createUrlItem("file-a", "https://oss.test/v3")])

		await resolveSharedMediaUrl({ fileId: "file-a", fileVersion: 1, updatedAt: "v1" })
		await resolveSharedMediaUrl({ fileId: "file-a", fileVersion: 2, updatedAt: "v1" })
		await resolveSharedMediaUrl({
			fileId: "file-a",
			fileVersion: 2,
			updatedAt: "v2",
			resourceVersion: "object-version-2",
		})

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledTimes(3)
	})

	it("reports missing and cached entries without persisting URLs", async () => {
		seedSharedMediaUrls({ items: [createUrlItem("file-a")] })

		expect(getCachedSharedMediaUrls({ fileIds: ["file-a", "file-b"] })).toEqual({
			cached: [expect.objectContaining({ file_id: "file-a" })],
			missing: ["file-b"],
		})
		expect(sharedMediaUrlCacheTestUtils.getCacheSize()).toBe(1)

		invalidateSharedMediaUrl("file-a")
		expect(sharedMediaUrlCacheTestUtils.getCacheSize()).toBe(0)
	})

	it("bounds URL metadata memory with an LRU cap", () => {
		const items = Array.from({ length: 2050 }, (_, index) =>
			createUrlItem(`file-${index}`, `https://oss.test/${index}`),
		)

		seedSharedMediaUrls({ items })

		expect(sharedMediaUrlCacheTestUtils.getCacheSize()).toBe(2048)
		expect(getCachedSharedMediaUrls({ fileIds: ["file-0", "file-1", "file-2049"] })).toEqual({
			cached: [expect.objectContaining({ file_id: "file-2049" })],
			missing: ["file-0", "file-1"],
		})
	})
})
