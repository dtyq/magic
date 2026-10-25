import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { filterFileAccessMenuItems } from "../utils/file-access-menu"
import type { ReactNode } from "react"
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
	IconInfoCircle,
	IconCopy,
	IconChevronsDown,
	IconChevronsUp,
} from "@tabler/icons-react"
import { Presentation } from "lucide-react"
import IconOpenWindow from "@/enhance/tabler/icons-react/icons/IconOpenWindow"
import MagicIcon from "@/components/base/MagicIcon"
import { Flex } from "antd"
import type { AttachmentItem } from "./types"
import { useStyles } from "../style"
import { useIsMobile } from "@/hooks/useIsMobile"

import MagicModal from "@/components/base/MagicModal"
import { MagicSystemFolderIcon } from "../components/MagicSystemFolderIcon"
import VIPTag from "../../VIPTag"
import { DownloadImageMode } from "../../../pages/Workspace/types"
import {
	buildSingleFileDownloadMenu,
	DOWNLOAD_IMAGE_NO_WATERMARK_MENU_KEY,
	type MobileDownloadMenuItem,
	type SingleFileDownloadHandlers,
} from "../utils/build-single-file-download-menu"
import { createFileMenuItems } from "../components/hooks/useFileMenuItems"
import { normalizeMenuItems, type TopicFilesMenuItem } from "../utils/menu-items"
import { isMagicSystemFolder } from "../utils/magic-system-folder"
import type { AttachmentIndex } from "../utils/attachmentIndex"
import { getAttachmentKey } from "../utils/getAttachmentKey"
import { copyAttachmentPath, getAttachmentFolderPath } from "../utils/attachmentPath"
import { useMobileDeleteConfirmSheet } from "./useMobileDeleteConfirmSheet"
import {
	detectCanvasProjectOperationRisk,
	getCanvasProjectOperationImpact,
} from "../utils/canvasProjectOperationRisk"
import {
	isConvertiblePresentationFile,
	isSlidesTemplateFolder,
} from "../utils/slides-template-folder"

type MenuItem = TopicFilesMenuItem

interface UseContextMenuOptions {
	handleUploadFile?: (item?: AttachmentItem) => void
	handleUploadFolder?: (item?: AttachmentItem) => void
	handleImportFromOtherProject?: (item?: AttachmentItem) => void
	handleShareItem?: (item: AttachmentItem) => void
	handleDeleteItem: (item: AttachmentItem) => void
	handleDeleteWithConfirm?: (item: AttachmentItem) => void
	handleOpenDirectory?: (item: AttachmentItem) => void
	handleDownloadOriginal: (item: AttachmentItem, mode?: DownloadImageMode) => void
	handleDownloadPdf: (item: AttachmentItem, folderChildren?: AttachmentItem[]) => void
	handleDownloadPptx: (item: AttachmentItem, folderChildren?: AttachmentItem[]) => void
	handleDownloadImage?: (item: AttachmentItem, format: "png" | "jpeg") => void
	handleOpenFile: (item: AttachmentItem) => void
	handleStartRename: (item: AttachmentItem) => void
	handleAddToCurrentChat?: (item: AttachmentItem) => void
	handleAddToNewChat?: (item: AttachmentItem) => void
	handleMoveFile?: (item: AttachmentItem) => void
	handleReplaceFile?: (item: AttachmentItem) => void
	handleShowInfo?: (item: AttachmentItem) => void
	createVirtualFile: (
		type: "txt" | "md" | "html" | "py" | "go" | "php" | "design" | "customFile",
		key?: string,
		parentPath?: string,
	) => void
	createVirtualFolder: (key?: string, parentPath?: string) => void
	createVirtualDesignProject?: (key?: string, parentPath?: string) => void
	createVirtualSelfMediaProject?: (key?: string, parentPath?: string) => void
	createVirtualAICardProject?: (key?: string, parentPath?: string) => void
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
	filterMenuItems?: (menuItems: MenuItem[], item?: AttachmentItem) => MenuItem[]
	/** 自定义处理批量菜单渲染 */
	filterBatchDownloadLayerMenuItems?: (menuItems: MenuItem[]) => MenuItem[]
	/** 是否允许显示文件下载菜单 */
	allowDownload?: boolean
	/* 获取快捷键提示 */
	getShortcutHint?: (action: "addToCurrentChat") => { modifiers: string[]; key: string } | null
	/* 进入多选模式并选中当前项 */
	handleEnterMultiSelectMode?: (item: AttachmentItem) => void
	/* 是否已在多选模式 */
	isSelectMode?: boolean
	/* File tree index for parent checks */
	treeIndex?: AttachmentIndex
	isFolderContentsExpanded?: (item: AttachmentItem) => boolean
	handleToggleFolderContents?: (item: AttachmentItem) => void
	/** Full attachment tree for mobile hierarchy delete confirmation */
	attachments?: AttachmentItem[]
	/** Desktop-only action for a recognized standard slide template folder. */
	handleSaveSlidesTemplate?: (item: AttachmentItem) => void
	/** Desktop-only action for converting a slide folder or PPT/PPTX/POTX file. */
	handleConvertToSlidesTemplate?: (item: AttachmentItem) => void
}

