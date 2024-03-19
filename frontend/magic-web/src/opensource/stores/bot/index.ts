import type { StatusIconKey } from "@/opensource/pages/flow/components/QuickInstructionButton/StatusIcons"
import type {
	Bot,
	QuickInstructionList,
	RespondInstructType,
	SystemInstructMap,
	WithPage,
} from "@/opensource/types/bot"
import type { DefaultOptionType } from "antd/es/select"
import { makeAutoObservable, runInAction } from "mobx"
import { BotApi } from "@/opensource/apis"

export class BotStore {
	publishList: Bot.BotVersion[] = []

	defaultIcon: Bot.DefaultIcon = {
		icons: {
			bot: "",
			flow: "",
			tool_set: "",
			mcp: "",
		},
	}

	instructList: QuickInstructionList[] = []

	instructOption: DefaultOptionType[] = []

	instructGroupOption: RespondInstructType = {}

	instructStatusColors: RespondInstructType = {}

	instructStatusIcons: StatusIconKey[] = []

	systemInstructList: SystemInstructMap = {} as SystemInstructMap

	// Data fetching states
	marketBotList: WithPage<Bot.BotItem[]> | null = null
	marketBotListLoading = false

	orgBotList: WithPage<Bot.OrgBotItem[]> | null = null
	orgBotListLoading = false
	orgBotListParams: Bot.GetUserBotListParams | null = null

	userBotList: WithPage<Bot.BotItem[]> | null = null
	userBotListLoading = false
	userBotListParams: Bot.GetUserBotListParams | null = null

	botDetailCache: Map<string, Bot.Detail> = new Map()
	botDetailLoading: Map<string, boolean> = new Map()

	botUpdateCache: Map<string, boolean> = new Map()
	botUpdateLoading: Map<string, boolean> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	// Data fetching methods
	fetchMarketBotList = async () => {
		if (this.marketBotListLoading) return
		this.marketBotListLoading = true
		try {
			const data = await BotApi.getMarketBotList()
			runInAction(() => {
				this.marketBotList = data
				this.marketBotListLoading = false
			})
		} catch (error) {
			runInAction(() => {
				this.marketBotListLoading = false
			})
			throw error
		}
	}

	fetchOrgBotList = async (params: Bot.GetUserBotListParams) => {
		if (this.orgBotListLoading) return
		this.orgBotListLoading = true
		this.orgBotListParams = params
		try {
			const data = await BotApi.getOrgBotList(params)
			runInAction(() => {
				this.orgBotList = data
				this.orgBotListLoading = false
			})
		} catch (error) {
			runInAction(() => {
				this.orgBotListLoading = false
			})
			throw error
		}
	}

	fetchUserBotList = async (params: Bot.GetUserBotListParams) => {
		if (this.userBotListLoading) return
		this.userBotListLoading = true
		this.userBotListParams = params
		try {
			const data = await BotApi.getUserBotList(params)
			runInAction(() => {
				this.userBotList = data
				this.userBotListLoading = false
			})
		} catch (error) {
			runInAction(() => {
				this.userBotListLoading = false
			})
			throw error
		}
	}

	fetchBotDetail = async (id: string) => {
		if (this.botDetailLoading.get(id)) return
		this.botDetailLoading.set(id, true)
		try {
			const data = await BotApi.getBotDetail(id)
			runInAction(() => {
				this.botDetailCache.set(id, data)
				this.botDetailLoading.set(id, false)
			})
		} catch (error) {
			runInAction(() => {
				this.botDetailLoading.set(id, false)
			})
			throw error
		}
	}

	fetchIsBotUpdate = async (id: string) => {
		if (this.botUpdateLoading.get(id)) return
		this.botUpdateLoading.set(id, true)
		try {
			const data = await BotApi.isBotUpdate(id)
			runInAction(() => {
				this.botUpdateCache.set(id, data)
				this.botUpdateLoading.set(id, false)
			})
		} catch (error) {
			runInAction(() => {
				this.botUpdateLoading.set(id, false)
			})
			throw error
		}
	}

	// Convenience getters
	getBotDetail(id: string): Bot.Detail | undefined {
		return this.botDetailCache.get(id)
	}

	getIsBotUpdate(id: string): boolean | undefined {
		return this.botUpdateCache.get(id)
	}

	isBotDetailLoading(id: string): boolean {
		return this.botDetailLoading.get(id) ?? false
	}

	isBotUpdateLoading(id: string): boolean {
		return this.botUpdateLoading.get(id) ?? false
	}

	// Update methods (renamed from update* to set*)
	setDefaultIcon = (data: Bot.DefaultIcon) => {
		this.defaultIcon = data
	}

	setPublishList = (bot: Bot.BotVersion[]) => {
		this.publishList = bot
	}

	setInstructList = (list: QuickInstructionList[]) => {
		this.instructList = list
	}

	setInstructOption = (data: DefaultOptionType[]) => {
		this.instructOption = data
	}

	setInstructGroupOption = (data: RespondInstructType) => {
		this.instructGroupOption = data
	}

	setInstructStatusColors = (data: RespondInstructType) => {
		this.instructStatusColors = data
	}

	setInstructStatusIcons = (data: StatusIconKey[]) => {
		this.instructStatusIcons = data
	}

	setSystemInstructList = (data: SystemInstructMap) => {
		this.systemInstructList = data
	}
}

export const botStore = new BotStore()
