import { useCallback, useEffect, useRef } from "react"
import {
	DRAG_TYPE,
	type AttachmentDragData,
	type MultipleFilesDragData,
	type TabDragData,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	UploadSubDir,
	type GetFileInfoResponse,
	type UploadSubDirType,
} from "@/components/CanvasDesign/public/magic-types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import type { GetOrCreateImagesDirFn } from "./useGetOrCreateImagesDir"
import { SuperMagicApi } from "@/apis"
import {
	getOrCreateUploadSubDirFileId,
	validateUploadDirectoryFileId,
} from "../utils/designAssetDirectory"
import {
	buildAssetResourcePath,
	formatCanvasRelativeResourcePath,
	getCanvasResourceFileName,
	isAssetResourceScheme,
	isCanvasResourceRootPath,
	parseAssetResourcePath,
	stripCurrentDirectoryPrefix,
	stripPathEdgeSlashes,
} from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import {
	resolveDesignResourceFileItem,
	resolveDesignResourceReference,
	resolveDesignWorkspaceStoragePath,
} from "../utils/designResourceReferenceResolver"
import {
	SUPPORTED_AUDIO_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	validateCanvasFilePath,
} from "@/components/CanvasDesign/runtime/shared/ids"

interface UseDesignFileDropPathsOptions {
	projectId?: string
	currentFile?: { id: string; name: string }
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
	updateAttachments: () => void
	getOrCreateImagesDir?: GetOrCreateImagesDirFn
	getFileInfoById?: (
		fileId: string,
		fileName?: string,
		fileSize?: number,
	) => Promise<GetFileInfoResponse & { file_id: string }>
	setFileInfoCache?: (
		path: string,
		fileInfo: GetFileInfoResponse,
		options?: { allowMissingAttachment?: boolean },
	) => void
}

interface UseDesignFileDropPathsReturn {
	/** 解析拖拽资源，必要时先复制到当前画布资源目录。 */
	getDataTransferFileInfo: (dataTransfer: DataTransfer) => Promise<string[]>
	/** 解析画布剪贴板资源，必要时服务端复制到当前画布。 */
	resolveCanvasClipboardReference: (input: {
		sourceProjectId?: string
		sourceCanvasId?: string
		sourceFileId?: string
		resourceIdentity?: string
		sourcePath?: string
		projectPath?: string
		targetProjectId?: string
		targetCanvasId?: string
		target: "canvas-editor" | "message-editor"
		fileName?: string
	}) => Promise<{
		kind: "current-canvas" | "project"
		path: string
		fileId?: string
		projectPath?: string
		resourceIdentity: string
		fileName: string
		awaitingAttachmentConfirmation?: boolean
	} | null>
}

export interface DesignDropResourceEntry {
	sourcePath?: string
	fileId?: string
	projectId?: string
	fileName?: string
	source?: number
}

type DesignDragData = TabDragData | AttachmentDragData | MultipleFilesDragData

interface DropFileLike {
	file_id?: string
	project_id?: string
	file_name?: string
	filename?: string
	relative_file_path?: string
	filePath?: string
	is_directory?: boolean
	source?: number
}

interface CopyFileResponse {
	status?: "success" | "processing" | "failed"
	batch_key?: string
	message?: string
	files?: {
		file_id?: string
		file_name?: string
		relative_file_path?: string
		parent_id?: string
	}
}

interface AssetDirectoryContext {
	assetDirFileId: string
	suffixDir: string
}

function createDropResourceEntry(file: DropFileLike): DesignDropResourceEntry | null {
	const sourcePath = file.relative_file_path || file.filePath
	const fileName = file.file_name || file.filename
	if (file.is_directory || (!file.file_id && !sourcePath)) return null

	return {
		sourcePath,
		fileId: file.file_id,
		projectId: file.project_id,
		fileName,
		source: file.source,
	}
}

function extractDesignDropResources(parsedData: DesignDragData): DesignDropResourceEntry[] {
	switch (parsedData.type) {
		case DRAG_TYPE.Tab: {
			const tabData = parsedData.data
			const entry = createDropResourceEntry({
				...tabData.fileData,
				filePath: tabData.filePath,
			})
			return entry ? [entry] : []
		}
		case DRAG_TYPE.ProjectFile: {
			const entry = createDropResourceEntry(parsedData.data)
			return entry ? [entry] : []
		}
		case DRAG_TYPE.ProjectDirectory:
			return []
		case DRAG_TYPE.MultipleFiles:
			return parsedData.data.flatMap((file) => {
				const entry = createDropResourceEntry(file)
				return entry ? [entry] : []
			})
		default:
			return []
	}
}

