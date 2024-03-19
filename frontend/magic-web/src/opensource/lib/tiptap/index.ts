/**
 * TipTap modules loaded on demand
 */
export interface TipTapModules {
	Editor: typeof import("@tiptap/core").Editor
	StarterKit: typeof import("@tiptap/starter-kit").StarterKit
	Markdown: typeof import("tiptap-markdown").Markdown
	StorageImageNode: typeof import("@/opensource/components/tiptap-node/storage-image-node/storage-image-node-extension").StorageImageNode
	ProjectImageNode: typeof import("@/opensource/components/tiptap-node/project-image-node/project-image-node-extension").ProjectImageNode
}

/**
 * Load TipTap modules on demand
 */
export const loadTipTapModules = async (): Promise<TipTapModules> => {
	const [tiptapCore, starterKit, markdown, storageImageNode, projectImageNode] =
		await Promise.all([
			import("@tiptap/core"),
			import("@tiptap/starter-kit"),
			import("tiptap-markdown"),
			import("@/opensource/components/tiptap-node/storage-image-node/storage-image-node-extension"),
			import("@/opensource/components/tiptap-node/project-image-node/project-image-node-extension"),
		])

	return {
		Editor: tiptapCore.Editor,
		StarterKit: starterKit.StarterKit,
		Markdown: markdown.Markdown,
		StorageImageNode: storageImageNode.StorageImageNode,
		ProjectImageNode: projectImageNode.ProjectImageNode,
	}
}
