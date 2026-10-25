import type { SelfMediaPlatform } from "../../../../types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"

/** An outline node in the tree structure */
export interface OutlineNode {
	id: string
	text: string
	children?: OutlineNode[]
	/** Optional reference attachments bound to this outline point */
	materials?: MaterialItem[]
}

/** Reference file (local upload or project file) */
export interface ReferenceFileValue {
	name: string
	content: string
	/** text content or data-url for binary/image files */
	kind?: "text" | "data-url"
	/** Present when file was picked from the project workspace */
	file_id?: string
	/** Workspace-relative path, e.g. "posts/foo/ref.png" */
	file_path?: string
}

/** A material item with file and description */
export interface MaterialItem {
	/** Unique id for list key */
	id: string
	/** The File object (local, before upload) */
	file: File
	/** Local preview URL (object URL) */
	previewUrl: string
	/** User-provided description/note for this material */
	description: string
	/** After upload: the remote file path/key */
	uploadedPath?: string
}

/** Per-article detailed planning */
export interface ArticleDetail {
	/** Article title */
	title: string
	/** Custom folder name (optional, auto-generated if empty) */
	folderName: string
	/** Content style/tone for this article */
	style: string
	/** Visual CSS+JS preset ID (e.g. "neo-brutalism", "dark-tech", "none") */
	visualPreset?: string
	/** Tree-structured outline */
	outline: OutlineNode[]
	/** Number of cards (for card-based platforms) */
	cardCount: number
	/** Attached materials with descriptions */
	materials: MaterialItem[]
	/** Reference files for content (uploaded or picked from project) */
	referenceFiles?: ReferenceFileValue[]
	/** Additional notes/instructions */
	notes: string
	/** Target platform for this article */
	platform: SelfMediaPlatform
	/** User's casual description (voice/text input) */
	description?: string
	/** Rich JSON content for the description (used by MagicPromptEditor) */
	descriptionJson?: JSONContent
	/** Reference files for custom visual style */
	visualReferenceFiles?: ReferenceFileValue[]
	/** Rich JSON content for visual description (used by MagicPromptEditor in custom mode) */
	visualDescriptionJson?: JSONContent
}

/** A brand image/asset uploaded by the user */
export interface BrandImageItem {
	/** Unique id for list key */
	id: string
	/** The File object (local, before upload) */
	file: File
	/** Local preview URL (object URL for images) */
	previewUrl: string
	/** User-provided description/note for this brand image */
	description: string
	/** Whether this file is an image (for preview) */
	isImage: boolean
	/** After upload: the remote file path/key */
	uploadedPath?: string
}

/** Global settings collected in brand info step */
export interface SelfMediaInitGlobalSettings {
	/** Account/author name */
	author: string
	/** Brand/IP positioning (one sentence) */
	brandPosition: string
	/** Target audience (optional) */
	targetAudience: string
	/** Brand image/IP assets for image generation reference */
	brandImages: BrandImageItem[]
}

/** Full data model for the init panel */
export interface SelfMediaInitData {
	global: SelfMediaInitGlobalSettings
	articles: ArticleDetail[]
}

/** Style presets — labels resolved via i18n key: selfMedia.initPanel.styles.{value} */
export const STYLE_PRESETS = [
	{ value: "professional", labelKey: "detail.selfMedia.initPanel.styles.professional" },
	{ value: "casual", labelKey: "detail.selfMedia.initPanel.styles.casual" },
	{ value: "storytelling", labelKey: "detail.selfMedia.initPanel.styles.storytelling" },
	{ value: "tutorial", labelKey: "detail.selfMedia.initPanel.styles.tutorial" },
	{ value: "emotional", labelKey: "detail.selfMedia.initPanel.styles.emotional" },
	{ value: "custom", labelKey: "detail.selfMedia.initPanel.styles.custom" },
] as const

/** Platforms that are currently implemented */
export const IMPLEMENTED_PLATFORMS: SelfMediaPlatform[] = [
	"rednote",
	"instagram",
	"wechat-official-accounts",
]

