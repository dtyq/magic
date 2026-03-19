import { useEffect, useRef } from "react"
import shareManagementStore from "../stores/shareManagement"
import type { SharedResourceType, SharedTopicFilterStatus } from "../types"
import { ShareType } from "../../Share/types"
import { useUpdateEffect } from "ahooks"

export function useShareManagementStore(
	tab: SharedResourceType,
	projectId?: string,
	filterStatus?: SharedTopicFilterStatus,
	searchText?: string,
) {
	const isFirstRenderRef = useRef(true)
	const prevProjectIdRef = useRef(projectId)

	// 监听 projectId 变化
	useEffect(() => {
		if (prevProjectIdRef.current !== projectId) {
			prevProjectIdRef.current = projectId
			// projectId 变化时，清空缓存并重置首次渲染标记
			shareManagementStore.setProjectId(projectId)
			isFirstRenderRef.current = true
		}
	}, [projectId])

	// 组件挂载时初始化数据
	useEffect(() => {
		shareManagementStore.setCurrentTab(tab)

		// 首次渲染时初始化
		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false
			shareManagementStore.initialize(tab, projectId, filterStatus, searchText)
		}
	}, [tab, projectId, filterStatus, searchText])

	// 统一监听 filterStatus 和 searchText 的变化
	useUpdateEffect(() => {
		if (filterStatus !== undefined || searchText !== undefined) {
			shareManagementStore.initialize(tab, projectId, filterStatus, searchText)
		}
	}, [filterStatus, searchText, tab, projectId])

	// 返回 observable 数据
	const tabData = shareManagementStore.getTabData(tab)

	return {
		data: tabData.data,
		isLoading: tabData.isLoading,
		isLoadingMore: tabData.isLoadingMore,
		hasMore: tabData.hasMore,
		lastFetchTime: tabData.lastFetchTime,
		fetchMore: () => shareManagementStore.fetchMore(tab, projectId, filterStatus, searchText),
		updateShareType: (resourceId: string, newType: ShareType, extraData?: any) =>
			shareManagementStore.updateShareType(tab, resourceId, newType, extraData),
		cancelShare: (resourceId: string) => shareManagementStore.cancelShare(tab, resourceId),
		refresh: () =>
			shareManagementStore.fetchAndUpdate(tab, projectId, filterStatus, false, searchText),
	}
}
