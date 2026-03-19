import { memo } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { useStyles } from "./styles"

interface DragIndicatorProps {
	/** 拖拽的文件数量 */
	fileCount: number
	/** 被拖拽的文件名列表 */
	draggedFileNames: string[]
	/** 是否包含文件夹 */
	hasFolder?: boolean
	/** 指示器位置 */
	position: { x: number; y: number }
	/** 目标文件夹名称 */
	targetFolderName?: string
	/** 是否可以放置 */
	canDrop?: boolean
}

/**
 * 拖拽指示器组件
 * 按照 Figma 原型设计：上方小div显示"移动到"信息，下方大div显示被拖拽的文件
 */
function DragIndicator({
	fileCount,
	draggedFileNames,
	hasFolder = false,
	position,
	targetFolderName,
	canDrop = true,
}: DragIndicatorProps) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()

	// 获取第一个被拖拽的文件名，用于显示
	const primaryFileName = draggedFileNames[0] || ""

	// 如果拖拽多个文件，显示文件数量
	const displayFileName =
		fileCount > 1
			? t("topicFiles.dragMove.dragMultipleItems", "{{count}}个项目", { count: fileCount })
			: primaryFileName

	// 从文件名中提取扩展名
	const getFileExtension = (fileName: string) => {
		const lastDotIndex = fileName.lastIndexOf(".")
		return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1) : ""
	}

	const content = (
		<div
			className={styles.dragIndicator}
			style={{
				left: position.x + 12, // 偏移避免遮挡鼠标
				top: position.y + 12,
			}}
		>
			{/* 小div在上：移动到目标 */}
			{canDrop && targetFolderName && (
				<div className={styles.topIndicator}>
					<span className={styles.moveToText}>
						{t("topicFiles.dragMove.moveTo", "移动到")}
					</span>
					<span className={styles.targetName}>{targetFolderName}</span>
				</div>
			)}

			{/* 大div在下：文件项信息 */}
			<div
				className={cx(styles.fileItem, {
					[styles.canDrop]: canDrop,
					[styles.cannotDrop]: !canDrop,
				})}
			>
				{/* 文件图标 */}
				<div className={styles.fileIcon}>
					{hasFolder ? (
						<img
							src={FoldIcon as unknown as string}
							alt="folder"
							width={14}
							height={14}
						/>
					) : (
						<MagicFileIcon type={getFileExtension(primaryFileName)} size={14} />
					)}
				</div>

				{/* 文件名 */}
				<span className={styles.fileName}>{displayFileName}</span>
			</div>
		</div>
	)

	// 使用 Portal 渲染到 body，确保在最顶层显示
	return createPortal(content, document.body)
}

export default memo(DragIndicator)
