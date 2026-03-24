import { userStore } from "@/models/user"
import { routesMatch } from "@/routes/history/helpers"
import { interfaceStore } from "@/stores/interface"
import { User } from "@/types/user"
import { PlatformServiceInterface } from "../types/platformServiceInterface"
import { AppServiceContext } from "../types"
import chatDb from "@/database/chat"
import { internetSearchManager } from "@/pages/superMagic/components/MessageEditor/services/InternetSearchManager"
import ChatFileService from "../../chat/file/ChatFileService"
import MessageSeqIdService from "../../chat/message/MessageSeqIdService"
import MessageService from "../../chat/message/MessageService"
import { initKnowledgeFileService } from "../../file/KnowledgeFile"
import { tryRestorePreviousRecordSummarySession } from "../../initRecordSummaryService"
import ConversationService from "../../chat/conversation/ConversationService"
import EditorDraftService from "@/services/chat/editor/DraftService"
import { initDataContextDb } from "@/database/data-context"
import groupInfoService from "../../groupInfo"
import userInfoService from "../../userInfo"
import { Platform } from "../const/platform"
import { GlobalApi } from "@/apis"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/store"
import { INIT_DOMAINS } from "@/models/user/stores/initialization.store"
import superMagicModeService from "../../superMagic/SuperMagicModeService"
import { LongMemory } from "@/types/longMemory"
import { RouteName } from "@/routes/constants"
import { MobileTabParam } from "@/pages/mobileTabs/constants"
import { baseHistory } from "@/routes/history"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"

export class MagicPlatformService implements PlatformServiceInterface {
	PlatformType: Platform = Platform.Magic

	private context: AppServiceContext

	get logger() {
		return this.context.logger
	}

	constructor(context: AppServiceContext) {
		this.context = context
	}

	preloadGlobalData = async () => {
		GlobalApi.getSettingsGlobalData({
			query_type: [
				"available_agents",
				"available_mcp_servers",
				"available_tool_sets",
				"memory_list",
			],
			memory_list_query: {
				status: [LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION],
			},
			available_tool_sets_query: {
				with_builtin: false,
			},
		}).then((res) => {
			GlobalMentionPanelStore.initData(
				res?.available_agents?.list ?? [],
				res?.available_mcp_servers?.list ?? [],
				res?.available_tool_sets?.list ?? [],
			)
			userStore.user.setPendingMemoryList(res?.memory_list?.data ?? [])
		})
	}

