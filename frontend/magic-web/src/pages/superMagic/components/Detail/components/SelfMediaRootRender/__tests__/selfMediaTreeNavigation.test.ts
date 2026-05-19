import { describe, expect, it } from "vitest"
import {
	createSelfMediaTreeNavigationIndex,
	getPlatformSlicesFromSelfMediaRoot,
	getPlatformSlicesFromRootFolderDisplayConfig,
	isSelfMediaPostRootFolderRow,
	resolveSelfMediaPostRootFolderRowResolution,
	resolveSelfMediaPostPlatform,
	resolveSelfMediaTreeNodeResolution,
	resolveSelfMediaTreeNavigationTarget,
} from "../utils/selfMediaTreeNavigation"
import type { AttachmentNode } from "../services/selfMediaHelpers"

function smRoot(overrides: Partial<AttachmentNode> = {}): AttachmentNode {
	return {
		file_id: "root-sm",
		is_directory: true,
		relative_file_path: "my-project/",
		display_config: { type: "self-media" },
		children: [],
		...overrides,
	}
}

describe("resolveSelfMediaTreeNavigationTarget", () => {
	it("resolves a nested file under posts/<id>/ to root and post id", () => {
		const root = smRoot({
			children: [
				{
					file_id: "html-1",
					is_directory: false,
					relative_file_path: "my-project/posts/post-abc/cards/1.html",
				} as AttachmentNode,
			],
		})
		const t = resolveSelfMediaTreeNavigationTarget([root], {
			file_id: "html-1",
			relative_file_path: "my-project/posts/post-abc/cards/1.html",
			is_directory: false,
		})
		expect(t).toEqual({
			rootFolderFileId: "root-sm",
			rootFolderRelativePath: "my-project",
			activePostId: "post-abc",
			initialView: "detail",
		})
	})

	it("returns null when the click is not under posts/ inside a self-media root", () => {
		const root = smRoot({
			children: [
				{
					file_id: "f",
					relative_file_path: "my-project/readme.md",
					is_directory: false,
				} as AttachmentNode,
			],
		})
		expect(
			resolveSelfMediaTreeNavigationTarget([root], {
				file_id: "f",
				relative_file_path: "my-project/readme.md",
				is_directory: false,
			}),
		).toBeNull()
	})

	it("returns null without a self-media root", () => {
		const t = resolveSelfMediaTreeNavigationTarget(
			[
				{
					file_id: "a",
					is_directory: true,
					relative_file_path: "x/",
					children: [
						{
							file_id: "b",
							relative_file_path: "x/posts/p1/x.html",
							is_directory: false,
						} as AttachmentNode,
					],
				} as AttachmentNode,
			],
			{ file_id: "b", relative_file_path: "x/posts/p1/x.html", is_directory: false },
		)
		expect(t).toBeNull()
	})
})

describe("isSelfMediaPostRootFolderRow", () => {
	it("is true only for the `posts/<id>` directory, not subfolders or files", () => {
		const postFolder = {
			file_id: "dir-post",
			is_directory: true,
			relative_file_path: "my-project/posts/post-abc/",
		} as AttachmentNode
		const subFolder = {
			file_id: "dir-cards",
			is_directory: true,
			relative_file_path: "my-project/posts/post-abc/cards/",
		} as AttachmentNode
		const file = {
			file_id: "f1",
			is_directory: false,
			relative_file_path: "my-project/posts/post-abc/cards/1.html",
		} as AttachmentNode
		const root = smRoot({
			children: [postFolder, subFolder, file] as unknown as AttachmentNode[],
		})
		const tree = [root]
		const nav = resolveSelfMediaTreeNavigationTarget(tree, postFolder)
		expect(nav).not.toBeNull()
		if (!nav) return
		expect(isSelfMediaPostRootFolderRow(tree, postFolder, nav)).toBe(true)
		expect(isSelfMediaPostRootFolderRow(tree, subFolder, nav)).toBe(false)
		expect(isSelfMediaPostRootFolderRow(tree, file, nav)).toBe(false)
	})

	it("resolves click navigation only for the post root folder row", () => {
		const postFolder = {
			file_id: "dir-post",
			is_directory: true,
			relative_file_path: "my-project/posts/post-abc/",
			display_config: { platform: "instagram" },
		} as AttachmentNode
		const subFolder = {
			file_id: "dir-cards",
			is_directory: true,
			relative_file_path: "my-project/posts/post-abc/cards/",
		} as AttachmentNode
		const file = {
			file_id: "f1",
			is_directory: false,
			relative_file_path: "my-project/posts/post-abc/cards/1.html",
		} as AttachmentNode
		const root = smRoot({ children: [postFolder, subFolder, file] })
		const tree = [root]

		expect(resolveSelfMediaPostRootFolderRowResolution(tree, postFolder)).toEqual({
			navigationTarget: {
				rootFolderFileId: "root-sm",
				rootFolderRelativePath: "my-project",
				activePostId: "post-abc",
				initialView: "detail",
			},
			targetPlatform: "instagram",
			folderIconPlatform: "instagram",
		})
		expect(resolveSelfMediaPostRootFolderRowResolution(tree, subFolder)).toBeNull()
		expect(resolveSelfMediaPostRootFolderRowResolution(tree, file)).toBeNull()
	})

	it("reuses a tree index for repeated row resolution", () => {
		const postFolder = {
			file_id: "dir-post",
			is_directory: true,
			relative_file_path: "my-project/posts/post-abc/",
			display_config: { platform: "instagram" },
		} as AttachmentNode
		const file = {
			file_id: "f1",
			is_directory: false,
			relative_file_path: "my-project/posts/post-abc/cards/1.html",
		} as AttachmentNode
		const root = smRoot({ children: [postFolder, file] })
		const index = createSelfMediaTreeNavigationIndex([root])

		expect(index.resolveNode(postFolder).folderIconPlatform).toBe("instagram")
		expect(index.resolvePostRootFolderClick(postFolder)?.navigationTarget?.activePostId).toBe(
			"post-abc",
		)
		expect(index.resolvePostRootFolderClick(file)).toBeNull()
	})
})

