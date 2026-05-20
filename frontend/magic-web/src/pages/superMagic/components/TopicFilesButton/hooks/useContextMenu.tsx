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
import { Flex, message } from "antd"
import { AttachmentSource, type AttachmentItem } from "./types"
import { useStyles } from "../style"
import { useIsMobile } from "@/hooks/useIsMobile"

import MagicModal from "@/components/base/MagicModal"
import { MagicSystemFolderIcon } from "../components/MagicSystemFolderIcon"
import { getAppEntryFile } from "../../MessageList/components/MessageAttachment/utils"
import VIPTag from "../../VIPTag"
import { IMAGE_EXTENSIONS } from "../../Detail/hooks/useDetailActions"
import { DownloadImageMode } from "../../../pages/Workspace/types"
import { createFileMenuItems } from "../components/hooks/useFileMenuItems"
import { useFileActionVisibility } from "@/pages/superMagic/providers/file-action-visibility-provider"
import { normalizeMenuItems, type TopicFilesMenuItem } from "../utils/menu-items"
import { isMagicSystemFolder } from "../utils/magic-system-folder"
import { isConvertibleFile } from "../../Detail/utils/file"
import type { TreeNodeData } from "../utils/treeDataConverter"
import { findNodePath } from "../utils/path-helper"

type MenuItem = TopicFilesMenuItem

