import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaPost, SelfMediaPostEntry, SelfMediaPostManifest } from "../types"
import {
	attachmentFileBaseName,
	buildResolvedPost,
	coerceSelfMediaPlatform,
	fileDirWithSlash,
	findDirectoryByRelativePath,
	parsePostManifest,
	type AttachmentNode,
} from "./selfMediaHelpers"

export interface SharedPostCandidate {
	postFile: AttachmentNode
	postFolder: AttachmentNode | null
	entry: string
}

export interface LoadedSharedPost {
	platform: SelfMediaPlatform
	entry: SelfMediaPostEntry
	post: SelfMediaPost
	postFileId: string
}

/** Build a manifest-less index from every post.json visible inside the shared tree. */
export function findSharedPostCandidates(
	tree: AttachmentNode[] | undefined,
	allFiles: AttachmentNode[],
	folderNode: AttachmentNode | null,
	folderRelativePath: string,
): SharedPostCandidate[] {
	if (!folderNode) return []
	const candidates = allFiles.filter((file) => {
		if (file.is_directory || attachmentFileBaseName(file).toLowerCase() !== "post.json") {
			return false
		}
		const path = file.relative_file_path || ""
		return folderRelativePath === "/" || path.startsWith(folderRelativePath)
	})

	return candidates.flatMap((postFile) => {
		const postPath = postFile.relative_file_path || ""
		const entry =
			folderRelativePath !== "/" && postPath.startsWith(folderRelativePath)
				? postPath.slice(folderRelativePath.length)
				: postPath.replace(/^\/+/, "")
		if (!entry) return []
		return [
			{
				postFile,
				postFolder: findDirectoryByRelativePath(tree, fileDirWithSlash(postFile)),
				entry,
			},
		]
	})
}

export function buildSharedPostSourceKey(candidates: SharedPostCandidate[]): string | null {
	if (candidates.length === 0) return null
	return candidates
		.map((candidate) => candidate.postFile.file_id || candidate.entry)
		.sort()
		.join("|")
}

/** Load only files that are already visible in the share permission boundary. */
export async function loadSharedPosts(
	candidates: SharedPostCandidate[],
	allFiles: AttachmentNode[],
	fileApi: Pick<FileApi, "getFileContentById">,
): Promise<LoadedSharedPost[]> {
	return Promise.all(candidates.map((candidate) => loadSharedPost(candidate, allFiles, fileApi)))
}

async function loadSharedPost(
	candidate: SharedPostCandidate,
	allFiles: AttachmentNode[],
	fileApi: Pick<FileApi, "getFileContentById">,
): Promise<LoadedSharedPost> {
	if (!candidate.postFile.file_id) throw new Error("postManifestMissing")

	const content = (await fileApi.getFileContentById(candidate.postFile.file_id, {
		responseType: "text",
	})) as string
	const manifest = parsePostManifest(content)
	if (!manifest) throw new Error("postManifestInvalid")

	const platform = resolveSharedPostPlatform(candidate, manifest)
	const entry: SelfMediaPostEntry = {
		id: String(manifest.id),
		name: String(
			manifest.meta?.title ||
				manifest.meta?.feedTitle ||
				attachmentFileBaseName(candidate.postFolder) ||
				manifest.id,
		),
		entry: candidate.entry,
	}
	return {
		platform,
		entry,
		post: buildResolvedPost(entry, manifest, allFiles, candidate.postFile),
		postFileId: candidate.postFile.file_id,
	}
}

function resolveSharedPostPlatform(
	candidate: SharedPostCandidate,
	manifest: SelfMediaPostManifest,
): SelfMediaPlatform {
	const folderDisplayConfig = candidate.postFolder?.display_config as
		Record<string, unknown> | undefined
	const manifestRecord = manifest as SelfMediaPostManifest & { platform?: unknown }
	const explicit =
		coerceSelfMediaPlatform(folderDisplayConfig?.platform) ||
		coerceSelfMediaPlatform(manifestRecord.platform) ||
		coerceSelfMediaPlatform(manifest.meta?.platform)
	if (explicit) return explicit
	if (manifest.article) return "wechat-official-accounts"

	const path = candidate.postFile.relative_file_path?.toLowerCase() || ""
	for (const platform of ["instagram", "rednote", "tiktok", "facebook", "x"] as const) {
		if (path.split("/").some((part) => part === platform || part.startsWith(`${platform}-`))) {
			return platform
		}
	}
	// Card-based posts historically default to Rednote when no platform metadata exists.
	return "rednote"
}