interface MapDownloadMenuToContextOptions {
	isFreeTrialVersion?: boolean
	preloadWaterMarkFreeModal?: () => void
	t: (key: string) => string
}

/** Map shared download menu entries to Ant Design context menu items. */
function mapDownloadMenuToContextItems(
	entries: MobileDownloadMenuItem[],
	options: MapDownloadMenuToContextOptions,
): MenuItem[] {
	return entries.map((entry) => ({
		key: entry.key,
		label:
			entry.key === DOWNLOAD_IMAGE_NO_WATERMARK_MENU_KEY && options.isFreeTrialVersion ? (
				<Flex align="center" gap={4}>
					<span>{entry.label}</span>
					<VIPTag />
				</Flex>
			) : (
				entry.label
			),
		onClick: entry.onClick,
		onMouseEnter:
			entry.key === DOWNLOAD_IMAGE_NO_WATERMARK_MENU_KEY
				? options.preloadWaterMarkFreeModal
				: undefined,
		children: entry.children?.length
			? mapDownloadMenuToContextItems(entry.children, options)
			: undefined,
	}))
}

function createConvertToSlidesTemplateMenuItem(
	item: AttachmentItem,
	onConvert: (item: AttachmentItem) => void,
	label: string,
): MenuItem {
	return {
		key: "convertToSlidesTemplate",
		label,
		icon: <Presentation className="size-4" aria-hidden="true" data-testid="ppt-menu-icon" />,
		onClick: () => onConvert(item),
	}
}

