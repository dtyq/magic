import type {
	Bot,
	GetUserAvailableAgentListResponse,
	QuickInstructionList,
	RespondInstructType,
	SystemInstructMap,
	WithPage,
} from "@/types/bot"
import type { StatusIconKey } from "@/pages/flow/components/QuickInstructionButton/StatusIcons"

import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"

export const generateBotApi = (fetch: ServiceHttpClient) => ({
	/** 获取市场机器人 */
	getMarketBotList() {
		return fetch.get<WithPage<Bot.BotItem[]>>("/api/v1/agents/versions/marketplace")
	},

	/** 获取企业内部机器人 */
	getOrgBotList({ page = 1, pageSize = 10, keyword }: Bot.GetUserBotListParams) {
		return fetch.get<WithPage<Bot.OrgBotItem[]>>("/api/v1/agents/versions/organization", {
			params: {
				page,
				page_size: pageSize,
				robot_name: keyword,
			},
		})
	},

	/** 获取用户个人机器人 */
	getUserBotList({ page, pageSize, keyword }: Bot.GetUserBotListParams) {
		return fetch.get<WithPage<Bot.BotItem[]>>("/api/v1/agents/queries", {
			params: {
				page,
				page_size: pageSize,
				robot_name: keyword,
			},
		})
	},

	/** 获取机器人版本列表 */
	getBotVersionList(agentId: string) {
		return fetch.get<Bot.BotVersion[]>(`/api/v1/agents/${agentId}/versions`)
	},

	/** 保存机器人 */
	saveBot(params: Bot.SaveBotParams) {
		return fetch.post<Bot.Detail["botEntity"]>("/api/v1/agents", params)
	},

	/** 删除机器人 */
	deleteBot(agentId: string) {
		return fetch.delete<null>(`/api/v1/agents/${agentId}`)
	},

	/** 修改机器人状态 */
	updateBotStatus(agentId: string, status: number) {
		return fetch.put<null>(`/api/v1/agents/${agentId}/status`, undefined, {
			params: { status },
		})
	},

	/** 发布机器人 */
	publishBot(params: Bot.PublishBotParams) {
		return fetch.post<Bot.PublishBot>("/api/v1/agents/versions", params)
	},

	/** 获取机器人最大版本号 */
	getMaxVersion(agentId: string) {
		return fetch.get<string>(`/api/v1/agents/${agentId}/max`)
	},

	/** 机器人发布至组织 */
	publishToOrg(agentId: string, status: number) {
		return fetch.get<null>(`/api/v1/agents/${agentId}/enterprise-status`, {
			params: { status },
		})
	},

	/** 机器人注册并添加好友 */
	registerAndAddFriend(agentVersionId: string) {
		return fetch.post<Bot.AddFriend>(`/api/v1/agents/${agentVersionId}/register-friend`)
	},

	/** 获取机器人详情 */
	getBotDetail(agentId: string) {
		return fetch.get<Bot.Detail>(`/api/v1/agents/${agentId}`)
	},

	/** 获取机器人版本详情 */
	getBotVersionDetail(agentVersionId: string) {
		return fetch.get<Bot.Detail>(`/api/v1/agents/versions/${agentVersionId}`)
	},

	/** 判断机器人是否修改过 */
	isBotUpdate(agentId: string) {
		return fetch.get<boolean>(`/api/v1/agents/${agentId}/is-updated`)
	},

	/** 获取默认图标 */
	getDefaultIcon() {
		return fetch.get<Bot.DefaultIcon>("/api/v1/file/default-icons", {
			enableRequestUnion: true,
		})
	},

	/** 保存交互指令 */
	saveInstruct(params: Bot.SaveInstructParams) {
		return fetch.post<QuickInstructionList[]>(
			`/api/v1/agents/${params.bot_id}/instructs`,
			params,
		)
	},

	/** 获取交互指令类型 */
	getInstructTypeOption() {
		return fetch.get<RespondInstructType>("/api/v1/agent-options/instruct-types")
	},

	/** 获取交互指令组类型 */
	getInstructGroupTypeOption() {
		return fetch.get<RespondInstructType>("/api/v1/agent-options/instruct-group-types")
	},

	/** 获取交互指令状态类型icon */
	getInstructStatusIcons() {
		return fetch.get<StatusIconKey[]>("/api/v1/agent-options/instruct-state-icons")
	},

	/** 获取交互指令状态类型颜色组 */
	getInstructStatusColors() {
		return fetch.get<RespondInstructType>("/api/v1/agent-options/instruct-state-colors")
	},

	/** 获取系统交互指令 */
	getSystemInstruct() {
		return fetch.get<SystemInstructMap>("/api/v1/agent-options/instruct-system")
	},

	/** 获取已配置过的第三方平台 */
	getThirdPartyPlatforms(botId: string) {
		return fetch.get<WithPage<Bot.ThirdPartyPlatform[]>>(
			`/api/v1/agents/third-platform/${botId}/list`,
			{
				params: {
					page: 1,
					page_size: 10,
				},
			},
		)
	},

	getUserAllAgentList() {
		return fetch.get<GetUserAvailableAgentListResponse>("/api/v1/agents/available")
	},
})
