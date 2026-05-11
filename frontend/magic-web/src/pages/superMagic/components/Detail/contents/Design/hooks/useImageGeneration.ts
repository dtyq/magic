import { useCallback } from "react"
import { SuperMagicApi } from "@/apis"
import type { ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import type { GetImageGenerationResultParams as ApiGetImageGenerationResultParams } from "@/apis/modules/superMagic"
import { MODEL_TYPE_IMAGE } from "@/apis/modules/org-ai-model-provider"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import superMagicCustomModelService from "@/services/superMagic/SuperMagicCustomModelService"
import type {
	ImageModelItem,
	GenerateImageRequest,
	GenerateImageResponse,
	GetImageGenerationResultParams,
	ImageGenerationResultResponse,
} from "@/components/CanvasDesign/types.magic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import MyModelsIcon from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/assets/my-models-icon.svg"
import type { GetOrCreateImagesDirFn } from "./useGetOrCreateImagesDir"
import { normalizePath } from "../utils/utils"
import { useTranslation } from "react-i18next"
import { resolveDesignImagesFileDirWithSlash } from "./resolveDesignImagesFileDirWithSlash"
import { toCanvasGenerateHightImageResponse } from "./useHighImageGeneration"
import {
	createDesignWorkspacePathExists,
	resolveDesignDslPathToWorkspaceAbsoluteByCandidates,
} from "../utils/designDslPathUtils"
import { syncFileInfoAfterGenerationComplete } from "../utils/syncFileInfoAfterGenerationComplete"

const IMAGE_MODEL_LIST_TTL_MS = 60_000
const imageModelListCacheByKey = new Map<string, { models: ImageModelItem[]; fetchedAt: number }>()

interface UseImageGenerationOptions {
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
	 * 当图片生成完成时，用于将结果缓存到文件信息缓存中
	 */
	setFileInfoCache?: (path: string, fileInfo: { src: string; fileName: string }) => void
	/** 文件列表更新 */
	updateAttachments: () => void
	/** 获取/创建 images 目录（由顶层传入，用于复用 promise 缓存） */
	getOrCreateImagesDir?: GetOrCreateImagesDirFn
}

interface UseImageGenerationReturn {
	getImageModelList: () => Promise<ImageModelItem[]>
	generateImage: (params: GenerateImageRequest) => Promise<GenerateImageResponse>
	getImageGenerationResult: (
		params: GetImageGenerationResultParams,
	) => Promise<ImageGenerationResultResponse>
}

/**
 * 图片生成相关功能 Hook
 * 职责：封装图片生成的所有相关操作
 * - 获取生图模型列表
 * - 发起图片生成请求
 * - 查询图片生成结果
 */
export function useImageGeneration(options: UseImageGenerationOptions): UseImageGenerationReturn {
	const {
		projectId,
		currentFile,
		flatAttachments,
		designProjectBasePath,
		setFileInfoCache,
		updateAttachments,
	} = options
	const { i18n, t } = useTranslation("super")

	/**
	 * 获取生图模型列表
	 */
	const getImageModelList = useCallback(async (): Promise<ImageModelItem[]> => {
		const now = Date.now()
		const cacheKey = [i18n.language, projectId ?? "", currentFile?.id ?? ""].join("\0")
		const cached = imageModelListCacheByKey.get(cacheKey)
		if (cached && now - cached.fetchedAt < IMAGE_MODEL_LIST_TTL_MS) {
			return cached.models
		}

		await superMagicModeService.fetchDefaultModeModelList({ force: false })
		const officialGroups = superMagicModeService.getImageModelGroupsByMode("general") || []
		const officialModels: ImageModelItem[] = officialGroups.flatMap(
			(groupItem: {
				group: { id: string; name: string; icon: string; sort: number }
				models: ImageModelItem[]
			}) =>
				(groupItem.models || []).map(
					(model): ImageModelItem => ({
						...model,
						model_source: "official",
						model_group: {
							id: groupItem.group.id,
							name: normalizeImageModelGroupLabel(groupItem.group.name),
							icon: groupItem.group.icon,
							sort: groupItem.group.sort,
							source: "official",
						},
					}),
				),
		)
		const customModels = getRepresentativeModelsByModelId(
			await superMagicCustomModelService.getMyModelsByType(MODEL_TYPE_IMAGE),
		)
		const modelIdSet = new Set(officialModels.map((item) => item.model_id))
		const mergedModels: ImageModelItem[] = [...officialModels]

		customModels.forEach((model) => {
			if (modelIdSet.has(model.model_id)) return

			mergedModels.push(toImageModelItem(model, t("messageEditor.addModel.myModels")))
		})
		imageModelListCacheByKey.set(cacheKey, { models: mergedModels, fetchedAt: Date.now() })
		return mergedModels
	}, [currentFile?.id, i18n.language, projectId, t])

	/**
	 * 发起图片生成
	 */
	const generateImage = useCallback(
		async (params: GenerateImageRequest): Promise<GenerateImageResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}
			const fileDirWithSlash = await resolveDesignImagesFileDirWithSlash({
				projectId,
				currentFile,
				flatAttachments,
				updateAttachments,
			})

			const referenceImagesWithSlash = params.reference_images?.map((imagePath) =>
				resolveReferenceImagePath({
					imagePath,
					designProjectBasePath,
					flatAttachments,
					getErrorMessage: () => t("design.errors.designResourcePathUnresolved"),
				}),
			)
			const referenceImageOptionsWithSlash = resolveReferenceImageOptions({
				referenceImageOptions: params.reference_image_options,
				designProjectBasePath,
				flatAttachments,
				getErrorMessage: () => t("design.errors.designResourcePathUnresolved"),
			})

			// 构建完整的请求参数，添加 project_id 和 file_dir
			const requestParams: GenerateImageRequest = {
				...params,
				project_id: projectId,
				file_dir: fileDirWithSlash,
				reference_images: referenceImagesWithSlash,
				reference_image_options: referenceImageOptionsWithSlash,
			}

			const result = await SuperMagicApi.generateImage(requestParams)
			return toCanvasGenerateHightImageResponse(result)
		},
		[projectId, currentFile, flatAttachments, designProjectBasePath, t, updateAttachments],
	)

	/**
	 * 查询图片生成结果
	 */
	const getImageGenerationResult = useCallback(
		async (params: GetImageGenerationResultParams): Promise<ImageGenerationResultResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}

			if (!params.image_id) {
				throw new Error(t("design.errors.imageIdNotExists"))
			}

			// 构建完整的请求参数，添加 project_id
			const requestParams: ApiGetImageGenerationResultParams = {
				project_id: projectId,
				image_id: params.image_id,
			}

			const result = await SuperMagicApi.getImageGenerationResult(requestParams)

			if (result.status === "completed" && result.file_url && result.file_name) {
				let filePath = ""
				if (result.file_dir) {
					const normalizedDir = normalizePath(result.file_dir)
					filePath = normalizedDir
						? `${normalizedDir}/${result.file_name}`
						: result.file_name
				} else {
					filePath = result.file_name
				}

				await syncFileInfoAfterGenerationComplete({
					projectId,
					filePath,
					fileUrl: result.file_url,
					fileName: result.file_name,
					setFileInfoCache,
				})
			}

			return result
		},
		[projectId, setFileInfoCache, t],
	)

	return {
		getImageModelList,
		generateImage,
		getImageGenerationResult,
	}
}

