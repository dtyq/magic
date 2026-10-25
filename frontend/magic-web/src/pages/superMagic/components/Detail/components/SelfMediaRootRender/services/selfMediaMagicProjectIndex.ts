import { SuperMagicApi } from "@/apis"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { parseMagicProjectConfigContentWithRange } from "@/pages/superMagic/utils/magicProjectConfigParser"
import type { SelfMediaPlatform } from "../../../types"
import type { ArticleDetail } from "../components/SelfMediaInitPanel/types"
import type { SelfMediaPostPublishStatus } from "../types"
import { resolveArticleFolderName } from "./selfMediaArticleFolderName"
import {
	findMagicProjectJsUnderSelfMediaRoot,
	findNodeById,
	type AttachmentNode,
} from "./selfMediaHelpers"
import { buildArticlePostTargets, type ArticlePostTarget } from "./selfMediaPostPaths"

export interface SelfMediaPostIndexEntry {
	platform: SelfMediaPlatform
	id: string
	name: string
	entry: string
}

export interface RemoveSelfMediaPostIndexEntry {
	platform: SelfMediaPlatform
	id: string
	entry: string
}

export interface RenameSelfMediaPostIndexEntry {
	platform: SelfMediaPlatform
	id: string
	entry: string
	name: string
}

export interface SetSelfMediaPostPublishStatusIndexEntry {
	platform: SelfMediaPlatform
	id: string
	entry: string
	publishStatus?: SelfMediaPostPublishStatus
}

export interface PrefillSelfMediaMagicProjectIndexParams {
	articles: ArticleDetail[]
	attachmentList?: AttachmentNode[]
	folderFileId?: string
	postTargets?: ArticlePostTarget[]
	fileApi: Pick<FileApi, "getFileContentById">
}

interface SplitMagicProjectJsResult {
	config: MagicProjectConfig
	prefix: string
	suffix: string
}

interface MagicProjectConfig {
	[key: string]: unknown
	"self-media"?: SelfMediaConfig
}

interface SelfMediaConfig {
	[key: string]: PlatformPostsBlock | unknown
}

interface PlatformPostsBlock {
	[key: string]: unknown
	posts: SelfMediaPostIndexRecord[]
}

interface SelfMediaPostIndexRecord {
	[key: string]: unknown
	id: string
	name: string
	entry: string
	publishStatus?: SelfMediaPostPublishStatus
}

export function buildSelfMediaPostIndexEntries(
	articles: ArticleDetail[],
	postTargets?: ArticlePostTarget[],
): SelfMediaPostIndexEntry[] {
	return articles.map((article, index) => {
		const target =
			postTargets?.find((item) => item.articleIndex === index) ||
			buildArticlePostTargets({ articles })[index]
		const folderName = target?.folderName || resolveArticleFolderName(article, index)
		return {
			platform: article.platform,
			id: folderName,
			name: article.title,
			entry: target?.postEntry || `posts/${folderName}/post.json`,
		}
	})
}

export function upsertSelfMediaPostsIndex(
	content: string,
	entries: SelfMediaPostIndexEntry[],
): string {
	const { config, prefix, suffix } = splitMagicProjectJs(content)
	const selfMedia = ensureSelfMediaConfig(config)

	for (const entry of entries) {
		const platformBlock = ensurePlatformBlock(selfMedia, entry.platform)
		const postEntry = {
			id: entry.id,
			name: entry.name,
			entry: entry.entry,
		}
		const existingIndex = platformBlock.posts.findIndex(
			(item) => item && typeof item === "object" && item.id === entry.id,
		)

		if (existingIndex >= 0) {
			platformBlock.posts[existingIndex] = {
				...platformBlock.posts[existingIndex],
				...postEntry,
			}
			continue
		}

		platformBlock.posts.push(postEntry)
	}

	return `${prefix}${JSON.stringify(config, null, 2)}${suffix}`
}