/** Append download entries from the shared builder onto a context menu list. */
function appendDownloadContextMenuItems(
	menuItems: MenuItem[],
	item: AttachmentItem,
	handlers: SingleFileDownloadHandlers,
	t: (key: string) => string,
	downloadIcon: ReactNode,
	options: {
		shouldUseSingleDownloadEntry?: boolean
		isFreeTrialVersion?: boolean
		preloadWaterMarkFreeModal?: () => void
	},
) {
	const entries = buildSingleFileDownloadMenu({
		item,
		handlers,
		t,
		shouldUseSingleDownloadEntry: options.shouldUseSingleDownloadEntry,
	})
	if (entries.length === 0) return

	if (item.is_directory && item.display_config?.type !== "slide") {
		const entry = entries[0]
		menuItems.push({
			key: "downloadFolder",
			label: entry.label,
			icon: downloadIcon,
			onClick: entry.onClick,
		})
		return
	}

	const hasSubMenu = entries.length > 1 || entries.some((entry) => entry.children?.length)
	if (!hasSubMenu) {
		const entry = entries[0]
		menuItems.push({
			key: "download",
			label: t("topicFiles.contextMenu.download"),
			icon: downloadIcon,
			onClick: entry.onClick,
		})
		return
	}

	menuItems.push({
		key: "download",
		label: t("topicFiles.contextMenu.download"),
		icon: downloadIcon,
		children: mapDownloadMenuToContextItems(entries, { ...options, t }),
	})
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
 * @param treeIndex - File tree index
 * @returns 如果父级链中有任何节点带 display_config，返回 true
 */
function hasDisplayConfigInAncestors(item: AttachmentItem, treeIndex?: AttachmentIndex): boolean {
	if (!treeIndex || !item.file_id) return false
	return treeIndex
		.getParentItemsById(item.file_id)
		.some((parent) => Boolean(parent.display_config))
}

/**
 * useContextMenu - 处理右键菜单配置
 */
export function useContextMenu(options: UseContextMenuOptions) {
	const {
		permissions: access,
		options: { copyTo, createNewTopic, moveTo },
	} = useFileAccess()
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const { deleteConfirmNode, openDeleteConfirm } = useMobileDeleteConfirmSheet()

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
		handleDownloadPptx,
		handleDownloadImage,
		handleOpenFile,
		handleStartRename,
		handleAddToCurrentChat,
		handleAddToNewChat,
		handleMoveFile,
		handleReplaceFile,
		handleShowInfo,
		onCopyFile,
		createVirtualFile,
		createVirtualFolder,
		createVirtualDesignProject,
		createVirtualSelfMediaProject,
		createVirtualAICardProject,
		isMoving = false,
		selectedItems,
		handleAddMultipleFilesToCurrentChat,
		handleAddMultipleFilesToNewChat,
		isFreeTrialVersion,
		shouldUseSingleDownloadEntry,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems,
		allowDownload,
		getShortcutHint,
		handleEnterMultiSelectMode,
		isSelectMode = false,
		treeIndex,
		isFolderContentsExpanded,
		handleToggleFolderContents,
		attachments = [],
		handleSaveSlidesTemplate,
		handleConvertToSlidesTemplate,
	} = options

	const openDeleteConfirmWithCanvasRisk = async (item: AttachmentItem) => {
		if (options.handleDeleteWithConfirm) {
			options.handleDeleteWithConfirm(item)
			return
		}
		const isFolder = Boolean(item.is_directory)
		const isMagicFolder = Boolean(isFolder && isMagicSystemFolder(item))
		const canvasRisk = await detectCanvasProjectOperationRisk({
			attachments,
			items: [item],
			operation: "delete",
		})
		const impact = getCanvasProjectOperationImpact(canvasRisk)
		const canvasWarningContent = canvasRisk.shouldWarn
			? t(
					impact === "open-failure"
						? "topicFiles.contextMenu.deleteCanvasOpenFailureRiskContent"
						: impact === "content-loss"
							? "topicFiles.contextMenu.deleteCanvasContentLossRiskContent"
							: "topicFiles.contextMenu.deleteCanvasMixedRiskContent",
				)
			: undefined

		if (isMobile) {
			openDeleteConfirm({
				attachments,
				selectedKeys: new Set([getAttachmentKey(item)]),
				canvasWarning: canvasRisk.shouldWarn,
				canvasWarningContent,
				onConfirm: () => handleDeleteItem(item),
				testIdPrefix: "topic-files-delete-confirm",
			})
			return
		}

		MagicModal.confirm({
			title: isFolder
				? t("topicFiles.contextMenu.deleteFolderTip")
				: t("topicFiles.contextMenu.deleteTip"),
			content: canvasRisk.shouldWarn
				? canvasWarningContent
				: isMagicFolder
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
			icon:
				isMagicFolder && !canvasRisk.shouldWarn ? (
					<MagicSystemFolderIcon size={24} />
				) : undefined,
			okText: t("topicFiles.contextMenu.delete"),
			cancelText: t("topicFiles.contextMenu.cancel"),
			onOk() {
				handleDeleteItem(item)
			},
		})
	}

	// 获取文件夹路径 - 优先使用 relative_file_path,否则从树结构中计算
	const getFolderPath = (item: AttachmentItem): string | undefined => {
		return getAttachmentFolderPath(item, treeIndex)
	}

	// 处理复制文件
	const handleCopyFile = (item: AttachmentItem) => {
		if (!item.file_id) return
		onCopyFile?.([item.file_id])
	}

	const handleCopyPath = async (item: AttachmentItem) => {
		await copyAttachmentPath({ item, treeIndex, t })
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
					onAddDesign: createVirtualDesignProject,
					onAddSelfMedia: createVirtualSelfMediaProject,
					onAddAICard: createVirtualAICardProject,
				}),
			},
			{
				key: "createFolder",
				label: t("topicFiles.contextMenu.createFolder"),
				icon: <MagicIcon component={IconFolderPlus} stroke={2} size={18} />,
				onClick: () => createVirtualFolder(),
			},
			...(handleUploadFile
				? [
						{
							key: "uploadFile",
							label: t("topicFiles.contextMenu.uploadFile"),
							icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
							onClick: () => handleUploadFile(),
						},
					]
				: []),
		]

		// 只有当浏览器支持文件夹上传时才显示上传文件夹选项
		if (handleUploadFolder && supportsFolderUpload(isMobile)) {
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
		if (item.is_directory && options.handleOpenDirectory) {
			menuItems.push({
				key: "openFile",
				label: t("topicFiles.contextMenu.openFile"),
				icon: <MagicIcon component={IconOpenWindow} stroke={2} size={18} />,
				onClick: () => options.handleOpenDirectory?.(item),
			})
		}
		if (handleAddToCurrentChat && !handleAddToNewChat) {
			menuItems.push({
				key: "addToCurrentChat",
				label: t("topicFiles.contextMenu.addToCurrentChat"),
				icon: <MagicIcon component={IconMessageCircleShare} stroke={2} size={18} />,
				onClick: () => handleAddToCurrentChat(item),
			})
		}
		const downloadIcon = <MagicIcon component={IconDownload} stroke={2} size={18} />
		const downloadHandlers: SingleFileDownloadHandlers = {
			handleDownloadOriginal,
			handleDownloadPdf,
			handleDownloadPptx,
			handleDownloadImage,
			handleDownloadNoWaterMark,
			preloadWaterMarkFreeModal,
		}
		const downloadMenuOptions = {
			shouldUseSingleDownloadEntry,
			isFreeTrialVersion,
			preloadWaterMarkFreeModal,
		}
		const showInfoMenuItems: MenuItem[] = handleShowInfo
			? [
					{
						key: "showInfo",
						label: t("topicFiles.contextMenu.showInfo"),
						icon: <MagicIcon component={IconInfoCircle} stroke={2} size={18} />,
						onClick: () => handleShowInfo(item),
					},
				]
			: []

		if (item.is_directory && "children" in item) {
			const parentPath = getFolderPath(item)
			const key = item.file_id
			const isSlidesTemplate = isSlidesTemplateFolder(item)
			const slidesTemplateMenuItem: MenuItem | undefined = !isMobile
				? isSlidesTemplate && handleSaveSlidesTemplate
					? {
							key: "saveSlidesTemplate",
							label: t("topicFiles.contextMenu.saveSlidesTemplate"),
							icon: (
								<Presentation
									className="size-4"
									aria-hidden="true"
									data-testid="ppt-menu-icon"
								/>
							),
							onClick: () => handleSaveSlidesTemplate(item),
						}
					: item.display_config?.type === "slide" && handleConvertToSlidesTemplate
						? createConvertToSlidesTemplateMenuItem(
								item,
								handleConvertToSlidesTemplate,
								t("topicFiles.contextMenu.convertToSlidesTemplate"),
							)
						: undefined
				: undefined
			const folderEntry =
				treeIndex?.getEntryById(item.file_id) ||
				treeIndex?.getEntryByKey(getAttachmentKey(item))
			const hasFolderContents = Boolean(
				folderEntry && treeIndex?.getChildKeysByKey(folderEntry.key).length,
			)
			const folderContentsExpanded = isFolderContentsExpanded?.(item) ?? false
			// 特殊项目目录内不允许嵌套创建画布、自媒体项目或 AI 卡片。
			const canCreateDesignProject =
				!item.display_config && !hasDisplayConfigInAncestors(item, treeIndex)

			menuItems.push(
				{
					key: "createFile",
					label: t("topicFiles.contextMenu.createFile"),
					icon: <MagicIcon component={IconFile} stroke={2} size={18} />,
					children: createFileMenuItems({
						t,
						onAddFile: (type) => createVirtualFile(type, key, parentPath),
						onAddDesign:
							createVirtualDesignProject && canCreateDesignProject
								? () => createVirtualDesignProject(key, parentPath)
								: undefined,
						onAddSelfMedia:
							createVirtualSelfMediaProject && canCreateDesignProject
								? () => createVirtualSelfMediaProject(key, parentPath)
								: undefined,
						onAddAICard:
							createVirtualAICardProject && canCreateDesignProject
								? () => createVirtualAICardProject(key, parentPath)
								: undefined,
					}),
				},
				{
					key: "createFolder",
					label: t("topicFiles.contextMenu.createFolder"),
					icon: <MagicIcon component={IconFolderPlus} stroke={2} size={18} />,
					onClick: () => createVirtualFolder(key, parentPath),
				},
				...(handleUploadFile
					? [
							{
								key: "uploadFile",
								label: t("topicFiles.contextMenu.uploadFile"),
								icon: <MagicIcon component={IconUpload} stroke={2} size={18} />,
								onClick: () => handleUploadFile(item),
							},
						]
					: []),
				// 只有当浏览器支持文件夹上传时才显示上传文件夹选项
				...(handleUploadFolder && supportsFolderUpload(isMobile)
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
				...(slidesTemplateMenuItem
					? [{ type: "divider" as const }, slidesTemplateMenuItem]
					: []),
				{ type: "divider" as const },
				{
					key: "rename",
					label: t("topicFiles.contextMenu.rename"),
					icon: <MagicIcon component={IconEdit} stroke={2} size={18} />,
					onClick: () => handleStartRename(item),
					disabled: isMoving,
				},
				...(handleMoveFile && moveTo
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
				...(onCopyFile && copyTo
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
				...(handleAddToCurrentChat &&
				handleAddToNewChat &&
				selectedItems &&
				selectedItems.size > 1
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
							!createNewTopic ? menuItem.key !== "addSelectedToNewChat" : true,
						)
					: handleAddToCurrentChat && handleAddToNewChat
						? [
								{
									key: "addToCurrentChat",
									label: (
										<Flex
											align="center"
											justify="space-between"
											style={{ width: "100%" }}
										>
											<span>
												{t("topicFiles.contextMenu.addToCurrentChat")}
											</span>
											{getShortcutHint &&
												!isMobile &&
												(() => {
													const shortcut =
														getShortcutHint("addToCurrentChat")
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
																className={
																	styles.menuItemShortcutItem
																}
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
								!createNewTopic ? menuItem.key !== "addToNewChat" : true,
							)
						: []),
				{ type: "divider" as const },
				// Folder download menu: single source via buildSingleFileDownloadMenu (avoids duplicate entries)
				...(() => {
					if (allowDownload === false) return []
					const downloadMenuItems: MenuItem[] = []
					appendDownloadContextMenuItems(
						downloadMenuItems,
						item,
						downloadHandlers,
						t,
						downloadIcon,
						downloadMenuOptions,
					)
					return downloadMenuItems
				})(),
				{ type: "divider" as const },
				...(handleShareItem && access.share
					? [
							{
								key: "share",
								label: t("topicFiles.contextMenu.shareFile"),
								icon: <MagicIcon component={IconShare} stroke={2} size={18} />,
								onClick: () => handleShareItem(item),
							},
						]
					: []),
				{
					key: "copyPath",
					label: t("topicFiles.contextMenu.copyPath"),
					icon: <MagicIcon component={IconCopy} stroke={2} size={18} />,
					onClick: () => {
						void handleCopyPath(item)
					},
				},
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
				...showInfoMenuItems,
				...(hasFolderContents && isFolderContentsExpanded && handleToggleFolderContents
					? [
							{
								key: "toggleFolderContents",
								label: folderContentsExpanded
									? t("topicFiles.contextMenu.collapseAll")
									: t("topicFiles.contextMenu.expandAll"),
								icon: (
									<MagicIcon
										component={
											folderContentsExpanded
												? IconChevronsUp
												: IconChevronsDown
										}
										stroke={2}
										size={18}
									/>
								),
								onClick: () => handleToggleFolderContents(item),
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
						void openDeleteConfirmWithCanvasRisk(item)
					},
				},
			)

			return normalizeMenuItems(
				filterFileAccessMenuItems(filterMenuItems?.(menuItems, item) || menuItems, access),
			)
		} else {
			const convertPresentationMenuItem: MenuItem | undefined =
				!isMobile && handleConvertToSlidesTemplate && isConvertiblePresentationFile(item)
					? createConvertToSlidesTemplateMenuItem(
							item,
							handleConvertToSlidesTemplate,
							t("topicFiles.contextMenu.convertToSlidesTemplate"),
						)
					: undefined
			// 文件菜单
			menuItems.push(
				{
					key: "openFile",
					label: t("topicFiles.contextMenu.openFile"),
					icon: <MagicIcon component={IconOpenWindow} stroke={2} size={18} />,
					onClick: () => handleOpenFile(item),
				},
				...(convertPresentationMenuItem
					? [{ type: "divider" as const }, convertPresentationMenuItem]
					: []),
				{ type: "divider" as const },
				{
					key: "rename",
					label: t("topicFiles.contextMenu.rename"),
					icon: <MagicIcon component={IconEdit} stroke={2} size={18} />,
					onClick: () => handleStartRename(item),
					disabled: isMoving,
				},
				...(handleMoveFile && moveTo
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
				...(onCopyFile && copyTo
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
				...(handleAddToCurrentChat &&
				handleAddToNewChat &&
				selectedItems &&
				selectedItems.size > 1
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
							!createNewTopic ? menuItem.key !== "addSelectedToNewChat" : true,
						)
					: handleAddToCurrentChat && handleAddToNewChat
						? [
								{
									key: "addToCurrentChat",
									label: (
										<Flex
											align="center"
											justify="space-between"
											style={{ width: "100%" }}
										>
											<span>
												{t("topicFiles.contextMenu.addToCurrentChat")}
											</span>
											{getShortcutHint &&
												!isMobile &&
												(() => {
													const shortcut =
														getShortcutHint("addToCurrentChat")
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
																className={
																	styles.menuItemShortcutItem
																}
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
								!createNewTopic ? menuItem.key !== "addToNewChat" : true,
							)
						: []),
				{ type: "divider" as const },
			)

			if (allowDownload !== false) {
				appendDownloadContextMenuItems(
					menuItems,
					item,
					downloadHandlers,
					t,
					downloadIcon,
					downloadMenuOptions,
				)
			}

			menuItems.push(
				{ type: "divider" as const },
				...(handleShareItem && access.share
					? [
							{
								key: "share",
								label: t("topicFiles.contextMenu.shareFile"),
								icon: <MagicIcon component={IconShare} stroke={2} size={18} />,
								onClick: () => handleShareItem(item),
							},
						]
					: []),
				{
					key: "copyPath",
					label: t("topicFiles.contextMenu.copyPath"),
					icon: <MagicIcon component={IconCopy} stroke={2} size={18} />,
					onClick: () => {
						void handleCopyPath(item)
					},
				},
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
				...showInfoMenuItems,
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
						void openDeleteConfirmWithCanvasRisk(item)
					},
				},
			)
		}

		return normalizeMenuItems(
			filterFileAccessMenuItems(filterMenuItems?.(menuItems, item) || menuItems, access),
		)
	}

	return {
		getMenuItems,
		getBatchDownloadLayerMenuItems,
		deleteConfirmNode,
	}
}
