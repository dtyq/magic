import React from "react"
import { IconRotateClockwise2 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "antd"
import { formatFileSize } from "@/opensource/stores/folderUpload/helpers"
import type { FailedFileInfo } from "@/opensource/stores/folderUpload/types"
import { useFailedFileItemStyles } from "./FailedFileItem.styles"
import MagicButton from "../../base/MagicButton"
import MagicFileIcon from "../../base/MagicFileIcon"
import MagicEllipseWithTooltip from "../../base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"

interface FailedFileItemProps {
	failedFile: FailedFileInfo
	taskId: string
	taskName: string
	projectId: string
	projectName: string
	onRetry: () => void
	isRetrying?: boolean
}

export const FailedFileItem: React.FC<FailedFileItemProps> = ({
	failedFile,
	onRetry,
	isRetrying = false,
}) => {
	const { styles, cx } = useFailedFileItemStyles()
	const { t, i18n } = useTranslation("super")

	// 检测是否为英文环境
	const isEnglish = i18n.language === "en_US" || i18n.language === "en"

	// 获取文件扩展名（用于文件图标）
	const getFileExtension = () => {
		const fileName = failedFile.fileName
		const lastDotIndex = fileName.lastIndexOf(".")
		return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ""
	}

	// 格式化文件大小
	const formattedSize = formatFileSize(failedFile.fileSize)

	// 检查错误是否可重试
	const isRetryableError = () => {
		const errorMessage = failedFile.error.toLowerCase()
		// 不可重试的错误类型
		const nonRetryablePatterns = [
			"special characters", // 文件名包含特殊字符
			"invalid filename", // 无效文件名
			"file name", // 文件名相关错误
			"filename", // 文件名相关错误
		]
		return !nonRetryablePatterns.some((pattern) => errorMessage.includes(pattern))
	}

	// 获取用户友好的错误信息
	const getUserFriendlyError = () => {
		const errorMessage = failedFile.error.toLowerCase()

		// 检查是否是文件名相关错误
		if (
			errorMessage.includes("special characters") ||
			errorMessage.includes("invalid filename") ||
			errorMessage.includes("file name") ||
			errorMessage.includes("filename")
		) {
			return t("folderUpload.messages.invalidFilenameError")
		}

		// 其他错误返回原始信息
		return failedFile.error
	}

	const canRetry = isRetryableError()
	const retryDisabledReason = !canRetry
		? t("folderUpload.messages.cannotRetryInvalidFilename")
		: undefined
	const displayError = getUserFriendlyError()

	return (
		<div className={cx(styles.fileItem, isEnglish && styles.englishLayout)}>
			{/* 左侧区域：文件图标 */}
			<div className={styles.leftSection}>
				<div className={styles.iconContainer}>
					<MagicFileIcon type={getFileExtension()} size={32} />
				</div>

				{/* 文件信息 */}
				<div className={styles.fileInfo}>
					{/* 文件名 */}
					<MagicEllipseWithTooltip
						text={failedFile.fileName}
						maxWidth="430px"
						className={styles.fileName}
					/>

					{/* 详细信息行：文件大小 + 失败原因 */}
					<div className={styles.detailsRow}>
						<span className={styles.fileSizeText}>{formattedSize}</span>
						<span className={styles.separator}>·</span>
						<MagicEllipseWithTooltip
							text={displayError}
							maxWidth="350px"
							className={styles.errorText}
						/>
					</div>
				</div>
			</div>

			{/* 右侧：重试按钮 */}
			<div className={styles.rightSection}>
				<Tooltip title={retryDisabledReason}>
					<MagicButton
						icon={<IconRotateClockwise2 size={18} />}
						onClick={onRetry}
						loading={isRetrying}
						disabled={!canRetry}
						className={styles.retryButton}
					>
						{t("folderUpload.actions.retry")}
					</MagicButton>
				</Tooltip>
			</div>
		</div>
	)
}
