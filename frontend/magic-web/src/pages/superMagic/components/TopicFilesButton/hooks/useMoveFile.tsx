import { useState, useCallback } from "react"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "./types"
import { checkDuplicateFileName } from "../utils/checkDuplicateFileName"
import MagicModal from "@/components/base/MagicModal"
import { IconAlertTriangleFilled } from "@tabler/icons-react"
import { SuperMagicApi } from "@/apis"
import { collectSelectedFolderIds } from "../../SelectPathModal/utils/attachmentUtils"

interface UseMoveFileOptions {
	projectId?: string
	attachments?: AttachmentItem[]
	onMoveSuccess?: () => void
	handleMoveFile?: (fileId: string, targetParentId: string) => Promise<boolean>
	// 批量移动相关
	selectedItems?: Set<string>
	setSelectedItems?: (items: Set<string>) => void
	getItemId?: (item: AttachmentItem) => string
	allFiles?: AttachmentItem[]
	onSelectModeChange?: (isSelectMode: boolean) => void
}

export function useMoveFile(options: UseMoveFileOptions = {}) {
	const { t } = useTranslation("super")
	const {
		projectId,
		attachments = [],
		onMoveSuccess,
		handleMoveFile,
		selectedItems,
		setSelectedItems,
		getItemId,
		allFiles,
		onSelectModeChange,
	} = options

	// 移动弹窗状态
	const [visible, setVisible] = useState(false)
	const [currentMoveItem, setCurrentMoveItem] = useState<AttachmentItem | null>(null)
	const [isBatchMode, setIsBatchMode] = useState(false)
	const [batchFileIds, setBatchFileIds] = useState<string[]>([])
	// 禁用的文件夹ID列表
	const [disabledFolderIds, setDisabledFolderIds] = useState<string[]>([])
	// 移动进度状态
	const [moveProgress, setMoveProgress] = useState(0)
	const [isMoving, setIsMovingFn] = useState(false)
	// 默认路径（被移动文件所在的目录）
	const [defaultPath, setDefaultPath] = useState<AttachmentItem[]>([])

	const setIsMoving = (moving: boolean) => {
		console.trace(moving)
		setIsMovingFn(moving)
	}

	// 根据 relative_file_path 构建完整的父目录路径
	const buildParentPathFromRelativePath = useCallback(
		(relativePath: string | undefined): AttachmentItem[] => {
			if (!relativePath || !attachments) return []

			// 解析路径，获取父目录部分（去掉最后的文件名）
			const pathParts = relativePath.split("/").filter(Boolean)
			if (pathParts.length === 0) return []

			// 移除最后一个部分（文件/文件夹名本身）
			const parentPathParts = pathParts.slice(0, -1)
			if (parentPathParts.length === 0) return []

			// 根据路径部分逐级查找对应的 AttachmentItem
			const result: AttachmentItem[] = []
			let currentLevel = attachments

			for (const partName of parentPathParts) {
				const found = currentLevel.find(
					(item) =>
						item.is_directory &&
						(item.name === partName ||
							item.file_name === partName ||
							item.filename === partName ||
							item.display_filename === partName),
				)

				if (found) {
					result.push(found)
					currentLevel = found.children || []
				} else {
					// 如果找不到对应的路径，返回已找到的部分
					break
				}
			}

			return result
		},
		[attachments],
	)

	// 显示移动选择器
	const showMoveSelector = useCallback(
		(item: AttachmentItem) => {
			setCurrentMoveItem(item)
			setIsBatchMode(false)
			// 单个文件移动时，禁用其父文件夹（如果是文件夹的话）
			const disabled = item.is_directory && item.file_id ? [item.file_id] : []
			setDisabledFolderIds(disabled)
			// 设置默认路径为被移动文件所在的目录
			const parentPath = buildParentPathFromRelativePath(item.relative_file_path)
			setDefaultPath(parentPath)
			setVisible(true)
		},
		[buildParentPathFromRelativePath],
	)

	// 显示批量移动选择器
	const showBatchMoveSelector = useCallback(
		(fileIds: string[]) => {
			setBatchFileIds(fileIds)
			setIsBatchMode(true)
			// 收集选中的文件夹ID作为禁用列表
			if (fileIds && attachments) {
				const disabledIds = collectSelectedFolderIds(attachments, fileIds)
				console.log("🔵 disabledIds", disabledIds)
				setDisabledFolderIds(disabledIds)

				// 找到第一个被移动的文件，并设置其父目录为默认路径
				const findFirstItem = (items: AttachmentItem[]): AttachmentItem | null => {
					for (const item of items) {
						if (item.file_id && fileIds.includes(item.file_id)) {
							return item
						}
						if (item.children) {
							const found = findFirstItem(item.children)
							if (found) return found
						}
					}
					return null
				}

				const firstItem = findFirstItem(attachments)
				if (firstItem?.relative_file_path) {
					const parentPath = buildParentPathFromRelativePath(firstItem.relative_file_path)
					setDefaultPath(parentPath)
				} else {
					setDefaultPath([])
				}
			} else {
				setDisabledFolderIds([])
				setDefaultPath([])
			}

			setVisible(true)
		},
		[attachments, buildParentPathFromRelativePath],
	)

	// 打开批量移动（内部根据选中项收集 file_ids）
	const openBatchMove = useCallback(() => {
		if (!selectedItems || selectedItems.size === 0 || !allFiles || !getItemId) return
		const ids: string[] = []
		const collect = (items: AttachmentItem[]) => {
			items.forEach((item) => {
				const id = getItemId(item)
				if (selectedItems.has(id)) {
					if (
						item.is_directory &&
						"children" in item &&
						(item.children?.length || 0) > 0
					) {
						if (item.file_id) ids.push(item.file_id)
						collect(item.children || [])
					} else if (item.file_id) ids.push(item.file_id)
				} else if (item.is_directory && "children" in item) {
					collect(item.children || [])
				}
			})
		}
		collect(allFiles)
		if (ids.length === 0) return
		showBatchMoveSelector(ids)
	}, [allFiles, getItemId, selectedItems, showBatchMoveSelector])

	// 隐藏移动选择器
	const hideMoveSelector = useCallback(() => {
		setVisible(false)
		setCurrentMoveItem(null)
		setBatchFileIds([])
		setIsBatchMode(false)
		setDisabledFolderIds([])
		setDefaultPath([])
	}, [])

	// 获取文件/文件夹的显示名称
	const getItemName = useCallback((item: AttachmentItem): string => {
		return item.name || item.file_name || item.filename || item.display_filename || ""
	}, [])

	// 根据路径构建目标文件夹路径
	const getTargetFolderPath = useCallback(
		(path: AttachmentItem[]): string => {
			if (path.length === 0) return ""
			return "/" + path.map((item) => getItemName(item)).join("/")
		},
		[getItemName],
	)

	// 检查单个文件是否存在同名冲突
	const checkSingleFileConflict = useCallback(
		(item: AttachmentItem, targetFolderPath: string): boolean => {
			const fileName = getItemName(item)
			return checkDuplicateFileName(fileName, attachments, targetFolderPath)
		},
		[attachments, getItemName],
	)

	// 检查批量文件是否存在同名冲突
	const checkBatchFilesConflict = useCallback(
		(
			fileIds: string[],
			targetFolderPath: string,
		): { hasConflict: boolean; conflictItems: AttachmentItem[] } => {
			if (!allFiles || !getItemId) {
				return { hasConflict: false, conflictItems: [] }
			}

			const conflictItems: AttachmentItem[] = []

			// 递归查找文件
			const findItemsById = (items: AttachmentItem[], ids: string[]): AttachmentItem[] => {
				const foundItems: AttachmentItem[] = []

				items.forEach((item) => {
					const itemId = getItemId(item)
					if (ids.includes(itemId)) {
						foundItems.push(item)
					}
					if (item.is_directory && "children" in item && item.children) {
						foundItems.push(...findItemsById(item.children, ids))
					}
				})

				return foundItems
			}

			const itemsToMove = findItemsById(allFiles, fileIds)

			itemsToMove.forEach((item) => {
				if (checkSingleFileConflict(item, targetFolderPath)) {
					conflictItems.push(item)
				}
			})

			return {
				hasConflict: conflictItems.length > 0,
				conflictItems,
			}
		},
		[allFiles, getItemId, checkSingleFileConflict],
	)

	// 显示覆盖确认对话框
	const showOverwriteConfirm = useCallback(
		(conflictItems: AttachmentItem[], onConfirm: () => void) => {
			const isMultiple = conflictItems.length > 1
			let content: string

			if (!isMultiple) {
				// 单个文件冲突
				const fileName = getItemName(conflictItems[0])
				content = t("topicFiles.moveModal.overwriteSingleContent", { name: fileName })
			} else {
				// 多个文件冲突
				const totalCount = conflictItems.length
				if (totalCount <= 3) {
					// 文件数量较少，显示所有文件名
					const conflictNames = conflictItems.map((item) => getItemName(item)).join("、")
					content = t("topicFiles.moveModal.overwriteMultipleContent", {
						names: conflictNames,
					})
				} else {
					// 文件数量较多，显示前3个 + 总数
					const firstThreeNames = conflictItems
						.slice(0, 3)
						.map((item) => getItemName(item))
						.join("、")
					content = t("topicFiles.moveModal.overwriteManyContent", {
						names: firstThreeNames,
						total: totalCount,
					})
				}
			}

			MagicModal.confirm({
				title: t("topicFiles.moveModal.overwriteTitle"),
				content,
				icon: (
					<IconAlertTriangleFilled
						size={20}
						color="rgba(255,125,0, 1)"
						style={{ marginRight: 6, lineHeight: 20, flexShrink: 0 }}
					/>
				),
				okButtonProps: {
					color: "danger",
					variant: "solid",
				},
				cancelButtonProps: {
					color: "default",
					variant: "filled",
				},
				okText: t("topicFiles.moveModal.overwriteConfirm"),
				cancelText: t("common.cancel"),
				onOk: onConfirm,
			})
		},
		[getItemName, t],
	)

	// 批量移动文件处理函数
	const batchMoveFiles = useCallback(
		async ({
			fileIds,
			projectId,
			targetParentId,
		}: {
			fileIds: string[]
			projectId: string
			targetParentId: string
		}) => {
			try {
				setIsMoving(true)
				setMoveProgress(0)

				// 调用后端创建批量移动任务
				const data = await SuperMagicApi.moveFiles({
					file_ids: fileIds,
					project_id: projectId,
					target_parent_id: targetParentId,
					pre_file_id: "",
				})

				// 如果直接完成
				if (data.status === "success") {
					setMoveProgress(100)
					magicToast.success(t("topicFiles.success.fileMoved"))
					hideMoveSelector()
					onMoveSuccess?.()
					setTimeout(() => {
						setIsMoving(false)
						setMoveProgress(0)
					}, 500)
					return
				}

				// 如果需要轮询状态
				if (data.status === "processing" && data.batch_key) {
					// 每2秒轮询批量状态
					const timer = setInterval(async () => {
						try {
							const checkData = await SuperMagicApi.checkBatchOperationStatus(
								data.batch_key,
							)

							// 更新进度显示
							if (checkData.status === "processing") {
								const progress = checkData.progress
									? parseInt(checkData.progress)
									: 0
								setMoveProgress(progress)
							} else if (checkData.status === "success") {
								setMoveProgress(100)
								magicToast.success(t("topicFiles.success.fileMoved"))
								hideMoveSelector()
								onMoveSuccess?.()
								clearInterval(timer)
								setTimeout(() => {
									setIsMoving(false)
									setMoveProgress(0)
								}, 500)
							} else if (checkData.status === "failed") {
								magicToast.error(
									checkData.message || t("topicFiles.error.moveFileFailed"),
								)
								clearInterval(timer)
								setIsMoving(false)
								setMoveProgress(0)
							} else {
								clearInterval(timer)
								setIsMoving(false)
								setMoveProgress(0)
							}
						} catch (error) {
							console.error("检查批量移动状态失败:", error)
							magicToast.error(t("topicFiles.error.moveFileFailed"))
							clearInterval(timer)
							setIsMoving(false)
							setMoveProgress(0)
						}
					}, 2000)
				}
			} catch (error) {
				console.error("批量移动失败:", error)
				magicToast.error(t("topicFiles.error.moveFileFailed"))
				setIsMoving(false)
				setMoveProgress(0)
			}
		},
		[hideMoveSelector, onMoveSuccess, t],
	)

	// 确认移动文件
	const confirmMove = useCallback(
		async (data: { path: AttachmentItem[] }) => {
			const targetParentId =
				data.path.length > 0 ? data.path[data.path.length - 1].file_id || "" : ""
			const targetFolderPath = getTargetFolderPath(data.path)

			const executeBatchMove = () => {
				// 立即退出多选模式
				setSelectedItems && setSelectedItems(new Set())
				onSelectModeChange && onSelectModeChange(false)

				batchMoveFiles({
					fileIds: batchFileIds,
					projectId: projectId || "",
					targetParentId: targetParentId,
				})
			}

			// 批量模式
			if (isBatchMode) {
				if (!projectId || batchFileIds.length === 0) return

				// 检查批量移动是否存在同名冲突
				const { hasConflict, conflictItems } = checkBatchFilesConflict(
					batchFileIds,
					targetFolderPath,
				)

				if (hasConflict) {
					// 显示覆盖确认对话框
					showOverwriteConfirm(conflictItems, () => {
						// 用户确认后执行批量移动
						executeBatchMove()
					})
					return
				}

				// 没有冲突，直接执行批量移动
				executeBatchMove()
				return
			}

			const executeSingleMove = async () => {
				if (!currentMoveItem?.file_id) return

				try {
					setIsMoving(true)
					setMoveProgress(0)

					let success = false

					if (handleMoveFile) {
						setMoveProgress(50)
						// 使用传入的 handleMoveFile 函数
						success = await handleMoveFile(currentMoveItem.file_id, targetParentId)
						if (success) {
							setMoveProgress(100)
							hideMoveSelector()
							// 清空选中状态
							setSelectedItems && setSelectedItems(new Set())
							onMoveSuccess?.()
							setTimeout(() => {
								setIsMoving(false)
								setMoveProgress(0)
							}, 500)
						} else {
							setIsMoving(false)
							setMoveProgress(0)
						}
					} else {
						setMoveProgress(50)
						// 直接调用 API
						await SuperMagicApi.moveFile({
							file_id: currentMoveItem.file_id,
							target_parent_id: targetParentId,
						})
						setMoveProgress(100)
						magicToast.success(t("topicFiles.success.fileMoved"))
						hideMoveSelector()
						// 清空选中状态
						setSelectedItems && setSelectedItems(new Set())
						onMoveSuccess?.()
						setTimeout(() => {
							setIsMoving(false)
							setMoveProgress(0)
						}, 500)
					}
				} catch (error) {
					console.error("移动文件失败:", error)
					magicToast.error(t("topicFiles.error.moveFileFailed"))
					setIsMoving(false)
					setMoveProgress(0)
				}
			}

			if (!currentMoveItem?.file_id) return

			// 检查单个文件移动是否存在同名冲突
			const hasConflict = checkSingleFileConflict(currentMoveItem, targetFolderPath)

			if (hasConflict) {
				// 显示覆盖确认对话框
				showOverwriteConfirm([currentMoveItem], () => {
					// 用户确认后执行单个移动
					executeSingleMove()
				})
				return
			}

			// 没有冲突，直接执行单个移动
			executeSingleMove()
		},
		[
			batchFileIds,
			currentMoveItem,
			handleMoveFile,
			hideMoveSelector,
			isBatchMode,
			onMoveSuccess,
			onSelectModeChange,
			projectId,
			setSelectedItems,
			t,
			batchMoveFiles,
			getTargetFolderPath,
			checkBatchFilesConflict,
			checkSingleFileConflict,
			showOverwriteConfirm,
		],
	)

	return {
		// 状态
		visible,
		currentMoveItem,
		projectId: projectId || "",
		attachments,
		isMoving,
		moveProgress,

		// 方法
		showMoveSelector,
		showBatchMoveSelector,
		openBatchMove,
		hideMoveSelector,
		confirmMove,
		batchMoveFiles, // 暴露批量移动方法

		// 选择器配置
		selectorConfig: {
			visible,
			title: t("topicFiles.moveModal.title"),
			tips: t("topicFiles.moveModal.tips"),
			projectId: projectId || "",
			attachments,
			onSubmit: confirmMove,
			onClose: hideMoveSelector,
			okText: t("topicFiles.moveModal.confirm"),
			cancelText: t("common.cancel"),
			disabledFolderIds, // 传递禁用文件夹列表
			confirmLoading: isMoving, // 添加确认按钮加载状态
			defaultPath, // 传递默认路径
		},
	}
}
