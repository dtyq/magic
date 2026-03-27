import { useTranslation } from "react-i18next"
import {
	IconDownload,
	IconEdit,
	IconFolderPlus,
	IconFolderUp,
	IconUpload,
	IconShare,
	IconTrash,
	IconFile,
	IconMessageCircleShare,
	IconMessageCirclePlus,
	IconFolderSymlink,
	IconReplace,
	IconFolders,
	IconSquareCheck,
} from "@tabler/icons-react"
import IconOpenWindow from "@/enhance/tabler/icons-react/icons/IconOpenWindow"
import MagicIcon from "@/components/base/MagicIcon"
import { Flex } from "antd"
import { AttachmentSource, type AttachmentItem } from "./types"
import { useStyles } from "../style"
import { useIsMobile } from "@/hooks/useIsMobile"

import MagicModal from "@/components/base/MagicModal"
import { getAppEntryFile } from "../../MessageList/components/MessageAttachment/utils"
import VIPTag from "../../VIPTag"
import { IMAGE_EXTENSIONS } from "../../Detail/hooks/useDetailActions"
import { DownloadImageMode } from "../../../pages/Workspace/types"
import { createFileMenuItems } from "../components/hooks/useFileMenuItems"
import { useFileActionVisibility } from "@/pages/superMagic/providers/file-action-visibility-provider"
import { normalizeMenuItems, type TopicFilesMenuItem } from "../utils/menu-items"

type MenuItem = TopicFilesMenuItem

interface UseContextMenuOptions {
	handleUploadFile: (item?: AttachmentItem) => void
	handleUploadFolder: (item?: AttachmentItem) => void
	handleShareItem: (item: AttachmentItem) => void
	handleDeleteItem: (item: AttachmentItem) => void
	handleDownloadOriginal: (item: AttachmentItem, mode?: DownloadImageMode) => void
	handleDownloadPdf: (item: AttachmentItem) => void
	handleDownloadPpt: (item: AttachmentItem) => void
	handleDownloadPptx: (item: AttachmentItem, folderChildren?: AttachmentItem[]) => void
	handleOpenFile: (item: AttachmentItem) => void
	handleStartRename: (item: AttachmentItem) => void
	handleAddToCurrentChat: (item: AttachmentItem) => void
	handleAddToNewChat: (item: AttachmentItem) => void
	handleMoveFile?: (item: AttachmentItem) => void
	handleReplaceFile?: (item: AttachmentItem) => void
	createVirtualFile: (
		type: "txt" | "md" | "html" | "py" | "go" | "php" | "design" | "custom",
		key?: string,
		parentPath?: string,
	) => void
	createVirtualFolder: (key?: string, parentPath?: string) => void
	createVirtualDesignProject?: (key?: string, parentPath?: string) => void
	isMoving?: boolean
	// 新增：多文件选择相关
	selectedItems?: Set<string>
	handleAddMultipleFilesToCurrentChat?: () => void
	handleAddMultipleFilesToNewChat?: () => void
	handleDownloadNoWaterMark?: (item?: AttachmentItem) => void
	preloadWaterMarkFreeModal?: () => void
	/* 当前订阅套餐是否为免费试用版 */
	isFreeTrialVersion?: boolean
	onCopyFile?: (fileIds: string[]) => void
	/** 自定义处理菜单渲染 */
	filterMenuItems?: (menuItems: MenuItem[]) => MenuItem[]
	/** 自定义处理批量菜单渲染 */
	filterBatchDownloadLayerMenuItems?: (menuItems: MenuItem[]) => MenuItem[]
	/* 获取快捷键提示 */
	getShortcutHint?: (action: "addToCurrentChat") => { modifiers: string[]; key: string } | null
	/* 进入多选模式并选中当前项 */
	handleEnterMultiSelectMode?: (item: AttachmentItem) => void
	/* 是否已在多选模式 */
	isSelectMode?: boolean
}

