/**
 * 插件文件资产 Host 侧实现。
 *
 * 三条路径：
 * - pickPluginFiles：本地文件 → upload → PluginFileAsset
 * - resolvePluginFileAssets -> resolvePluginFileByPath：已有资源 path → 按 asset/workspace 类型解析，不上传
 * - resolveProjectPluginFile：资源面板选中项 → 同上（path 来自 panel item）
 *
 * PluginFileAsset 同时含 path（稳定标识）与 url/src（当前可访问签名 URL）。
 */
import { getMediaDimensions, isImageFile, validateFile } from "../../../../runtime/shared/ids"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { ReferenceResourcePanelItem } from "../../../../public/props"
import type { ReferenceResourceTypeFilter } from "../../../editors/message/reference-assets/reference-resource.types"
import type { PluginPickFilesOptions } from "../runtime-protocol/v1/index"
import type { PluginFileAsset, PluginFilePickerType } from "../window/types"
import {
	buildAssetResourcePath,
	getCanvasResourceFileName,
	isAssetResourceScheme,
	parseAssetResourcePath,
} from "../../../../runtime/shared/path/canvasResourcePath"

export const IMAGE_FILE_EXTENSIONS = new Set([
	"avif",
	"bmp",
	"gif",
	"ico",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp",
])

interface ResolvedPluginFileResource {
	path: string
	type: PluginFilePickerType
	fileInfo: { src: string; fileName?: string }
}

async function resolvePluginFileResource(
	canvas: Canvas,
	path: string,
	options?: {
		requestedType?: PluginFilePickerType
		declaredMediaType?: "image" | "video" | "audio" | null
	},
): Promise<ResolvedPluginFileResource> {
	const assetId = parseAssetResourcePath(path)
	if (assetId !== undefined) {
		const asset = await canvas.assetResourceManager.getResource(assetId)
		if (!asset.fileUrl || !asset.mediaType) {
			throw new Error("Asset detail does not contain a supported media resource.")
		}
		if (options?.declaredMediaType && options.declaredMediaType !== asset.mediaType) {
			throw new Error("Asset media type does not match the selected resource metadata.")
		}
		if (
			options?.requestedType &&
			options.requestedType !== "file" &&
			options.requestedType !== asset.mediaType
		) {
			throw new Error("Asset media type does not match the plugin picker type.")
		}

		const canonicalPath = buildAssetResourcePath(assetId)
		return {
			path: canonicalPath,
			type: options?.requestedType === "file" ? "file" : asset.mediaType,
			fileInfo: {
				src: asset.fileUrl,
				fileName:
					asset.fileName ||
					getCanvasResourceFileName(canonicalPath) ||
					`asset-${assetId}`,
			},
		}
	}
	if (isAssetResourceScheme(path)) {
		throw new Error("Invalid asset resource path.")
	}

	const getFileInfo = canvas.magicConfigManager.config?.methods?.getFileInfo
	if (!getFileInfo) {
		throw new Error("getFileInfo method not available.")
	}
	const type =
		options?.requestedType ?? options?.declaredMediaType ?? inferPluginFileTypeFromPath(path)
	const fileInfo = await getFileInfo(path, { useImageProcess: type === "image" })
	return { path, type, fileInfo }
}

/** 上传本地文件并返回插件文件资产
 * params:
 * - canvas: 画布
 * - files: 本地文件
 * - options: 选项
 * return: 插件文件资产数组
 */
export async function pickPluginFiles(
	canvas: Canvas,
	files: File[],
	options?: PluginPickFilesOptions,
): Promise<PluginFileAsset[]> {
	if (!canvas.permissionManager.can("document.write")) {
		throw new Error("Canvas does not allow document changes.")
	}

	const maxCount = Math.max(1, options?.maxCount ?? (options?.multiple ? files.length : 1))
	const acceptedFiles = files
		.slice(0, maxCount)
		.filter((file) => validatePluginPickedFile(file, options))

	if (acceptedFiles.length === 0) {
		return []
	}

	const dimensions = await Promise.all(
		acceptedFiles.map((file) =>
			options?.type === "image" || isImageFile(file)
				? getMediaDimensions(file).catch(
						(): { width: number; height: number } | undefined => undefined,
					)
				: Promise.resolve(undefined),
		),
	)
	const uploadResults = await canvas.canvasFileUploadManager.uploadDirect(acceptedFiles)

	return uploadResults.map((result, index) => ({
		id: result.path || result.src,
		path: result.path,
		url: result.src,
		src: result.src,
		fileName: result.fileName,
		type: inferPluginFileType(acceptedFiles[index]),
		width: dimensions[index]?.width,
		height: dimensions[index]?.height,
	}))
}

/**
 *【单 path 换链】按项目内 path 解析已有资源，不上传。命中。
 * 图片会 useImageProcess: true 换链，并尝试读 naturalWidth/Height。
 * params:
 * - canvas: 画布
 * - path: 项目路径
 * - options: 选项
 * return: 插件文件资产
 */