/** All platforms including upcoming — labels resolved via i18n key: selfMedia.initPanel.platforms.{value} */
export const ALL_PLATFORMS: Array<{
	value: SelfMediaPlatform
	labelKey: string
	disabled: boolean
}> = [
	{ value: "rednote", labelKey: "detail.selfMedia.initPanel.platforms.rednote", disabled: false },
	{
		value: "instagram",
		labelKey: "detail.selfMedia.initPanel.platforms.instagram",
		disabled: false,
	},
	{
		value: "wechat-official-accounts",
		labelKey: "detail.selfMedia.initPanel.platforms.wechatOfficialAccounts",
		disabled: false,
	},
	{ value: "tiktok", labelKey: "detail.selfMedia.initPanel.platforms.tiktok", disabled: true },
	{ value: "x", labelKey: "detail.selfMedia.initPanel.platforms.x", disabled: true },
	{
		value: "facebook",
		labelKey: "detail.selfMedia.initPanel.platforms.facebook",
		disabled: true,
	},
	{
		value: "wechat-channels",
		labelKey: "detail.selfMedia.initPanel.platforms.wechatChannels",
		disabled: true,
	},
]

/** Visual presets organized by platform — maps to backend skill presets/ directory */
export interface VisualPresetOption {
	value: string
	labelKey: string
	descriptionKey: string
	platforms: SelfMediaPlatform[]
	preview?: {
		sourcePath: string
		/** Static long image generated from preview.html, served from frontend public/. */
		imageUrl?: string
	}
	/** CSS gradient or color hint used by the compact layout mark. */
	swatch?: string
}

