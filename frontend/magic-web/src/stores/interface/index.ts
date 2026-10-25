import { WebSocketReadyState } from "@/types/websocket"
import { platformKey } from "@/utils/storage"
import { cloneDeep } from "lodash-es"
import { makeAutoObservable } from "mobx"

export type ChatInputHeightMode = "auto" | "manual"

export interface ChatInputHeightPreference {
	mode: ChatInputHeightMode
	height: number
}

const DEFAULT_CHAT_INPUT_HEIGHT = 240
const DEFAULT_CHAT_SIDER_WIDTH = 240

/** Resolve localStorage only in environments where browser persistence is available. */
function getBrowserStorage() {
	try {
		if (typeof window === "undefined") return null
		return window.localStorage ?? null
	} catch {
		return null
	}
}

/** Accept only positive finite heights before restoring layout state. */
function isValidHeight(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
}

export class InterfaceStore {
	readyState: WebSocket["readyState"] = WebSocketReadyState.CLOSED
	isSwitchingOrganization: boolean = false
	isConnecting: boolean = false
	chatPanelSizeKey = platformKey("chatPanel")

	isMobile: boolean = false

	/**
	 * 聊天输入框默认高度
	 */
	chatInputDefaultHeight = DEFAULT_CHAT_INPUT_HEIGHT

	/** Scoped desktop conversation input preferences. */
	chatInputHeightPreferences: Record<string, ChatInputHeightPreference> = {}

	/**
	 * 聊天侧边栏默认宽度
	 */
	chatSiderDefaultWidth = DEFAULT_CHAT_SIDER_WIDTH

	/**
	 * 移动端底部导航栏是否显示
	 */
	mobileTabBarVisible = false

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
		const chatPanelSize = getBrowserStorage()?.getItem(this.chatPanelSizeKey)
		if (chatPanelSize) {
			try {
				const json = JSON.parse(chatPanelSize) as {
					chatInputDefaultHeight?: unknown
					chatInputHeightPreferences?: unknown
					chatSiderDefaultWidth?: unknown
				}
				if (isValidHeight(json.chatInputDefaultHeight)) {
					this.chatInputDefaultHeight = json.chatInputDefaultHeight
				}
				if (isValidHeight(json.chatSiderDefaultWidth)) {
					this.chatSiderDefaultWidth = json.chatSiderDefaultWidth
				}
				if (
					typeof json.chatInputHeightPreferences === "object" &&
					json.chatInputHeightPreferences !== null &&
					!Array.isArray(json.chatInputHeightPreferences)
				) {
					this.chatInputHeightPreferences = json.chatInputHeightPreferences as Record<
						string,
						ChatInputHeightPreference
					>
				}
			} catch {
				// Corrupted local preferences fall back to safe defaults instead of blocking app startup.
			}
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

	/**
	 * 缓存聊天面板大小
	 */
	cacheChatPanelSize() {
		getBrowserStorage()?.setItem(
			this.chatPanelSizeKey,
			JSON.stringify({
				chatInputDefaultHeight: this.chatInputDefaultHeight,
				chatInputHeightPreferences: this.chatInputHeightPreferences,
				chatSiderDefaultWidth: this.chatSiderDefaultWidth,
			}),
		)
	}

	/** Read a scoped preference while using the legacy height as an automatic-mode fallback. */
	getChatInputHeightPreference(scope: string): ChatInputHeightPreference {
		const preference = this.chatInputHeightPreferences[scope]
		if (preference) return preference

		return {
			mode: "auto",
			height: this.chatInputDefaultHeight,
		}
	}

	/** Persist one conversation layout preference without leaking its mode into other scopes. */
	setChatInputHeightPreference(scope: string, preference: ChatInputHeightPreference) {
		if (!scope || !isValidHeight(preference.height)) {
			return
		}

		const height = Math.round(preference.height)
		this.chatInputHeightPreferences = {
			...this.chatInputHeightPreferences,
			[scope]: {
				mode: preference.mode,
				height,
			},
		}
		this.cacheChatPanelSize()
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
