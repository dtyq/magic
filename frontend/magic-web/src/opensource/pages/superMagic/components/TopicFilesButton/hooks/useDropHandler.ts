import { useCallback } from "react"
import type { TreeNodeData } from "../utils/treeDataConverter"
import { ROOT_FILE_ID } from "../constant"
import { useTranslation } from "react-i18next"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseDropHandlerOptions {
	treeData: TreeNodeData[]
	handleMoveFile: (
		draggedFileId: string,
		targetParentId: string,
		preFileId?: string,
	) => Promise<boolean>
}

/**
 * useDropHandler - 处理树形拖拽放置逻辑
 */
export function useDropHandler(options: UseDropHandlerOptions) {
	const { t } = useTranslation("super")
	const { treeData, handleMoveFile } = options

	// 拖拽完成处理
	const handleDrop = useCallback(
		async (info: any) => {
			const { dragNode, node } = info

			if (dragNode.item?.is_directory) {
				magicToast.info(t("topicFiles.error.dragFolderNotSupported"))
				return
			}

			// 检查基本参数
			if (!dragNode || !dragNode.key) {
				console.warn("Invalid drag node")
				return
			}

			const draggedFileId = dragNode.key

			// 解析位置信息来计算 parent_id 和 pre_file_id
			let targetParentId = ROOT_FILE_ID
			let preFileId = ""

			// 当 dropPosition 为 -1 时，targetParentId 应该是空字符串
			if (info.dropPosition === -1) {
				targetParentId = ""
				preFileId = ""
			} else if (node && node.pos) {
				// pos 格式类似 "0-4" 或 "0-4-0"，需要去掉开头的 "0-"
				let posStr = node.pos
				if (posStr.startsWith("0-")) {
					posStr = posStr.substring(2) // 去掉 "0-"
				}

				console.log("Drop position info:", {
					node,
					originalPos: node.pos,
					processedPos: posStr,
					draggedFileId,
				})

				// 如果 posStr 为空，说明移动到根目录第一个位置
				if (!posStr) {
					targetParentId = ROOT_FILE_ID
					preFileId = "" // 第一个位置，没有前置文件
				} else {
					const posArray = posStr.split("-").map((p: string) => parseInt(p, 10))

					if (posArray.length === 1) {
						// 只有一个数字，如 "4"，需要判断该位置是文件还是文件夹
						const targetIndex = posArray[0]

						if (treeData[targetIndex]) {
							const targetNode = treeData[targetIndex]

							// 如果目标位置是文件夹，则移动到文件夹内部第一个位置
							if (targetNode.item?.is_directory) {
								targetParentId = targetNode.key
								preFileId = "" // 移动到文件夹第一个位置
							} else {
								// 如果目标位置是文件，则移动到根目录该位置
								targetParentId = ROOT_FILE_ID
								preFileId = targetNode.key
							}
						} else {
							// 目标位置不存在，移动到根目录末尾
							targetParentId = ROOT_FILE_ID
							preFileId = ""
						}
					} else {
						// 多个数字，如 "4-0"，移动到某个文件夹内部
						const parentPath = posArray.slice(0, -1) // [4]
						const targetIndex = posArray[posArray.length - 1] // 0

						// 根据父级路径找到父级节点
						let parentNode = null
						let currentLevel = treeData

						for (let i = 0; i < parentPath.length; i++) {
							const index = parentPath[i]
							if (currentLevel[index]) {
								parentNode = currentLevel[index]
								currentLevel = currentLevel[index].children || []
							} else {
								break
							}
						}

						if (parentNode) {
							targetParentId = parentNode.key

							// 如果是移动到文件夹内部的第一个位置（targetIndex = 0），pre_file_id 为 null
							if (currentLevel[targetIndex]) {
								// pre_file_id 是目标位置对应的文件
								preFileId = currentLevel[targetIndex].key
							} else {
								preFileId = ""
							}
						}
					}
				}
			}

			console.log("Drop operation:", {
				draggedId: draggedFileId,
				targetParentId,
				preFileId,
				pos: node?.pos,
				dropPosition: info.dropPosition,
				operation: "move_with_position",
			})

			// 调用移动文件API
			const success = await handleMoveFile(draggedFileId, targetParentId, preFileId)

			if (success) {
				console.log("File moved successfully")
			}
		},
		[treeData, handleMoveFile],
	)

	return {
		handleDrop,
	}
}
