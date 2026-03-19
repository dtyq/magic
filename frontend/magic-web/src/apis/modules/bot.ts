import { genRequestUrl } from "@/utils/http"
import type {
	Bot,
	GetUserAvailableAgentListResponse,
	QuickInstructionList,
	RespondInstructType,
	SystemInstructMap,
	WithPage,
} from "@/types/bot"
import type { StatusIconKey } from "@/pages/flow/components/QuickInstructionButton/StatusIcons"

import type { HttpClient } from "../core/HttpClient"

export const generateBotApi = (fetch: HttpClient) => ({
	/** 获取市场机器人 */
	getMarketBotList() {
		return fetch.get<WithPage<Bot.BotItem[]>>(
			genRequestUrl("/api/v1/agents/versions/marketplace"),
		)
	},

	/** 获取企业内部机器人 */
	getOrgBotList({ page = 1, pageSize = 10, keyword }: Bot.GetUserBotListParams) {
		return fetch.get<WithPage<Bot.OrgBotItem[]>>(
			genRequestUrl(
				"/api/v1/agents/versions/organization",
				{},
				{
					page,
					page_size: pageSize,
					robot_name: keyword,
				},
			),
		)
	},

	/** 获取用户个人机器人 */
	getUserBotList({ page, pageSize, keyword }: Bot.GetUserBotListParams) {
		return fetch.get<WithPage<Bot.BotItem[]>>(
			genRequestUrl(
				"/api/v1/agents/queries",
				{},
				{
					page,
					page_size: pageSize,
					robot_name: keyword,
				},
			),
		)
	},

	/** 获取机器人版本列表 */
	getBotVersionList(agentId: string) {
		return fetch.get<Bot.BotVersion[]>(
			genRequestUrl("/api/v1/agents/${agentId}/versions", { agentId }),
		)
	},

	/** 保存机器人 */
	saveBot(params: Bot.SaveBotParams) {
		return fetch.post<Bot.Detail["botEntity"]>(genRequestUrl("/api/v1/agents"), params)
	},

	/** 删除机器人 */
	deleteBot(agentId: string) {
		return fetch.delete<null>(genRequestUrl("/api/v1/agents/${agentId}", { agentId }))
	},

	/** 修改机器人状态 */
	updateBotStatus(agentId: string, status: number) {
		return fetch.put<null>(
			genRequestUrl("/api/v1/agents/${agentId}/status", { agentId }, { status }),
		)
	},

	/** 发布机器人 */
	publishBot(params: Bot.PublishBotParams) {
		return fetch.post<Bot.PublishBot>(genRequestUrl("/api/v1/agents/versions"), params)
	},

	/** 获取机器人最大版本号 */
	getMaxVersion(agentId: string) {
		return fetch.get<string>(genRequestUrl("/api/v1/agents/${agentId}/max", { agentId }))
	},

	/** 机器人发布至组织 */
	publishToOrg(agentId: string, status: number) {
		return fetch.get<null>(
			genRequestUrl("/api/v1/agents/${agentId}/enterprise-status", { agentId }, { status }),
		)
	},

	/** 机器人注册并添加好友 */
	registerAndAddFriend(agentVersionId: string) {
		return fetch.post<Bot.AddFriend>(
			genRequestUrl("/api/v1/agents/${agentVersionId}/register-friend", {
				agentVersionId,
			}),
		)
	},

	/** 获取机器人详情 */
	getBotDetail(agentId: string) {
		return fetch.get<Bot.Detail>(genRequestUrl("/api/v1/agents/${agentId}", { agentId }))
	},

	/** 获取机器人版本详情 */
	getBotVersionDetail(agentVersionId: string) {
		return fetch.get<Bot.Detail>(
			genRequestUrl("/api/v1/agents/versions/${agentVersionId}", {
				agentVersionId,
			}),
		)
	},

	/** 判断机器人是否修改过 */
	isBotUpdate(agentId: string) {
		return fetch.get<boolean>(
			genRequestUrl("/api/v1/agents/${agentId}/is-updated", { agentId }),
		)
	},

	/** 获取默认图标 */
	getDefaultIcon() {
		return fetch.get<Bot.DefaultIcon>(genRequestUrl("/api/v1/file/default-icons"), {
			enableRequestUnion: true,
		})
	},

	/** 保存交互指令 */
	saveInstruct(params: Bot.SaveInstructParams) {
		return fetch.post<QuickInstructionList[]>(
			genRequestUrl("/api/v1/agents/${agentId}/instructs", { agentId: params.bot_id }),
			params,
		)
	},

	/** 获取交互指令类型 */
	getInstructTypeOption() {
		return fetch.get<RespondInstructType>(genRequestUrl("/api/v1/agent-options/instruct-types"))
	},

	/** 获取交互指令组类型 */
	getInstructGroupTypeOption() {
		return fetch.get<RespondInstructType>(
			genRequestUrl("/api/v1/agent-options/instruct-group-types"),
		)
	},

	/** 获取交互指令状态类型icon */
	getInstructStatusIcons() {
		return fetch.get<StatusIconKey[]>(
			genRequestUrl("/api/v1/agent-options/instruct-state-icons"),
		)
	},

	/** 获取交互指令状态类型颜色组 */
	getInstructStatusColors() {
		return fetch.get<RespondInstructType>(
			genRequestUrl("/api/v1/agent-options/instruct-state-colors"),
		)
	},

	/** 获取系统交互指令 */
	getSystemInstruct() {
		return fetch.get<SystemInstructMap>(genRequestUrl("/api/v1/agent-options/instruct-system"))
	},

	/** 获取已配置过的第三方平台 */
	getThirdPartyPlatforms(botId: string) {
		return fetch.get<WithPage<Bot.ThirdPartyPlatform[]>>(
			genRequestUrl(
				"/api/v1/agents/third-platform/${botId}/list",
				{ botId },
				{
					page: 1,
					page_size: 10,
				},
			),
		)
	},

	getUserAllAgentList() {
		return fetch.get<GetUserAvailableAgentListResponse>(
			genRequestUrl("/api/v1/agents/available"),
		)
	},
})