export async function resolvePluginFileByPath(
	canvas: Canvas,
	path: string,
	options?: PluginPickFilesOptions & { fileName?: string; skipImageDimensions?: boolean },
): Promise<PluginFileAsset> {
	const resolved = await resolvePluginFileResource(canvas, path, {
		requestedType: options?.type,
	})
	const { fileInfo, type } = resolved
	const dimensions =
		type === "image" && !options?.skipImageDimensions
			? await getImageDimensionsFromUrl(fileInfo.src).catch(
					(): { width: number; height: number } | undefined => undefined,
				)
			: undefined

	return {
		id: resolved.path,
		path: resolved.path,
		url: fileInfo.src,
		src: fileInfo.src,
		fileName:
			options?.fileName ||
			fileInfo.fileName ||
			getCanvasResourceFileName(resolved.path) ||
			resolved.path,
		type,
		width: dimensions?.width,
		height: dimensions?.height,
	}
}

/**
 * 【多 path 换链】批量 resolvePluginFileByPath 的批量封装 + 类型过滤。。
 * params:
 * - canvas: 画布
 * - files: 项目路径数组
 * - options: 选项，options.type 有值时过滤类型（与 pickFiles 的 type 约束对齐）；未传则不过滤。
 * return: 插件文件资产数组
 */
export async function resolvePluginFileAssets(
	canvas: Canvas,
	files: Array<{ path: string; fileName?: string }>,
	options?: PluginPickFilesOptions,
): Promise<PluginFileAsset[]> {
	if (!canvas.permissionManager.can("document.write")) {
		throw new Error("Canvas does not allow document changes.")
	}

	const resolved = await Promise.all(
		files.map((file) =>
			resolvePluginFileByPath(canvas, file.path, {
				...options,
				fileName: file.fileName,
			}),
		),
	)

	return resolved.filter((asset) => validatePluginPickedFileType(asset.type, options))
}

/** options.type 未指定时放行；指定时只保留推断 type 匹配的 asset。 */
function validatePluginPickedFileType(
	type: PluginFilePickerType | undefined,
	options?: PluginPickFilesOptions,
): boolean {
	if (!options?.type) return true
	return type === options.type
}

/** 【资源面板项】把「从项目资源面板选中的一项」解析成已有资源。
 * params:
 * - canvas: 画布
 * - item: 项目面板选中项
 * - options: 选项
 * return: 插件文件资产
 */
export async function resolveProjectPluginFile(
	canvas: Canvas,
	item: ReferenceResourcePanelItem,
	options?: PluginPickFilesOptions,
): Promise<PluginFileAsset> {
	const path = item.data.file_path
	const resolved = await resolvePluginFileResource(canvas, path, {
		requestedType: options?.type,
		declaredMediaType: item.data.media_type,
	})
	const { fileInfo, type } = resolved
	const dimensions =
		type === "image"
			? await getImageDimensionsFromUrl(fileInfo.src).catch(
					(): { width: number; height: number } | undefined => undefined,
				)
			: undefined

	return {
		id: resolved.path,
		path: resolved.path,
		url: fileInfo.src,
		src: fileInfo.src,
		fileName: fileInfo.fileName || item.data.file_name,
		type,
		width: dimensions?.width,
		height: dimensions?.height,
	}
}

/** 本地 `<input type="file">` 的 accept 属性。 */
export function getPluginFilePickerAccept(options?: PluginPickFilesOptions): string {
	if (options?.accept?.length) return options.accept.join(",")
	if (options?.type === "image") return "image/*"
	if (options?.type === "video") return "video/*"
	if (options?.type === "audio") return "audio/*"
	return ""
}

/** 资源面板 Tab 类型过滤（image / video / audio / file）。 */
export function getPluginReferenceResourceType(
	options?: PluginPickFilesOptions,
): ReferenceResourceTypeFilter {
	if (options?.type === "image") return "image"
	if (options?.type === "video") return "video"
	if (options?.type === "audio") return "audio"
	return "file"
}

/** 通过 Image 加载签名 URL 读 natural 尺寸；失败时由调用方 catch 忽略。 */
function getImageDimensionsFromUrl(url: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => {
			resolve({
				width: image.naturalWidth,
				height: image.naturalHeight,
			})
		}
		image.onerror = () => {
			reject(new Error("Failed to load selected project image."))
		}
		image.src = url
	})
}

/** 本地上传前校验：通用 validateFile + options.type MIME 过滤。 */
function validatePluginPickedFile(file: File, options?: PluginPickFilesOptions): boolean {
	const validation = validateFile(file)
	if (!validation.valid) return false
	if (options?.type === "image") return isImageFile(file)
	if (options?.type === "video") return file.type.startsWith("video/")
	if (options?.type === "audio") return file.type.startsWith("audio/")
	return true
}

/** 从 File MIME 推断 PluginFilePickerType。 */
function inferPluginFileType(file: File | undefined): PluginFilePickerType {
	if (!file) return "file"
	if (isImageFile(file)) return "image"
	if (file.type.startsWith("video/")) return "video"
	if (file.type.startsWith("audio/")) return "audio"
	return "file"
}

/** 从 path 后缀推断 type；resolve 路径无 File 对象时使用。 */
function inferPluginFileTypeFromPath(path: string): PluginFilePickerType {
	const extension = path.split(".").pop()?.toLowerCase()
	if (extension && IMAGE_FILE_EXTENSIONS.has(extension)) {
		return "image"
	}
	if (extension && ["mp4", "webm", "mov", "m4v"].includes(extension)) {
		return "video"
	}
	if (extension && ["mp3", "wav", "m4a", "aac", "ogg"].includes(extension)) {
		return "audio"
	}
	return "file"
}
