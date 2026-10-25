import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	mediaResourceRegistry,
	mediaResourceRegistryTestUtils,
	useMediaResourceSnapshot,
	type MediaResourceRef,
	type MediaResourceResolver,
} from "../MediaResourceRegistry"

const imageRef: MediaResourceRef = {
	identity: "file-1",
	provider: "project-file",
	projectId: "project-1",
	fileId: "file-1",
	fileName: "cover.png",
	mediaType: "image",
}

describe("MediaResourceRegistry", () => {
	beforeEach(() => {
		mediaResourceRegistry.clear()
		vi.useRealTimers()
	})

	it("coalesces concurrent requests for the same rendition", async () => {
		let resolveRequest: ((value: { previewUrl: string; status: "ready" }) => void) | undefined
		const resolver = vi.fn<MediaResourceResolver>(
			() =>
				new Promise((resolve) => {
					resolveRequest = resolve
				}),
		)

		const first = mediaResourceRegistry.ensurePreview(imageRef, resolver)
		const second = mediaResourceRegistry.ensurePreview(imageRef, resolver)
		expect(resolver).toHaveBeenCalledTimes(1)

		resolveRequest?.({ previewUrl: "https://cdn.test/cover.png", status: "ready" })
		await Promise.all([first, second])
		expect(mediaResourceRegistry.getSnapshot(imageRef)).toMatchObject({
			status: "ready",
			previewUrl: "https://cdn.test/cover.png",
		})
	})

	it("refreshes a URL inside the expiry safety window", async () => {
		const resolver = vi
			.fn<MediaResourceResolver>()
			.mockResolvedValueOnce({
				previewUrl: "https://cdn.test/old.png",
				expiresAt: Date.now() + 1,
				status: "ready",
			})
			.mockResolvedValueOnce({
				previewUrl: "https://cdn.test/new.png",
				expiresAt: Date.now() + 60_000,
				status: "ready",
			})

		await mediaResourceRegistry.ensurePreview(imageRef, resolver)
		await mediaResourceRegistry.ensurePreview(imageRef, resolver)
		expect(resolver).toHaveBeenCalledTimes(2)
		expect(mediaResourceRegistry.getSnapshot(imageRef).previewUrl).toBe(
			"https://cdn.test/new.png",
		)
	})

	it("preserves the thumbnail when loading the preview rendition", async () => {
		const resolver = vi
			.fn<MediaResourceResolver>()
			.mockResolvedValueOnce({
				thumbnailUrl: "https://cdn.test/thumbnail.png",
				status: "ready",
			})
			.mockResolvedValueOnce({
				previewUrl: "https://cdn.test/thumbnail.png",
				thumbnailUrl: undefined,
				status: "ready",
			})

		await mediaResourceRegistry.ensureThumbnail(imageRef, resolver)
		await mediaResourceRegistry.ensurePreview(imageRef, resolver)

		expect(mediaResourceRegistry.getSnapshot(imageRef)).toMatchObject({
			thumbnailUrl: "https://cdn.test/thumbnail.png",
			previewUrl: "https://cdn.test/thumbnail.png",
			status: "ready",
		})
	})

	it("keeps the null hook snapshot referentially stable", async () => {
		const resolver = vi.fn<MediaResourceResolver>().mockResolvedValue(null)
		const { result, rerender } = renderHook(() =>
			useMediaResourceSnapshot(null, { resolver, loadThumbnail: false }),
		)
		const initialSnapshot = result.current.snapshot
		rerender()
		expect(result.current.snapshot).toBe(initialSnapshot)
	})

	it("notifies subscribers when a scope is cleared", async () => {
		const resolver = vi.fn<MediaResourceResolver>().mockResolvedValue({
			previewUrl: "https://cdn.test/cover.png",
			status: "ready",
		})
		const { result } = renderHook(() =>
			useMediaResourceSnapshot(imageRef, { resolver, loadThumbnail: false }),
		)
		await waitFor(() => expect(result.current.snapshot.previewUrl).toBeUndefined())

		await act(async () => {
			await mediaResourceRegistry.ensurePreview(imageRef, resolver)
		})
		expect(result.current.snapshot.previewUrl).toBe("https://cdn.test/cover.png")

		act(() => mediaResourceRegistry.clearScope({ projectId: "project-1" }))
		await waitFor(() => expect(result.current.snapshot.status).toBe("idle"))
	})

	it("builds keys with provider, project and media type", () => {
		expect(mediaResourceRegistryTestUtils.buildKey(imageRef)).toBe(
			"project-file|project-1|file-1|image",
		)
	})

	it("isolates scoped and versioned resources without changing the base key", () => {
		expect(
			mediaResourceRegistryTestUtils.buildKey({
				...imageRef,
				resourceVersion: "v2",
				scope: "org:o|user:u",
			}),
		).toBe("project-file|project-1|file-1|image|version:||v2|scope:org:o|user:u")
	})

	it("publishes provider-owned snapshots without starting a request", () => {
		mediaResourceRegistry.prime(imageRef, {
			status: "ready",
			previewSize: { width: 320, height: 180 },
		})

		expect(mediaResourceRegistry.getSnapshot(imageRef)).toMatchObject({
			status: "ready",
			previewSize: { width: 320, height: 180 },
		})
	})
})