export const VISUAL_PRESETS: VisualPresetOption[] = [
	{
		value: "neo-brutalism",
		labelKey: "detail.selfMedia.initPanel.visuals.neoBrutalism.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.neoBrutalism.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/neo-brutalism/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/neo-brutalism.webp",
		},
		swatch: "linear-gradient(135deg, #fafaf8 0%, #ffe566 52%, #ff2442 100%)",
	},
	{
		value: "code-dispatch",
		labelKey: "detail.selfMedia.initPanel.visuals.codeDispatch.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.codeDispatch.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/code-dispatch/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/code-dispatch.webp",
		},
		swatch: "linear-gradient(135deg, #0f1923 0%, #1a3a4a 50%, #00d2d3 100%)",
	},
	{
		value: "dark-tech",
		labelKey: "detail.selfMedia.initPanel.visuals.darkTech.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.darkTech.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/dark-tech/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/dark-tech.webp",
		},
		swatch: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #d4af37 100%)",
	},
	{
		value: "gradient-editorial",
		labelKey: "detail.selfMedia.initPanel.visuals.gradientEditorial.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.gradientEditorial.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/gradient-editorial/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/gradient-editorial.webp",
		},
		swatch: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #a78bfa 100%)",
	},
	{
		value: "personal-insight",
		labelKey: "detail.selfMedia.initPanel.visuals.personalInsight.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.personalInsight.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/personal-insight/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/personal-insight.webp",
		},
		swatch: "linear-gradient(135deg, #ffffff 0%, #f0f7ff 50%, #1a73e8 100%)",
	},
	{
		value: "film-vintage",
		labelKey: "detail.selfMedia.initPanel.visuals.filmVintage.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.filmVintage.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/film-vintage/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/film-vintage.webp",
		},
		swatch: "linear-gradient(135deg, #0f0d0a 0%, #6f1d1b 50%, #f2dfb8 100%)",
	},
	{
		value: "warm-journal",
		labelKey: "detail.selfMedia.initPanel.visuals.warmJournal.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.warmJournal.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/warm-journal/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/warm-journal.webp",
		},
		swatch: "linear-gradient(135deg, #0a0a0a 0%, #c5bba5 52%, #f5f0e6 100%)",
	},
	{
		value: "paper-column",
		labelKey: "detail.selfMedia.initPanel.visuals.paperColumn.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.paperColumn.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/paper-column/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/paper-column.webp",
		},
		swatch: "linear-gradient(135deg, #f5f1ea 0%, #dbe7f0 54%, #567493 100%)",
	},
	{
		value: "signal-grid",
		labelKey: "detail.selfMedia.initPanel.visuals.signalGrid.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.signalGrid.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/signal-grid/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/signal-grid.webp",
		},
		swatch: "linear-gradient(135deg, #fbfbfa 0%, #111111 58%, #1f5fe8 100%)",
	},
	{
		value: "product-launch-preset",
		labelKey: "detail.selfMedia.initPanel.visuals.productLaunch.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.productLaunch.description",
		platforms: ["rednote"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/rednote/product-launch-preset/preview.html",
			imageUrl: "/self-media-preset-previews/rednote/product-launch-preset.webp",
		},
		swatch: "linear-gradient(135deg, #FFFFFF 0%, #FFF5F5 50%, #E63946 100%)",
	},

	{
		value: "ins-modern",
		labelKey: "detail.selfMedia.initPanel.visuals.insModern.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insModern.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-modern/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-modern.webp",
		},
		swatch: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #e9ecef 100%)",
	},
	{
		value: "ins-minimal",
		labelKey: "detail.selfMedia.initPanel.visuals.insMinimal.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insMinimal.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-minimal/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-minimal.webp",
		},
		swatch: "linear-gradient(135deg, #ffffff 0%, #f7f2ea 50%, #151515 100%)",
	},
	{
		value: "ins-dark",
		labelKey: "detail.selfMedia.initPanel.visuals.insDark.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insDark.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-dark/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-dark.webp",
		},
		swatch: "linear-gradient(135deg, #080a12 0%, #6d28d9 52%, #14f1d9 100%)",
	},
	{
		value: "ins-fluent-depth",
		labelKey: "detail.selfMedia.initPanel.visuals.insFluentDepth.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insFluentDepth.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-fluent-depth/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-fluent-depth.webp",
		},
		swatch: "linear-gradient(135deg, #f5f7fb 0%, #2563eb 52%, #7c3aed 100%)",
	},
	{
		value: "ins-retro",
		labelKey: "detail.selfMedia.initPanel.visuals.insRetro.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insRetro.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-retro/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-retro.webp",
		},
		swatch: "linear-gradient(135deg, #2f1b12 0%, #c2410c 52%, #f7d08a 100%)",
	},
	{
		value: "ins-creator-studio",
		labelKey: "detail.selfMedia.initPanel.visuals.insCreatorStudio.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insCreatorStudio.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-creator-studio/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-creator-studio.webp",
		},
		swatch: "linear-gradient(135deg, #fffdf8 0%, #d97706 48%, #2563eb 100%)",
	},
	{
		value: "ins-film-frame",
		labelKey: "detail.selfMedia.initPanel.visuals.insFilmFrame.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insFilmFrame.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-film-frame/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-film-frame.webp",
		},
		swatch: "linear-gradient(135deg, #11100e 0%, #e23d28 50%, #d6a64f 100%)",
	},
	{
		value: "ins-warm-journal",
		labelKey: "detail.selfMedia.initPanel.visuals.insWarmJournal.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insWarmJournal.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-warm-journal/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-warm-journal.webp",
		},
		swatch: "linear-gradient(135deg, #f3e7d3 0%, #c75d38 48%, #4f7b69 100%)",
	},
	{
		value: "ins-signal-grid",
		labelKey: "detail.selfMedia.initPanel.visuals.insSignalGrid.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insSignalGrid.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-signal-grid/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-signal-grid.webp",
		},
		swatch: "linear-gradient(135deg, #f8fafc 0%, #0ea5e9 52%, #111827 100%)",
	},
	{
		value: "ins-token-system",
		labelKey: "detail.selfMedia.initPanel.visuals.insTokenSystem.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.insTokenSystem.description",
		platforms: ["instagram"],
		preview: {
			sourcePath:
				"backend/super-magic/agents/skills/self-media-composer/presets/instagram/ins-token-system/preview.html",
			imageUrl: "/self-media-preset-previews/instagram/ins-token-system.webp",
		},
		swatch: "linear-gradient(135deg, #f7f8fa 0%, #1868db 52%, #172b4d 100%)",
	},
	{
		value: "custom",
		labelKey: "detail.selfMedia.initPanel.visuals.custom.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.custom.description",
		platforms: ["rednote", "instagram", "wechat-official-accounts"],
		swatch: "linear-gradient(135deg, #a29bfe 0%, #fd79a8 50%, #fdcb6e 100%)",
	},
	{
		value: "none",
		labelKey: "detail.selfMedia.initPanel.visuals.none.label",
		descriptionKey: "detail.selfMedia.initPanel.visuals.none.description",
		platforms: ["rednote", "instagram", "wechat-official-accounts"],
		swatch: "linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)",
	},
]

const VISUAL_PRESET_DISPLAY_ORDER: Partial<Record<SelfMediaPlatform, string[]>> = {
	rednote: [
		"personal-insight",
		"code-dispatch",
		"signal-grid",
		"product-launch-preset",
		"paper-column",
		"gradient-editorial",
		"neo-brutalism",
		"dark-tech",
		"warm-journal",
		"film-vintage",
		"custom",
		"none",
	],
	instagram: [
		"ins-modern",
		"ins-minimal",
		"ins-fluent-depth",
		"ins-dark",
		"ins-retro",
		"ins-creator-studio",
		"ins-film-frame",
		"ins-warm-journal",
		"ins-signal-grid",
		"ins-token-system",
		"custom",
		"none",
	],
}

