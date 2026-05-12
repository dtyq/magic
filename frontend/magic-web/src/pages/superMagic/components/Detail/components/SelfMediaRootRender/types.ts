import type { ComponentType } from "react"
import type { DetailSelfMediaData, SelfMediaPlatform } from "../../types"

export type { SelfMediaInitialNavigation } from "../../types"

/** Pure helper output: which root to open and which post to select */
export interface SelfMediaTreeNavigationTarget {
	rootFolderFileId: string
	rootFolderRelativePath: string
	activePostId: string
	initialView: "detail"
}

export interface SelfMediaAttachmentNode {
	file_id?: string
	file_name?: string
	relative_file_path?: string
	is_directory?: boolean
	updated_at?: string
	children?: SelfMediaAttachmentNode[]
	[key: string]: unknown
}

/** Comment item under a self-media post */
export interface SelfMediaComment {
	name: string
	avatarColor?: string
	avatarChar?: string
	text: string
	time?: string
	location?: string
	likes?: string
	noBorder?: boolean
}

/** Post meta surfaced on feed/detail views */
export interface SelfMediaPostMeta {
	id: string
	title?: string
	subtitle?: string
	tags?: string
	author?: string
	feedTitle?: string
	feedLikes?: string
	commentCount?: string
	comments?: SelfMediaComment[]
	[key: string]: any
}

/** A single card in a post: relative HTML path + resolved fileId/url */
export interface SelfMediaCard {
	/** Original relative path in magic.project.js */
	path: string
	/** Resolved file_id from attachments tree */
	fileId?: string
	/** Resolved S3 download URL (lazy-fetched) */
	url?: string
	/**
	 * Versioning token sourced from the attachment's `updated_at`.
	 * Allows consumers to bust cached URLs / iframe sources when the
	 * underlying file content changes without its file_id changing.
	 */
	version?: string
}

/** A single self-media post */
export interface SelfMediaPost {
	meta: SelfMediaPostMeta
	cards: SelfMediaCard[]
	/** Single HTML article body (e.g. wechat-official-accounts) */
	article?: SelfMediaCard
	/** Landscape hero cover image for feed/list views */
	heroCover?: SelfMediaCard
	/** Square thumbnail cover for compact sub-cards */
	thumbnailCover?: SelfMediaCard
}

/** Lightweight entry in root magic.project.js */
export interface SelfMediaPostEntry {
	id: string
	name: string
	entry: string
}

/** Parsed post.json content for a single post */
export interface SelfMediaPostManifest {
	id: string
	meta?: SelfMediaPostMeta
	cards?: string[]
	/** Single HTML article relative path (wechat-official-accounts) */
	article?: string
	/** Landscape hero cover relative path */
	heroCover?: string
	/** Square thumbnail cover relative path */
	thumbnailCover?: string
}

/** Per-platform block inside the root `self-media` object */
export interface SelfMediaPlatformBlock {
	posts: Array<SelfMediaPost | SelfMediaPostEntry>
}

/** Parsed `self-media` map from magic.project.js */
export type SelfMediaConfig = Partial<Record<SelfMediaPlatform, SelfMediaPlatformBlock>>

/** View modes shared by every platform */
export type SelfMediaView = "feed" | "detail" | "scroll" | "edit" | "code"

/**
 * Common props passed from RootRender into each platform component.
 *
 * NOTE: All data + navigation state (posts / loading / error / active* / view,
 * plus the change/export callbacks) now live in `SelfMediaStore` and are read
 * via `useSelfMediaStore()` inside each platform implementation. Only the
 * tree-context + save callbacks that cannot live in the store remain here.
 */
export interface PlatformComponentProps {
	platform: SelfMediaPlatform
	attachmentList?: SelfMediaAttachmentNode[]
	/** Whether the user has permission to edit content */
	allowEdit?: boolean
	/** Save content callback from the parent Render component */
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
	/** Currently selected project */
	selectedProject?: any
}

/** Component contract every platform implementation must follow */
export type PlatformComponent = ComponentType<PlatformComponentProps>

/** Props for SelfMediaRootRender */
export interface SelfMediaRootRenderProps {
	data: DetailSelfMediaData
	attachments?: SelfMediaAttachmentNode[]
	attachmentList?: SelfMediaAttachmentNode[]
	className?: string
	[key: string]: any
}
