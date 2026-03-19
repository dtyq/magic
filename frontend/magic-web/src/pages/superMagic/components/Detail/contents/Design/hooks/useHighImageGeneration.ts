import { useCallback } from "react"
import { SuperMagicApi } from "@/apis"
import type {
	GenerateHightImageRequest as ApiGenerateHightImageRequest,
	GenerateHightImageResponse,
} from "@/apis/modules/superMagic"
import type {
	GenerateHightImageRequest,
	GetConvertHightConfigResponse,
} from "@/components/CanvasDesign/types.magic"
import { useTranslation } from "react-i18next"

interface UseHighImageGenerationOptions {
	projectId?: string
	currentFile?: {
		id: string
		name: string
	}
	attachments?: unknown[]
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
	const { projectId } = options
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

			// 处理 file_path，确保以斜杠开头
			const filePathWithSlash = params.file_path.startsWith("/")
				? params.file_path
				: `/${params.file_path}`

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
				// 如果提供了 file_dir，确保格式正确（以斜杠开头和结尾）
				if (!fileDir.startsWith("/")) {
					fileDir = `/${fileDir}`
				}
				if (!fileDir.endsWith("/")) {
					fileDir = `${fileDir}/`
				}
			}

			// 构建完整的请求参数
			const requestParams: ApiGenerateHightImageRequest = {
				project_id: params.project_id || projectId,
				image_id: params.image_id,
				file_dir: fileDir,
				file_path: filePathWithSlash,
				size: params.size,
			}

			const result = await SuperMagicApi.generateHighImage(requestParams)
			return result
		},
		[projectId, t],
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
