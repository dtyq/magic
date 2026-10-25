import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import type { ImageProcessOptions } from "@/utils/image-processing"
import { resolveResourceUrlsWithVersionOverrides } from "../dashboard/resourceVersioning"
import {
	createPreloadedUrlMapping,
	injectMediaInterceptorScript,
	type FileItem,
} from "./mediaInterceptor"
import type {
	ExternalCssResource,
	HtmlDisplayConfig,
	HtmlResourceInfo,
} from "./htmlResourceCollector"
import { resolveCachedResourceUrls } from "./resourceUrlCache"

interface ReplaceHtmlResourceUrlsOptions {
	fileIds: string[]
	resourceFileVersions?: Record<string, number | undefined>
	preloadedUrlMapping?: Map<string, string>
	imageProcessOptions?: ImageProcessOptions
	imageFileIds: Set<string>
	/** Subset of imageFileIds that may be converted to WebP (GIF is excluded). */
	imageProcessingFileIds?: Set<string>
	fileUpdatedAtMap: Map<string, string>
	htmlContent: string
	urlMap: Map<string, HtmlResourceInfo>
	filePathMap: Map<string, string>
	processingMetadata?: HtmlDisplayConfig
	allFiles: FileItem[]
	relativeFolderPath: string
	access?: FileAccessContext | null
	fileApi?: FileApi
	externalCssResources?: ExternalCssResource[]
}

interface ReplaceHtmlResourceUrlsResult {
	content: string
	filePathMapping: Map<string, string>
	resourcesResolved: boolean
}

function escapeHtmlAttributeValue(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
}

function htmlAttributePathPattern(path: string): string {
	// Match both source HTML and native HTML serialization. CSS/script paths stay raw.
	const serializedPath = path
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/\u00a0/g, "&nbsp;")
	return `(?:${Array.from(new Set([path, serializedPath, escapeHtmlAttributeValue(path)]))
		.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|")})`
}

function readHtmlAttributeValue(quotedValue: string): string | null {
	return (
		new DOMParser()
			.parseFromString(`<div data-value=${quotedValue}></div>`, "text/html")
			.querySelector("div")
			?.getAttribute("data-value") ?? null
	)
}

function replaceCssUrlReference(content: string, path: string, url: string): string {
	const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	const cssUrlRegex = new RegExp(`url\\(\\s*['"]?${escapedPath}['"]?\\s*\\)`, "g")
	return content.replace(cssUrlRegex, () => `/*__ORIGINAL_URL__:${path}__*/url('${url}')`)
}

async function resolveHtmlResourceUrls({
	fileIds,
	resourceFileVersions,
	preloadedUrlMapping,
	imageProcessOptions,
	imageFileIds,
	imageProcessingFileIds,
	fileUpdatedAtMap,
	access,
	fileApi,
}: Pick<
	ReplaceHtmlResourceUrlsOptions,
	| "fileIds"
	| "resourceFileVersions"
	| "preloadedUrlMapping"
	| "imageProcessOptions"
	| "imageFileIds"
	| "imageProcessingFileIds"
	| "fileUpdatedAtMap"
	| "access"
	| "fileApi"
>) {
	const processableImageFileIds = imageProcessingFileIds ?? imageFileIds
	return resolveResourceUrlsWithVersionOverrides({
		fileIds,
		resourceFileVersions,
		access,
		fileApi,
		fetchUnversionedUrls: async (unversionedFileIds) => {
			if (unversionedFileIds.length === 0) return []

			if (preloadedUrlMapping) {
				const preloadedUrls = unversionedFileIds
					// Preloaded URLs are originals. Reuse them for non-images and formats
					// that must not be transformed (notably animated GIFs).
					.filter((fileId) =>
						imageProcessOptions ? !processableImageFileIds.has(fileId) : true,
					)
					.map((fileId) => ({
						file_id: fileId,
						url: preloadedUrlMapping.get(fileId),
					}))
					.filter((item) => item.url) as GetTemporaryDownloadUrlItem[]

				if (!imageProcessOptions) return preloadedUrls

				const imageIdsToProcess = unversionedFileIds.filter((fileId) =>
					processableImageFileIds.has(fileId),
				)
				const originalIdsToFetch = unversionedFileIds.filter(
					(fileId) =>
						!processableImageFileIds.has(fileId) && !preloadedUrlMapping.has(fileId),
				)
				const originalUrls =
					originalIdsToFetch.length > 0
						? await (fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl)({
								file_ids: originalIdsToFetch,
								access: access ?? undefined,
							})
						: []
				if (imageIdsToProcess.length === 0)
					return [...preloadedUrls, ...(originalUrls || [])]

				const processedImageUrls = await (
					fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
				)({
					file_ids: imageIdsToProcess,
					options: { xMagicImageProcess: imageProcessOptions },
					access: access ?? undefined,
				})
				return [...preloadedUrls, ...(processedImageUrls || []), ...(originalUrls || [])]
			}

			return resolveCachedResourceUrls({
				fileIds: unversionedFileIds,
				imageFileIds: processableImageFileIds,
				fileUpdatedAtMap,
				imageProcessOptions,
				access,
				fileApi,
			})
		},
	})
}

