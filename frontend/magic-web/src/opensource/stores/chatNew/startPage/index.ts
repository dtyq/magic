import { makeAutoObservable, observable } from "mobx"
import ConversationBotDataService from "@/opensource/services/chat/conversation/ConversationBotDataService"

class StartPageStore {
	/* AI助理启动页Map */
	StartPageMap = observable.map<string, boolean>()
	/** 初始化时是否隐藏 */
	private isHiddenWhenInit: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	closeStartPage() {
		// 如果当前助理的启动页存在，则关闭启动页
		if (
			ConversationBotDataService.agentId &&
			this.StartPageMap.get(ConversationBotDataService.agentId)
		) {
			this.StartPageMap.set(ConversationBotDataService.agentId, false)
		}
	}

	openStartPage() {
		if (ConversationBotDataService.agentId) {
			this.StartPageMap.set(ConversationBotDataService.agentId, true)
		}
	}

	updateStartPageMap(key: string, value: boolean) {
		this.StartPageMap.set(key, value)
	}

	setIsHiddenWhenInit(value: boolean) {
		this.isHiddenWhenInit = value
	}

	initStartPage(key: string) {
		if (this.isHiddenWhenInit) {
			this.StartPageMap.set(key, false)
			this.setIsHiddenWhenInit(false)
		} else {
			this.StartPageMap.set(key, true)
		}
	}
}

const startPageStore = new StartPageStore()

export default startPageStore
