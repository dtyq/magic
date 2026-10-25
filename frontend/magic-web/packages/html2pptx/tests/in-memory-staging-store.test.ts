import { describe, expect, it, vi } from "vitest"
import { createInMemoryStreamingStagingStore } from "../src/packaging/in-memory-staging-store"
import type { MediaSourceDescriptor } from "../src/media/source-descriptor"

const signalOptions = (signal?: AbortSignal) => (signal ? { signal } : {})

describe("createInMemoryStreamingStagingStore", () => {
	it("keeps bytes and Blob descriptors replayable", async () => {
		const store = createInMemoryStreamingStagingStore()
		await store.createSession("session-test")
		const bytes: MediaSourceDescriptor = {
			kind: "bytes",
			data: new Uint8Array([1, 2, 3]).buffer,
			key: "bytes",
			contentType: "image/png",
			extn: "png",
		}
		const blob = new Blob([new Uint8Array([4, 5])], { type: "image/jpeg" })
		const blobSource: MediaSourceDescriptor = {
			kind: "blob",
			blob,
			size: blob.size,
			key: "blob",
			contentType: "image/jpeg",
			extn: "jpg",
		}

		const stagedBytes = await store.stage(bytes)
		expect(stagedBytes).not.toBe(bytes)
		expect(
			new Uint8Array((stagedBytes as Extract<MediaSourceDescriptor, { kind: "bytes" }>).data),
		).toEqual(new Uint8Array([1, 2, 3]))
		expect(await store.stage(blobSource)).toBe(blobSource)
	})

	it("fetches URL and path descriptors into typed Blob descriptors", async () => {
		const fetch = vi.fn(
			async (resource: string) =>
				new Response(resource === "/asset.png" ? new Uint8Array([7, 8]) : "not image", {
					status: 200,
					headers: { "content-type": "text/plain" },
				}),
		)
		const store = createInMemoryStreamingStagingStore({ fetch })
		await store.createSession("session-fetch")
		const source: MediaSourceDescriptor = {
			kind: "url",
			url: "/asset.png",
			key: "asset",
			contentType: "image/png",
			extn: "png",
		}
		const pathSource: MediaSourceDescriptor = {
			kind: "path",
			path: "/asset.txt",
			key: "path",
			contentType: "text/plain",
			extn: "txt",
		}

		const staged = await store.stage(source)
		const stagedPath = await store.stage(pathSource)
		expect(staged).toMatchObject({
			kind: "blob",
			key: "asset",
			contentType: "image/png",
			extn: "png",
		})
		expect(stagedPath).toMatchObject({ kind: "blob", key: "path", contentType: "text/plain" })
		expect((staged as Extract<MediaSourceDescriptor, { kind: "blob" }>).blob.size).toBe(2)
		expect(fetch).toHaveBeenNthCalledWith(
			1,
			"/asset.png",
			expect.objectContaining({ signal: undefined }),
		)
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/asset.txt",
			expect.objectContaining({ signal: undefined }),
		)
	})

	it("rejects non-success responses and OPFS descriptors", async () => {
		const fetch = vi.fn(async () => new Response("missing", { status: 404 }))
		const store = createInMemoryStreamingStagingStore({ fetch })
		await store.createSession("session-errors")
		await expect(
			store.stage({
				kind: "url",
				url: "/missing",
				key: "missing",
				contentType: "image/png",
				extn: "png",
			}),
		).rejects.toThrow("HTTP 404")
		await expect(
			store.stage({
				kind: "opfs",
				sessionId: "session-other",
				path: "media/image.png",
				size: 1,
				key: "opfs",
				contentType: "image/png",
				extn: "png",
			}),
		).rejects.toThrow("cannot read OPFS")
	})

	it("passes AbortSignal to fetch and rejects an already aborted operation", async () => {
		const controller = new AbortController()
		const fetch = vi.fn(async (_resource: string, options: RequestInit) => {
			expect(options.signal).toBe(controller.signal)
			return new Response(new Uint8Array([1]), { status: 200 })
		})
		const store = createInMemoryStreamingStagingStore({ fetch })
		await store.createSession("session-abort")
		const source: MediaSourceDescriptor = {
			kind: "url",
			url: "/asset",
			key: "asset",
			contentType: "image/png",
			extn: "png",
		}
		await store.stage(source, signalOptions(controller.signal))
		expect(fetch).toHaveBeenCalledOnce()

		const aborted = new AbortController()
		aborted.abort()
		await expect(store.getSlideIr(1, signalOptions(aborted.signal))).rejects.toMatchObject({
			name: "AbortError",
		})
	})

	it("clones SlideIR so caller mutation and Worker transfer do not corrupt replay", async () => {
		const store = createInMemoryStreamingStagingStore()
		await store.createSession("session-slides")
		const source = {
			nodes: [
				{
					type: "image",
					source: {
						kind: "bytes",
						data: new Uint8Array([9, 8, 7]).buffer,
						key: "image",
						contentType: "image/png",
						extn: "png",
					},
				},
			],
		}
		await store.putSlideIr(1, source)
		new Uint8Array(source.nodes[0].source.data).fill(0)
		const replayed = await store.getSlideIr<typeof source>(1)
		expect(new Uint8Array(replayed.nodes[0].source.data)).toEqual(new Uint8Array([9, 8, 7]))

		replayed.nodes.length = 0
		const replayedAgain = await store.getSlideIr<typeof source>(1)
		expect(replayedAgain.nodes).toHaveLength(1)
		await store.deleteSlideIr?.(1)
		await expect(store.getSlideIr(1)).rejects.toThrow("was not found")
		await store.cleanupSession("session-slides")
		await expect(
			store.createSession("session-slides"),
			"session can be recreated after cleanup",
		).resolves.toBeUndefined()
	})
})
