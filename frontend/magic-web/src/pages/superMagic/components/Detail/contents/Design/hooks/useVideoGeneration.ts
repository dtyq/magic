import { useCallback } from "react"
import { SuperMagicApi } from "@/apis"
import type {
	EstimateVideoPointsResponse as ApiEstimateVideoPointsResponse,
	GetVideoGenerationResultParams as ApiGetVideoGenerationResultParams,
} from "@/apis/modules/superMagic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import superMagicCustomModelService from "@/services/superMagic/SuperMagicCustomModelService"
import { MODEL_TYPE_VIDEO, type ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import { UploadSubDir } from "@/components/CanvasDesign/public/magic-types"
import type {
	EstimateVideoPointsResponse,
	GenerationStatus,
	VideoModelItem,
	GenerateVideoRequest,
	GenerateVideoResponse,
	GetVideoGenerationResultParams,
	VideoGenerationResultResponse,
} from "@/components/CanvasDesign/public/magic-types"
import MyModelsIcon from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/assets/my-models-icon.svg"
import { isAssetResourcePath } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import { normalizePath } from "../utils/utils"
import { useTranslation } from "react-i18next"
import {
	resolveDesignCanvasResourceApiUri,
	resolveDesignWorkspaceDirectoryApiPath,
	resolveDesignWorkspaceStoragePath,
} from "../utils/designResourceReferenceResolver"
import { syncFileInfoAfterGenerationComplete } from "../utils/syncFileInfoAfterGenerationComplete"
import {
	calculateUploadDirectory,
	getOrCreateUploadSubDirFileId,
	validateUploadDirectoryFileId,
} from "../utils/designAssetDirectory"

interface UseVideoGenerationOptions {
	projectId?: string
	topicId?: string
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
		topicId,
		currentFile,
		flatAttachments,
		designProjectBasePath,
		setFileInfoCache,
		updateAttachments,
	} = options
	const { t } = useTranslation("super")

	const getVideoModelList = useCallback(async (): Promise<VideoModelItem[]> => {
		await superMagicModeService.fetchModeList({ force: false })
		await superMagicModeService.fetchDefaultModeModelList({ force: false })
		const officialGroups = superMagicModeService.getAllVideoModelGroups()
		const officialModels = officialGroups.flatMap((groupItem) =>
			(groupItem.models || []).map((model): VideoModelItem => ({
				...model,
				model_source: "official",
				model_group: {
					id: groupItem.group.id,
					name: normalizeVideoModelGroupLabel(groupItem.group.name),
					icon: groupItem.group.icon,
					sort: groupItem.group.sort,
					source: "official",
				},
			})),
		)
		const officialModelIds = new Set(officialModels.map((model) => model.model_id))
		const customModels = getRepresentativeModelsByModelId(
			await superMagicCustomModelService.getMyModelsByType(MODEL_TYPE_VIDEO),
		)
		const customVideoModels = customModels
			.filter((model) => !officialModelIds.has(model.model_id))
			.map((model) => toVideoModelItem(model, t("messageEditor.addModel.myModels")))

		return [...officialModels, ...customVideoModels]
	}, [t])

	const generateVideo = useCallback(
		async (params: GenerateVideoRequest): Promise<GenerateVideoResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}
			const requestParams = await buildDesignVideoRequestParams({
				params,
				projectId,
				topicId,
				currentFile,
				flatAttachments,
				designProjectBasePath,
				updateAttachments,
				ensureVideosDir: params.generation_type !== "canvas_composition",
				pathUnresolvedMessage: t("design.errors.designResourcePathUnresolved"),
			})
			const result = await SuperMagicApi.generateVideo(requestParams)
			return {
				...result,
				status: normalizeVideoGenerationStatus(result.status),
			} as GenerateVideoResponse
		},
		[
			projectId,
			topicId,
			currentFile,
			flatAttachments,
			designProjectBasePath,
			t,
			updateAttachments,
		],
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
			const result = await SuperMagicApi.estimateVideoPoints(requestParams, {
				enableErrorMessagePrompt: false,
			})
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
				const fileUrl = result.file_url
				const fileName = result.file_name
				const normalizedDir = normalizePath(normalizedResult.file_dir || "")
				const workspacePath = normalizedDir ? `${normalizedDir}/${fileName}` : fileName
				const filePath = resolveDesignWorkspaceStoragePath(workspacePath, {
					designProjectBasePath,
				})
				if (filePath) {
					await syncFileInfoAfterGenerationComplete({
						projectId,
						filePath,
						fileUrl,
						fileName,
						setFileInfoCache,
					})
				}
			}
			return normalizedResult
		},
		[designProjectBasePath, projectId, setFileInfoCache, t],
	)

	return { getVideoModelList, generateVideo, estimateVideoPoints, getVideoGenerationResult }
}

