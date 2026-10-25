import { describe, expect, it, vi } from "vitest"
import type { ResolveCanvasResourceReference } from "../../../../public/resource-reference"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import {
	areCanvasResourceReferencesSame,
	buildAssetResourcePath,
	getCanvasResourceAvailability,
	getCanvasResourceFileName,
	getCanvasResourceReferenceIdentity,
	isAssetResourcePath,
	isAssetResourceScheme,
	isOpaqueAssetReference,
	normalizeCanvasUploadFileResponsePath,
	parseAssetResourcePath,
	resolveCanvasGeneratedResourceStoragePath,
	resolveCanvasStorageResourceReference,
} from "../canvasResourcePath"

describe("canvasResourcePath", () => {
	it("uses one canonical builder and parser for asset references", () => {
		expect(buildAssetResourcePath(" 958528842662629376 ")).toBe("asset://958528842662629376")
		expect(parseAssetResourcePath(" ASSET://reference.png ")).toBe("reference.png")
		expect(isAssetResourcePath("asset://virtual-human-asset-id")).toBe(true)
		expect(isAssetResourceScheme("asset://invalid/id")).toBe(true)
		expect(isAssetResourcePath("asset://invalid/id")).toBe(false)
		expect(isAssetResourcePath("asset://invalid\\id")).toBe(false)
		expect(isAssetResourcePath("asset://asset-id?version=1")).toBe(false)
		expect(() => buildAssetResourcePath("asset/id")).toThrow()

		expect(isOpaqueAssetReference("asset://virtual-human-asset-id")).toBe(true)
		expect(isOpaqueAssetReference("asset:/virtual-human-asset-id")).toBe(false)
		expect(
			normalizeCanvasUploadFileResponsePath({
				path: " ASSET://virtual-human-asset-id ",
			}),
		).toEqual({ path: "asset://virtual-human-asset-id" })
		expect(normalizeCanvasUploadFileResponsePath({ path: "asset://invalid/id" })).toEqual({
			path: "asset://invalid/id",
		})
	})

	it("keeps unresolved identities exact when no host resolver is available", () => {
		expect(getCanvasResourceReferenceIdentity("./images/a.png")).toBe(
			"unresolved:./images/a.png",
		)
		expect(getCanvasResourceReferenceIdentity("/images/a.png")).toBe("unresolved:/images/a.png")
		expect(areCanvasResourceReferencesSame("./images/a.png", "/images/a.png")).toBe(false)
	})

	it("uses structured host identities without weak fallback for unresolved references", () => {
		const resolveResourceReference: ResolveCanvasResourceReference = vi.fn((input) => {
			const path =
				input.namespace === "external-url"
					? input.url
					: "path" in input
						? input.path
						: input.fileId
			if (path === "./images/a.png" || path === "/画布A/images/a.png") {
				return {
					status: "resolved" as const,
					resourceKind: "workspace-file" as const,
					rawReference: path || "",
					workspacePath: "/画布A/images/a.png",
					storagePath: "./images/a.png",
					identity: "workspace:/画布A/images/a.png",
					candidates: ["/画布A/images/a.png"],
					legacyRecovered: false,
					resolutionSource: "strict-path" as const,
				}
			}
			return {
				status: "ambiguous" as const,
				rawReference: path || "",
				candidates: [],
			}
		})

		expect(
			areCanvasResourceReferencesSame(
				"./images/a.png",
				"/画布A/images/a.png",
				resolveResourceReference,
			),
		).toBe(true)
		expect(
			areCanvasResourceReferencesSame(
				"./images/a.png",
				"/images/a.png",
				resolveResourceReference,
			),
		).toBe(false)
		expect(getCanvasResourceReferenceIdentity("/images/a.png", resolveResourceReference)).toBe(
			"unresolved:/images/a.png",
		)
	})

	it("routes historical bare paths only through legacy recovery", () => {
		const resolveResourceReference = vi.fn(createTestResourceReferenceResolver())

		resolveCanvasStorageResourceReference("images/a.png", resolveResourceReference)
		resolveCanvasStorageResourceReference("./images/a.png", resolveResourceReference)

		expect(resolveResourceReference).toHaveBeenNthCalledWith(
			1,
			{
				namespace: "canvas-storage",
				path: "images/a.png",
				mode: "legacy-recovery",
			},
			undefined,
		)
		expect(resolveResourceReference).toHaveBeenNthCalledWith(
			2,
			{
				namespace: "canvas-storage",
				path: "./images/a.png",
				mode: "strict-current-canvas",
			},
			undefined,
		)
	})

	it("marks only the exact missing attachment path as deleted", () => {
		const resolveResourceReference = createTestResourceReferenceResolver({
			currentCanvasWorkspacePath: "/画布A",
			attachmentsReady: true,
			attachmentPathsByFileId: {
				current: "/画布A/images/same.png",
			},
		})

		expect(getCanvasResourceAvailability("./images/same.png", resolveResourceReference)).toBe(
			"available",
		)
		expect(
			getCanvasResourceAvailability("/images/images/same.png", resolveResourceReference),
		).toBe("deleted")
	})

	it("does not treat an incomplete attachment snapshot as deletion", () => {
		const resolveResourceReference = createTestResourceReferenceResolver({
			attachmentsReady: false,
		})

		expect(
			getCanvasResourceAvailability("./images/pending.png", resolveResourceReference),
		).toBe("pending")
	})

	it("normalizes upload storage paths and file response paths", () => {
		expect(normalizeCanvasUploadFileResponsePath({ path: "/imagesimage_x.png" }).path).toBe(
			"/images/image_x.png",
		)
		expect(normalizeCanvasUploadFileResponsePath({ path: "imagesimage_x.png" }).path).toBe(
			"images/image_x.png",
		)
		expect(normalizeCanvasUploadFileResponsePath({ path: "/audiosaudio_x.mp3" }).path).toBe(
			"/audios/audio_x.mp3",
		)
		expect(normalizeCanvasUploadFileResponsePath({ path: "/videosvideo_x.mp4" }).path).toBe(
			"/videos/video_x.mp4",
		)
	})

	it("derives generated upload paths from the workspace namespace", () => {
		const resolveResourceReference = createTestResourceReferenceResolver()
		const host = {
			magicConfigManager: { config: { methods: { resolveResourceReference } } },
		}

		expect(resolveCanvasGeneratedResourceStoragePath(host, "/画布A/images/", "x.png")).toBe(
			"./images/x.png",
		)
		expect(resolveCanvasGeneratedResourceStoragePath(host, "/images/", "x.png")).toBe(
			"/images/x.png",
		)
		expect(resolveCanvasGeneratedResourceStoragePath(host, "/画布B/images/", "x.png")).toBe(
			"/画布B/images/x.png",
		)
		expect(resolveCanvasGeneratedResourceStoragePath(host, "images", "x.png")).toBe(
			"/images/x.png",
		)
		expect(
			resolveCanvasGeneratedResourceStoragePath(undefined, "/images/", "x.png"),
		).toBeUndefined()
		expect(
			resolveCanvasGeneratedResourceStoragePath(host, "https://example.test/images", "x.png"),
		).toBeUndefined()
	})

	it("extracts file names from urls and paths", () => {
		expect(getCanvasResourceFileName("https://cdn.test/a/b/cat.png?x=1#top")).toBe("cat.png")
		expect(getCanvasResourceFileName("C:\\temp\\dog.mp4?x=1")).toBe("dog.mp4")
		expect(getCanvasResourceFileName("")).toBe("")
	})
})