/** Replace collected relative resources while preserving their original paths for editing. */
export async function replaceHtmlResourceUrls({
	fileIds,
	resourceFileVersions,
	preloadedUrlMapping,
	imageProcessOptions,
	imageFileIds,
	imageProcessingFileIds,
	fileUpdatedAtMap,
	htmlContent,
	urlMap,
	filePathMap,
	processingMetadata,
	allFiles,
	relativeFolderPath,
	access,
	fileApi,
	externalCssResources = [],
}: ReplaceHtmlResourceUrlsOptions): Promise<ReplaceHtmlResourceUrlsResult> {
	const urlData = await resolveHtmlResourceUrls({
		fileIds,
		resourceFileVersions,
		preloadedUrlMapping,
		imageProcessOptions,
		imageFileIds,
		imageProcessingFileIds,
		fileUpdatedAtMap,
		access,
		fileApi,
	})
	const filePathMapping = new Map<string, string>()
	const magicProjectConfig: Record<string, unknown> = {}
	let content = htmlContent
	const inlinedCssFileIds = new Set(externalCssResources.map((resource) => resource.fileId))
	const externalCssReferences = new Map<string, string[]>()
	for (const resource of externalCssResources) {
		for (const reference of resource.references) {
			const paths = externalCssReferences.get(reference.fileId) ?? []
			if (!paths.includes(reference.path)) paths.push(reference.path)
			externalCssReferences.set(reference.fileId, paths)
		}
	}

	// Inline linked stylesheets before replacing their nested URLs. Keeping the CSS in
	// the processed HTML prevents the sandbox browser from resolving relative paths
	// against its workspace root before host-side URL mapping has run.
	for (const resource of externalCssResources) {
		const escapedPath = htmlAttributePathPattern(resource.htmlPath)
		const linkRegex = new RegExp(
			`<link\\b(?=[^>]*\\brel=["']stylesheet["'])(?=[^>]*\\bhref=["']${escapedPath}["'])[^>]*>`,
			"gi",
		)
		const hrefRegex = new RegExp(`\\bhref=(["'])(${escapedPath})\\1`, "i")
		const embeddedCss = resource.content.replace(/<\/style/gi, "<\\/style")
		content = content.replace(linkRegex, (linkTag) => {
			const href = linkTag.match(hrefRegex)
			if (
				!href ||
				readHtmlAttributeValue(`${href[1]}${href[2]}${href[1]}`) !== resource.htmlPath
			)
				return linkTag
			// Keep an inert copy of the original link so the save cleanup can restore
			// its href and discard only the runtime-injected stylesheet.
			const inertLink = linkTag.replace(
				hrefRegex,
				`data-original-href="${escapeHtmlAttributeValue(resource.htmlPath)}"`,
			)
			return `${inertLink}<style data-injected="true">${embeddedCss}</style>`
		})
	}

	urlData.forEach((item) => {
		const resourceInfo = urlMap.get(item.file_id)
		filePathMapping.set(item.url || "", filePathMap.get(item.file_id) || "")
		if (!item.url) return

		// A single image can be referenced by both HTML attributes and external CSS.
		// Replace every CSS reference independently instead of letting one urlMap entry
		// overwrite the other usage site.
		for (const path of externalCssReferences.get(item.file_id) ?? []) {
			content = replaceCssUrlReference(content, path, item.url)
		}

		// The original link is now inert and exists only for save restoration. Do not
		// let the generic href matcher rewrite the href substring in data-original-href.
		if (inlinedCssFileIds.has(item.file_id)) return

		if (!resourceInfo) return

		urlMap.set(item.file_id, { ...resourceInfo, url: item.url })
		const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

		if (resourceInfo.attr === "slides") return

		if (resourceInfo.attr === "data-analyst-dashboard") {
			const urlRegex = new RegExp(`(url\\s*:\\s*)(['"\`])${escapedPath}(['"\`])`, "g")
			content = content.replace(urlRegex, `$1$2${item.url}$3`)
			return
		}

		if (resourceInfo.attr === "data-analyst-project") {
			const configKey = resourceInfo.type === "geo" ? "geo" : "dataSources"
			if (resourceInfo.type === "geo" || resourceInfo.type === "cleaned_data") {
				const configItems =
					(magicProjectConfig[configKey] as
						Array<{ name: string; url: string }> | undefined) ?? []
				configItems.push({
					name: resourceInfo.fileName?.split(".")[0] ?? "",
					url: item.url,
				})
				magicProjectConfig[configKey] = configItems
			}
			return
		}

		if (resourceInfo.attr === "css-url") {
			content = replaceCssUrlReference(content, resourceInfo.path, item.url)
			return
		}

		if (resourceInfo.attr === "inline-style") {
			const inlineStyleRegex = new RegExp(
				`(<${resourceInfo.tag}\\b[^>]*?\\s)style=("[^"]*"|'[^']*')`,
				"gi",
			)
			content = content.replace(inlineStyleRegex, (match, beforeStyle, quotedStyle) => {
				// Decode this attribute only, then escape the replacement for HTML again.
				const style = readHtmlAttributeValue(quotedStyle)
				if (style == null) return match
				const replaced = replaceCssUrlReference(style, resourceInfo.path, item.url)
				if (replaced === style) return match
				return `${beforeStyle}style="${escapeHtmlAttributeValue(replaced)}"`
			})
			return
		}

		const attributeRegex = new RegExp(
			`<(${resourceInfo.tag})([^>]*?\\s)${resourceInfo.attr}=(["'])(${htmlAttributePathPattern(resourceInfo.path)})\\3([^>]*?)>`,
			"gi",
		)
		content = content.replace(
			attributeRegex,
			(match, tagName, beforeAttr, quote, path, afterAttr) => {
				// A literal entity in a filename must not match a different decoded path.
				if (readHtmlAttributeValue(`${quote}${path}${quote}`) !== resourceInfo.path)
					return match
				const escapedUrl = escapeHtmlAttributeValue(item.url)
				const escapedOriginalPath = escapeHtmlAttributeValue(resourceInfo.path)
				return `<${tagName}${beforeAttr}${resourceInfo.attr}="${escapedUrl}" data-original-path="${escapedOriginalPath}"${afterAttr}>`
			},
		)
	})

	if (processingMetadata?.type === "dashboard" && Object.keys(magicProjectConfig).length > 0) {
		const splitContent = content.split("</head>")
		content = `
			${splitContent[0]}
			<script data-injected="true">
				if (window.magicProjectConfigure) {
					window.magicProjectConfigure(${JSON.stringify(magicProjectConfig)});
				}
			</script>
			</head>
			${splitContent[1]}
		`
	}

	if (processingMetadata?.type === "audio" || processingMetadata?.type === "video") {
		const mapping = createPreloadedUrlMapping(allFiles, urlMap, relativeFolderPath)
		content = injectMediaInterceptorScript(content, {
			enableRelativePathInterception: true,
			preloadedUrlMapping: mapping,
		})
	}

	const resolvedFileIds = new Set(urlData.filter((item) => item.url).map((item) => item.file_id))
	return {
		content,
		filePathMapping,
		resourcesResolved: fileIds.every((id) => resolvedFileIds.has(id)),
	}
}
