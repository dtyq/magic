import { makeAutoObservable, runInAction } from "mobx"
import i18n from "i18next"
import { SuperMagicApi } from "@/opensource/apis"
import type {
	ShareListApiResponse,
	ShareResourceApiItem,
	SharedTopicFilterStatus,
	SharedResourceType,
	ProjectShareItem,
	FileShareItem,
	TopicShareItem,
} from "../types"
import { ResourceType, ShareType } from "../../Share/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

// 每个 tab 的数据结构
interface TabData<T> {
	data: T[]
	isLoading: boolean
	isLoadingMore: boolean
	hasMore: boolean
	page: number
	lastFetchTime: number
}

// 初始化 TabData
function createInitialTabData<T>(): TabData<T> {
	return {
		data: [],
		isLoading: false,
		isLoadingMore: false,
		hasMore: true,
		page: 1,
		lastFetchTime: 0,
	}
}

class ShareManagementStore {
	// 为每个资源类型维护独立缓存
	projectShares: TabData<ProjectShareItem> = createInitialTabData()
	fileShares: TabData<FileShareItem> = createInitialTabData()
	topicShares: TabData<TopicShareItem> = createInitialTabData()

	currentTab: SharedResourceType | null = null
	currentProjectId: string | undefined = undefined
	currentFilterStatus: SharedTopicFilterStatus | undefined = undefined
	currentSearchText: string | undefined = undefined

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	// 获取翻译函数
	private t = (key: string, options?: Record<string, unknown>) => {
		return i18n.t(`super:${key}`, options)
	}

	// 获取对应 tab 的数据
	getTabData(tab: SharedResourceType): TabData<any> {
		switch (tab) {
			case "project":
				return this.projectShares
			case "file":
				return this.fileShares
			case "topic":
				return this.topicShares
			default:
				return this.projectShares
		}
	}

	// 设置当前 tab
	setCurrentTab(tab: SharedResourceType) {
		this.currentTab = tab
	}

	// 设置项目 ID，如果变化则清空所有缓存
	setProjectId(projectId?: string) {
		if (this.currentProjectId !== projectId) {
			this.currentProjectId = projectId
			// 清空所有 tab 的缓存
			this.projectShares = createInitialTabData()
			this.fileShares = createInitialTabData()
			this.topicShares = createInitialTabData()
		}
	}

	// 初始化 - 有缓存立即返回 + 静默更新
	async initialize(
		tab: SharedResourceType,
		projectId?: string,
		filterStatus?: SharedTopicFilterStatus,
		searchText?: string,
	) {
		const tabData = this.getTabData(tab)

		// 保存当前状态
		this.currentProjectId = projectId
		this.currentFilterStatus = filterStatus
		this.currentSearchText = searchText

		if (tabData.data.length > 0) {
			// 有缓存，触发静默更新
			this.fetchAndUpdate(tab, projectId, filterStatus, true, searchText)
			return tabData.data
		}

		// 无缓存，正常加载
		return this.fetchAndUpdate(tab, projectId, filterStatus, false, searchText)
	}

	// 获取数据并更新
	async fetchAndUpdate(
		tab: SharedResourceType,
		projectId?: string,
		filterStatus?: SharedTopicFilterStatus,
		silent = false,
		searchText?: string,
	) {
		const tabData = this.getTabData(tab)

		// 更新当前状态（如果提供了参数）
		if (projectId !== undefined) {
			this.currentProjectId = projectId
		}
		if (filterStatus !== undefined) {
			this.currentFilterStatus = filterStatus
		}
		if (searchText !== undefined) {
			this.currentSearchText = searchText
		}

		if (!silent) {
			runInAction(() => {
				tabData.isLoading = true
			})
		}

		try {
			// 根据 tab 类型确定 resource_type、share_project
			let resourceTypes: ResourceType[]
			let shareProject: boolean | undefined

			switch (tab) {
				case "project":
					resourceTypes = [ResourceType.FileCollection]
					shareProject = true
					break
				case "file":
					resourceTypes = [ResourceType.FileCollection, ResourceType.File]
					shareProject = undefined // 不传此参数
					break
				case "topic":
					resourceTypes = [ResourceType.Topic]
					shareProject = undefined
					break
				default:
					resourceTypes = [ResourceType.FileCollection]
					shareProject = undefined
			}

			const apiResult = (await SuperMagicApi.getShareResourcesList({
				page: 1,
				page_size: 10,
				keyword: searchText || "",
				resource_type: resourceTypes,
				project_id: projectId,
				filter_type: filterStatus && filterStatus !== "all" ? filterStatus : undefined,
				share_project: shareProject,
			})) as ShareListApiResponse

			// 转换数据（不需要客户端过滤，后端已过滤）
			const transformedData = this.transformData(tab, apiResult.list || [])

			runInAction(() => {
				tabData.data = transformedData
				tabData.hasMore = transformedData.length < apiResult.total
				tabData.page = 1
				tabData.lastFetchTime = Date.now()
			})

			return transformedData
		} catch (error) {
			console.error("Failed to fetch share list:", error)
			if (!silent) {
				magicToast.error("获取分享列表失败")
			}
			return tabData.data
		} finally {
			if (!silent) {
				runInAction(() => {
					tabData.isLoading = false
				})
			}
		}
	}