describe("platform slices / platform resolve", () => {
	it("reads self-media config from root folder display_config (no file fetch)", () => {
		const root = {
			file_id: "root-1",
			is_directory: true,
			relative_file_path: "p/",
			display_config: {
				type: "self-media",
				"self-media": {
					instagram: {
						posts: [{ id: "my-post", name: "T", entry: "posts/my-post/post.json" }],
					},
				},
			},
		} as import("../services/selfMediaHelpers").AttachmentNode
		const slices = getPlatformSlicesFromRootFolderDisplayConfig(root)
		expect(slices.length).toBeGreaterThan(0)
		const p = resolveSelfMediaPostPlatform([root], "root-1", "my-post", {
			display_config: undefined,
		})
		expect(p).toBe("instagram")
	})

	it("prefers display_config.platform on the post row", () => {
		const root = {
			file_id: "r",
			is_directory: true,
			relative_file_path: "p/",
			display_config: { type: "self-media" },
		} as import("../services/selfMediaHelpers").AttachmentNode
		const p = resolveSelfMediaPostPlatform([root], "r", "x", {
			display_config: { platform: "tiktok" },
		})
		expect(p).toBe("tiktok")
	})

	it("falls back to inline magic.project.js content when root metadata is absent", () => {
		const root = smRoot({
			children: [
				{
					file_id: "mpj",
					file_name: "magic.project.js",
					is_directory: false,
					relative_file_path: "my-project/magic.project.js",
					content: `
window.magicProjectConfig = {
	type: "self-media",
	"self-media": {
		instagram: {
			posts: [{ id: "post-1", name: "P1", entry: "posts/post-1/post.json" }]
		}
	}
}
window.magicProjectConfigure(window.magicProjectConfig)
`,
				} as AttachmentNode,
			],
		})
		expect(getPlatformSlicesFromSelfMediaRoot(root)).toHaveLength(1)
		expect(resolveSelfMediaPostPlatform([root], "root-sm", "post-1", null)).toBe("instagram")
	})

	it("returns null when neither metadata nor inline magic can resolve a platform", () => {
		const root = smRoot({
			children: [
				{
					file_id: "mpj",
					file_name: "magic.project.js",
					is_directory: false,
					relative_file_path: "my-project/magic.project.js",
				} as AttachmentNode,
			],
		})
		expect(resolveSelfMediaPostPlatform([root], "root-sm", "any", null)).toBeNull()
	})

	it("resolves click target and folder icon platform together", () => {
		const postFolder = {
			file_id: "dir-post",
			is_directory: true,
			relative_file_path: "my-project/posts/post-abc/",
			display_config: { platform: "instagram" },
		} as AttachmentNode
		const root = smRoot({
			display_config: {
				type: "self-media",
				"self-media": {
					instagram: {
						posts: [{ id: "post-abc", name: "ABC", entry: "posts/post-abc/post.json" }],
					},
				},
			},
			children: [postFolder],
		})
		expect(resolveSelfMediaTreeNodeResolution([root], postFolder)).toEqual({
			navigationTarget: {
				rootFolderFileId: "root-sm",
				rootFolderRelativePath: "my-project",
				activePostId: "post-abc",
				initialView: "detail",
			},
			targetPlatform: "instagram",
			folderIconPlatform: "instagram",
		})
	})
})