export function removeSelfMediaPostFromIndex(
	content: string,
	target: RemoveSelfMediaPostIndexEntry,
): string {
	const { config, prefix, suffix } = splitMagicProjectJs(content)
	const selfMedia = ensureSelfMediaConfig(config)
	const platformBlock = selfMedia[target.platform]
	if (!isObjectRecord(platformBlock) || !Array.isArray(platformBlock.posts)) {
		return content
	}
	const nextPosts = platformBlock.posts.filter(
		(post) => post.id !== target.id && post.entry !== target.entry,
	)
	if (nextPosts.length === platformBlock.posts.length) return content
	platformBlock.posts = nextPosts

	return `${prefix}${JSON.stringify(config, null, 2)}${suffix}`
}

export function renameSelfMediaPostInIndex(
	content: string,
	target: RenameSelfMediaPostIndexEntry,
): string {
	const { config, prefix, suffix } = splitMagicProjectJs(content)
	const selfMedia = ensureSelfMediaConfig(config)
	const platformBlock = selfMedia[target.platform]
	if (!isObjectRecord(platformBlock) || !Array.isArray(platformBlock.posts)) {
		return content
	}

	let changed = false
	platformBlock.posts = platformBlock.posts.map((post) => {
		if (post.id !== target.id && post.entry !== target.entry) return post
		changed = true
		return {
			...post,
			name: target.name,
		}
	})
	if (!changed) return content

	return `${prefix}${JSON.stringify(config, null, 2)}${suffix}`
}

export function setSelfMediaPostPublishStatusInIndex(
	content: string,
	target: SetSelfMediaPostPublishStatusIndexEntry,
): string {
	const { config, prefix, suffix } = splitMagicProjectJs(content)
	const selfMedia = ensureSelfMediaConfig(config)
	const platformBlock = selfMedia[target.platform]
	if (!isObjectRecord(platformBlock) || !Array.isArray(platformBlock.posts)) {
		return content
	}

	let changed = false
	platformBlock.posts = platformBlock.posts.map((post) => {
		if (post.id !== target.id && post.entry !== target.entry) return post
		const nextPost = { ...post }
		changed = true
		if (target.publishStatus) {
			nextPost.publishStatus = target.publishStatus
		} else {
			delete nextPost.publishStatus
		}
		return nextPost
	})
	if (!changed) return content

	return `${prefix}${JSON.stringify(config, null, 2)}${suffix}`
}

export async function prefillSelfMediaMagicProjectIndex({
	articles,
	attachmentList,
	folderFileId,
	postTargets,
	fileApi,
}: PrefillSelfMediaMagicProjectIndexParams): Promise<void> {
	if (!articles.length) return

	const rootNode = findNodeById(attachmentList, folderFileId)
	const magicProjectFile = findMagicProjectJsUnderSelfMediaRoot(rootNode)
	const magicProjectFileId = magicProjectFile?.file_id?.toString()
	if (!magicProjectFileId) throw new Error("magicProjectNotFound")

	const content = (await fileApi.getFileContentById(magicProjectFileId, {
		responseType: "text",
	})) as string
	const entries = buildSelfMediaPostIndexEntries(articles, postTargets)
	const updatedContent = upsertSelfMediaPostsIndex(content, entries)

	await SuperMagicApi.saveFileContent([
		{
			file_id: magicProjectFileId,
			content: updatedContent,
			enable_shadow: true,
		},
	])
}

function splitMagicProjectJs(content: string): SplitMagicProjectJsResult {
	const parsed = parseMagicProjectConfigContentWithRange(content)
	if (!parsed) throw new Error("Invalid magic.project.js")

	return {
		config: parsed.config as MagicProjectConfig,
		prefix: content.slice(0, parsed.startIndex),
		suffix: content.slice(parsed.endIndex),
	}
}

function ensureSelfMediaConfig(config: MagicProjectConfig): SelfMediaConfig {
	const current = config["self-media"]
	if (isObjectRecord(current)) return current as SelfMediaConfig

	config["self-media"] = {}
	return config["self-media"]
}

function ensurePlatformBlock(
	selfMedia: SelfMediaConfig,
	platform: SelfMediaPlatform,
): PlatformPostsBlock {
	const current = selfMedia[platform]
	if (isObjectRecord(current)) {
		const block = current as PlatformPostsBlock
		if (!Array.isArray(block.posts)) block.posts = []
		return block
	}

	selfMedia[platform] = { posts: [] }
	return selfMedia[platform] as PlatformPostsBlock
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