	// 加载更多
	async fetchMore(
		tab: SharedResourceType,
		projectId?: string,
		filterStatus?: SharedTopicFilterStatus,
		searchText?: string,
	) {
		const tabData = this.getTabData(tab)

		if (!tabData.hasMore || tabData.isLoadingMore) {
			return []
		}

		runInAction(() => {
			tabData.isLoadingMore = true
		})

		try {
			// 根据 tab 类型确定 resource_type、share_project 和 filterFn
			let resourceTypes: ResourceType[]
			let shareProject: boolean | undefined

			switch (tab) {
				case "project":
					resourceTypes = [ResourceType.FileCollection]
					shareProject = true
					break
				case "file":
					resourceTypes = [ResourceType.FileCollection]
					shareProject = undefined // 不传此参数
					break
				case "topic":
					resourceTypes = [ResourceType.Topic]
					shareProject = undefined
					break
				default:
					resourceTypes = [ResourceType.FileCollection]
					shareProject = undefined
			}

			const nextPage = tabData.page + 1

			const apiResult = (await SuperMagicApi.getShareResourcesList({
				page: nextPage,
				page_size: 10,
				keyword: searchText || "",
				resource_type: resourceTypes,
				project_id: projectId,
				filter_type: filterStatus && filterStatus !== "all" ? filterStatus : undefined,
				share_project: shareProject,
			})) as ShareListApiResponse

			// 转换数据（不需要客户端过滤，后端已过滤）
			const transformedData = this.transformData(tab, apiResult.list || [])

			runInAction(() => {
				tabData.data = [...tabData.data, ...transformedData]
				tabData.hasMore = tabData.data.length < apiResult.total
				tabData.page = nextPage
			})

			return transformedData
		} catch (error) {
			console.error("Failed to fetch more share list:", error)
			magicToast.error("加载更多失败")
			return []
		} finally {
			runInAction(() => {
				tabData.isLoadingMore = false
			})
		}
	}

	// 数据转换
	private transformData(
		tab: SharedResourceType,
		items: ShareResourceApiItem[],
	): ProjectShareItem[] | FileShareItem[] | TopicShareItem[] {
		switch (tab) {
			case "project":
				return items.map((item) => ({
					...item,
					project_name: item.project_name || this.t("common.untitledProject"),
					title: item.resource_name || this.t("common.untitledProject"),
					project_id: item.project_id || "",
					workspace_id: item.workspace_id || "",
					workspace_name: item.workspace_name || "",
					share_type: item.share_type as ShareType,
					resource_id: item.resource_id,
					has_password: item.has_password || false,
					password: item.password,
					created_at: item.created_at,
					deleted_at: item.deleted_at,
					copy_count: item.extend?.copy_count,
					expire_days: item.expire_days,
				})) as ProjectShareItem[]

			case "file":
				return items.map((item) => ({
					...item,
					title: item.resource_name || this.t("common.untitledFile"),
					project_id: item.project_id || "",
					project_name: item.project_name || this.t("common.untitledProject"),
					workspace_id: item.workspace_id || "",
					workspace_name: item.workspace_name || "",
					share_type: item.share_type as ShareType,
					resource_id: item.resource_id,
					has_password: item.has_password || false,
					password: item.password,
					created_at: item.created_at,
					deleted_at: item.deleted_at,
					file_count: item.extend?.file_count || 0,
					copy_count: item.extend?.copy_count,
					expire_days: item.expire_days,
					share_project: item.share_project,
				})) as FileShareItem[]

			case "topic":
				return items.map((item) => ({
					...item,
					title: item.resource_name || this.t("messageHeader.untitledTopic"),
					topic_id: item.resource_id,
					project_id: item.project_id || "",
					project_name: item.project_name || this.t("common.untitledProject"),
					workspace_id: item.workspace_id || "",
					workspace_name: item.workspace_name || "",
					share_type: item.share_type as ShareType,
					resource_id: item.resource_id,
					has_password: item.is_password_enabled ?? item.has_password ?? false,
					is_password_enabled: item.is_password_enabled ?? item.has_password ?? false,
					password: item.password,
					created_at: item.created_at,
					shared_at: item.shared_at || item.created_at,
					topic_mode: item.topic_mode,
					deleted_at: item.deleted_at,
				})) as TopicShareItem[]

			default:
				return []
		}
	}

	// 更新单个分享项的类型
	updateShareType(
		tab: SharedResourceType,
		resourceId: string,
		newType: ShareType,
		extraData?: any,
	) {
		const tabData = this.getTabData(tab)
		runInAction(() => {
			tabData.data = tabData.data.map((item: any) =>
				item.resource_id === resourceId
					? { ...item, share_type: newType, ...(extraData && { extra: extraData }) }
					: item,
			)
		})
	}

	// 取消单个分享
	async cancelShare(tab: SharedResourceType, resourceId: string) {
		try {
			await SuperMagicApi.cancelShareResource({ resourceId })
			magicToast.success("取消分享成功")

			const tabData = this.getTabData(tab)

			// 判断是否只加载了一页
			if (tabData.page === 1) {
				// 只有第一页，刷新列表，使用当前保存的状态
				await this.fetchAndUpdate(
					tab,
					this.currentProjectId,
					this.currentFilterStatus,
					true,
					this.currentSearchText,
				)
			} else {
				// 加载了多页，直接从列表移除
				runInAction(() => {
					tabData.data = tabData.data.filter(
						(item: any) => item.resource_id !== resourceId,
					)
				})
			}
		} catch (error) {
			console.error("Cancel share failed:", error)
			magicToast.error("取消分享失败")
		}
	}

	// 重置某个 tab 的数据
	resetTab(tab: SharedResourceType) {
		const tabData = this.getTabData(tab)
		runInAction(() => {
			Object.assign(tabData, createInitialTabData())
		})
	}

	// 重置所有数据
	reset() {
		runInAction(() => {
			this.projectShares = createInitialTabData()
			this.fileShares = createInitialTabData()
			this.topicShares = createInitialTabData()
			this.currentTab = null
		})
	}
}

export default new ShareManagementStore()
