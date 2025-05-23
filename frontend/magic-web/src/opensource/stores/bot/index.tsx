import type { StatusIconKey } from "@/opensource/pages/flow/components/QuickInstructionButton/const"
import { RequestUrl } from "@/opensource/apis/constant"
import type {
	Bot,
	QuickInstructionList,
	RespondInstructType,
	SystemInstructMap,
	WithPage,
} from "@/types/bot"
import type { DefaultOptionType } from "antd/es/select"
import type { SWRResponse } from "swr"
import useSWR from "swr"
import useSWRImmutable from "swr/immutable"
import { create } from "zustand"
import { BotApi } from "@/apis"

interface BotStore {
	publishList: Bot.BotVersion[]
	defaultIcon: Bot.DefaultIcon
	instructList: QuickInstructionList[]
	instructOption: DefaultOptionType[]
	instructGroupOption: RespondInstructType
	instructStatusColors: RespondInstructType
	instructStatusIcons: StatusIconKey[]
	systemInstructList: SystemInstructMap
	useMarketBotList: () => SWRResponse<WithPage<Bot.BotItem[]>>
	useBotDetail: (id: string) => SWRResponse<Bot.Detail>
	useOrgBotList: (params: Bot.GetUserBotListParams) => SWRResponse<WithPage<Bot.OrgBotItem[]>>
	useUserBotList: (params: Bot.GetUserBotListParams) => SWRResponse<WithPage<Bot.BotItem[]>>
	useIsBotUpdate: (id: string) => SWRResponse<boolean>
	useDefaultIcon: () => SWRResponse<Bot.DefaultIcon>
	updatePublishList: (bot: Bot.BotVersion[]) => void
	updateInstructList: (list: QuickInstructionList[]) => void
	updateInstructOption: (data: DefaultOptionType[]) => void
	updateInstructGroupOption: (data: RespondInstructType) => void
	updateInstructStatusColors: (data: RespondInstructType) => void
	updateInstructStatusIcons: (data: StatusIconKey[]) => void
	updateSystemInstructList: (data: SystemInstructMap) => void
}

export const useBotStore = create<BotStore>((set) => ({
	publishList: [],
	instructList: [],
	instructOption: [],
	instructGroupOption: {},
	instructStatusColors: {},
	instructStatusIcons: [],
	systemInstructList: {} as SystemInstructMap,
	useMarketBotList: () => {
		return useSWR(RequestUrl.getMarketBotList, () => BotApi.getMarketBotList())
	},

	useOrgBotList: ({ page, pageSize, keyword }: Bot.GetUserBotListParams) => {
		return useSWR(RequestUrl.getOrgBotList, () =>
			BotApi.getOrgBotList({
				page,
				pageSize,
				keyword,
			}),
		)
	},

	useUserBotList: ({ page, pageSize, keyword }: Bot.GetUserBotListParams) => {
		return useSWR(RequestUrl.getUserBotList, () =>
			BotApi.getUserBotList({
				page,
				pageSize,
				keyword,
			}),
		)
	},

	useBotDetail: (id: string) => {
		return useSWR(RequestUrl.getBotDetail, () => BotApi.getBotDetail(id))
	},

	useIsBotUpdate: (id: string) => {
		return useSWR(RequestUrl.isBotUpdate, () => BotApi.isBotUpdate(id))
	},

	defaultIcon: {
		icons: {
			bot: "",
			flow: "",
			tool_set: "",
			mcp: "",
		},
	},
	useDefaultIcon: () => {
		return useSWRImmutable(RequestUrl.getDefaultIcon, () => BotApi.getDefaultIcon(), {
			onSuccess(d: Bot.DefaultIcon) {
				set({ defaultIcon: d })
			},
		})
	},
	updatePublishList: (bot: Bot.BotVersion[]) => {
		set({ publishList: bot })
	},
	updateInstructList: (list: QuickInstructionList[]) => {
		set({ instructList: list })
	},
	updateInstructOption: (data: DefaultOptionType[]) => {
		set(() => ({
			instructOption: data,
		}))
	},
	updateInstructGroupOption: (data: RespondInstructType) => {
		set(() => ({
			instructGroupOption: data,
		}))
	},
	updateInstructStatusIcons: (data: StatusIconKey[]) => {
		set(() => ({
			instructStatusIcons: data,
		}))
	},
	updateInstructStatusColors: (data: RespondInstructType) => {
		set(() => ({
			instructStatusColors: data,
		}))
	},
	updateSystemInstructList: (list: SystemInstructMap) => {
		set({ systemInstructList: list })
	},
}))
