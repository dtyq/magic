import { describe, expect, it } from "vitest"
import {
	pruneProtectedReferencePaths,
	resolveExplicitPromptReferencePaths,
	resolveReferenceBindingState,
	unprotectPromptBoundReferencePaths,
} from "../../MessageEditor/reference-assets/referenceBinding"
import { resolvePromptPlaceholderTokenConfig } from "../../MessageEditor/reference-assets/promptPlaceholderTokenConfig"

const tokenConfig = resolvePromptPlaceholderTokenConfig((key, defaultValue) =>
	typeof defaultValue === "string" ? defaultValue : key,
)

const referenceFileInfos = [
	{ path: "/design/images/a.png", fileName: "a.png", src: "/design/images/a.png" },
	{ path: "/design/images/b.png", fileName: "b.png", src: "/design/images/b.png" },
]

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
})
