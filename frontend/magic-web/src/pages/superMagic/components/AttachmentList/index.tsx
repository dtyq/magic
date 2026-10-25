import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import {
	resolveFilePresentation,
	getFilePresentationIndex,
} from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import MagicIcon from "@/components/base/MagicIcon"
import topicEmpty from "@/pages/superMagic/assets/svg/topic-empty.svg"
import type { MouseEvent } from "react"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { IconChevronDown, IconChevronRight, IconDownload } from "@tabler/icons-react"
import { Button, Input, Tooltip, Typography } from "antd"
import { useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import useStyles from "./style"
import { SuperMagicApi } from "@/apis"
import {
	getAccessProjectId,
	getAccessTopicId,
	getShareAccessToken,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useTranslation } from "react-i18next"

const { Text } = Typography

// 定义文件和文件夹类型
interface FileItem {
	file_id: string
	file_name: string
	filename?: string
	file_extension: string
	is_directory?: boolean
	display_filename?: string
	is_hidden?: boolean

	[key: string]: any
}

interface FolderItem {
	name: string
	type: string
	is_directory: true
	children: (FileItem | FolderItem)[]
	path: string
	is_hidden?: boolean

	[key: string]: any
}

type AttachmentItem = FileItem | FolderItem

export default function AttachmentList({
	attachments,
	setUserSelectDetail,
}: {
	attachments: any[]
	topicId?: string
	setUserSelectDetail?: (detail: any) => void
}) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()
	const fileAccess = useFileAccess()

	const [isFileListCollapsed, setIsFileListCollapsed] = useState(false)
	const [fileSearchText, setFileSearchText] = useState("")
	const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})

	// 切换文件夹的展开/折叠状态
	const toggleFolder = (folderId: string, e: MouseEvent) => {
		e.stopPropagation()
		setCollapsedFolders((prev) => ({
			...prev,
			[folderId]: !prev[folderId],
		}))
	}

	// 过滤文件列表
	const filteredFiles = useMemo(() => {
		if (!attachments) return []

		const filterItems = (items: AttachmentItem[]): AttachmentItem[] => {
			return items.filter((item) => {
				// 首先检查是否被隐藏
				if (item.is_hidden) return false

				// 如果没有搜索文本，直接返回未隐藏的项目
				if (!fileSearchText.trim()) return true

				// 检查是否为文件夹
				if (item.is_directory && "children" in item) {
					// 对文件夹名称进行搜索
					const folderMatch = (item.name || "")
						.toLowerCase()
						.includes(fileSearchText.toLowerCase())

					// 递归搜索子文件/文件夹
					const filteredChildren = filterItems(item.children)

					// 如果文件夹名称匹配或子项有匹配，则保留此文件夹
					return folderMatch || filteredChildren.length > 0
				} else {
					// 对文件名进行搜索
					return (item.filename || item.file_name || "")
						.toLowerCase()
						.includes(fileSearchText.toLowerCase())
				}
			})
		}

		return filterItems(attachments)
	}, [attachments, fileSearchText])

	const handleDownloadFile = (file_id: string, e: MouseEvent<HTMLSpanElement>) => {
		e.stopPropagation()
		SuperMagicApi.getTemporaryDownloadUrlForAdmin({
			topic_id: getAccessTopicId(fileAccess),
			project_id: getAccessProjectId(fileAccess),
			temporary_token: getShareAccessToken(fileAccess),
			file_ids: [file_id],
		}).then((res: any) => {
			window.open(res[0]?.url, "_blank")
		})
	}

	const handleOpenFile = (item: AttachmentItem) => {
		// 如果是文件夹，不做任何操作
		if (item.is_directory) return

		const fileName = item.display_filename || item.file_name || item.filename
		const type = getFileType(item.file_extension)

		if (type) {
			const fileData = {
				type, // 根据文件扩展名确定类型
				data: {
					file_name: fileName,
					file_extension: item.file_extension,
					file_id: item.file_id,
				},
				currentFileId: item.file_id,
				attachments,
			}

			// PC端：发布事件打开文件tab
			if (!isMobile) {
				pubsub.publish(PubSubEvents.Open_File_Tab, {
					fileId: item.file_id,
					fileData,
				})
			} else {
				// 移动端：使用旧的方式
				setUserSelectDetail?.(fileData)
			}
		} else {
			// 不支持的文件类型，移动端和PC端都使用setUserSelectDetail
			const emptyData = {
				type: "empty",
				data: {
					text: t("attachmentList.previewUnsupported"),
				},
			}
			setUserSelectDetail?.(emptyData)
		}
	}

	// 根据是否移动端渲染文本
	const renderText = (text: string, tooltipTitle: string) => {
		if (isMobile) {
			return <Text className={styles.ellipsis}>{text}</Text>
		}

		return (
			<Tooltip title={tooltipTitle} placement="right">
				<Text className={styles.ellipsis}>{text}</Text>
			</Tooltip>
		)
	}

	// 递归渲染文件和文件夹
	const renderItems = (items: AttachmentItem[], level = 0) => {
		// 过滤掉隐藏的项目
		const visibleItems = items.filter((item) => !item.is_hidden)

		// 检查是否至少存在一个文件夹
		const hasFolders = visibleItems.some((item) => item.is_directory && "children" in item)

		return visibleItems.map((item: AttachmentItem) => {
			// 判断是否为文件夹
			if (item.is_directory && "children" in item) {
				const isFolderCollapsed = collapsedFolders[`/${item.relative_file_path}`]

				// 计算嵌套层级的缩进宽度
				const indentWidth = level * 24

				return (
					<div key={item.name} className={styles.folderContainer}>
						<div
							className={styles.fileItem}
							onClick={(e) => toggleFolder(`/${item.relative_file_path}`, e)}
							data-testid="toggle-folder"
						>
							{/* 使用固定结构的布局 */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									flex: 1,
									overflow: "hidden",
									paddingLeft: indentWidth + "px",
								}}
							>
								<div className={styles.iconWrapper}>
									<Button
										type="text"
										size="small"
										icon={
											<MagicIcon
												size={18}
												component={
													isFolderCollapsed
														? IconChevronDown
														: IconChevronRight
												}
												stroke={2}
											/>
										}
										onClick={(e) =>
											toggleFolder(`/${item.relative_file_path}`, e)
										}
										className={styles.iconButton}
									/>
								</div>
								<div className={styles.iconWrapper} style={{ marginLeft: "2px" }}>
									<FileResourceIcon
										presentation={resolveFilePresentation(item, {
											index: getFilePresentationIndex(attachments),
										})}
										size={18}
										folderTestId="attachment-list-image"
									/>
								</div>
								<div className={styles.fileNameContainer}>
									{renderText(item.name, item.name)}
								</div>
							</div>
						</div>
						{isFolderCollapsed && (
							<div className={styles.folderContent}>
								{renderItems(item.children, level + 1)}
							</div>
						)}
					</div>
				)
			} else {
				// 渲染文件
				// 计算嵌套层级的缩进宽度
				const indentWidth = level * 24

				return (
					<div
						key={item.file_id}
						className={styles.fileItem}
						onClick={(e) => {
							e.stopPropagation()
							handleOpenFile(item)
						}}
						data-testid="handle-open-file"
					>
						{/* 使用固定结构的布局 */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								flex: 1,
								overflow: "hidden",
								paddingLeft: indentWidth + "px",
							}}
						>
							{/* 只有在有文件夹存在时或者不是顶层时才显示空白占位按钮 */}
							{(hasFolders || level > 0) && (
								<div className={styles.iconWrapper}>
									<Button
										type="text"
										size="small"
										className={styles.iconButton}
										style={{
											visibility: "hidden",
											width: "18px",
											height: "18px",
										}}
									/>
								</div>
							)}
							<div
								className={styles.iconWrapper}
								style={{ marginLeft: hasFolders || level > 0 ? "2px" : "0" }}
							>
								<FileResourceIcon
									presentation={resolveFilePresentation(item, {
										index: getFilePresentationIndex(attachments),
									})}
									size={18}
									className={styles.threadTitleImage}
								/>
							</div>
							<div className={styles.fileNameContainer}>
								{renderText(item.file_name, item.file_name)}
							</div>
						</div>
						<MagicIcon
							className={styles.attachmentAction}
							onClick={(e: any) => handleDownloadFile(item.file_id, e)}
							component={IconDownload}
							stroke={2}
							size={18}
						/>
					</div>
				)
			}
		})
	}

	return (
		<div className={cx(styles.section, isFileListCollapsed && styles.collapsed)}>
			<div className={styles.header}>
				<div className={styles.titleContainer}>
					<div className={styles.iconWrapper}>
						<Button
							type="text"
							size="small"
							icon={
								<MagicIcon
									size={18}
									component={
										isFileListCollapsed ? IconChevronRight : IconChevronDown
									}
									stroke={2}
								/>
							}
							onClick={() => {
								setIsFileListCollapsed(!isFileListCollapsed)
							}}
							className={styles.iconButton}
						/>
					</div>
					<span>{t("attachmentList.projectFiles")}</span>
				</div>
			</div>
			{!isFileListCollapsed && (
				<div className={styles.content}>
					<div className={styles.searchContainer}>
						<Input
							placeholder={t("attachmentList.searchFiles")}
							value={fileSearchText}
							onChange={(e) => setFileSearchText(e.target.value)}
							className={styles.searchInput}
						/>
					</div>
					{!!filteredFiles.length && (
						<div className={styles.listContainer}>{renderItems(filteredFiles, 0)}</div>
					)}
					{!!attachments?.length && !filteredFiles.length && fileSearchText && (
						<div className={styles.emptyText}>
							<img
								src={topicEmpty}
								alt=""
								className={styles.emptyTextIcon}
								data-testid="attachment-list-image-2"
							/>
							{t("attachmentList.noMatch")}
						</div>
					)}
					{attachments?.length === 0 && (
						<div className={styles.emptyText}>
							<img
								src={topicEmpty}
								alt=""
								className={styles.emptyTextIcon}
								data-testid="attachment-list-image-3"
							/>
							{t("attachmentList.empty")}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
