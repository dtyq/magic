import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import type {
	CompleteImagePromptRequest,
	CompleteImagePromptResponse,
	CompleteTextContentRequest,
	CompleteTextContentResponse,
} from "@/components/CanvasDesign/public/magic-types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { resolveDesignCanvasResourceApiUri } from "../utils/designResourceReferenceResolver"

interface UseImagePromptCompletionOptions {
	projectId?: string
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/** 画布目录路径段（与 magic.project.js 同级），用于把 DSL 相对路径还原为工作区路径 */
	designProjectBasePath?: string
}

interface UseImagePromptCompletionReturn {
	completeImagePrompt: (
		params: CompleteImagePromptRequest,
	) => Promise<CompleteImagePromptResponse>
	completeTextContent: (
		params: CompleteTextContentRequest,
	) => Promise<CompleteTextContentResponse>
}

export function useImagePromptCompletion(
	options: UseImagePromptCompletionOptions,
): UseImagePromptCompletionReturn {
	const { projectId, flatAttachments, designProjectBasePath } = options
	const { t } = useTranslation("super")

	const completeImagePrompt = useCallback(
		async (params: CompleteImagePromptRequest): Promise<CompleteImagePromptResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}

			const referenceImages = params.reference_images?.map((imagePath) =>
				resolveReferenceImagePath({
					imagePath,
					designProjectBasePath,
					flatAttachments,
					getErrorMessage: () => t("design.errors.designResourcePathUnresolved"),
				}),
			)
			const referenceImageOptions = resolveReferenceImageOptions({
				referenceImageOptions: params.reference_image_options,
				designProjectBasePath,
				flatAttachments,
				getErrorMessage: () => t("design.errors.designResourcePathUnresolved"),
			})

			const requestParams: CompleteImagePromptRequest = {
				project_id: projectId,
				user_prompt: params.user_prompt,
				reference_images: referenceImages,
				reference_image_options: referenceImageOptions,
			}

			if (params.model_id) {
				requestParams.model_id = params.model_id
			}

			return SuperMagicApi.completeImagePrompt(requestParams)
		},
		[designProjectBasePath, flatAttachments, projectId, t],
	)

	const completeTextContent = useCallback(
		async (params: CompleteTextContentRequest): Promise<CompleteTextContentResponse> => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}

			const requestParams: CompleteTextContentRequest = {
				project_id: projectId,
				user_prompt: params.user_prompt,
			}

			if (params.model_id) {
				requestParams.model_id = params.model_id
			}

			return SuperMagicApi.completeTextContent(requestParams)
		},
		[projectId, t],
	)

	return {
		completeImagePrompt,
		completeTextContent,
	}
}

function resolveReferenceImagePath(params: {
	imagePath: string
	designProjectBasePath?: string
	flatAttachments?: FileItem[]
	getErrorMessage: () => string
}): string {
	const { imagePath, designProjectBasePath, flatAttachments, getErrorMessage } = params
	const resolved = resolveDesignCanvasResourceApiUri(imagePath, {
		designProjectBasePath,
		flatAttachments,
	})
	if (!resolved) throw new Error(getErrorMessage())
	return resolved
}

function resolveReferenceImageOptions(params: {
	referenceImageOptions?: CompleteImagePromptRequest["reference_image_options"]
	designProjectBasePath?: string
	flatAttachments?: FileItem[]
	getErrorMessage: () => string
}): CompleteImagePromptRequest["reference_image_options"] {
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