interface BuildDesignVideoRequestParamsOptions {
	params: GenerateVideoRequest
	projectId: string
	topicId?: string
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
		topicId,
		currentFile,
		flatAttachments,
		designProjectBasePath,
		updateAttachments,
		ensureVideosDir,
		pathUnresolvedMessage,
	} = options
	let fileDir = ""
	if (currentFile?.id && flatAttachments && flatAttachments.length > 0) {
		const designProjectFile = flatAttachments.find((item) => item.file_id === currentFile.id)

		if (designProjectFile?.relative_file_path) {
			const videosDirPath = calculateUploadDirectory(
				{ currentFile, flatAttachments },
				UploadSubDir.Videos,
			)

			if (ensureVideosDir) {
				await getOrCreateUploadSubDirFileId({
					currentFile,
					flatAttachments,
					projectId,
					subDir: UploadSubDir.Videos,
					updateAttachments,
					validateDirFileId: validateUploadDirectoryFileId,
				})
			}

			fileDir = videosDirPath
		}
	}
	const fileDirWithSlash = fileDir
		? resolveDesignWorkspaceDirectoryApiPath(fileDir, {
				designProjectBasePath,
				flatAttachments,
			})
		: undefined
	const request = toDesignGenerateVideoRequest(
		params,
		designProjectBasePath,
		flatAttachments,
		pathUnresolvedMessage,
	)
	if (params.generation_type === "canvas_composition") {
		if (!request.composition?.videos.length) {
			throw new Error("画布合并任务缺少视频输入")
		}
		if (!fileDirWithSlash) {
			throw new Error(pathUnresolvedMessage)
		}
		return {
			...request,
			project_id: projectId,
			file_dir: fileDirWithSlash,
		}
	}
	return {
		...request,
		project_id: projectId,
		...(topicId ? { topic_id: topicId } : {}),
		file_dir: fileDirWithSlash,
	}
}

function normalizeVideoModelGroupLabel(label: string): string {
	return label.replace(/[-_\s]video$/i, "").trim()
}

const MY_MODELS_GROUP_ID = "my-models"

function toVideoModelItem(model: ServiceProviderModel, groupName: string): VideoModelItem {
	return {
		id: model.id,
		group_id: MY_MODELS_GROUP_ID,
		model_id: model.model_id,
		model_name: model.name,
		provider_model_id: model.model_version || model.model_id,
		model_description: typeof model.description === "string" ? model.description : "",
		model_icon: model.icon ?? "",
		model_status: "normal",
		sort: 0,
		...(model.video_generation_config
			? { video_generation_config: model.video_generation_config }
			: {}),
		model_source: "custom",
		model_group: {
			id: MY_MODELS_GROUP_ID,
			name: groupName,
			icon: MyModelsIcon,
			source: "custom",
		},
	}
}

