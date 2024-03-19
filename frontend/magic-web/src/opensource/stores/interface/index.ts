import { WebSocketReadyState } from "@/opensource/types/websocket"
import { platformKey } from "@/opensource/utils/storage"
import { cloneDeep } from "lodash-es"
import { makeAutoObservable } from "mobx"

class InterfaceStore {
	readyState: WebSocket["readyState"] = WebSocketReadyState.CLOSED
	isSwitchingOrganization: boolean = false
	isConnecting: boolean = false
	showReloadButton: boolean = false
	chatPanelSizeKey = platformKey("chatPanel")

	isMobile: boolean = false

	/**
	 * 聊天输入框默认高度
	 */
	chatInputDefaultHeight = 240

	/**
	 * 聊天侧边栏默认宽度
	 */
	chatSiderDefaultWidth = 240

	/**
	 * 移动端底部导航栏是否显示
	 */
	mobileTabBarVisible = true

	/**
	 * 是否启用全局安全区域
	 */
	enableGlobalSafeArea = {
		top: true,
		bottom: true,
		left: false,
		right: false,
	}

	/**
	 * 全局安全区域样式
	 */
	globalSafeAreaStyle = {
		top: {},
		bottom: {},
		left: {},
		right: {},
	}

	constructor() {
		const chatPanelSize = localStorage.getItem(this.chatPanelSizeKey)
		if (chatPanelSize) {
			const json = JSON.parse(chatPanelSize)
			this.chatInputDefaultHeight = json.chatInputDefaultHeight
			this.chatSiderDefaultWidth = json.chatSiderDefaultWidth
		}

		makeAutoObservable(this, {}, { autoBind: true })
	}

	setReadyState(readyState: WebSocket["readyState"]) {
		this.readyState = readyState
	}

	setIsSwitchingOrganization(isSwitchingOrganization: boolean) {
		this.isSwitchingOrganization = isSwitchingOrganization
	}

	setIsConnecting(isConnecting: boolean) {
		this.isConnecting = isConnecting
	}

	setShowReloadButton(showReloadButton: boolean) {
		this.showReloadButton = showReloadButton
	}

	/**
	 * 缓存聊天面板大小
	 */
	cacheChatPanelSize() {
		localStorage.setItem(
			this.chatPanelSizeKey,
			JSON.stringify({
				chatInputDefaultHeight: this.chatInputDefaultHeight,
				chatSiderDefaultWidth: this.chatSiderDefaultWidth,
			}),
		)
	}

	/**
	 * 设置聊天输入框默认高度
	 */
	setChatInputDefaultHeight(height: number) {
		this.chatInputDefaultHeight = height
		this.cacheChatPanelSize()
	}

	/**
	 * 设置聊天侧边栏默认宽度
	 */
	setChatSiderDefaultWidth(width: number) {
		this.chatSiderDefaultWidth = width
		this.cacheChatPanelSize()
	}

	/**
	 * 设置移动端底部导航栏是否显示
	 * @param visible 是否显示
	 */
	setMobileTabBarVisible(visible: boolean) {
		this.mobileTabBarVisible = visible
	}

	/**
	 * 设置是否为移动端
	 * @param isMobile 是否为移动端
	 */
	setIsMobile(isMobile: boolean) {
		this.isMobile = isMobile
	}

	/**
	 * 设置是否启用全局安全区域
	 * @param enable 是否启用
	 * @deprecated 请在shouldDisableGlobalSafeArea中判断是否启用全局安全区域
	 */
	setEnableGlobalSafeArea(enable: boolean | Partial<typeof this.enableGlobalSafeArea>) {
		const preConfig = cloneDeep(this.enableGlobalSafeArea)
		// console.trace("preConfig", preConfig, enable)
		if (typeof enable === "boolean") {
			this.enableGlobalSafeArea.top = enable
			this.enableGlobalSafeArea.bottom = enable
			this.enableGlobalSafeArea.left = enable
			this.enableGlobalSafeArea.right = enable
		} else {
			Object.assign(this.enableGlobalSafeArea, enable)
		}
		return () => {
			Object.assign(this.enableGlobalSafeArea, preConfig)
		}
	}

	/**
	 * 设置全局安全区域样式
	 * @param style 样式
	 */
	setGlobalSafeAreaStyle(
		direction: keyof typeof this.globalSafeAreaStyle,
		style: React.CSSProperties,
	) {
		const preConfig = cloneDeep(this.globalSafeAreaStyle)

		Object.assign(this.globalSafeAreaStyle, {
			[direction]: style,
		})

		return () => {
			Object.assign(this.globalSafeAreaStyle, preConfig)
		}
	}

	resetGlobalSafeAreaStyle() {
		this.globalSafeAreaStyle = {
			top: {},
			bottom: {},
			left: {},
			right: {},
		}
	}
}

// 创建全局单例
export const interfaceStore = new InterfaceStore()