	/**
	 * @description 切换用户后的初始化流程
	 * @param magicUser 用户信息
	 * @param showSwitchLoading 是否显示切换加载状态
	 */
	initUserData = async (magicUser: User.UserInfo) => {
		try {
			const magicId = magicUser.magic_id
			const userId = magicUser.user_id

			this.preloadGlobalData()

			// 获取超级麦吉模式列表，开启更新定时器
			superMagicModeService.startRefreshTimer()
			superMagicModeService.fetchModeList()

			this.logger.log("开始切换账户后的初始化流程", { magicId, userId })
			interfaceStore.setIsSwitchingOrganization(true)
			userStore.initialization.resetInitialized()

			// Switch database based on magic_id
			this.logger.log("切换数据库", { magicId })
			chatDb.switchDb(magicId)
			this.logger.log("数据库切换完成", { magicId })

			this.logger.log("初始化聊天文件服务")
			ChatFileService.init()
			this.logger.log("聊天文件服务初始化完成")

			this.logger.log("初始化编辑器草稿服务")
			EditorDraftService.initDrafts()
			this.logger.log("编辑器草稿服务初始化完成")

			this.logger.log("初始化知识库文件服务")
			initKnowledgeFileService()
			this.logger.log("知识库文件服务初始化完成", { magicId })

			/** Reset super magic internet search state */
			this.logger.log("重置超级魔法互联网搜索状态")
			internetSearchManager.init()

			// Check render sequence ID for all organizations
			this.logger.log("检查所有组织的渲染序列ID")
			MessageSeqIdService.checkAllOrganizationRenderSeqId()

			// Reset view if switching user (not reconnecting)
			this.logger.log("重置消息数据视图")
			// Reset message data view
			ConversationService.reset() // Switch to empty conversation
			MessageService.reset()

			// Reset pull trigger list to avoid request loop
			this.logger.log("重置消息拉取触发器列表")
			MessageService.resetPullTriggerList()

			/** Pull messages on first load */
			const globalPullSeqId = MessageSeqIdService.getGlobalPullSeqId()
			if (!globalPullSeqId) {
				this.logger.log("首次加载，拉取消息", {
					magicId: magicUser.magic_id,
					organizationCode: magicUser.organization_code,
				})
				await MessageService.pullMessageOnFirstLoad(
					magicUser.magic_id,
					magicUser.organization_code,
				)
				this.logger.log("首次消息拉取完成")
			}

			/** Initialize message pull loop */
			this.logger.log("初始化消息拉取循环")
			MessageService.init()

			// Try to restore recording session after user login
			this.logger.log("延迟恢复录音会话")
			setTimeout(() => {
				tryRestorePreviousRecordSummarySession({
					userId: userStore.user.userInfo?.user_id,
					organizationCode: userStore.user.organizationCode,
				})
			}, 1000)

			this.logger.log("用户切换后的初始化流程完成", { magicId })

			const { route, params } = routesMatch(window.location.pathname) ?? {}

			if (
				route?.name &&
				[
					RouteName.Super,
					RouteName.SuperWorkspaceState,
					RouteName.SuperWorkspaceProjectState,
					RouteName.SuperWorkspaceProjectTopicState,
				].includes(route.name as RouteName)
			) {
				await this.initSuperMagicDataIfNeeded({
					workspaceId: params?.workspaceId,
					projectId: params?.projectId,
					topicId: params?.topicId,
				})
			} else if (route?.name === RouteName.MobileTabs) {
				if (this.shouldInitializeMobileTabsSuperState()) {
					await this.initMobileTabsSuperData()
				}
			} else if (route?.name === RouteName.Chat) {
				await this.initChatDataIfNeeded(magicUser)
			}
		} catch (error) {
			this.logger.error("切换账户后的初始化流程失败", error)
		} finally {
			interfaceStore.setIsSwitchingOrganization(false)
		}
	}

	private chatInitPromise: Promise<void> | null = null

	private shouldInitializeMobileTabsSuperState() {
		const searchParams = new URLSearchParams(window.location.search)
		const activeTab = searchParams.get("tab")

		return (
			activeTab === MobileTabParam.Super ||
			searchParams.has("workspaceId") ||
			searchParams.has("projectId") ||
			searchParams.has("topicId")
		)
	}

	private syncMobileTabsSuperQueryState() {
		const currentSearchParams = new URLSearchParams(window.location.search)
		const nextSearchParams = new URLSearchParams(currentSearchParams)
		const selectedWorkspaceId = workspaceStore.selectedWorkspace?.id || null
		const selectedProjectId = projectStore.selectedProject?.id || null
		const selectedTopicId = topicStore.selectedTopic?.id || null

		if (selectedWorkspaceId) nextSearchParams.set("workspaceId", selectedWorkspaceId)
		else nextSearchParams.delete("workspaceId")

		if (selectedProjectId) nextSearchParams.set("projectId", selectedProjectId)
		else nextSearchParams.delete("projectId")

		if (selectedTopicId) nextSearchParams.set("topicId", selectedTopicId)
		else nextSearchParams.delete("topicId")

		const nextSearch = nextSearchParams.toString()
		const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
		const currentUrl = `${window.location.pathname}${window.location.search}`

		if (nextUrl !== currentUrl) {
			baseHistory.replace(nextUrl)
		}
	}

