import { useCallback } from "react"
import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import type {
	EstimateVideoPointsResponse as ApiEstimateVideoPointsResponse,
	GetVideoGenerationResultParams as ApiGetVideoGenerationResultParams,
} from "@/apis/modules/superMagic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { UploadSubDir } from "@/components/CanvasDesign/types.magic"
import type {
	EstimateVideoPointsResponse,
	GenerationStatus,
	VideoModelItem,
	GenerateVideoRequest,
	GenerateVideoResponse,
	GetVideoGenerationResultParams,
	VideoGenerationResultResponse,
} from "@/components/CanvasDesign/types.magic"
import { normalizePath } from "../utils/utils"
import { useTranslation } from "react-i18next"
import {
	createDesignWorkspacePathExists,
	resolveDesignDslPathToWorkspaceAbsoluteByCandidates,
} from "../utils/designDslPathUtils"
import { syncFileInfoAfterGenerationComplete } from "../utils/syncFileInfoAfterGenerationComplete"

interface UseVideoGenerationOptions {
	projectId?: string
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/** 画布目录路径段（与 magic.project.js 同级），用于把 DSL 相对路径还原为工作区路径 */
	designProjectBasePath?: string
	/**
	 * 设置文件信息缓存的回调函数
	 * 当视频生成完成时，用于将结果缓存到文件信息缓存中
	 */
	setFileInfoCache?: (path: string, fileInfo: { src: string; fileName: string }) => void
	/** 文件列表更新 */
	updateAttachments: () => void
}

interface UseVideoGenerationReturn {
	getVideoModelList: () => Promise<VideoModelItem[]>
	generateVideo: (params: GenerateVideoRequest) => Promise<GenerateVideoResponse>
	estimateVideoPoints: (params: GenerateVideoRequest) => Promise<EstimateVideoPointsResponse>
	getVideoGenerationResult: (
		params: GetVideoGenerationResultParams,
	) => Promise<VideoGenerationResultResponse>
}

/**
 * 视频生成相关功能 Hook
 * 职责：封装视频模型列表、发起视频生成、查询视频生成结果（与 useImageGeneration 对齐）
 */
export function useVideoGeneration(options: UseVideoGenerationOptions): UseVideoGenerationReturn {
	const {
		projectId,
		currentFile,
		flatAttachments,
		designProjectBasePath,
		setFileInfoCache,
		updateAttachments,
	} = options
	const { t } = useTranslation("super")

	const getVideoModelList = useCallback(async (): Promise<VideoModelItem[]> => {
		const officialGroups = JSON.parse(
			JSON.stringify(superMagicModeService.getVideoModelGroupsByMode("general") || []),
		) as Array<{
			group: { id: string; name: string; icon: string; sort: number }
			models: VideoModelItem[]
		}>
		const result = officialGroups.flatMap((groupItem) =>
			(groupItem.models || []).map(
				(model): VideoModelItem => ({
					...model,
					model_source: "official",
					model_group: {
						id: groupItem.group.id,
						name: normalizeVideoModelGroupLabel(groupItem.group.name),
						icon: groupItem.group.icon,
						sort: groupItem.group.sort,
						source: "official",
					},
				}),
			),
		)
		return result
	}, [])

	const generateVideo = useCallback(
		async (params: GenerateVideoRequest): Promise<GenerateVideoResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}
			const requestParams = await buildDesignVideoRequestParams({
				params,
				projectId,
				currentFile,
				flatAttachments,
				designProjectBasePath,
				updateAttachments,
				ensureVideosDir: true,
				pathUnresolvedMessage: t("design.errors.designResourcePathUnresolved"),
			})
			const result = await SuperMagicApi.generateVideo(requestParams)
			return {
				...result,
				status: normalizeVideoGenerationStatus(result.status),
			} as GenerateVideoResponse
		},
		[projectId, currentFile, flatAttachments, designProjectBasePath, t, updateAttachments],
	)

	const estimateVideoPoints = useCallback(
		async (params: GenerateVideoRequest): Promise<EstimateVideoPointsResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}
			const requestParams = await buildDesignVideoRequestParams({
				params,
				projectId,
				currentFile,
				flatAttachments,
				designProjectBasePath,
				updateAttachments,
				ensureVideosDir: false,
				pathUnresolvedMessage: t("design.errors.designResourcePathUnresolved"),
			})
			const result = await SuperMagicApi.estimateVideoPoints(requestParams)
			return normalizeEstimateVideoPointsResponse(result)
		},
		[projectId, currentFile, flatAttachments, designProjectBasePath, updateAttachments, t],
	)

	const getVideoGenerationResult = useCallback(
		async (params: GetVideoGenerationResultParams): Promise<VideoGenerationResultResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}
			if (!params.video_id) {
				throw new Error(t("design.errors.videoIdNotExists"))
			}
			const requestParams: ApiGetVideoGenerationResultParams = {
				project_id: projectId,
				video_id: params.video_id,
			}
			const result = await SuperMagicApi.getVideoGenerationResult(requestParams)
			const normalizedResult = {
				...result,
				status: normalizeVideoGenerationStatus(result.status),
			} as VideoGenerationResultResponse
			if (
				isVideoGenerationSucceeded(normalizedResult.status) &&
				result.file_url &&
				result.file_name
			) {
				let filePath = ""
				if (normalizedResult.file_dir) {
					const normalizedDir = normalizePath(normalizedResult.file_dir)
					filePath = normalizedDir
						? `${normalizedDir}/${normalizedResult.file_name}`
						: normalizedResult.file_name
				} else {
					filePath = normalizedResult.file_name
				}
				await syncFileInfoAfterGenerationComplete({
					projectId,
					filePath,
					fileUrl: normalizedResult.file_url,
					fileName: normalizedResult.file_name,
					setFileInfoCache,
				})
			}
			return normalizedResult
		},
		[projectId, setFileInfoCache, t],
	)

	return { getVideoModelList, generateVideo, estimateVideoPoints, getVideoGenerationResult }
}

