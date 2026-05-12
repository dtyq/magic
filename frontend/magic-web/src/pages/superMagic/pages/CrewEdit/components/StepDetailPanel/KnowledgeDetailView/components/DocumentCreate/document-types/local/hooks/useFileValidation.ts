import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { FILE_UPLOAD_LIMITS } from "../../../constants"
import magicToast from "@/components/base/MagicToaster/utils"

/**
 * 文件验证Hook
 * 提供文件格式、大小、数量验证
 */
export function useFileValidation() {
	const { t } = useTranslation("crew/create")

	/**
	 * 验证单个文件
	 */
	const validateFile = useMemoizedFn((file: File) => {
		const ext = file.name.split(".").pop()?.toLowerCase()

		if (
			!ext ||
			!FILE_UPLOAD_LIMITS.SUPPORTED_EXTENSIONS.includes(
				ext as (typeof FILE_UPLOAD_LIMITS.SUPPORTED_EXTENSIONS)[number],
			)
		) {
			return {
				valid: false,
				error: t("documentCreate.upload.error.unsupportedFormat", { ext }),
			}
		}

		if (file.size > FILE_UPLOAD_LIMITS.MAX_FILE_SIZE) {
			return {
				valid: false,
				error: t("documentCreate.upload.error.fileTooBig", {
					maxSize: FILE_UPLOAD_LIMITS.MAX_FILE_SIZE / 1024 / 1024,
				}),
			}
		}

		return { valid: true }
	})

	/**
	 * 批量验证文件
	 */
	const validateBatch = useMemoizedFn((files: File[], existingCount: number = 0) => {
		const totalCount = files.length + existingCount

		if (totalCount > FILE_UPLOAD_LIMITS.MAX_FILE_COUNT) {
			return {
				valid: false,
				error: t("documentCreate.upload.error.tooManyFiles", {
					maxCount: FILE_UPLOAD_LIMITS.MAX_FILE_COUNT,
				}),
			}
		}

		// 验证每个文件，收集失败的文件及其具体错误
		const invalidResults: Array<{ name: string; error: string }> = []
		for (const file of files) {
			const result = validateFile(file)
			if (!result.valid) {
				invalidResults.push({ name: file.name, error: result.error || "" })
			}
		}

		if (invalidResults.length > 0) {
			// 如果只有一个文件失败，返回具体的错误信息
			if (invalidResults.length === 1 && invalidResults[0]) {
				return {
					valid: false,
					error: invalidResults[0].error,
				}
			}
			// 如果多个文件失败，返回文件列表
			return {
				valid: false,
				error: t("documentCreate.upload.error.invalidFiles", {
					files: invalidResults.map((r) => r.name).join(", "),
				}),
			}
		}

		return { valid: true }
	})

	/**
	 * 显示验证错误提示
	 */
	const showValidationError = useMemoizedFn((error: string) => {
		magicToast.error(error)
	})

	return {
		validateFile,
		validateBatch,
		showValidationError,
		limits: FILE_UPLOAD_LIMITS,
	}
}
