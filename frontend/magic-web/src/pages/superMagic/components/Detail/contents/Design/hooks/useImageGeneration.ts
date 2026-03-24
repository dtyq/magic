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
import { normalizePath } from "../utils/utils"
import { useTranslation } from "react-i18next"
import { toCanvasGenerateHightImageResponse } from "./useHighImageGeneration"

interface UseImageGenerationOptions {
	projectId?: string
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/**
	 * 设置文件信息缓存的回调函数
	 * 当图片生成完成时，用于将结果缓存到文件信息缓存中
	 */
	setFileInfoCache?: (path: string, fileInfo: { src: string; fileName: string }) => void
	/** 文件列表更新 */
	updateAttachments: () => void
	/** 等待附件列表更新完成的回调函数 */
	waitForAttachmentsUpdate: (callback: () => void | Promise<void>) => void
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
		setFileInfoCache,
		updateAttachments,
		waitForAttachmentsUpdate,
	} = options
	const { t } = useTranslation("super")

	/**
	 * 获取生图模型列表
	 */
	const getImageModelList = useCallback(async (): Promise<ImageModelItem[]> => {
		const officialGroups = JSON.parse(
			JSON.stringify(superMagicModeService.getImageModelGroupsByMode("general") || []),
		) as Array<{
			group: { id: string; name: string; icon: string; sort: number }
			models: ImageModelItem[]
		}>
		const officialModels: ImageModelItem[] = officialGroups.flatMap((groupItem) =>
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

		return mergedModels
	}, [t])

	/**
	 * 发起图片生成
	 */
	const generateImage = useCallback(
		async (params: GenerateImageRequest): Promise<GenerateImageResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}

			// 计算 file_dir（项目目录路径）
			let fileDir = ""
			let parentDirId: string | undefined = undefined

			if (currentFile?.id && flatAttachments && flatAttachments.length > 0) {
				// 查找 design 项目文件/文件夹
				const designProjectFile = flatAttachments.find(
					(item) => item.file_id === currentFile.id,
				)

				if (designProjectFile?.relative_file_path) {
					const filePath = designProjectFile.relative_file_path

					// 如果是文件夹，直接使用路径
					if (designProjectFile.is_directory) {
						fileDir = filePath
						parentDirId = designProjectFile.file_id
					} else {
						// 如果是文件，计算目录路径：去掉文件名，保留目录部分
						const fileName = designProjectFile.file_name || currentFile.name
						// 如果文件路径以文件名结尾，则去掉文件名
						if (filePath.endsWith(fileName)) {
							fileDir = filePath.slice(0, -fileName.length)
						} else {
							// 否则使用文件路径的目录部分
							const lastSlashIndex = filePath.lastIndexOf("/")
							if (lastSlashIndex >= 0) {
								fileDir = filePath.slice(0, lastSlashIndex + 1)
							}
						}
						// 查找父目录的 ID
						const parentDirPath = normalizePath(fileDir)
						if (parentDirPath) {
							const parentDir = flatAttachments.find(
								(item) =>
									item.is_directory &&
									normalizePath(item.relative_file_path || "") === parentDirPath,
							)
							if (parentDir) {
								parentDirId = parentDir.file_id
							}
						}
					}

					// 清理路径：移除前导和尾随斜杠，确保路径格式统一
					fileDir = normalizePath(fileDir)

					// 如果 fileDir 不为空但 parentDirId 未找到，尝试通过路径查找父目录
					if (!parentDirId && fileDir) {
						const parentDir = flatAttachments.find(
							(item) =>
								item.is_directory &&
								normalizePath(item.relative_file_path || "") === fileDir,
						)
						if (parentDir) {
							parentDirId = parentDir.file_id
						}
					}

					// 检查 images 目录是否存在
					const imagesDirPath = fileDir ? `${fileDir}/images` : "images"
					const normalizedImagesDirPath = normalizePath(imagesDirPath)
					const imagesDirExists = flatAttachments.some(
						(item) =>
							item.is_directory &&
							normalizePath(item.relative_file_path || "") ===
								normalizedImagesDirPath,
					)

					// 如果 images 目录不存在，创建它
					if (!imagesDirExists) {
						try {
							await SuperMagicApi.createFile({
								project_id: projectId,
								parent_id: parentDirId || "",
								file_name: "images",
								is_directory: true,
							})
							// 触发文件列表更新
							updateAttachments()
						} catch (error: unknown) {
							// 如果是"文件已存在"错误（code: 51168），说明目录已经存在，忽略错误
							const errorObj = error as { code?: number; message?: string }
							if (errorObj.code === 51168) {
								// 触发文件列表更新，确保获取最新的文件列表
								updateAttachments()
							} else {
								//
							}
						}
					}

					// 添加 images 子目录
					fileDir = imagesDirPath
				}
			}

			// 格式化为目录格式：以斜杠开头和结尾
			const fileDirWithSlash = fileDir ? `/${fileDir}/` : undefined

			// 处理 reference_images，在每个路径前添加前导斜杠
			const referenceImagesWithSlash = params.reference_images?.map((imagePath) => {
				// 如果已经有前导斜杠，直接返回，否则添加
				return imagePath.startsWith("/") ? imagePath : `/${imagePath}`
			})

			// 构建完整的请求参数，添加 project_id 和 file_dir
			const requestParams: GenerateImageRequest = {
				...params,
				project_id: projectId,
				file_dir: fileDirWithSlash,
				reference_images: referenceImagesWithSlash,
			}

			const result = await SuperMagicApi.generateImage(requestParams)
			return toCanvasGenerateHightImageResponse(result)
		},
		[projectId, currentFile?.id, currentFile?.name, flatAttachments, t, updateAttachments],
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

			// 当状态为 completed 时，将结果缓存到文件信息缓存中
			if (result.status === "completed" && result.file_url && result.file_name) {
				// 构建文件路径：file_dir + file_name
				// file_dir 格式可能是 "/新建画布/images/" 或 "新建画布/images/"
				let filePath = ""
				if (result.file_dir) {
					// 移除前导和尾随斜杠，然后拼接文件名
					const normalizedDir = normalizePath(result.file_dir)
					filePath = normalizedDir
						? `${normalizedDir}/${result.file_name}`
						: result.file_name
				} else {
					filePath = result.file_name
				}

				// 先触发附件列表更新，确保新生成的文件已同步到附件列表中
				// 这样设置缓存时才能通过路径找到对应的 file_id
				updateAttachments()

				// 等待附件列表更新完成后再设置缓存
				// 使用 Promise 包装 waitForAttachmentsUpdate 的回调形式
				await new Promise<void>((resolve) => {
					waitForAttachmentsUpdate(() => {
						// 调用 setFileInfoCache 设置缓存
						if (setFileInfoCache) {
							setFileInfoCache(filePath, {
								src: result.file_url,
								fileName: result.file_name,
							})
						}
						resolve()
					})
				})
			}

			return result
		},
		[projectId, setFileInfoCache, updateAttachments, waitForAttachmentsUpdate, t],
	)

	return {
		getImageModelList,
		generateImage,
		getImageGenerationResult,
	}
}

function toImageModelItem(model: ServiceProviderModel, groupName: string): ImageModelItem {
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
		if (modelMap.has(model.model_id)) return
		modelMap.set(model.model_id, model)
	})

	return Array.from(modelMap.values())
}

function normalizeImageModelGroupLabel(label: string): string {
	return label.replace(/[-_\s]image$/i, "").trim()
}

const MY_MODELS_GROUP_ID = "my-models"