function isImage(fileExtension?: string): boolean {
	if (!fileExtension) return false
	const ext = fileExtension.toLowerCase()
	return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * 判断文件是否支持转换为PDF格式
 * markdown和HTML文件都支持转换为PDF
 */
function isConvertiblePdf(fileExtension?: string): boolean {
	if (!fileExtension) return false
	const ext = fileExtension.toLowerCase()
	return ext === "md" || ext === "html"
}

/**
 * 判断文件是否支持转换为PPTX格式
 * 只有HTML文件支持转换为PPTX
 */
function isConvertiblePPTX(fileExtension?: string): boolean {
	if (!fileExtension) return false
	const ext = fileExtension.toLowerCase()
	return ext === "html"
}

/**
 * 检测浏览器是否支持文件夹上传
 * 移动端直接返回 false，桌面端检测 webkitdirectory 属性支持
 */
function supportsFolderUpload(isMobile: boolean): boolean {
	// 移动端直接禁用文件夹上传功能，避免误判和用户体验问题
	if (isMobile) {
		return false
	}

	// 桌面端检测 webkitdirectory 属性支持
	try {
		const input = document.createElement("input")
		return "webkitdirectory" in input
	} catch {
		return false
	}
}

/**
 * Flatten menu items and remove divider items
 * @param items - Array of menu items to process
 * @returns Flattened array without divider items
 */
export function flattenMenuItems(items: MenuItem[]): MenuItem[] {
	const result: MenuItem[] = []

	function processItem(item: MenuItem | null) {
		// Skip null or divider items
		if (!item || item.type === "divider") return

		// Type guard: check if item has children property
		const hasChildren =
			"children" in item &&
			item.children !== undefined &&
			Array.isArray(item.children) &&
			item.children.length > 0

		// If item has children, process them recursively
		if (hasChildren && item.children) {
			item.children.forEach((child) => processItem(child as MenuItem))
		} else {
			// Add item without children property
			// Create a new object without children to ensure type safety
			const itemWithoutChildren = { ...item }
			delete (itemWithoutChildren as { children?: unknown }).children
			result.push(itemWithoutChildren as MenuItem)
		}
	}

	items.forEach((item) => processItem(item))

	return result
}

/**
 * useContextMenu - 处理右键菜单配置
 */
export function useContextMenu(options: UseContextMenuOptions) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const { hideAddToNewChat, hideCopyTo, hideMoveTo, hideShare } = useFileActionVisibility()
	const {
		handleUploadFile,
		handleUploadFolder,
		handleShareItem,
		handleDeleteItem,
		handleDownloadOriginal,
		handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleDownloadPptx,
		handleOpenFile,
		handleStartRename,
		handleAddToCurrentChat,
		handleAddToNewChat,
		handleMoveFile,
		handleReplaceFile,
		onCopyFile,
		createVirtualFile,
		createVirtualFolder,
		createVirtualDesignProject,
		isMoving = false,
		selectedItems,
		handleAddMultipleFilesToCurrentChat,
		handleAddMultipleFilesToNewChat,
		isFreeTrialVersion,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems,
		getShortcutHint,
		handleEnterMultiSelectMode,
		isSelectMode = false,
	} = options

	// 获取文件夹路径
	const getFolderPath = (item: AttachmentItem): string | undefined => {
		if (item.is_directory && "children" in item) {
			return item.relative_file_path || `/${item.name}`
		}
		return undefined
	}

	// 处理复制文件
	const handleCopyFile = (item: AttachmentItem) => {
		if (!item.file_id) return
		onCopyFile?.([item.file_id])
	}

	// 生成批量下载层菜单项（只有三个选项）
	const getBatchDownloadLayerMenuItems = (): MenuItem[] => {
		const menuItems: MenuItem[] = [
			{
				key: "createFile",
				label: t("topicFiles.contextMenu.createFile"),
				icon: <MagicIcon component={IconFile} stroke={2} size={18} />,
				children: createFileMenuItems({
					t,
					onAddFile: (type) => createVirtualFile(type),
					// 只在根目录显示新建画布选项
					onAddDesign: createVirtualDesignProject,
				}),
			},
			{
				key: "createFolder",
				label: t("topicFiles.contextMenu.createFolder"),
				icon: <MagicIcon component={IconFolderPlus} stroke={2} size={18} />,
				onClick: () => createVirtualFolder(),
			},
			{
				key: "uploadFile",
				label: t("topicFiles.contextMenu.uploadFile"),
				icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
				onClick: () => handleUploadFile(),
			},
		]

		// 只有当浏览器支持文件夹上传时才显示上传文件夹选项
		if (supportsFolderUpload(isMobile)) {
			menuItems.push({
				key: "uploadFolder",
				label: t("topicFiles.contextMenu.uploadFolder"),
				icon: <MagicIcon component={IconFolderUp} stroke={2} size={18} />,
				onClick: () => handleUploadFolder(),
			})
		}

		return filterBatchDownloadLayerMenuItems?.(menuItems) || menuItems
	}

	// 生成菜单项
	const getMenuItems = (item: AttachmentItem): MenuItem[] => {
		const menuItems: MenuItem[] = []

		if (item.is_directory && "children" in item) {
			const parentPath = getFolderPath(item)
			const key = item.file_id
			// 判断是否为根目录：根目录的 parentPath 为 undefined 或者 relative_file_path 为空/根路径
			const isRootDirectory = !item.relative_file_path || item.relative_file_path === "/"

			menuItems.push(
				{
					key: "createFile",
					label: t("topicFiles.contextMenu.createFile"),
					icon: <MagicIcon component={IconFile} stroke={2} size={18} />,
					children: createFileMenuItems({
						t,
						onAddFile: (type) => createVirtualFile(type, key, parentPath),
						// 只在根目录显示新建画布选项
						onAddDesign:
							createVirtualDesignProject && isRootDirectory
								? () => createVirtualDesignProject(key, parentPath)
								: undefined,
					}),
				},
				{
					key: "createFolder",
					label: t("topicFiles.contextMenu.createFolder"),
					icon: <MagicIcon component={IconFolderPlus} stroke={2} size={18} />,
					onClick: () => createVirtualFolder(key, parentPath),
				},
				{
					key: "uploadFile",
					label: t("topicFiles.contextMenu.uploadFile"),
					icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
					onClick: () => handleUploadFile(item),
				},
				// 只有当浏览器支持文件夹上传时才显示上传文件夹选项
				...(supportsFolderUpload(isMobile)
					? [
							{
								key: "uploadFolder",
								label: t("topicFiles.contextMenu.uploadFolder"),
								icon: <MagicIcon component={IconFolderUp} stroke={2} size={18} />,
								onClick: () => handleUploadFolder(item),
							},
						]
					: []),
				{ type: "divider" as const },
				{
					key: "rename",
					label: t("topicFiles.contextMenu.rename"),
					icon: <MagicIcon component={IconEdit} stroke={2} size={18} />,
					onClick: () => handleStartRename(item),
					disabled: isMoving,
				},
				...(handleMoveFile && !hideMoveTo
					? [
							{
								key: "moveFile",
								label: t("topicFiles.contextMenu.moveTo"),
								icon: (
									<MagicIcon component={IconFolderSymlink} stroke={2} size={18} />
								),
								onClick: () => handleMoveFile(item),
								disabled: isMoving,
							},
						]
					: []),
				...(onCopyFile && !hideCopyTo
					? [
							{
								key: "copyFile",
								label: t("topicFiles.contextMenu.copyTo"),
								icon: <MagicIcon component={IconFolders} stroke={2} size={18} />,
								onClick: () => handleCopyFile(item),
								disabled: isMoving,
							},
						]
					: []),
				{ type: "divider" as const },
				// 根据选中状态决定显示单文件还是多文件菜单（文件夹版本）
				...(selectedItems && selectedItems.size > 1
					? [
							{
								key: "addSelectedToCurrentChat",
								label: t("topicFiles.contextMenu.addToCurrentChat"),
								icon: (
									<MagicIcon
										component={IconMessageCircleShare}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddMultipleFilesToCurrentChat?.(),
							},
							{
								key: "addSelectedToNewChat",
								label: t("topicFiles.contextMenu.addToNewChat"),
								icon: (
									<MagicIcon
										component={IconMessageCirclePlus}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddMultipleFilesToNewChat?.(),
							},
						].filter((menuItem) =>
							hideAddToNewChat ? menuItem.key !== "addSelectedToNewChat" : true,
						)
					: [
							{
								key: "addToCurrentChat",
								label: (
									<Flex
										align="center"
										justify="space-between"
										style={{ width: "100%" }}
									>
										<span>{t("topicFiles.contextMenu.addToCurrentChat")}</span>
										{getShortcutHint &&
											!isMobile &&
											(() => {
												const shortcut = getShortcutHint("addToCurrentChat")
												if (!shortcut) return null
												return (
													<div className={styles.menuItemShortcut}>
														{shortcut.modifiers.map((modifier) => (
															<div
																key={modifier}
																className={
																	styles.menuItemShortcutItem
																}
															>
																{modifier}
															</div>
														))}
														<div
															className={styles.menuItemShortcutItem}
														>
															{shortcut.key}
														</div>
													</div>
												)
											})()}
									</Flex>
								),
								icon: (
									<MagicIcon
										component={IconMessageCircleShare}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddToCurrentChat(item),
							},
							{
								key: "addToNewChat",
								label: t("topicFiles.contextMenu.addToNewChat"),
								icon: (
									<MagicIcon
										component={IconMessageCirclePlus}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddToNewChat(item),
							},
						].filter((menuItem) =>
							hideAddToNewChat ? menuItem.key !== "addToNewChat" : true,
						)),
				{ type: "divider" as const },
				// 文件夹下载菜单：根据metadata决定显示方式
				...(item.metadata
					? [
							{
								key: "download",
								label: t("topicFiles.contextMenu.download"),
								icon: <MagicIcon component={IconDownload} stroke={2} size={18} />,
								children: [
									{
										key: "downloadOriginal",
										label: t("topicFiles.contextMenu.downloadOriginal"),
										onClick: () => handleDownloadOriginal(item),
									},
									{
										key: "downloadPdf",
										label: t("topicFiles.contextMenu.downloadPdf"),
										onClick: () => {
											const appEntryFile = getAppEntryFile(
												item.children || [],
											)
											if (appEntryFile) handleDownloadPdf(appEntryFile)
										},
									},
									{
										key: "downloadPpt",
										label: t("topicFiles.contextMenu.downloadPpt"),
										onClick: () => {
											const appEntryFile = getAppEntryFile(
												item.children || [],
											)
											if (appEntryFile) handleDownloadPpt(appEntryFile)
										},
									},
									{
										key: "downloadPptx",
										label: t("topicFiles.contextMenu.downloadPptx"),
										onClick: () => {
											const children = item.children || []
											const appEntryFile = getAppEntryFile(children)
											if (appEntryFile) {
												console.log("children", children)
												handleDownloadPptx(appEntryFile, children)
											}
										},
									},
								],
							},
						]
					: [
							{
								key: "downloadFolder",
								label: t("topicFiles.contextMenu.downloadFolder"),
								icon: <MagicIcon component={IconDownload} stroke={2} size={18} />,
								onClick: () => handleDownloadOriginal(item),
							},
						]),
				{ type: "divider" as const },
				...(!hideShare
					? [
							{
								key: "share",
								label: t("topicFiles.contextMenu.shareFile"),
								icon: <MagicIcon component={IconShare} stroke={2} size={18} />,
								onClick: () => handleShareItem(item),
							},
						]
					: []),
				...(handleEnterMultiSelectMode && !isSelectMode
					? [
							{
								key: "selectMultiple",
								label: t("topicFiles.contextMenu.selectMultiple"),
								icon: (
									<MagicIcon component={IconSquareCheck} stroke={2} size={18} />
								),
								onClick: () => handleEnterMultiSelectMode(item),
							},
						]
					: []),
				{ type: "divider" as const },
				{
					key: "delete",
					danger: true,
					label: t("topicFiles.contextMenu.delete"),
					icon: (
						<MagicIcon
							component={IconTrash}
							stroke={2}
							size={18}
							className={styles.danger}
						/>
					),
					disabled: isMoving,
					onClick: () => {
						const isFolder = item.is_directory
						MagicModal.confirm({
							title: isFolder
								? t("topicFiles.contextMenu.deleteFolderTip")
								: t("topicFiles.contextMenu.deleteTip"),
							content: isFolder
								? t("topicFiles.contextMenu.deleteFolderContent", {
										name: item.name,
									})
								: t("topicFiles.contextMenu.deleteContent", {
										name: item.name,
									}),
							variant: "destructive",
							showIcon: true,
							okText: t("topicFiles.contextMenu.delete"),
							cancelText: t("topicFiles.contextMenu.cancel"),
							onOk() {
								handleDeleteItem(item)
							},
						})
					},
				},
			)

			return normalizeMenuItems(filterMenuItems?.(menuItems) || menuItems)
		} else {
			// 文件菜单
			const canConvertToPdf = isConvertiblePdf(item.file_extension)
			const canConvertToPPTX = isConvertiblePPTX(item.file_extension)

			menuItems.push(
				{
					key: "openFile",
					label: t("topicFiles.contextMenu.openFile"),
					icon: <MagicIcon component={IconOpenWindow} stroke={2} size={18} />,
					onClick: () => handleOpenFile(item),
				},
				{ type: "divider" as const },
				{
					key: "rename",
					label: t("topicFiles.contextMenu.rename"),
					icon: <MagicIcon component={IconEdit} stroke={2} size={18} />,
					onClick: () => handleStartRename(item),
					disabled: isMoving,
				},
				...(handleMoveFile && !hideMoveTo
					? [
							{
								key: "moveFile",
								label: t("topicFiles.contextMenu.moveTo"),
								icon: (
									<MagicIcon component={IconFolderSymlink} stroke={2} size={18} />
								),
								onClick: () => handleMoveFile(item),
								disabled: isMoving,
							},
						]
					: []),
				...(onCopyFile && !hideCopyTo
					? [
							{
								key: "copyFile",
								label: t("topicFiles.contextMenu.copyTo"),
								icon: <MagicIcon component={IconFolders} stroke={2} size={18} />,
								onClick: () => handleCopyFile(item),
								disabled: isMoving,
							},
						]
					: []),
				...(handleReplaceFile
					? [
							{
								key: "replaceFile",
								label: t("topicFiles.contextMenu.replaceFile"),
								icon: <MagicIcon component={IconReplace} stroke={2} size={18} />,
								onClick: () => handleReplaceFile(item),
								disabled: isMoving,
							},
						]
					: []),
				{ type: "divider" as const },
				// 根据选中状态决定显示单文件还是多文件菜单（文件版本）
				...(selectedItems && selectedItems.size > 1
					? [
							{
								key: "addSelectedToCurrentChat",
								label: t("topicFiles.contextMenu.addToCurrentChat"),
								icon: (
									<MagicIcon
										component={IconMessageCircleShare}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddMultipleFilesToCurrentChat?.(),
							},
							{
								key: "addSelectedToNewChat",
								label: t("topicFiles.contextMenu.addToNewChat"),
								icon: (
									<MagicIcon
										component={IconMessageCirclePlus}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddMultipleFilesToNewChat?.(),
							},
						].filter((menuItem) =>
							hideAddToNewChat ? menuItem.key !== "addSelectedToNewChat" : true,
						)
					: [
							{
								key: "addToCurrentChat",
								label: (
									<Flex
										align="center"
										justify="space-between"
										style={{ width: "100%" }}
									>
										<span>{t("topicFiles.contextMenu.addToCurrentChat")}</span>
										{getShortcutHint &&
											!isMobile &&
											(() => {
												const shortcut = getShortcutHint("addToCurrentChat")
												if (!shortcut) return null
												return (
													<div className={styles.menuItemShortcut}>
														{shortcut.modifiers.map((modifier) => (
															<div
																key={modifier}
																className={
																	styles.menuItemShortcutItem
																}
															>
																{modifier}
															</div>
														))}
														<div
															className={styles.menuItemShortcutItem}
														>
															{shortcut.key}
														</div>
													</div>
												)
											})()}
									</Flex>
								),
								icon: (
									<MagicIcon
										component={IconMessageCircleShare}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddToCurrentChat(item),
							},
							{
								key: "addToNewChat",
								label: t("topicFiles.contextMenu.addToNewChat"),
								icon: (
									<MagicIcon
										component={IconMessageCirclePlus}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleAddToNewChat(item),
							},
						].filter((menuItem) =>
							hideAddToNewChat ? menuItem.key !== "addToNewChat" : true,
						)),
				{ type: "divider" as const },
			)

			// 根据文件类型决定下载菜单的展示方式
			if (canConvertToPdf || canConvertToPPTX) {
				// 支持转换的文件：显示下载子菜单
				const downloadChildren = [
					{
						key: "downloadOriginal",
						label: t("topicFiles.contextMenu.downloadOriginal"),
						onClick: () => handleDownloadOriginal(item, DownloadImageMode.Download),
					},
				]

				// 添加PDF转换选项
				if (canConvertToPdf) {
					downloadChildren.push({
						key: "downloadPdf",
						label: t("topicFiles.contextMenu.downloadPdf"),
						onClick: () => handleDownloadPdf(item),
					})
				}

				// 添加PPTX转换选项
				if (canConvertToPPTX) {
					console.log(item)
					downloadChildren.push({
						key: "downloadPpt",
						label: t("topicFiles.contextMenu.downloadPpt"),
						onClick: () => handleDownloadPpt(item),
					})
					downloadChildren.push({
						key: "downloadPptx",
						label: t("topicFiles.contextMenu.downloadPptx"),
						onClick: () => handleDownloadPptx(item, item.children || []),
					})
				}

				menuItems.push({
					key: "download",
					label: t("topicFiles.contextMenu.download"),
					icon: <MagicIcon component={IconDownload} stroke={2} size={18} />,
					children: downloadChildren,
				})
			} else {
				const isAIImageFile =
					isImage(item.file_extension) && item.source === AttachmentSource.AI
				// 其他文件：直接下载原始文件
				menuItems.push({
					key: "download",
					label: t("topicFiles.contextMenu.download"),
					icon: <MagicIcon component={IconDownload} stroke={2} size={18} />,
					onClick: !isAIImageFile
						? () => handleDownloadOriginal(item, DownloadImageMode.Download)
						: undefined,
					children: isAIImageFile
						? [
								{
									key: "downloadImage",
									label: t("topicFiles.contextMenu.downloadImage"),
									onClick: () =>
										handleDownloadOriginal(
											item,
											DownloadImageMode.NormalDownload,
										),
								},
								{
									key: "downloadImageNoWaterMark",
									label: (
										<Flex align="center" gap={4}>
											<span>
												{t(
													"topicFiles.contextMenu.downloadImageNoWaterMark",
												)}
											</span>
											{isFreeTrialVersion && <VIPTag />}
										</Flex>
									),
									onClick: () => handleDownloadNoWaterMark?.(item),
									onMouseEnter: () => preloadWaterMarkFreeModal?.(),
								},
							]
						: undefined,
				})
			}

			menuItems.push(
				{ type: "divider" as const },
				...(!hideShare
					? [
							{
								key: "share",
								label: t("topicFiles.contextMenu.shareFile"),
								icon: <MagicIcon component={IconShare} stroke={2} size={18} />,
								onClick: () => handleShareItem(item),
							},
						]
					: []),
				...(handleEnterMultiSelectMode && !isSelectMode
					? [
							{
								key: "selectMultiple",
								label: t("topicFiles.contextMenu.selectMultiple"),
								icon: (
									<MagicIcon component={IconSquareCheck} stroke={2} size={18} />
								),
								onClick: () => handleEnterMultiSelectMode(item),
							},
						]
					: []),
				{ type: "divider" as const },
				{
					key: "delete",
					danger: true,
					label: t("topicFiles.contextMenu.delete"),
					icon: (
						<MagicIcon
							component={IconTrash}
							stroke={2}
							size={18}
							className={styles.danger}
						/>
					),
					disabled: isMoving,
					onClick: () => {
						const isFolder = item.is_directory
						MagicModal.confirm({
							title: isFolder
								? t("topicFiles.contextMenu.deleteFolderTip")
								: t("topicFiles.contextMenu.deleteTip"),
							content: isFolder
								? t("topicFiles.contextMenu.deleteFolderContent", {
										name: item.name,
									})
								: t("topicFiles.contextMenu.deleteContent", {
										name: item.name,
									}),
							variant: "destructive",
							showIcon: true,
							okText: t("topicFiles.contextMenu.delete"),
							cancelText: t("topicFiles.contextMenu.cancel"),
							onOk() {
								handleDeleteItem(item)
							},
						})
					},
				},
			)
		}

		return normalizeMenuItems(filterMenuItems?.(menuItems) || menuItems)
	}

	return {
		getMenuItems,
		getBatchDownloadLayerMenuItems,
	}
}
