import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import {
	getNodePath,
	type TreeNodeData,
} from "@/opensource/pages/superMagic/components/TopicFilesButton/utils/treeDataConverter"

interface UseLocateFileOptions {
	treeData: TreeNodeData[]
	expandedKeys: React.Key[]
	setExpandedKeys: (keys: React.Key[]) => void
	treeAreaRef: React.RefObject<HTMLDivElement>
}

/**
 * useLocateFile - 文件定位功能 Hook（简化版，用于文件选择器）
 * 负责处理文件在树中的定位、展开和滚动
 */
export function useLocateFile(options: UseLocateFileOptions) {
	const { treeData, expandedKeys, setExpandedKeys, treeAreaRef } = options

	// 定位文件状态
	const [locatingFileId, setLocatingFileId] = useState<string | null>(null)

	// 普通文件定位逻辑
	const handleLocateFileInTree = useMemoizedFn((fileId: string) => {
		console.log("📍 Locating file in FileSelector:", fileId)

		// 获取文件的路径（包括所有父文件夹）
		const path = getNodePath(treeData, fileId)
		console.log("📂 File path:", path)

		// 展开所有父文件夹（排除最后一个，因为那是文件本身）
		const foldersToExpand = path.slice(0, -1)
		const newExpandedKeys = Array.from(new Set([...expandedKeys, ...foldersToExpand]))
		setExpandedKeys(newExpandedKeys)

		// 设置定位状态，触发闪烁动画
		setLocatingFileId(fileId)

		// 滚动到文件位置（延迟以确保展开动画完成）
		setTimeout(() => {
			const fileElement = document.querySelector(
				`[data-selector-file-id="${fileId}"]`,
			) as HTMLElement
			const scrollContainer = treeAreaRef.current

			if (fileElement && scrollContainer) {
				// 计算元素相对于容器的位置
				const elementRect = fileElement.getBoundingClientRect()
				const containerRect = scrollContainer.getBoundingClientRect()
				const offsetTop = elementRect.top - containerRect.top + scrollContainer.scrollTop
				const containerHeight = scrollContainer.clientHeight
				const elementHeight = fileElement.clientHeight

				// 滚动到元素居中位置
				scrollContainer.scrollTo({
					top: offsetTop - containerHeight / 2 + elementHeight / 2,
					behavior: "smooth",
				})
			}
		}, 300)

		// 清除定位状态（闪烁动画结束后）
		setTimeout(() => {
			setLocatingFileId(null)
		}, 2000)
	})

	return {
		locatingFileId,
		handleLocateFileInTree,
	}
}
