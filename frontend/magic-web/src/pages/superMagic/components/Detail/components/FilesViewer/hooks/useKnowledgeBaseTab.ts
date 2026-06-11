import { useState, useCallback } from "react"

export const KNOWLEDGE_BASE_TAB_ID_PREFIX = "__kb__"

/** 知识库预览 Tab 的数据 */
export interface KnowledgeBaseTabData {
	knowledgeBaseId: string
	documentCode?: string
	fileKey?: string
	title: string
	knowledgeBaseName?: string
	fileExtension?: string
}

function normalizeFileExtension(extension?: string) {
	const normalized = extension?.trim().replace(/^\./, "").toLowerCase()
	return normalized || ""
}

function extractFileExtensionFromPath(path?: string) {
	const normalizedPath = path?.trim().split(/[?#]/)[0] || ""
	const fileName = normalizedPath.split("/").pop() || ""
	const extensionStartIndex = fileName.lastIndexOf(".")

	if (extensionStartIndex <= 0 || extensionStartIndex === fileName.length - 1) {
		return ""
	}

	return normalizeFileExtension(fileName.slice(extensionStartIndex + 1))
}

function getKnowledgeBaseTabFileExtension(data: KnowledgeBaseTabData) {
	return normalizeFileExtension(data.fileExtension) || extractFileExtensionFromPath(data.fileKey)
}

/** 知识库预览 Tab 项 */
export interface KnowledgeBaseTabItem {
	id: string
	type: "knowledge_base"
	title: string
	isKnowledgeBaseTab: true
	active: boolean
	closeable: boolean
	fileData: Record<string, never>
	data: KnowledgeBaseTabData
	/** Tab 创建时间戳（毫秒），用于与文件 tab 混排 */
	create_at: number
}

function buildKnowledgeBaseTabId(data: KnowledgeBaseTabData) {
	return `${KNOWLEDGE_BASE_TAB_ID_PREFIX}${data.knowledgeBaseId}_${data.documentCode || data.fileKey || data.title}`
}

interface UseKnowledgeBaseTabReturn {
	knowledgeBaseTabs: KnowledgeBaseTabItem[]
	openKnowledgeBaseTab: (data: KnowledgeBaseTabData) => void
	closeKnowledgeBaseTab: (tabId: string) => void
	isKnowledgeBaseTab: (tabId: string) => boolean
	deactivateAllKnowledgeBaseTabs: () => void
}

export function useKnowledgeBaseTab(): UseKnowledgeBaseTabReturn {
	const [knowledgeBaseTabs, setKnowledgeBaseTabs] = useState<KnowledgeBaseTabItem[]>([])

	const isKnowledgeBaseTab = useCallback((tabId: string) => {
		return tabId.startsWith(KNOWLEDGE_BASE_TAB_ID_PREFIX)
	}, [])

	const openKnowledgeBaseTab = useCallback((data: KnowledgeBaseTabData) => {
		const tabId = buildKnowledgeBaseTabId(data)
		const fileExtension = getKnowledgeBaseTabFileExtension(data)

		setKnowledgeBaseTabs((prev) => {
			const existing = prev.find((tab) => tab.id === tabId)
			if (existing) {
				// 已存在则激活它，取消其他
				return prev.map((tab) => ({ ...tab, active: tab.id === tabId }))
			}
			// 新增：取消其他激活，新 tab 设为激活
			const deactivated = prev.map((tab) => ({ ...tab, active: false }))
			const newTab: KnowledgeBaseTabItem = {
				id: tabId,
				type: "knowledge_base",
				title: data.title,
				isKnowledgeBaseTab: true,
				active: true,
				closeable: true,
				fileData: (fileExtension ? { file_extension: fileExtension } : {}) as Record<
					string,
					never
				>,
				data,
				create_at: Date.now(),
			}
			return [...deactivated, newTab]
		})
	}, [])

	const closeKnowledgeBaseTab = useCallback((tabId: string) => {
		setKnowledgeBaseTabs((prev) => prev.filter((tab) => tab.id !== tabId))
	}, [])

	const deactivateAllKnowledgeBaseTabs = useCallback(() => {
		setKnowledgeBaseTabs((prev) => prev.map((tab) => ({ ...tab, active: false })))
	}, [])

	return {
		knowledgeBaseTabs,
		openKnowledgeBaseTab,
		closeKnowledgeBaseTab,
		isKnowledgeBaseTab,
		deactivateAllKnowledgeBaseTabs,
	}
}