function getRepresentativeModelsByModelId(models: ServiceProviderModel[]): ServiceProviderModel[] {
	const modelMap = new Map<string, ServiceProviderModel>()

	models.forEach((model) => {
		const existing = modelMap.get(model.model_id)
		if (!existing) {
			modelMap.set(model.model_id, model)
			return
		}

		// 同一 model_id 可能对应多个服务商，优先保留带视频能力配置的记录，
		// 避免接口第一条为空配置时覆盖后续可用配置。
		if (!hasUsableVideoGenerationConfig(existing) && hasUsableVideoGenerationConfig(model)) {
			modelMap.set(model.model_id, model)
		}
	})

	return Array.from(modelMap.values())
}

function hasUsableVideoGenerationConfig(model: ServiceProviderModel): boolean {
	const config = model.video_generation_config
	return Boolean(config && Object.keys(config).length > 0)
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
	const isCanvasComposition = params.generation_type === "canvas_composition"
	const compositionExtensions = params.extensions?.output_file_name
		? { output_file_name: params.extensions.output_file_name }
		: undefined
	const composition = params.composition
		? normalizeGenerateVideoComposition(
				params.composition,
				designProjectBasePath,
				flatAttachments,
				pathUnresolvedMessage,
			)
		: undefined

	if (isCanvasComposition) {
		return {
			project_id: params.project_id,
			video_id: params.video_id,
			generation_type: params.generation_type,
			...(Object.keys(normalizedGeneration).length > 0
				? { generation: normalizedGeneration }
				: {}),
			...(composition ? { composition } : {}),
			...(compositionExtensions ? { extensions: compositionExtensions } : {}),
		}
	}

	return {
		project_id: params.project_id,
		video_id: params.video_id,
		model_id: params.model_id,
		prompt: params.prompt,
		input_mode: params.input_mode,
		task: params.task || "generate",
		file_dir: params.file_dir,
		file_name: params.file_name,
		generation_type: params.generation_type,
		topic_id: params.topic_id,
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

function normalizeGenerateVideoComposition(
	composition: NonNullable<GenerateVideoRequest["composition"]>,
	designProjectBasePath?: string,
	flatAttachments?: FileItem[],
	pathUnresolvedMessage?: string,
): NonNullable<GenerateVideoRequest["composition"]> {
	const resolve = (input: { path: string }) => {
		const path = ensureDesignResourceUri(
			input.path,
			designProjectBasePath,
			flatAttachments,
			pathUnresolvedMessage,
		)
		if (!path.startsWith("/") && !isAssetResourcePath(path)) {
			throw new Error(pathUnresolvedMessage || "Design composition path unresolved")
		}
		return { ...input, path }
	}

	return {
		videos: composition.videos.map(resolve),
		...(composition.audios?.length
			? { audios: composition.audios.map(resolve) }
			: composition.audios
				? { audios: [] }
				: {}),
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
						uri: ensureDesignResourceUri(
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
						uri: ensureDesignResourceUri(
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
						uri: ensureDesignResourceUri(
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
						uri: ensureDesignResourceUri(
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
						uri: ensureDesignResourceUri(
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
						uri: ensureDesignResourceUri(
							inputs.mask.uri,
							designProjectBasePath,
							flatAttachments,
							pathUnresolvedMessage,
						),
					},
				}
			: {}),
		...(inputs.draft_task?.video_id || inputs.draft_task?.uri
			? {
					draft_task: {
						...(inputs.draft_task.video_id
							? { video_id: inputs.draft_task.video_id }
							: {}),
						...(inputs.draft_task.uri
							? {
									uri: ensureDesignResourceUri(
										inputs.draft_task.uri,
										designProjectBasePath,
										flatAttachments,
										pathUnresolvedMessage,
									),
								}
							: {}),
					},
				}
			: {}),
		...(inputs.audio?.length
			? {
					audio: inputs.audio.map((item) => ({
						...item,
						uri: ensureDesignResourceUri(
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

function ensureDesignResourceUri(
	path: string,
	designProjectBasePath?: string,
	flatAttachments?: FileItem[],
	pathUnresolvedMessage?: string,
): string {
	if (!path) return path
	const resolved = resolveDesignCanvasResourceApiUri(path, {
		designProjectBasePath,
		flatAttachments,
	})
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