interface BuildDesignVideoRequestParamsOptions {
	params: GenerateVideoRequest
	projectId: string
	currentFile?: {
		id: string
		name: string
	}
	flatAttachments?: FileItem[]
	designProjectBasePath?: string
	updateAttachments: () => void
	ensureVideosDir: boolean
	pathUnresolvedMessage: string
}

async function buildDesignVideoRequestParams(
	options: BuildDesignVideoRequestParamsOptions,
): Promise<GenerateVideoRequest> {
	const {
		params,
		projectId,
		currentFile,
		flatAttachments,
		designProjectBasePath,
		updateAttachments,
		ensureVideosDir,
		pathUnresolvedMessage,
	} = options
	let fileDir = ""
	let parentDirId: string | undefined = undefined
	if (currentFile?.id && flatAttachments && flatAttachments.length > 0) {
		const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)

		if (designProjectFile?.relative_file_path) {
			const filePath = designProjectFile.relative_file_path

			if (designProjectFile.is_directory) {
				fileDir = filePath
				parentDirId = designProjectFile.file_id
			} else {
				const fileName = designProjectFile.file_name || currentFile.name
				if (filePath.endsWith(fileName)) {
					fileDir = filePath.slice(0, -fileName.length)
				} else {
					const lastSlashIndex = filePath.lastIndexOf("/")
					if (lastSlashIndex >= 0) fileDir = filePath.slice(0, lastSlashIndex + 1)
				}
				const parentDirPath = normalizePath(fileDir)
				if (parentDirPath) {
					const parentDir = flatAttachments.find(
						(item) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") === parentDirPath,
					)
					if (parentDir) parentDirId = parentDir.file_id
				}
			}

			fileDir = normalizePath(fileDir)

			if (!parentDirId && fileDir) {
				const parentDir = flatAttachments.find(
					(item) =>
						item.is_directory &&
						normalizePath(item.relative_file_path || "") === fileDir,
				)
				if (parentDir) parentDirId = parentDir.file_id
			}

			const videosDirPath = fileDir
				? `${fileDir}/${UploadSubDir.Videos}`
				: UploadSubDir.Videos
			const normalizedVideosDirPath = normalizePath(videosDirPath)
			const videosDirExists = flatAttachments.some(
				(item) =>
					item.is_directory &&
					normalizePath(item.relative_file_path || "") === normalizedVideosDirPath,
			)

			if (!videosDirExists && ensureVideosDir) {
				try {
					await SuperMagicApi.createFile({
						project_id: projectId,
						parent_id: parentDirId || "",
						file_name: UploadSubDir.Videos,
						is_directory: true,
					})
					updateAttachments()
				} catch (error: unknown) {
					const errorObj = error as { code?: number }
					if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) updateAttachments()
				}
			}

			fileDir = videosDirPath
		}
	}
	const fileDirWithSlash = fileDir ? `/${fileDir}/` : undefined
	return {
		...toDesignGenerateVideoRequest(
			params,
			designProjectBasePath,
			flatAttachments,
			pathUnresolvedMessage,
		),
		project_id: projectId,
		file_dir: fileDirWithSlash,
	}
}