function resolveReferenceImagePath(params: {
	imagePath: string
	designProjectBasePath?: string
	flatAttachments?: FileItem[]
	getErrorMessage: () => string
}): string {
	const { imagePath, designProjectBasePath, flatAttachments, getErrorMessage } = params
	const resolved = resolveDesignDslPathToWorkspaceAbsoluteByCandidates(
		imagePath,
		designProjectBasePath,
		{
			pathExists: createDesignWorkspacePathExists(flatAttachments),
		},
	)
	if (!resolved) throw new Error(getErrorMessage())
	return resolved
}

function resolveReferenceImageOptions(params: {
	referenceImageOptions?: GenerateImageRequest["reference_image_options"]
	designProjectBasePath?: string
	flatAttachments?: FileItem[]
	getErrorMessage: () => string
}): GenerateImageRequest["reference_image_options"] {
	const { referenceImageOptions, designProjectBasePath, flatAttachments, getErrorMessage } =
		params
	if (!referenceImageOptions?.length) return undefined

	return referenceImageOptions.map((entry) => ({
		...entry,
		path: resolveReferenceImagePath({
			imagePath: entry.path,
			designProjectBasePath,
			flatAttachments,
			getErrorMessage,
		}),
	}))
}

function toImageModelItem(model: ServiceProviderModel, groupName: string): ImageModelItem {
	return {
		...model,
		group_id: MY_MODELS_GROUP_ID,
		model_name: model.name,
		provider_model_id: model.model_version || model.model_id,
		model_description: typeof model.description === "string" ? model.description : "",
		model_icon: model.icon ?? "",
		model_status: "normal",
		sort: 0,
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
		// 同一 model_id 多条记录时，保留带可用 image_size_config 的一条
		if (!hasUsableImageSizeConfig(existing) && hasUsableImageSizeConfig(model))
			modelMap.set(model.model_id, model)
	})

	return Array.from(modelMap.values())
}

function hasUsableImageSizeConfig(model: ServiceProviderModel): boolean {
	const sizes = model.image_size_config?.sizes
	return Array.isArray(sizes) && sizes.length > 0
}

function normalizeImageModelGroupLabel(label: string): string {
	return label.replace(/[-_\s]image$/i, "").trim()
}

const MY_MODELS_GROUP_ID = "my-models"