interface UseContextMenuOptions {
	handleUploadFile: (item?: AttachmentItem) => void
	handleUploadFolder: (item?: AttachmentItem) => void
	handleImportFromOtherProject?: (item?: AttachmentItem) => void
	handleShareItem: (item: AttachmentItem) => void
	handleDeleteItem: (item: AttachmentItem) => void
	handleDownloadOriginal: (item: AttachmentItem, mode?: DownloadImageMode) => void
	handleDownloadPdf: (
		item: AttachmentItem,
		folderChildren?: AttachmentItem[],
		pagination?: "slice" | "none",
	) => void
	handleDownloadPpt: (item: AttachmentItem) => void
	handleDownloadPptx: (item: AttachmentItem, folderChildren?: AttachmentItem[]) => void
	handleDownloadImage?: (item: AttachmentItem, format: "png" | "jpeg") => void
	handleOpenFile: (item: AttachmentItem) => void
	handleStartRename: (item: AttachmentItem) => void
	handleAddToCurrentChat: (item: AttachmentItem) => void
	handleAddToNewChat: (item: AttachmentItem) => void
	handleMoveFile?: (item: AttachmentItem) => void
	handleReplaceFile?: (item: AttachmentItem) => void
	createVirtualFile: (
		type: "txt" | "md" | "html" | "py" | "go" | "php" | "design" | "customFile",
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
	/* 是否收敛为单一下载入口 */
	shouldUseSingleDownloadEntry?: boolean
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
	/* 树形数据，用于检查父级节点 */
	treeData?: TreeNodeData[]
}

function isImage(fileExtension?: string): boolean {
	if (!fileExtension) return false
	const ext = fileExtension.toLowerCase()
	return IMAGE_EXTENSIONS.includes(ext)
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
 * 检查父级或更父级是否有 display_config
 * @param item - 当前文件/文件夹项
 * @param treeData - 完整的树形数据
 * @returns 如果父级链中有任何节点带 display_config，返回 true
 */
function hasDisplayConfigInAncestors(item: AttachmentItem, treeData?: TreeNodeData[]): boolean {
	if (!treeData || !item.relative_file_path) return false

	const currentPath = item.relative_file_path
	// 如果是根目录，没有父级
	if (currentPath === "/" || !currentPath.includes("/")) return false

	// 规范化路径：去掉尾部的 /
	const normalizePath = (path: string) => path.replace(/\/+$/, "")

	// 递归查找指定路径的节点
	const findNodeByPath = (nodes: TreeNodeData[], targetPath: string): AttachmentItem | null => {
		const normalizedTargetPath = normalizePath(targetPath)
		for (const node of nodes) {
			const nodePath = node.item.relative_file_path
			if (nodePath && normalizePath(nodePath) === normalizedTargetPath) {
				return node.item
			}
			if (node.children) {
				const found = findNodeByPath(node.children, targetPath)
				if (found) return found
			}
		}
		return null
	}

	// 获取所有父级路径
	const pathParts = currentPath.split("/").filter(Boolean)

	// 逐级向上检查每个父级路径
	for (let i = pathParts.length - 1; i > 0; i--) {
		const parentPath = "/" + pathParts.slice(0, i).join("/")
		const parentNode = findNodeByPath(treeData, parentPath)

		// 如果找到父级节点且有 display_config，返回 true
		if (parentNode?.display_config) {
			return true
		}
	}

	// 检查根目录
	const rootNode = findNodeByPath(treeData, "/")
	if (rootNode?.display_config) {
		return true
	}

	return false
}

/**
 * useContextMenu - 处理右键菜单配置
 */
export function useContextMenu(options: UseContextMenuOptions) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const { hideCopyTo, hideCreateNewTopic, hideMoveTo, hideShareFile } = useFileActionVisibility()
	const {
		handleUploadFile,
		handleUploadFolder,
		handleImportFromOtherProject,
		handleShareItem,
		handleDeleteItem,
		handleDownloadOriginal,
		handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleDownloadPptx,
		handleDownloadImage,
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
		shouldUseSingleDownloadEntry,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems,
		getShortcutHint,
		handleEnterMultiSelectMode,
		isSelectMode = false,
		treeData,
	} = options

	// 获取文件夹路径 - 优先使用 relative_file_path,否则从树结构中计算
	const getFolderPath = (item: AttachmentItem): string | undefined => {
		if (item.is_directory && "children" in item) {
			// 优先使用 relative_file_path
			if (item.relative_file_path) {
				return item.relative_file_path
			}

			const pathFromTree = item.file_id ? findNodePath(treeData || [], item.file_id) : null
			return pathFromTree || `/${item.name}`
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

		// 添加导入选项
		if (handleImportFromOtherProject) {
			menuItems.push({
				key: "importFromOtherProject",
				label: t("topicFiles.contextMenu.importFromOtherProject"),
				icon: <MagicIcon component={IconFolderSymlink} stroke={2} size={18} />,
				onClick: () => handleImportFromOtherProject(),
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
			// 判断是否允许创建画布：当前项或父级/更父级没有携带 display_config 时才允许
			const canCreateDesignProject =
				!item.display_config && !hasDisplayConfigInAncestors(item, treeData)

			menuItems.push(
				{
					key: "createFile",
					label: t("topicFiles.contextMenu.createFile"),
					icon: <MagicIcon component={IconFile} stroke={2} size={18} />,
					children: createFileMenuItems({
						t,
						onAddFile: (type) => createVirtualFile(type, key, parentPath),
						// 只在当前项和父级或更父级都没有 display_config 时显示新建画布选项
						onAddDesign:
							createVirtualDesignProject && canCreateDesignProject
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
				// 添加从其他项目导入选项
				...(handleImportFromOtherProject
					? [
							{
								key: "importFromOtherProject",
								label: t("topicFiles.contextMenu.importFromOtherProject"),
								icon: (
									<MagicIcon component={IconFolderSymlink} stroke={2} size={18} />
								),
								onClick: () => handleImportFromOtherProject(item),
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
							hideCreateNewTopic ? menuItem.key !== "addSelectedToNewChat" : true,
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
							hideCreateNewTopic ? menuItem.key !== "addToNewChat" : true,
						)),
				{ type: "divider" as const },
				// 文件夹下载菜单：根据display_config决定显示方式
				...(item.display_config && item.display_config?.type === "slide"
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
											handleDownloadPdf(item, item.children || [])
										},
									},
									{
										key: "downloadPpt",
										label: t("topicFiles.contextMenu.downloadPpt"),
										onClick: () => {
											const appEntryFile = getAppEntryFile(
												item.children || [],
												item.display_config,
											)
											if (appEntryFile) handleDownloadPpt(appEntryFile)
											else if (item.display_config?.type === "custom")
												message.error(
													t("topicFiles.customMainFileNotFound"),
												)
										},
									},
									{
										key: "downloadPptx",
										label: t("topicFiles.contextMenu.downloadPptx"),
										onClick: () => {
											const children = item.children || []
											const appEntryFile = getAppEntryFile(
												children,
												item.display_config,
											)
											if (appEntryFile) {
												console.log("children", children)
												handleDownloadPptx(appEntryFile, children)
											} else if (item.display_config?.type === "custom")
												message.error(
													t("topicFiles.customMainFileNotFound"),
												)
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
				...(!hideShareFile
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
						const isMagicFolder = Boolean(isFolder && isMagicSystemFolder(item))
						MagicModal.confirm({
							title: isFolder
								? t("topicFiles.contextMenu.deleteFolderTip")
								: t("topicFiles.contextMenu.deleteTip"),
							content: isMagicFolder
								? t("topicFiles.contextMenu.deleteMagicFolderContent")
								: isFolder
									? t("topicFiles.contextMenu.deleteFolderContent", {
											name: item.name,
										})
									: t("topicFiles.contextMenu.deleteContent", {
											name: item.name,
										}),
							variant: "destructive",
							showIcon: true,
							icon: isMagicFolder ? <MagicSystemFolderIcon size={24} /> : undefined,
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
			const canConvertToPdf = isConvertibleFile(item, ["html", "md"])
			const canConvertToPPTX = isConvertibleFile(item, ["html"])
			const canConvertToImage = isConvertibleFile(item, ["html"])

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
							hideCreateNewTopic ? menuItem.key !== "addSelectedToNewChat" : true,
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
							hideCreateNewTopic ? menuItem.key !== "addToNewChat" : true,
						)),
				{ type: "divider" as const },
			)

			// 根据文件类型决定下载菜单的展示方式
			if (canConvertToPdf || canConvertToPPTX || canConvertToImage) {
				// 支持转换的文件：显示下载子菜单
				const downloadChildren: MenuItem[] = [
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
						children: [
							{
								key: "downloadPdfPaginated",
								label: t("topicFiles.exportPdfPaginated"),
								onClick: () => handleDownloadPdf(item, undefined, "slice"),
							},
							{
								key: "downloadPdfFullPage",
								label: t("topicFiles.exportPdfFullPage"),
								onClick: () => handleDownloadPdf(item, undefined, "none"),
							},
						],
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

				// 添加图片导出选项（仅 HTML）
				if (canConvertToImage && handleDownloadImage) {
					downloadChildren.push({
						key: "downloadAsImage",
						label: t("topicFiles.contextMenu.downloadAsImage"),
						children: [
							{
								key: "downloadImagePng",
								label: t("topicFiles.exportImagePng"),
								onClick: () => handleDownloadImage(item, "png"),
							},
							{
								key: "downloadImageJpeg",
								label: t("topicFiles.exportImageJpeg"),
								onClick: () => handleDownloadImage(item, "jpeg"),
							},
						],
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
						: shouldUseSingleDownloadEntry
							? () => handleDownloadNoWaterMark?.(item)
							: undefined,
					children:
						isAIImageFile && !shouldUseSingleDownloadEntry
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
				...(!hideShareFile
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
						const isMagicFolder = Boolean(isFolder && isMagicSystemFolder(item))
						MagicModal.confirm({
							title: isFolder
								? t("topicFiles.contextMenu.deleteFolderTip")
								: t("topicFiles.contextMenu.deleteTip"),
							content: isMagicFolder
								? t("topicFiles.contextMenu.deleteMagicFolderContent")
								: isFolder
									? t("topicFiles.contextMenu.deleteFolderContent", {
											name: item.name,
										})
									: t("topicFiles.contextMenu.deleteContent", {
											name: item.name,
										}),
							variant: "destructive",
							showIcon: true,
							icon: isMagicFolder ? <MagicSystemFolderIcon size={24} /> : undefined,
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