function normalizeVideoModelGroupLabel(label: string): string {
	return label.replace(/[-_\s]video$/i, "").trim()
}

function toDesignGenerateVideoRequest(
	params: GenerateVideoRequest,
	designProjectBasePath?: string,
	flatAttachments?: FileItem[],
	pathUnresolvedMessage?: string,
): GenerateVideoRequest {
	const normalizedGeneration = {
		...(params.generation || {}),
	}
	const normalizedInputs = params.inputs || {}

	return {
		project_id: params.project_id,
		video_id: params.video_id,
		model_id: params.model_id,
		prompt: params.prompt,
		input_mode: params.input_mode,
		task: params.task || "generate",
		file_dir: params.file_dir,
		file_name: params.file_name,
		...(Object.keys(normalizedInputs).length > 0
			? {
					inputs: normalizeGenerateVideoInputs(
						normalizedInputs,
						designProjectBasePath,
						flatAttachments,
						pathUnresolvedMessage,
					),
				}
			: {}),
		...(Object.keys(normalizedGeneration).length > 0
			? {
					generation: normalizedGeneration,
				}
			: {}),
		...(params.callbacks ? { callbacks: params.callbacks } : {}),
		...(params.execution ? { execution: params.execution } : {}),
		...(params.extensions ? { extensions: params.extensions } : {}),
	}
}

function normalizeGenerateVideoInputs(
	inputs: NonNullable<GenerateVideoRequest["inputs"]>,
	designProjectBasePath?: string,
	flatAttachments?: FileItem[],
	pathUnresolvedMessage?: string,
): NonNullable<GenerateVideoRequest["inputs"]> {
	return {
		...(inputs.frames?.length
			? {
					frames: inputs.frames.map((frame) => ({
						...frame,
						uri: ensureDesignAbsolutePath(
							frame.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					})),
				}
			: {}),
		...(inputs.reference_images?.length
			? {
					reference_images: inputs.reference_images.map((item) => ({
						...item,
						uri: ensureDesignAbsolutePath(
							item.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					})),
				}
			: {}),
		...(inputs.reference_videos?.length
			? {
					reference_videos: inputs.reference_videos.map((item) => ({
						...item,
						uri: ensureDesignAbsolutePath(
							item.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					})),
				}
			: {}),
		...(inputs.reference_audios?.length
			? {
					reference_audios: inputs.reference_audios.map((item) => ({
						...item,
						uri: ensureDesignAbsolutePath(
							item.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					})),
				}
			: {}),
		...(inputs.video?.uri
			? {
					video: {
						...inputs.video,
						uri: ensureDesignAbsolutePath(
							inputs.video.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					},
				}
			: {}),
		...(inputs.mask?.uri
			? {
					mask: {
						...inputs.mask,
						uri: ensureDesignAbsolutePath(
							inputs.mask.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					},
				}
			: {}),
		...(inputs.audio?.length
			? {
					audio: inputs.audio.map((item) => ({
						...item,
						uri: ensureDesignAbsolutePath(
							item.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					})),
				}
			: {}),
	}
}

function ensureDesignAbsolutePath(
	path: string,
	designProjectBasePath?: string,
	flatAttachments?: FileItem[],
	pathUnresolvedMessage?: string,
): string {
	if (!path) return path
	const resolved = resolveDesignDslPathToWorkspaceAbsoluteByCandidates(
		path,
		designProjectBasePath,
		{
			pathExists: createDesignWorkspacePathExists(flatAttachments),
		},
	)
	if (!resolved) throw new Error(pathUnresolvedMessage || "Design resource path unresolved")
	return resolved
}

function isVideoGenerationSucceeded(status: string): boolean {
	return status === "completed"
}

function normalizeVideoGenerationStatus(status: string): GenerationStatus {
	if (status === "running") return "processing"
	if (status === "succeeded") return "completed"
	if (status === "canceled") return "failed"
	if (status === "pending" || status === "processing" || status === "completed") {
		return status
	}
	return "failed"
}

function normalizeEstimateVideoPointsResponse(
	response: ApiEstimateVideoPointsResponse,
): EstimateVideoPointsResponse {
	return {
		resource_type: response.resource_type,
		points: Number.isFinite(response.points) ? response.points : 0,
		detail: response.detail,
	}
}
