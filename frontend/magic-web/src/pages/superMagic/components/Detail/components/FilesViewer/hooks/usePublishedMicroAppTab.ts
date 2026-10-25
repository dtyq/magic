import { useCallback, useEffect, useState } from "react"
import type { CachedMicroAppTab } from "@/models/config/repositories/SuperProjectStateTypes"
import { PUBLISHED_MICRO_APP_TAB_ID_PREFIX } from "../utils/tabConstants"

export interface PublishedMicroAppTabData {
	appId: string
	appName?: string
}

export interface PublishedMicroAppTabItem {
	id: string
	type: "micro_app"
	title: string
	isPublishedMicroAppTab: true
	active: boolean
	closeable: boolean
	fileData: Record<string, never>
	data: PublishedMicroAppTabData
	create_at: number
}

// Published micro-app tabs are not regular file tabs, so they are kept outside
// the FilesViewer instance. This preserves the active preview when navigating
// from a project page to a topic page while keeping projects isolated.
const publishedMicroAppTabsByProject = new Map<string, PublishedMicroAppTabItem[]>()

export function buildPublishedMicroAppTabId(appId: string) {
	return `${PUBLISHED_MICRO_APP_TAB_ID_PREFIX}${appId}`
}

interface UsePublishedMicroAppTabReturn {
	publishedMicroAppTabs: PublishedMicroAppTabItem[]
	openPublishedMicroAppTab: (data: PublishedMicroAppTabData) => void
	closePublishedMicroAppTab: (tabId: string) => void
	isPublishedMicroAppTab: (tabId: string) => boolean
	deactivateAllPublishedMicroAppTabs: () => void
	restorePublishedMicroAppTabs: (
		cachedTabs: CachedMicroAppTab[],
		options: { restoreActive: boolean },
	) => void
}

export function usePublishedMicroAppTab(projectId?: string): UsePublishedMicroAppTabReturn {
	const projectKey = projectId || "__default__"
	const [publishedMicroAppTabs, setPublishedMicroAppTabs] = useState<PublishedMicroAppTabItem[]>(
		() => publishedMicroAppTabsByProject.get(projectKey) || [],
	)

	useEffect(() => {
		setPublishedMicroAppTabs(publishedMicroAppTabsByProject.get(projectKey) || [])
	}, [projectKey])

	const updateTabs = useCallback(
		(
			next:
				| PublishedMicroAppTabItem[]
				| ((previous: PublishedMicroAppTabItem[]) => PublishedMicroAppTabItem[]),
		) => {
			setPublishedMicroAppTabs((previous) => {
				const updated = typeof next === "function" ? next(previous) : next
				if (updated.length > 0) {
					publishedMicroAppTabsByProject.set(projectKey, updated)
				} else {
					publishedMicroAppTabsByProject.delete(projectKey)
				}
				return updated
			})
		},
		[projectKey],
	)

	const isPublishedMicroAppTab = useCallback((tabId: string) => {
		return tabId.startsWith(PUBLISHED_MICRO_APP_TAB_ID_PREFIX)
	}, [])

	const openPublishedMicroAppTab = useCallback(
		(data: PublishedMicroAppTabData) => {
			const appId = data.appId.trim()
			if (!appId) return

			const tabId = buildPublishedMicroAppTabId(appId)
			const title = data.appName?.trim() || appId

			updateTabs((prev) => {
				const existing = prev.find((tab) => tab.id === tabId)
				if (existing) {
					return prev.map((tab) => ({ ...tab, active: tab.id === tabId }))
				}

				const deactivated = prev.map((tab) => ({ ...tab, active: false }))
				const newTab: PublishedMicroAppTabItem = {
					id: tabId,
					type: "micro_app",
					title,
					isPublishedMicroAppTab: true,
					active: true,
					closeable: true,
					fileData: {},
					data: { appId, appName: title },
					create_at: Date.now(),
				}
				return [...deactivated, newTab]
			})
		},
		[updateTabs],
	)

	const closePublishedMicroAppTab = useCallback(
		(tabId: string) => {
			updateTabs((prev) => prev.filter((tab) => tab.id !== tabId))
		},
		[updateTabs],
	)

	const deactivateAllPublishedMicroAppTabs = useCallback(() => {
		updateTabs((prev) => prev.map((tab) => ({ ...tab, active: false })))
	}, [updateTabs])

	// 刷新后从项目缓存重建；已在内存中的标签（用户读取期间刚打开的）保持原状，
	// 只有明确允许时才恢复缓存里的激活态，避免覆盖用户当前的选择。
	const restorePublishedMicroAppTabs = useCallback(
		(cachedTabs: CachedMicroAppTab[], { restoreActive }: { restoreActive: boolean }) => {
			if (cachedTabs.length === 0) return
			updateTabs((prev) => {
				const known = new Set(prev.map((tab) => tab.id))
				const restored: PublishedMicroAppTabItem[] = cachedTabs.flatMap((cached) => {
					const appId = cached.appId?.trim()
					if (!appId || known.has(buildPublishedMicroAppTabId(appId))) return []
					return [
						{
							id: buildPublishedMicroAppTabId(appId),
							type: "micro_app",
							title: cached.appName?.trim() || appId,
							isPublishedMicroAppTab: true,
							active: false,
							closeable: true,
							fileData: {},
							data: { appId, appName: cached.appName?.trim() || appId },
							create_at: cached.createdAt,
						},
					]
				})
				const activeCached = restoreActive
					? cachedTabs.find((cached) => cached.active)
					: undefined
				const activeId = activeCached
					? buildPublishedMicroAppTabId(activeCached.appId.trim())
					: undefined
				const merged = [...restored, ...prev]
				if (!activeId || !merged.some((tab) => tab.id === activeId)) return merged
				return merged.map((tab) => ({ ...tab, active: tab.id === activeId }))
			})
		},
		[updateTabs],
	)

	return {
		restorePublishedMicroAppTabs,
		publishedMicroAppTabs,
		openPublishedMicroAppTab,
		closePublishedMicroAppTab,
		isPublishedMicroAppTab,
		deactivateAllPublishedMicroAppTabs,
	}
}
