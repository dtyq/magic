import { genRequestUrl } from "@/utils/http"
import type {
	Bot,
	QuickInstructionList,
	RespondInstructType,
	SystemInstructMap,
	WithPage,
} from "@/types/bot"
import type { StatusIconKey } from "@/opensource/pages/flow/components/QuickInstructionButton/const"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generateBotApi = (fetch: HttpClient) => ({
	/** 获取市场机器人 */
	getMarketBotList() {
		return fetch.get<WithPage<Bot.BotItem[]>>(genRequestUrl(RequestUrl.getMarketBotList))
	},

	/** 获取企业内部机器人 */
	getOrgBotList({ page = 1, pageSize = 10, keyword }: Bot.GetUserBotListParams) {
		return fetch.get<WithPage<Bot.OrgBotItem[]>>(
			genRequestUrl(
				RequestUrl.getOrgBotList,
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
				RequestUrl.getUserBotList,
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
		return fetch.get<Bot.BotVersion[]>(genRequestUrl(RequestUrl.getBotVersionList, { agentId }))
	},

	/** 保存机器人 */
	saveBot(params: Bot.SaveBotParams) {
		return fetch.post<Bot.Detail["botEntity"]>(genRequestUrl(RequestUrl.saveBot), params)
	},

	/** 删除机器人 */
	deleteBot(agentId: string) {
		return fetch.delete<null>(genRequestUrl(RequestUrl.deleteBot, { agentId }))
	},

	/** 修改机器人状态 */
	updateBotStatus(agentId: string, status: number) {
		return fetch.put<null>(genRequestUrl(RequestUrl.updateBotStatus, { agentId }, { status }))
	},

	/** 发布机器人 */
	publishBot(params: Bot.PublishBotParams) {
		return fetch.post<Bot.PublishBot>(genRequestUrl(RequestUrl.publishBot), params)
	},

	/** 获取机器人最大版本号 */
	getMaxVersion(agentId: string) {
		return fetch.get<string>(genRequestUrl(RequestUrl.getBotMaxVersion, { agentId }))
	},

	/** 机器人发布至组织 */
	publishToOrg(agentId: string, status: number) {
		return fetch.get<null>(genRequestUrl(RequestUrl.publishBotToOrg, { agentId }, { status }))
	},

	/** 机器人注册并添加好友 */
	registerAndAddFriend(agentVersionId: string) {
		return fetch.post<Bot.AddFriend>(
			genRequestUrl(RequestUrl.registerAndAddFriend, {
				agentVersionId,
			}),
		)
	},

	/** 获取机器人详情 */
	getBotDetail(agentId: string) {
		return fetch.get<Bot.Detail>(genRequestUrl(RequestUrl.getBotDetail, { agentId }))
	},

	/** 获取机器人版本详情 */
	getBotVersionDetail(agentVersionId: string) {
		return fetch.post<Bot.Detail>(
			genRequestUrl(RequestUrl.getBotVersionDetail, {
				agentVersionId,
			}),
		)
	},

	/** 判断机器人是否修改过 */
	isBotUpdate(agentId: string) {
		return fetch.get<boolean>(genRequestUrl(RequestUrl.isBotUpdate, { agentId }))
	},

	/** 获取默认图标 */
	getDefaultIcon() {
		return fetch.get<Bot.DefaultIcon>(genRequestUrl(RequestUrl.getDefaultIcon))
	},

	/** 保存交互指令 */
	saveInstruct(params: Bot.SaveInstructParams) {
		return fetch.post<QuickInstructionList[]>(
			genRequestUrl(RequestUrl.saveInstruct, { agentId: params.bot_id }),
			params,
		)
	},

	/** 获取交互指令类型 */
	getInstructTypeOption() {
		return fetch.get<RespondInstructType>(genRequestUrl(RequestUrl.getInstructTypeOption))
	},

	/** 获取交互指令组类型 */
	getInstructGroupTypeOption() {
		return fetch.get<RespondInstructType>(genRequestUrl(RequestUrl.getInstructGroupTypeOption))
	},

	/** 获取交互指令状态类型icon */
	getInstructStatusIcons() {
		return fetch.get<StatusIconKey[]>(genRequestUrl(RequestUrl.getInstructStatusIcons))
	},

	/** 获取交互指令状态类型颜色组 */
	getInstructStatusColors() {
		return fetch.get<RespondInstructType>(genRequestUrl(RequestUrl.getInstructStatusColors))
	},

	/** 获取系统交互指令 */
	getSystemInstruct() {
		return fetch.get<SystemInstructMap>(genRequestUrl(RequestUrl.getSystemInstruct))
	},

	/** 获取已配置过的第三方平台 */
	getThirdPartyPlatforms(botId: string) {
		return fetch.get<WithPage<Bot.ThirdPartyPlatform[]>>(
			genRequestUrl(
				RequestUrl.getThirdPartyPlatforms,
				{ botId },
				{
					page: 1,
					page_size: 10,
				},
			),
		)
	},
})
