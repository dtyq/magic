import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	createSessionFileAccess,
	createShareFileAccess,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import { SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS } from "@/pages/superMagic/services/sharedMediaImageProcess"
import {
	__resetProjectFileImagePreviewCoordinatorForTests,
	cancelProjectFileImagePreviewRequest,
	isProjectFileImagePreviewDirectUrlUsable,
	invalidateProjectFileImagePreviewDirectUrl,
	projectFileImagePreviewCoordinatorConfig,
	requestProjectFileImagePreview,
	requestProjectFileImagePreviewBatch,
	seedProjectFileImagePreviewDirectUrls,
} from "./projectFileImagePreviewCoordinator"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

function createSource(index: number) {
	return {
		fileId: `file-${index}`,
		cacheKey: `file-${index}|png|image-${index}.png|version-1`,
	}
}

function createRows(fileIds: string[]) {
	return fileIds.map((fileId) => ({
		file_id: fileId,
		url: `https://cdn.example.com/${fileId}.webp?signature=stable`,
		expires_at: "2099-01-01 00:00:00",
	}))
}

describe("projectFileImagePreviewCoordinator", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-09-09T14:00:00"))
		vi.clearAllMocks()
		__resetProjectFileImagePreviewCoordinatorForTests()
	})

	afterEach(() => {
		__resetProjectFileImagePreviewCoordinatorForTests()
		vi.useRealTimers()
	})

	it("reuses the exact valid signed url without another exchange", async () => {
		const source = createSource(1)
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce(createRows([source.fileId]))

		const firstRequest = requestProjectFileImagePreview(source)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)
		const firstResult = await firstRequest
		const secondResult = await requestProjectFileImagePreview(source)

		expect(firstResult).toEqual({
			status: "loaded",
			item: {
				url: "https://cdn.example.com/file-1.webp?signature=stable",
				expiresAt: "2099-01-01 00:00:00",
			},
		})
		expect(secondResult).toEqual(firstResult)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("keeps concurrent share and session thumbnail requests in separate exchanges", async () => {
		const source = createSource(2)
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue(createRows([source.fileId]))
		const shareAccess = createShareFileAccess({
			token: "share-token-coalesce",
			projectId: "project-1",
		})
		const sessionAccess = createSessionFileAccess({ projectId: "project-1" })

		// Two identities request the same file in the same batch window. They must
		// not be coalesced into one exchange or share an in-flight promise.
		const shareRequest = requestProjectFileImagePreview(source, { access: shareAccess })
		const sessionRequest = requestProjectFileImagePreview(source, { access: sessionAccess })
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs * 3)
		const [shareResult, sessionResult] = await Promise.all([shareRequest, sessionRequest])

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
		expect(shareResult.status).toBe("loaded")
		expect(sessionResult.status).toBe("loaded")
		const kinds = vi.mocked(getTemporaryDownloadUrl).mock.calls.map(([arg]) => arg.access?.kind)
		expect(kinds).toEqual(["share", "session"])
	})

	it("seeds an attachment-list URL for reuse by the preview coordinator", async () => {
		const source = {
			...createSource(6),
			directThumbnailUrl: "https://cdn.example.com/file-6-direct.jpg",
			directThumbnailExpiresAt: "2099-01-01 00:00:00",
			fileVersion: 3,
			updatedAt: "2026-09-08 10:00:00",
			resourceVersion: "resource-3",
		}
		seedProjectFileImagePreviewDirectUrls([source])

		await expect(requestProjectFileImagePreview(source)).resolves.toEqual({
			status: "loaded",
			item: {
				url: source.directThumbnailUrl,
				expiresAt: source.directThumbnailExpiresAt,
			},
		})
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("does not treat expired direct urls as usable", () => {
		const source = {
			...createSource(7),
			directThumbnailUrl: "https://cdn.example.com/file-7-direct.jpg",
			directThumbnailExpiresAt: "2026-09-09 14:00:10",
		}

		seedProjectFileImagePreviewDirectUrls([source])
		expect(isProjectFileImagePreviewDirectUrlUsable(source)).toBe(false)
	})

	it("does not re-seed a rejected direct url", () => {
		const source = {
			...createSource(8),
			directThumbnailUrl: "https://cdn.example.com/file-8-direct.jpg",
			directThumbnailExpiresAt: "2099-01-01 00:00:00",
		}

		seedProjectFileImagePreviewDirectUrls([source])
		invalidateProjectFileImagePreviewDirectUrl(source)
		seedProjectFileImagePreviewDirectUrls([source])

		expect(isProjectFileImagePreviewDirectUrlUsable(source)).toBe(false)
	})
	it("passes attachment version metadata through the shared URL resolver", async () => {
		const source = {
			...createSource(1),
			fileVersion: 7,
			updatedAt: "2026-09-04 10:00:00",
			resourceVersion: "resource-version-7",
		}
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce(createRows([source.fileId]))

		const request = requestProjectFileImagePreview(source)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)
		await expect(request).resolves.toMatchObject({ status: "loaded" })

		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: [source.fileId],
			file_versions: { [source.fileId]: 7 },
			download_mode: undefined,
			is_download: undefined,
			cache: undefined,
			options: {
				xMagicImageProcess: SHARED_MEDIA_THUMBNAIL_IMAGE_PROCESS,
			},
			enableErrorMessagePrompt: false,
		})
	})

	it("keeps signed urls in memory only and exchanges again after reset", async () => {
		const source = createSource(2)
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue(createRows([source.fileId]))

		const firstRequest = requestProjectFileImagePreview(source)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)
		await firstRequest

		const persistedPreviewKeys = Array.from(
			{ length: window.sessionStorage.length },
			(_, index) => window.sessionStorage.key(index),
		).filter((key) => key?.startsWith("magic:project-file-image-preview:v3:"))
		expect(persistedPreviewKeys).toEqual([])

		__resetProjectFileImagePreviewCoordinatorForTests()
		const secondRequest = requestProjectFileImagePreview(source)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)
		await secondRequest

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
	})

	it("removes legacy persisted preview entries without touching unrelated session data", () => {
		const legacyKey = "magic:project-file-image-preview:v3:legacy-preview"
		const unrelatedKey = "project-file-image-preview-test:unrelated"
		window.sessionStorage.setItem(legacyKey, "signed-url")
		window.sessionStorage.setItem(unrelatedKey, "keep")

		__resetProjectFileImagePreviewCoordinatorForTests()

		expect(window.sessionStorage.getItem(legacyKey)).toBeNull()
		expect(window.sessionStorage.getItem(unrelatedKey)).toBe("keep")
		window.sessionStorage.removeItem(unrelatedKey)
	})

	it("distinguishes unavailable previews from failed exchanges", async () => {
		const unavailableSource = createSource(20)
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([])

		const unavailableRequest = requestProjectFileImagePreview(unavailableSource)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)
		await expect(unavailableRequest).resolves.toEqual({ status: "unavailable" })

		const failedSource = createSource(21)
		const exchangeError = new Error("temporary exchange failure")
		vi.mocked(getTemporaryDownloadUrl).mockRejectedValueOnce(exchangeError)

		const failedRequest = requestProjectFileImagePreview(failedSource)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)
		await expect(failedRequest).resolves.toEqual({
			status: "failed",
			error: exchangeError,
		})
	})

	it("deduplicates the same cache key while its exchange is in flight", async () => {
		const source = createSource(3)
		let resolveExchange!: (rows: ReturnType<typeof createRows>) => void
		vi.mocked(getTemporaryDownloadUrl).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveExchange = resolve
				}),
		)

		const firstRequest = requestProjectFileImagePreview(source)
		const secondRequest = requestProjectFileImagePreview(source)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		resolveExchange(createRows([source.fileId]))
		await expect(firstRequest).resolves.toEqual(await secondRequest)
	})

	it("cancels a queued exchange only after its last consumer leaves", async () => {
		const sharedSource = createSource(4)
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce(createRows([sharedSource.fileId]))
		const firstConsumer = requestProjectFileImagePreview(sharedSource)
		const secondConsumer = requestProjectFileImagePreview(sharedSource)

		cancelProjectFileImagePreviewRequest(sharedSource.cacheKey)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		await expect(Promise.all([firstConsumer, secondConsumer])).resolves.toEqual([
			{
				status: "loaded",
				item: expect.objectContaining({
					url: expect.stringContaining(sharedSource.fileId),
				}),
			},
			{
				status: "loaded",
				item: expect.objectContaining({
					url: expect.stringContaining(sharedSource.fileId),
				}),
			},
		])

		const abandonedSource = createSource(5)
		const abandonedRequest = requestProjectFileImagePreview(abandonedSource)
		cancelProjectFileImagePreviewRequest(abandonedSource.cacheKey)
		await vi.advanceTimersByTimeAsync(projectFileImagePreviewCoordinatorConfig.batchDelayMs)

		await expect(abandonedRequest).resolves.toEqual({ status: "cancelled" })
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("keeps get-file-url batches within the fixed global concurrency limit", async () => {
		const sources = Array.from(
			{ length: projectFileImagePreviewCoordinatorConfig.batchSize * 2 + 1 },
			(_, index) => createSource(index + 10),
		)
		const pendingResolvers: Array<(value: ReturnType<typeof createRows>) => void> = []
		vi.mocked(getTemporaryDownloadUrl).mockImplementation(
			({ file_ids }) =>
				new Promise((resolve) => {
					pendingResolvers.push(() => resolve(createRows(file_ids)))
				}),
		)

		const allRequests = requestProjectFileImagePreviewBatch(sources)

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(
			projectFileImagePreviewCoordinatorConfig.maxConcurrency,
		)
		pendingResolvers[0](createRows([]))
		await Promise.resolve()
		await Promise.resolve()
		await vi.runOnlyPendingTimersAsync()

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(3)
		for (let index = 1; index < pendingResolvers.length; index += 1) {
			pendingResolvers[index](createRows([]))
		}
		await allRequests
	})
})
