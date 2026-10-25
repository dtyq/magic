import { describe, expect, it } from "vitest"
import { createTestResourceReferenceResolver } from "../../../../../public/__tests__/testResourceReferenceResolver"
import {
	pruneProtectedReferencePaths,
	reconcileProtectedReferencePaths,
	resolveExplicitPromptReferencePaths,
	resolveReferenceBindingState,
	unprotectPromptBoundReferencePaths,
} from "../../../../editors/message/reference-assets/referenceBinding"
import {
	decodePromptPlaceholdersWithLabels,
	parsePromptPlaceholderTokenMatches,
	resolvePromptPlaceholderDecodeLabels,
	resolvePromptPlaceholderTokenConfig,
} from "../../../../editors/message/reference-assets/promptPlaceholderTokenConfig"

const tokenConfig = resolvePromptPlaceholderTokenConfig((key, defaultValue) =>
	typeof defaultValue === "string" ? defaultValue : key,
)

const referenceFileInfos = [
	{
		path: "/design/images/a.png",
		fileName: "a.png",
		src: "/design/images/a.png",
		assetType: "image" as const,
	},
	{
		path: "/design/images/b.png",
		fileName: "b.png",
		src: "/design/images/b.png",
		assetType: "image" as const,
	},
]

const resolveDesignAResourceReference = createTestResourceReferenceResolver()