	private async initMobileTabsSuperData() {
		const { default: SuperMagicService } = await import("@/pages/superMagic/services/index")
		const searchParams = new URLSearchParams(window.location.search)
		const workspaceId = searchParams.get("workspaceId") || undefined
		const projectId = searchParams.get("projectId") || undefined
		const topicId = searchParams.get("topicId") || undefined

		await SuperMagicService.initializeState({
			workspaceId,
			projectId,
			topicId,
		})

		this.syncMobileTabsSuperQueryState()

		userStore.initialization.markInitialized({
			magicId: userStore.user.userInfo?.magic_id,
			organizationCode: userStore.user.userInfo?.organization_code,
			domain: INIT_DOMAINS.super,
		})
	}

	/**
	 * 初始化超级麦吉数据
	 * @param {workspaceId, projectId, topicId}: { workspaceId?: string, projectId?: string, topicId?: string } 超级麦吉的参数
	 * @returns void
	 */
	initSuperMagicDataIfNeeded = async ({
		workspaceId,
		projectId,
		topicId,
	}: {
		workspaceId?: string
		projectId?: string
		topicId?: string
	}) => {
		if (userStore.initialization.isInitialized({ domain: INIT_DOMAINS.super })) return
		const { default: SuperMagicService } = await import("@/pages/superMagic/services/index")
		const hasRouteParams = !!(workspaceId || projectId || topicId)
		if (interfaceStore.isMobile && hasRouteParams) {
			SuperMagicService.refreshState({
				workspaceId: workspaceId || undefined,
				projectId,
				topicId,
			})
		} else {
			// 初始化超级麦吉状态
			SuperMagicService.initializeState({
				workspaceId: workspaceId || undefined,
				projectId,
				topicId,
			})
		}
	}

	/**
	 * 初始化聊天数据
	 * @param {magicUser}: User.UserInfo 用户信息
	 * @returns void
	 */
	initChatDataIfNeeded = async (magicUser?: User.UserInfo) => {
		const targetUser = magicUser ?? userStore.user.userInfo
		if (!targetUser) return

		const {
			magic_id: magicId,
			organization_code: organizationCode,
			user_id: userId,
		} = targetUser
		if (
			userStore.initialization.isInitialized({
				magicId,
				organizationCode,
				domain: INIT_DOMAINS.chat,
			})
		)
			return

		if (this.chatInitPromise) {
			await this.chatInitPromise
			return
		}

		this.chatInitPromise = (async () => {
			try {
				this.logger.log("初始化数据上下文数据库", { magicId, userId })
				const db = await initDataContextDb(magicId, userId)
				this.logger.log("数据上下文数据库初始化完成", { magicId })

				this.logger.log("加载用户和组织数据")
				await userInfoService.loadData(db)
				await groupInfoService.loadData(db)
				this.logger.log("用户和组织数据加载完成")
			} catch (error) {
				this.logger.warn("数据上下文初始化失败，跳过用户和组织数据加载", error)
				userInfoService.setInitd(false)
				groupInfoService.setInitd(false)
			}

			const globalPullSeqId = MessageSeqIdService.getGlobalPullSeqId()
			const routeMeta = routesMatch(window.location.pathname)
			const isInitChat = routeMeta?.route?.meta?.isShouldInitChat !== false

			if (globalPullSeqId && isInitChat) {
				this.logger.log("初始化会话服务", {
					magicId,
					organizationCode,
				})
				await ConversationService.init(targetUser)

				this.logger.log("拉取离线消息")
				await MessageService.pullOfflineMessages({
					isHistoryMessage: true,
					sortCheck: false,
				})
			}

			userStore.initialization.markInitialized({
				magicId,
				organizationCode,
				domain: INIT_DOMAINS.chat,
			})
		})()

		try {
			await this.chatInitPromise
		} catch (error) {
			this.logger.error("初始化聊天数据失败", error)
			throw error
		} finally {
			this.chatInitPromise = null
		}
	}
}

export default MagicPlatformService
