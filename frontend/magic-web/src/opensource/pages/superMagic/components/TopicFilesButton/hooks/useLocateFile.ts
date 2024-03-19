import { useState, useEffect, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { findTreeNodeByKey, getNodePath, type TreeNodeData } from "../utils/treeDataConverter"
import { useOrganization } from "@/opensource/models/user/hooks/useOrganization"
import { ProjectStateRepository } from "@/opensource/models/config/repositories/SuperProjectStateRepository"

interface UseLocateFileOptions {
	treeData: TreeNodeData[]
	expandedKeys: React.Key[]
	setExpandedKeys: (keys: React.Key[]) => void
	selectedProjectId?: string
}

/**
 * 查找树节点的父节点
 */
export function findParentNode(treeData: TreeNodeData[], targetKey: string): TreeNodeData | null {
	function search(nodes: TreeNodeData[]): TreeNodeData | null {
		for (const node of nodes) {
			if (node.children) {
				// 检查当前节点的直接子节点中是否包含目标节点
				const hasChild = node.children.some((child) => child.key === targetKey)
				if (hasChild) {
					return node
				}
				// 递归查找子节点
				const found = search(node.children)
				if (found) return found
			}
		}
		return null
	}
	return search(treeData)
}

/**
 * 在 PPT 节点的直接子节点中查找页面文件节点（只查找第一层）
 */
export function findSlidePageNodeByName(
	pptNode: TreeNodeData,
	pageFileName: string,
): TreeNodeData | null {
	// 只查找第一层子节点，不递归
	if (!pptNode.children) return null

	for (const child of pptNode.children) {
		if (child.item?.file_name === pageFileName) {
			return child
		}
	}
	return null
}

/**
 * useLocateFile - 文件定位功能 Hook
 * 负责处理文件在树中的定位、展开和滚动
 * 支持 PPT 文件的智能定位（定位到当前激活的页面）
 */
export function useLocateFile(options: UseLocateFileOptions) {
	const { treeData, expandedKeys, setExpandedKeys, selectedProjectId } = options
	const { organizationCode } = useOrganization()
	const projectStateRepository = useMemo(() => new ProjectStateRepository(), [])

	// 定位文件状态
	const [locatingFileId, setLocatingFileId] = useState<string | null>(null)

	// 普通文件定位逻辑（提取为独立函数）
	const handleLocateNormalFile = useMemoizedFn((fileId: string) => {
		console.log("📍 Locating normal file:", fileId)

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
			const fileElement = document.querySelector(`[data-file-id="${fileId}"]`)
			if (fileElement) {
				fileElement.scrollIntoView({ behavior: "smooth", block: "center" })
			}
		}, 300)

		// 清除定位状态（闪烁动画结束后）
		setTimeout(() => {
			setLocatingFileId(null)
		}, 2000)
	})

	// 处理 PPT 文件定位
	const handleLocatePPTFile = useMemoizedFn(async (pptFileId: string, pptNode: TreeNodeData) => {
		console.log("📊 Locating PPT file:", pptFileId)

		// 1. 从缓存获取当前激活的页面索引
		let activeIndex = 0
		if (organizationCode && selectedProjectId) {
			try {
				const state = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProjectId,
				)
				activeIndex = state?.fileState?.pptActiveIndexMap?.[pptFileId] ?? 0
				console.log("📍 PPT activeIndex from cache:", activeIndex)
			} catch (error) {
				console.warn("⚠️ Failed to get PPT activeIndex from cache:", error)
			}
		}

		// 2. 从 metadata.slides 获取页面文件名
		const slides = pptNode.item.metadata.slides
		if (!slides || !Array.isArray(slides)) {
			console.warn("⚠️ PPT slides array not found, fallback to entry file")
			handleLocateNormalFile(pptFileId)
			return
		}

		const pageFileName = slides[activeIndex] || slides[0]
		console.log("📄 Target page file:", pageFileName, "at index:", activeIndex)

		// 3. 查找对应的页面文件节点（只在当前 PPT 的第一层子节点中查找）
		const pageNode = findSlidePageNodeByName(pptNode, pageFileName)

		if (pageNode) {
			console.log("✅ Found page file node, locating to:", pageNode.key)
			// 定位到页面文件
			handleLocateNormalFile(pageNode.key as string)
		} else {
			// 降级：定位到 PPT 入口文件
			console.warn("⚠️ Page file not found, fallback to entry file")
			handleLocateNormalFile(pptFileId)
		}
	})

	// 主定位函数
	const handleLocateFileInTree = useMemoizedFn(async (fileId: string) => {
		console.log("🎯 Locating file in tree:", fileId)

		// 查找文件节点
		const node = findTreeNodeByKey(treeData, fileId)
		if (!node) {
			console.warn("⚠️ File node not found in tree:", fileId)
			return
		}

		// 检查是否是 PPT 入口文件
		if (node.item?.metadata?.type === "slide" && node.item?.metadata?.slides) {
			const parentNode = findParentNode(treeData, fileId)
			if (!parentNode) {
				console.warn("⚠️ Parent node not found for PPT entry file:", fileId)
				return
			}
			console.log("🎬 Detected PPT entry file, handling PPT location")
			await handleLocatePPTFile(fileId, parentNode as TreeNodeData)
			return
		}
		// 普通文件定位
		handleLocateNormalFile(fileId)
	})

	// 订阅定位文件事件
	useEffect(() => {
		const handleLocateEvent = (fileId: string) => {
			handleLocateFileInTree(fileId)
		}

		pubsub.subscribe(PubSubEvents.Locate_File_In_Tree, handleLocateEvent)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Locate_File_In_Tree, handleLocateEvent)
		}
	}, [handleLocateFileInTree])

	return {
		locatingFileId,
		handleLocateFileInTree,
	}
}