describe("imageReferenceBinding", () => {
	it("treats placeholder-bound references as prompt-linked", () => {
		const binding = resolveReferenceBindingState({
			prompt: "请参考[图片1]和[图片2]继续绘制",
			referenceFileInfos,
			tokenConfig,
		})

		expect(binding.mode).toBe("prompt-linked")
		expect(binding.explicitPromptReferencePaths).toEqual([
			"/design/images/a.png",
			"/design/images/b.png",
		])
		expect(binding.protectedReferencePaths).toEqual([])
	})

	it("treats lowercase english placeholder labels as prompt-linked", () => {
		const binding = resolveReferenceBindingState({
			prompt: "请参考[image1]和[image2]继续绘制",
			referenceFileInfos,
			tokenConfig,
		})

		expect(binding.mode).toBe("prompt-linked")
		expect(binding.explicitPromptReferencePaths).toEqual([
			"/design/images/a.png",
			"/design/images/b.png",
		])
		expect(binding.protectedReferencePaths).toEqual([])
	})

	it("parses lowercase english media placeholder labels", () => {
		expect(
			parsePromptPlaceholderTokenMatches("[image1] [video2] [audio3]", tokenConfig),
		).toEqual([
			expect.objectContaining({ kind: "image", label: "image", index: 1 }),
			expect.objectContaining({ kind: "video", label: "video", index: 2 }),
			expect.objectContaining({ kind: "audio", label: "audio", index: 3 }),
		])
	})

	it("decodes lowercase english image placeholders to mentions", () => {
		expect(
			decodePromptPlaceholdersWithLabels(
				"请参考[image1]继续绘制",
				[{ path: "/design/images/a.png", fileName: "a.png" }],
				resolvePromptPlaceholderDecodeLabels("image", tokenConfig),
				tokenConfig,
			),
		).toBe("请参考@a.png继续绘制")
	})

	it("keeps legacy references protected when prompt has no explicit binding", () => {
		const binding = resolveReferenceBindingState({
			prompt: "保持原有构图和光影",
			referenceFileInfos,
			tokenConfig,
		})

		expect(binding.mode).toBe("detached-legacy")
		expect(binding.explicitPromptReferencePaths).toEqual([])
		expect(binding.protectedReferencePaths).toEqual([
			"/design/images/a.png",
			"/design/images/b.png",
		])
	})

	it("recognizes mixed binding when only part of the restored references are explicit", () => {
		const binding = resolveReferenceBindingState({
			prompt: "请继续参考@b.png",
			referenceFileInfos,
			tokenConfig,
		})

		expect(binding.mode).toBe("mixed")
		expect(binding.explicitPromptReferencePaths).toEqual(["/design/images/b.png"])
		expect(binding.protectedReferencePaths).toEqual(["/design/images/a.png"])
	})

	it("resolves duplicate file-name mentions in restored reference order", () => {
		const duplicateReferenceInfos = [
			{ path: "/design/a/cat.png", fileName: "cat.png", src: "/design/a/cat.png" },
			{ path: "/design/b/cat.png", fileName: "cat.png", src: "/design/b/cat.png" },
		]

		expect(
			resolveExplicitPromptReferencePaths({
				prompt: "@cat.png @cat.png",
				referenceFileInfos: duplicateReferenceInfos,
				tokenConfig,
			}),
		).toEqual(["/design/a/cat.png", "/design/b/cat.png"])
	})

	it("prefers structured mention identity over same-name reference order", () => {
		const duplicateReferenceInfos = [
			{ path: "/design/a/cat.png", fileName: "cat.png", src: "/design/a/cat.png" },
			{ path: "/design/b/cat.png", fileName: "cat.png", src: "/design/b/cat.png" },
		]

		const binding = resolveReferenceBindingState({
			prompt: "@cat.png @cat.png",
			referenceFileInfos: duplicateReferenceInfos,
			tokenConfig,
			mentionBindings: [
				{ fileName: "cat.png", path: "/design/a/cat.png" },
				{ fileName: "cat.png", path: "/design/a/cat.png" },
			],
		})

		expect(binding.explicitPromptReferencePaths).toEqual(["/design/a/cat.png"])
		expect(binding.protectedReferencePaths).toEqual(["/design/b/cat.png"])
	})

	it("prunes removed protected references and unprotects prompt-bound legacy references", () => {
		expect(
			pruneProtectedReferencePaths(
				["/design/images/b.png"],
				["/design/images/a.png", "/design/images/b.png"],
			),
		).toEqual(["/design/images/b.png"])

		expect(
			unprotectPromptBoundReferencePaths(
				["/design/images/a.png", "/design/images/b.png"],
				["/design/images/b.png"],
			),
		).toEqual(["/design/images/a.png"])
	})

	it("protects opaque assets during sync without masking explicit mention removal", () => {
		expect(
			reconcileProtectedReferencePaths({
				referenceFileInfos: [
					{ path: "asset://virtual-human-asset-id" },
					{ path: "./images/reference.png" },
				],
				protectedReferencePaths: [],
				currentPrompt: "继续编辑 @asset://virtual-human-asset-id",
				previousPrompt: "继续编辑 @asset://virtual-human-asset-id",
				source: "user",
			}),
		).toEqual(["asset://virtual-human-asset-id"])

		expect(
			reconcileProtectedReferencePaths({
				referenceFileInfos: [{ path: "asset://virtual-human-asset-id" }],
				protectedReferencePaths: ["asset://virtual-human-asset-id"],
				currentPrompt: "继续编辑",
				previousPrompt: "继续编辑 @asset://virtual-human-asset-id",
				source: "user",
			}),
		).toEqual([])

		expect(
			reconcileProtectedReferencePaths({
				referenceFileInfos: [{ path: "asset://virtual-human-asset-id" }],
				protectedReferencePaths: ["asset://virtual-human-asset-id"],
				currentPrompt: "继续编辑",
				previousPrompt: "继续编辑",
				source: "user",
			}),
		).toEqual(["asset://virtual-human-asset-id"])
	})

	it("requires explicit editor context before treating an untyped opaque URI as an image", () => {
		const opaqueInfo = [{ path: "asset://image-id", fileName: "asset://image-id" }]

		expect(
			resolveExplicitPromptReferencePaths({
				prompt: "请参考[图片1]",
				referenceFileInfos: opaqueInfo,
				tokenConfig,
			}),
		).toEqual([])
		expect(
			resolveExplicitPromptReferencePaths({
				prompt: "请参考[图片1]",
				referenceFileInfos: opaqueInfo,
				tokenConfig,
				defaultAssetType: "image",
			}),
		).toEqual(["asset://image-id"])
	})

	it("keeps unresolved path spellings separate when no host context exists", () => {
		const equivalentInfos = [
			{ path: "./images/a.png", fileName: "a.png", src: "./images/a.png" },
		]
		const binding = resolveReferenceBindingState({
			prompt: "@a.png",
			referenceFileInfos: equivalentInfos,
			tokenConfig,
		})

		expect(binding.explicitPromptReferencePaths).toEqual(["./images/a.png"])
		expect(pruneProtectedReferencePaths(["/images/a.png"], ["./images/a.png"])).toEqual([])
		expect(unprotectPromptBoundReferencePaths(["./images/a.png"], ["/images/a.png"])).toEqual([
			"./images/a.png",
		])
	})

	it("uses host identity to distinguish workspace-root and current-canvas references", () => {
		expect(
			pruneProtectedReferencePaths(
				["/images/a.png"],
				["./images/a.png"],
				resolveDesignAResourceReference,
			),
		).toEqual([])
		expect(
			pruneProtectedReferencePaths(
				["/画布A/images/a.png"],
				["./images/a.png"],
				resolveDesignAResourceReference,
			),
		).toEqual(["./images/a.png"])
		expect(
			unprotectPromptBoundReferencePaths(
				["./images/a.png"],
				["/images/a.png"],
				resolveDesignAResourceReference,
			),
		).toEqual(["./images/a.png"])
	})
})