/** Get visual presets available for a given platform */
export function getVisualPresetsForPlatform(platform: SelfMediaPlatform): VisualPresetOption[] {
	const orderedValues = VISUAL_PRESET_DISPLAY_ORDER[platform]
	const orderIndex = new Map(orderedValues?.map((value, index) => [value, index]) ?? [])

	return VISUAL_PRESETS.filter((p) => p.platforms.includes(platform)).sort((a, b) => {
		const aIndex = orderIndex.get(a.value) ?? Number.MAX_SAFE_INTEGER
		const bIndex = orderIndex.get(b.value) ?? Number.MAX_SAFE_INTEGER

		return aIndex - bIndex
	})
}

export function getVisualPresetValuesForPrompt(platform: SelfMediaPlatform): string[] {
	return getVisualPresetsForPlatform(platform)
		.map((preset) => preset.value)
		.filter((value) => value !== "custom")
}

export function getAllVisualPresetValuesForPrompt(): string[] {
	return Array.from(
		new Set(VISUAL_PRESETS.map((preset) => preset.value).filter((value) => value !== "custom")),
	)
}

/** Collect article-level and outline-bound reference materials */
export function collectArticleMaterials(article: ArticleDetail): MaterialItem[] {
	const items = [...(article.materials || [])]
	const visit = (nodes: OutlineNode[]) => {
		for (const node of nodes) {
			if (node.materials?.length) items.push(...node.materials)
			if (node.children?.length) visit(node.children)
		}
	}
	visit(article.outline || [])
	return items
}

function hasMeaningfulText(value?: string): boolean {
	return Boolean(value?.trim())
}

function hasMeaningfulRichText(value: unknown): boolean {
	if (!value) return false
	if (typeof value === "string") return hasMeaningfulText(value)
	if (Array.isArray(value)) return value.some(hasMeaningfulRichText)
	if (typeof value !== "object") return false

	const record = value as Record<string, unknown>
	if (typeof record.text === "string" && hasMeaningfulText(record.text)) return true
	return Object.entries(record).some(
		([key, child]) => key !== "type" && hasMeaningfulRichText(child),
	)
}

function hasMeaningfulReferenceFile(file: ReferenceFileValue): boolean {
	return Boolean(
		hasMeaningfulText(file.name) ||
		hasMeaningfulText(file.content) ||
		hasMeaningfulText(file.file_id) ||
		hasMeaningfulText(file.file_path),
	)
}

function hasMeaningfulMaterial(material: MaterialItem): boolean {
	return Boolean(
		hasMeaningfulText(material.description) ||
		hasMeaningfulText(material.uploadedPath) ||
		material.file?.size > 0,
	)
}

function hasMeaningfulOutline(nodes: OutlineNode[] | undefined): boolean {
	if (!nodes?.length) return false
	return nodes.some(
		(node) =>
			hasMeaningfulText(node.text) ||
			node.materials?.some(hasMeaningfulMaterial) ||
			hasMeaningfulOutline(node.children),
	)
}

export function hasMeaningfulArticleDraftContent(article: ArticleDetail): boolean {
	return Boolean(
		hasMeaningfulText(article.title) ||
		hasMeaningfulText(article.description) ||
		hasMeaningfulText(article.notes) ||
		hasMeaningfulRichText(article.descriptionJson) ||
		hasMeaningfulOutline(article.outline) ||
		article.materials?.some(hasMeaningfulMaterial) ||
		article.referenceFiles?.some(hasMeaningfulReferenceFile) ||
		article.visualReferenceFiles?.some(hasMeaningfulReferenceFile) ||
		hasMeaningfulRichText(article.visualDescriptionJson),
	)
}

export function hasMeaningfulSelfMediaDraftData(data: SelfMediaInitData): boolean {
	return data.articles.some(hasMeaningfulArticleDraftContent)
}

/** Default card count by platform */
export function getDefaultCardCount(platform: SelfMediaPlatform): number {
	switch (platform) {
		case "rednote":
		case "instagram":
			return 6
		case "wechat-official-accounts":
			return 0 // not applicable
		default:
			return 6
	}
}
