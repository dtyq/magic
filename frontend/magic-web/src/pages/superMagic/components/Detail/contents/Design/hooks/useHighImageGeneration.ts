import { useCallback } from "react"
import { SuperMagicApi } from "@/apis"
import type {
	GenerateHightImageRequest as ApiGenerateHightImageRequest,
	GenerateHightImageResponse as ApiGenerateHightImageResponse,
} from "@/apis/modules/superMagic"
import type {
	GenerateHightImageRequest,
	GenerateHightImageResponse,
	GetConvertHightConfigResponse,
} from "@/components/CanvasDesign/types.magic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	buildReferenceImageOptions,
	getReferenceImageCrop,
} from "@/components/CanvasDesign/canvas/utils/imageCropUtils"
import { useTranslation } from "react-i18next"
import {
	createDesignWorkspacePathExists,
	isRelativeDesignDslPath,
	resolveDesignDslPathToWorkspaceAbsoluteByCandidates,
} from "../utils/designDslPathUtils"

interface UseHighImageGenerationOptions {
	projectId?: string
	currentFile?: {
		id: string
		name: string
	}
	designProjectBasePath?: string
	flatAttachments?: FileItem[]
}

interface UseHighImageGenerationReturn {
	generateHightImage: (params: GenerateHightImageRequest) => Promise<GenerateHightImageResponse>
	getConvertHightConfig: () => Promise<GetConvertHightConfigResponse>
}

/**
 * 转高清相关功能 Hook
 * 职责：封装转高清的操作
 * - 发起转高清请求
 * - 获取转高清配置
 */
export function useHighImageGeneration(
	options: UseHighImageGenerationOptions,
): UseHighImageGenerationReturn {
	const { projectId, designProjectBasePath, flatAttachments } = options
	const { t } = useTranslation("super")

	/**
	 * 发起转高清
	 * @param params 转高清请求参数
	 */
	const generateHightImage = useCallback(
		async (params: GenerateHightImageRequest): Promise<GenerateHightImageResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}

			if (!params.file_path) {
				throw new Error(t("design.errors.filePathNotExists"))
			}

			const pathExists = createDesignWorkspacePathExists(flatAttachments)
			const filePathWithSlash = resolveDesignDslPathToWorkspaceAbsoluteByCandidates(
				params.file_path,
				designProjectBasePath,
				{
					pathExists,
				},
			)
			if (isRelativeDesignDslPath(params.file_path) && !filePathWithSlash.startsWith("/")) {
				throw new Error(t("design.errors.designResourcePathUnresolved"))
			}

			// 根据 file_path 生成 file_dir（提取目录部分）
			let fileDir = params.file_dir || ""
			if (!fileDir) {
				// 从 file_path 中提取目录部分
				const lastSlashIndex = filePathWithSlash.lastIndexOf("/")
				if (lastSlashIndex >= 0) {
					fileDir = filePathWithSlash.slice(0, lastSlashIndex + 1)
				} else {
					fileDir = "/"
				}
			} else {
				fileDir = resolveDesignDslPathToWorkspaceAbsoluteByCandidates(
					fileDir,
					designProjectBasePath,
					{
						ensureTrailingSlash: true,
						pathExists,
					},
				)
				if (isRelativeDesignDslPath(params.file_dir || "") && !fileDir.startsWith("/")) {
					throw new Error(t("design.errors.designResourcePathUnresolved"))
				}
			}

			// 构建完整的请求参数
			const requestParams: ApiGenerateHightImageRequest = {
				project_id: params.project_id || projectId,
				image_id: params.image_id,
				file_dir: fileDir,
				file_path: filePathWithSlash,
				size: params.size,
				reference_image_options: buildReferenceImageOptions({
					filePath: filePathWithSlash,
					crop: getReferenceImageCrop({
						filePath: params.file_path,
						referenceImageOptions: params.reference_image_options,
					}),
				}),
			}

			const result = await SuperMagicApi.generateHighImage(requestParams)
			return toCanvasGenerateHightImageResponse(result)
		},
		[projectId, designProjectBasePath, flatAttachments, t],
	)

	/**
	 * 获取转高清配置
	 */
	const getConvertHightConfig = useCallback(async (): Promise<GetConvertHightConfigResponse> => {
		const result = await SuperMagicApi.getConvertHightConfig()
		return result
	}, [])

	return {
		generateHightImage,
		getConvertHightConfig,
	}
}

export function toCanvasGenerateHightImageResponse(
	response: ApiGenerateHightImageResponse,
): GenerateHightImageResponse {
	return {
		...response,
		status: response.status as GenerateHightImageResponse["status"],
	}
}