export function resolveDesignDropResourceEntries(
	dataTransfer: DataTransfer,
): DesignDropResourceEntry[] {
	const customData = dataTransfer.getData("text/plain")
	if (!customData) return []

	try {
		const parsedData = JSON.parse(customData) as DesignDragData
		const entries = extractDesignDropResources(parsedData)
		const seen = new Set<string>()

		return entries.filter((entry) => {
			let assetPath: string | undefined
			if (entry.sourcePath && isAssetResourceScheme(entry.sourcePath)) {
				const assetId = parseAssetResourcePath(entry.sourcePath)
				if (assetId === undefined) return false
				assetPath = buildAssetResourcePath(assetId)
			} else {
				// 文件名只用于媒体类型校验，绝不能退化为资源路径或 identity。
				const mediaName = entry.fileName || entry.sourcePath
				if (!mediaName || !validateCanvasFilePath(mediaName).valid) return false
			}
			const key = assetPath || entry.fileId || entry.sourcePath
			if (!key) return false
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	} catch (error) {
		console.warn("[getDataTransferFileInfo] 解析拖拽数据失败:", error)
		return []
	}
}

/**
 * 只做路径语义归一化，供纯路径测试和兼容调用使用。
 * 实际拖拽通过 useDesignFileDropPaths 进一步准备外部资源。
 */
export function resolveDesignDropResourcePaths(
	dataTransfer: DataTransfer,
	designProjectBasePath?: string,
): string[] {
	return Array.from(
		new Set(
			resolveDesignDropResourceEntries(dataTransfer).flatMap((entry) => {
				if (!entry.sourcePath) return []
				const assetId = parseAssetResourcePath(entry.sourcePath)
				if (assetId !== undefined) return [buildAssetResourcePath(assetId)]
				if (isAssetResourceScheme(entry.sourcePath)) return []
				const storagePath = resolveDesignWorkspaceStoragePath(entry.sourcePath, {
					designProjectBasePath,
				})
				return storagePath ? [storagePath] : []
			}),
		),
	)
}

function isVideoResourcePath(path: string): boolean {
	const fileName = getCanvasResourceFileName(path).toLowerCase()
	return SUPPORTED_VIDEO_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}

function isAudioResourcePath(path: string): boolean {
	const fileName = getCanvasResourceFileName(path).toLowerCase()
	return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}

function getUploadSubDir(path: string): UploadSubDirType {
	if (isVideoResourcePath(path)) return UploadSubDir.Videos
	if (isAudioResourcePath(path)) return UploadSubDir.Audios
	return UploadSubDir.Images
}

function getDropResourceLabel(entry: DesignDropResourceEntry): string {
	return entry.sourcePath || entry.fileName || entry.fileId || "unknown"
}

function getCopiedFileInfo(
	response: CopyFileResponse,
	sourcePath: string,
): NonNullable<CopyFileResponse["files"]> {
	if (response.status === "failed") {
		throw new Error(response.message || `复制文件失败: ${sourcePath}`)
	}
	if (response.status !== "success" || !response.files?.file_name) {
		throw new Error(`复制文件未完成，无法确定最终文件名: ${sourcePath}`)
	}
	return response.files
}

/**
 * 画布拖拽资源准备器：当前画布资源直接归一化，其他目录资源使用后端复制规则。
 * 前端不猜测 a(1).png，复制后的实际文件名以后端响应为准。
 */
export function useDesignFileDropPaths(
	options: UseDesignFileDropPathsOptions,
): UseDesignFileDropPathsReturn {
	const {
		projectId,
		currentFile,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		updateAttachments,
		getOrCreateImagesDir,
		getFileInfoById,
		setFileInfoCache,
	} = options

	const resolveAssetDirectory = useCallback(
		async (subDir: UploadSubDirType): Promise<AssetDirectoryContext | null> => {
			if (!projectId) return null

			if (subDir === UploadSubDir.Images && getOrCreateImagesDir) {
				const imagesDir = await getOrCreateImagesDir()
				return imagesDir
					? { assetDirFileId: imagesDir.imagesDirFileId, suffixDir: imagesDir.suffixDir }
					: null
			}

			const assetDir = await getOrCreateUploadSubDirFileId({
				currentFile,
				flatAttachments,
				projectId,
				subDir,
				updateAttachments,
				validateDirFileId: validateUploadDirectoryFileId,
			})

			return assetDir
				? { assetDirFileId: assetDir.assetDirFileId, suffixDir: assetDir.suffixDir }
				: null
		},
		[currentFile, flatAttachments, getOrCreateImagesDir, projectId, updateAttachments],
	)

	const getSourceFileIdByWorkspacePath = useCallback(
		(normalizedWorkspacePath: string): string | undefined => {
			return resolveDesignResourceFileItem(
				{ namespace: "workspace-path", path: normalizedWorkspacePath },
				{
					flatAttachments,
					attachmentsReady,
					designProjectBasePath,
					attachmentIndex,
				},
			)?.file_id
		},
		[attachmentIndex, attachmentsReady, designProjectBasePath, flatAttachments],
	)

	const canvasClipboardReferenceCacheRef = useRef<
		Map<
			string,
			Promise<
				Awaited<ReturnType<UseDesignFileDropPathsReturn["resolveCanvasClipboardReference"]>>
			>
		>
	>(new Map())
	useEffect(() => {
		canvasClipboardReferenceCacheRef.current.clear()
	}, [currentFile?.id, projectId])

	const getDataTransferFileInfo = useCallback(
		async (dataTransfer: DataTransfer): Promise<string[]> => {
			const entries = resolveDesignDropResourceEntries(dataTransfer)
			const preparedPaths: string[] = []
			let copiedResource = false
			const assetDirectoryPromises = new Map<
				UploadSubDirType,
				Promise<AssetDirectoryContext | null>
			>()

			const getAssetDirectory = (subDir: UploadSubDirType) => {
				let promise = assetDirectoryPromises.get(subDir)
				if (!promise) {
					promise = resolveAssetDirectory(subDir)
					assetDirectoryPromises.set(subDir, promise)
				}
				return promise
			}

			try {
				for (const entry of entries) {
					const resourceLabel = getDropResourceLabel(entry)
					const assetId = entry.sourcePath
						? parseAssetResourcePath(entry.sourcePath)
						: undefined
					if (assetId !== undefined) {
						// Asset references are stable logical paths. They are resolved by the
						// Canvas media lifecycle after drop and must never be copied into the
						// current workspace asset directory.
						preparedPaths.push(buildAssetResourcePath(assetId))
						continue
					}
					if (entry.sourcePath && isAssetResourceScheme(entry.sourcePath)) {
						throw new Error(`无效的素材库资源路径: ${resourceLabel}`)
					}
					const isExternalProject = Boolean(
						entry.projectId && projectId && entry.projectId !== projectId,
					)
					let sourceFileId: string | undefined
					let authoritativePath = entry.fileName || entry.sourcePath || ""

					if (isExternalProject) {
						// 外部项目的 payload 路径可能恰好长得像当前画布；只允许用 fileId 发起复制。
						sourceFileId = entry.fileId
						if (!sourceFileId) {
							throw new Error(`无法确定外部待复制资源的文件ID: ${resourceLabel}`)
						}
					} else if (entry.fileId) {
						const attachmentResolution = resolveDesignResourceReference(
							{
								namespace: "attachment",
								fileId: entry.fileId,
								source: entry.source,
							},
							{
								designProjectBasePath,
								flatAttachments,
								attachmentsReady,
								attachmentIndex,
							},
						)
						if (
							attachmentResolution.status !== "resolved" ||
							attachmentResolution.resourceKind !== "workspace-file" ||
							!attachmentResolution.workspacePath
						) {
							// 当前项目拖拽携带 fileId 时必须命中当前附件快照，禁止按 payload 路径或文件名猜测。
							throw new Error(`无法通过文件ID定位待拖入资源: ${resourceLabel}`)
						}

						sourceFileId = attachmentResolution.attachmentId
						authoritativePath = attachmentResolution.workspacePath
						if (attachmentResolution.storagePath.startsWith("./")) {
							preparedPaths.push(attachmentResolution.storagePath)
							continue
						}
					} else {
						if (!entry.sourcePath) {
							throw new Error(`待拖入资源缺少路径: ${resourceLabel}`)
						}
						const sourceResolution = resolveDesignResourceReference(
							{
								namespace: "workspace-path",
								path: entry.sourcePath,
							},
							{
								designProjectBasePath,
								flatAttachments,
								attachmentsReady,
								attachmentIndex,
							},
						)
						if (
							sourceResolution.status !== "resolved" ||
							sourceResolution.resourceKind !== "workspace-file" ||
							!sourceResolution.workspacePath
						) {
							throw new Error(`无法解析待拖入资源路径: ${entry.sourcePath}`)
						}

						authoritativePath = sourceResolution.workspacePath
						if (sourceResolution.storagePath.startsWith("./")) {
							preparedPaths.push(sourceResolution.storagePath)
							continue
						}
						sourceFileId = getSourceFileIdByWorkspacePath(
							sourceResolution.workspacePath,
						)
					}

					if (!sourceFileId || !projectId) {
						throw new Error(`无法确定待复制资源的文件ID: ${resourceLabel}`)
					}

					const subDir = getUploadSubDir(authoritativePath)
					const assetDirectory = await getAssetDirectory(subDir)
					if (!assetDirectory) {
						throw new Error(`无法获取画布资源目录: ${subDir}`)
					}

					const response = (await SuperMagicApi.copyFile({
						file_id: sourceFileId,
						target_parent_id: assetDirectory.assetDirFileId,
						target_project_id: projectId,
						pre_file_id: "-1",
						keep_both_file_ids: [sourceFileId],
					})) as CopyFileResponse
					const copiedFile = getCopiedFileInfo(response, resourceLabel)
					copiedResource = true
					const copiedWorkspacePath =
						copiedFile.relative_file_path ||
						`${assetDirectory.suffixDir}/${copiedFile.file_name}`
					const copiedDesignPath = resolveDesignWorkspaceStoragePath(
						copiedWorkspacePath,
						{
							designProjectBasePath,
						},
					)
					if (!copiedDesignPath) {
						throw new Error(`无法解析复制后的资源路径: ${copiedWorkspacePath}`)
					}

					if (getFileInfoById && setFileInfoCache && copiedFile.file_id) {
						try {
							const copiedFileInfo = await getFileInfoById(
								copiedFile.file_id,
								copiedFile.file_name,
							)
							setFileInfoCache(copiedDesignPath, copiedFileInfo, {
								allowMissingAttachment: true,
							})
						} catch (error) {
							// 复制已经成功，缓存预热失败不应让用户重试复制并产生重名副本。
							console.warn("[useDesignFileDropPaths] 复制文件信息预热失败:", error)
						}
					}

					preparedPaths.push(copiedDesignPath)
				}

				return preparedPaths
			} finally {
				if (copiedResource) updateAttachments()
			}
		},
		[
			attachmentIndex,
			attachmentsReady,
			designProjectBasePath,
			flatAttachments,
			getFileInfoById,
			getSourceFileIdByWorkspacePath,
			projectId,
			resolveAssetDirectory,
			setFileInfoCache,
			updateAttachments,
		],
	)

	const resolveCanvasClipboardReference = useCallback(
		async (
			input: Parameters<UseDesignFileDropPathsReturn["resolveCanvasClipboardReference"]>[0],
		) => {
			const fallbackResourceIdentity =
				input.resourceIdentity ||
				input.sourceFileId ||
				input.projectPath ||
				input.sourcePath
			if (!fallbackResourceIdentity) {
				return null
			}
			const fileName =
				input.fileName ||
				getCanvasResourceFileName(input.sourcePath || fallbackResourceIdentity) ||
				"canvas-clipboard-file"
			const assetPathCandidate = [
				input.sourcePath,
				input.projectPath,
				input.resourceIdentity,
			].find((candidate) => candidate && parseAssetResourcePath(candidate) !== undefined)
			const assetId = assetPathCandidate
				? parseAssetResourcePath(assetPathCandidate)
				: undefined
			if (assetId !== undefined) {
				if (input.target !== "canvas-editor") return null
				const path = buildAssetResourcePath(assetId)
				return {
					kind: "current-canvas" as const,
					path,
					resourceIdentity: `opaque-asset:${path}`,
					fileName,
				}
			}
			if (
				[input.sourcePath, input.projectPath, input.resourceIdentity].some(
					(candidate) => candidate && isAssetResourceScheme(candidate),
				)
			) {
				return null
			}

			const targetProjectId = input.targetProjectId || projectId
			const resourceIdentity = fallbackResourceIdentity
			if (!targetProjectId) return null
			const sourceAttachment = input.sourceFileId
				? attachmentIndex?.byFileId.get(input.sourceFileId) ||
					flatAttachments?.find((item) => item.file_id === input.sourceFileId)
				: undefined
			const inferredSameProject = Boolean(
				sourceAttachment ||
				(input.projectPath && getSourceFileIdByWorkspacePath(input.projectPath)) ||
				(input.sourcePath && getSourceFileIdByWorkspacePath(input.sourcePath)),
			)
			const sameProject = input.sourceProjectId
				? input.sourceProjectId === targetProjectId
				: inferredSameProject
			const sameCanvas = Boolean(
				input.sourceCanvasId &&
				input.targetCanvasId &&
				input.sourceCanvasId === input.targetCanvasId,
			)

			if (input.target === "message-editor" && sameProject) {
				let projectPath = input.projectPath?.trim()
				const sourcePath = input.sourcePath || input.projectPath
				if ((!projectPath || projectPath.startsWith("./")) && sourcePath) {
					const resolution = sameCanvas
						? resolveDesignResourceReference(
								{
									namespace: "canvas-storage",
									path: sourcePath,
									mode: "legacy-recovery",
								},
								{
									designProjectBasePath,
									flatAttachments,
									attachmentsReady,
									attachmentIndex,
								},
							)
						: resolveDesignResourceReference(
								{ namespace: "workspace-path", path: sourcePath },
								{
									designProjectBasePath,
									flatAttachments,
									attachmentsReady,
									attachmentIndex,
								},
							)
					if (resolution.status === "resolved" && resolution.workspacePath) {
						projectPath = resolution.workspacePath
					}
				}
				if (projectPath && !projectPath.startsWith("/")) projectPath = `/${projectPath}`
				const fileId =
					input.sourceFileId ||
					(projectPath ? getSourceFileIdByWorkspacePath(projectPath) : undefined)
				if (!projectPath || !fileId) {
					return null
				}
				const result = {
					kind: "project" as const,
					path: projectPath,
					projectPath,
					fileId,
					resourceIdentity,
					fileName,
				}
				return result
			}

			if (input.target !== "canvas-editor") {
				return null
			}
			if (sameProject && !sameCanvas) {
				const sourceWorkspacePath =
					sourceAttachment?.relative_file_path || input.projectPath || undefined
				if (sourceWorkspacePath) {
					const workspaceResolution = resolveDesignResourceReference(
						{ namespace: "workspace-path", path: sourceWorkspacePath },
						{
							designProjectBasePath,
							flatAttachments,
							attachmentsReady,
							attachmentIndex,
						},
					)
					if (
						workspaceResolution.status === "resolved" &&
						workspaceResolution.storagePath.startsWith("./")
					) {
						const result = {
							kind: "current-canvas" as const,
							path: workspaceResolution.storagePath,
							fileId: workspaceResolution.attachmentId,
							projectPath: workspaceResolution.workspacePath
								? `/${workspaceResolution.workspacePath.replace(/^\/+/, "")}`
								: undefined,
							resourceIdentity,
							fileName,
						}
						return result
					}
				}
			}
			if (sameCanvas && input.sourcePath) {
				const current = resolveDesignResourceReference(
					{
						namespace: "canvas-storage",
						path: input.sourcePath,
						mode: "legacy-recovery",
					},
					{ designProjectBasePath, flatAttachments, attachmentsReady, attachmentIndex },
				)
				if (current.status === "resolved" && current.storagePath.startsWith("./")) {
					const result = {
						kind: "current-canvas" as const,
						path: current.storagePath,
						fileId: current.attachmentId,
						projectPath: current.workspacePath
							? `/${current.workspacePath.replace(/^\/+/, "")}`
							: undefined,
						resourceIdentity,
						fileName,
					}
					return result
				}
				const normalizedCanvasPath = stripCurrentDirectoryPrefix(input.sourcePath)
				if (
					isCanvasResourceRootPath(normalizedCanvasPath) &&
					!normalizedCanvasPath
						.split("/")
						.some((segment) => segment === ".." || segment.includes("\0"))
				) {
					const result = {
						kind: "current-canvas" as const,
						path: formatCanvasRelativeResourcePath(normalizedCanvasPath),
						resourceIdentity,
						fileName,
					}
					return result
				}
			}

			if (!sameProject) {
				return null
			}

			// Clipboard may still point at another canvas workspace path even when the
			// same file name already exists under the current canvas asset directory
			// (copyFile would then create a "(2)" duplicate). Prefer the local asset.
			const reuseAuthoritativePath = input.projectPath || input.sourcePath || fileName
			const reuseSubDir = getUploadSubDir(reuseAuthoritativePath)
			if (designProjectBasePath) {
				const existingWorkspacePath = `/${stripPathEdgeSlashes(designProjectBasePath)}/${reuseSubDir}/${fileName}`
				const existingFileId = getSourceFileIdByWorkspacePath(existingWorkspacePath)
				if (existingFileId) {
					const existingPath = formatCanvasRelativeResourcePath(
						`${reuseSubDir}/${fileName}`,
					)
					return {
						kind: "current-canvas" as const,
						path: existingPath,
						fileId: existingFileId,
						projectPath: existingWorkspacePath,
						resourceIdentity,
						fileName,
					}
				}
			}

			const copyCacheKey = [
				input.sourceProjectId ?? "",
				input.sourceCanvasId ?? "",
				targetProjectId,
				input.targetCanvasId ?? "",
				resourceIdentity,
			].join("\0")
			const cachedCopy = canvasClipboardReferenceCacheRef.current.get(copyCacheKey)
			if (cachedCopy) {
				return cachedCopy
			}
			const copyPromise = (async () => {
				const sourceFileId =
					input.sourceFileId ||
					(input.projectPath
						? getSourceFileIdByWorkspacePath(input.projectPath)
						: undefined) ||
					(input.sourcePath
						? getSourceFileIdByWorkspacePath(input.sourcePath)
						: undefined)
				if (!sourceFileId) {
					return null
				}
				const authoritativePath = input.projectPath || input.sourcePath || fileName
				const subDir = getUploadSubDir(authoritativePath)
				const assetDirectory = await resolveAssetDirectory(subDir)
				if (!assetDirectory) {
					return null
				}
				const response = (await SuperMagicApi.copyFile({
					file_id: sourceFileId,
					target_parent_id: assetDirectory.assetDirFileId,
					target_project_id: targetProjectId,
					pre_file_id: "-1",
					keep_both_file_ids: [sourceFileId],
				})) as CopyFileResponse
				const copiedFile = getCopiedFileInfo(response, fileName)
				const copiedWorkspacePath =
					copiedFile.relative_file_path ||
					`${assetDirectory.suffixDir}/${copiedFile.file_name}`
				const copiedPath = resolveDesignWorkspaceStoragePath(copiedWorkspacePath, {
					designProjectBasePath,
				})
				if (!copiedPath) return null
				if (getFileInfoById && setFileInfoCache && copiedFile.file_id) {
					try {
						const copiedInfo = await getFileInfoById(
							copiedFile.file_id,
							copiedFile.file_name,
						)
						setFileInfoCache(copiedPath, copiedInfo, { allowMissingAttachment: true })
					} catch {
						// Copy succeeded; cache warming is best effort.
					}
				}
				updateAttachments()
				const result = {
					kind: "current-canvas" as const,
					path: copiedPath,
					fileId: copiedFile.file_id,
					projectPath: `/${copiedWorkspacePath.replace(/^\/+/, "")}`,
					resourceIdentity,
					fileName: copiedFile.file_name || fileName,
					awaitingAttachmentConfirmation: true,
				}
				return result
			})()
			canvasClipboardReferenceCacheRef.current.set(
				copyCacheKey,
				copyPromise
					.then((result) => {
						if (!result) canvasClipboardReferenceCacheRef.current.delete(copyCacheKey)
						return result
					})
					.catch((error) => {
						canvasClipboardReferenceCacheRef.current.delete(copyCacheKey)
						throw error
					}),
			)
			return copyPromise
		},
		[
			attachmentIndex,
			attachmentsReady,
			designProjectBasePath,
			flatAttachments,
			getFileInfoById,
			getSourceFileIdByWorkspacePath,
			projectId,
			resolveAssetDirectory,
			setFileInfoCache,
			updateAttachments,
		],
	)

	return { getDataTransferFileInfo, resolveCanvasClipboardReference }
}
