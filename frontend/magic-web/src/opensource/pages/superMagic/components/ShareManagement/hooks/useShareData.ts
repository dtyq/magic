import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn } from "ahooks"
import { SuperMagicApi } from "@/opensource/apis"
import {
	SharedResourceType,
	SharedTopicFilterStatus,
	type TopicShareItem,
	type FileShareItem,
	type ProjectShareItem,
	type ShareResourceApiItem,
} from "../types"
import { ResourceType, ShareType } from "../../Share/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseShareDataProps {
	resourceType: SharedResourceType
	filterStatus: SharedTopicFilterStatus
	searchText: string
	projectId?: string
	currentPage: number
	pageSize?: number
}

export function useShareData({
	resourceType,
	filterStatus,
	searchText,
	projectId,
	currentPage,
	pageSize = 10,
}: UseShareDataProps) {
	const { t } = useTranslation("super")
	const [data, setData] = useState<(TopicShareItem | FileShareItem | ProjectShareItem)[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(false)
	const [refreshKey, setRefreshKey] = useState(0)
	const isInitialLoadRef = useRef(true)

	// 加载数据
	const fetchData = useCallback(async () => {
		try {
			// 只有首次加载或数据为空时才显示 loading 状态
			// 刷新时静默更新，避免闪烁
			if (isInitialLoadRef.current) {
				setLoading(true)
			}

			// 获取资源类型枚举值和 share_project
			let resourceTypes: ResourceType[]
			let shareProject: boolean | undefined
			let projectIdParam: string | undefined

			switch (resourceType) {
				case SharedResourceType.Topic:
					resourceTypes = [ResourceType.Topic]
					shareProject = undefined
					projectIdParam = projectId
					break
				case SharedResourceType.File:
					resourceTypes = [ResourceType.FileCollection, ResourceType.File]
					shareProject = undefined
					projectIdParam = projectId
					break
				case SharedResourceType.Project:
					resourceTypes = [ResourceType.FileCollection]
					shareProject = true
					projectIdParam = ""
					break
				default:
					resourceTypes = [ResourceType.Topic]
					shareProject = undefined
					projectIdParam = projectId
			}

			const response = await SuperMagicApi.getShareResourcesList({
				page: currentPage,
				page_size: pageSize,
				keyword: searchText,
				resource_type: resourceTypes,
				project_id: projectIdParam,
				filter_type: filterStatus,
				share_project: shareProject,
			})

			// 转换数据
			const list = (response.list || []).map((item: ShareResourceApiItem) => {
				const baseData = {
					...item,
					resource_id: item.resource_id,
					share_type: item.share_type as ShareType,
					is_password_enabled: item.is_password_enabled || false,
					has_password: false,
					password: item.password,
					created_at: item.created_at,
					deleted_at: item.deleted_at,
				}

				switch (resourceType) {
					case SharedResourceType.Topic:
						return {
							...baseData,
							title: item.resource_name || t("messageHeader.untitledTopic"),
							topic_id: item.resource_id,
							project_id: item.project_id || "",
							project_name: item.project_name || t("common.untitledProject"),
							workspace_id: item.workspace_id || "",
							workspace_name: item.workspace_name || "",
							shared_at: item.shared_at || item.created_at,
							topic_mode: item.topic_mode,
						} as TopicShareItem

					case SharedResourceType.File:
						return {
							...baseData,
							title: item.resource_name || t("common.untitledFile"),
							project_id: item.project_id || "",
							project_name: item.project_name || t("common.untitledProject"),
							workspace_id: item.workspace_id || "",
							workspace_name: item.workspace_name || "",
							file_count: item.extend?.file_count || 0,
							copy_count: item.extend?.copy_count,
							expire_days: item.expire_days,
						} as FileShareItem

					case SharedResourceType.Project:
						return {
							...baseData,
							title: item.resource_name || t("common.untitledProject"),
							project_name: item.project_name || t("common.untitledProject"),
							project_id: item.project_id || "",
							workspace_id: item.workspace_id || "",
							workspace_name: item.workspace_name || "",
							file_count: item.extend?.file_count || 0,
							copy_count: item.extend?.copy_count,
							expire_days: item.expire_days,
						} as ProjectShareItem

					default:
						return baseData as unknown as TopicShareItem
				}
			})

			setData(list)
			setTotal(response.total || 0)
			isInitialLoadRef.current = false
		} catch (error) {
			console.error("Failed to fetch share data:", error)
			magicToast.error(t("shareManagement.fetchFailed"))
		} finally {
			setLoading(false)
		}
	}, [currentPage, pageSize, searchText, resourceType, projectId, filterStatus, t])

	// 防抖版本的 fetchData
	const { run: debouncedFetchData } = useDebounceFn(fetchData, {
		wait: 0,
	})

	// 加载数据 - 只在真正需要的参数变化时触发
	useEffect(() => {
		debouncedFetchData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPage, pageSize, searchText, resourceType, projectId, filterStatus, refreshKey])

	// 切换资源类型时重置首次加载状态
	useEffect(() => {
		isInitialLoadRef.current = true
	}, [resourceType])

	// 刷新数据 - 通过改变 refreshKey 触发 useEffect 重新执行（静默刷新）
	const refreshData = () => {
		setRefreshKey((prev) => prev + 1)
	}

	// 取消单个分享
	const cancelShare = async (resourceId: string) => {
		try {
			await SuperMagicApi.cancelShareResource({ resourceId })
			magicToast.success(t("shareManagement.cancelShareSuccess"))
			refreshData()
		} catch (error) {
			console.error("Cancel share failed:", error)
			magicToast.error(t("shareManagement.cancelShareFailed"))
		}
	}

	// 批量取消分享
	const batchCancelShare = async (resourceIds: string[]) => {
		try {
			await SuperMagicApi.batchCancelShareResources({ resourceIds })
			magicToast.success(t("shareManagement.batchCancelShareSuccess"))
			refreshData()
		} catch (error) {
			console.error("Batch cancel share failed:", error)
			magicToast.error(t("shareManagement.batchCancelShareFailed"))
		}
	}

	return {
		data,
		total,
		loading,
		refreshData,
		cancelShare,
		batchCancelShare,
	}
}
