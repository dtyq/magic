import { ChatApi } from "@/apis"
import { MessageReceiveListResponse } from "@/apis/modules/chat/types"
import { makeAutoObservable } from "mobx"

export const domClassName = "group-seen-panel"

/**
 * 群组已读面板
 */
class GroupSeenPanelStore {
	/**
	 * 群组已读面板 DOM 类名
	 */
	static domClassName = "group-seen-panel"

	/**
	 * 消息 ID
	 */
	messageId: string | null = null

	/**
	 * 消息接收者列表
	 */
	messageReceiveList: MessageReceiveListResponse | null = null

	/**
	 * 边距大小
	 */
	marginSize: number = 20

	/**
	 * 位置
	 */
	position: { x: number; y: number } = { x: 0, y: 0 }

	/**
	 * 大小
	 */
	size: { width: number; height: number } = { width: 360, height: 300 }

	/**
	 * 是否打开
	 */
	open: boolean = false

	/**
	 * 是否加载中
	 */
	loading: boolean = false

	/**
	 * 是否悬停
	 */
	isHover: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 打开面板
	 * @param messageId 消息 ID
	 */
	openPanel(messageId: string, position: { x: number; y: number }) {
		this.open = true
		this.setPosition(position)

		this.adjustPosition()

		this.messageId = messageId
		this.fetchMessageReceiveList(messageId)
	}

	/**
	 * 获取消息接收者列表
	 * @returns
	 */
	async fetchMessageReceiveList(messageId: string) {
		if (!messageId) {
			return
		}

		this.loading = true
		const messageReceiveList = await ChatApi.getMessageReceiveList(messageId)
		this.messageReceiveList = messageReceiveList
		this.loading = false
	}

	/**
	 * 关闭面板
	 */
	closePanel(force = false) {
		if (this.isHover && !force) return
		this.open = false
		this.messageId = null
		this.messageReceiveList = null
	}

	/**
	 * 设置卡片位置
	 * @param position 卡片位置
	 */
	setPosition(position: { x: number; y: number }) {
		this.position.x = position.x - this.size.width - 20
		this.position.y = position.y
		this.adjustPosition()
	}

	/**
	 * 设置卡片大小
	 * @param size 卡片大小
	 */
	setSize(size: { width: number; height: number }) {
		this.size = size
		// 调整位置
		this.adjustPosition()
	}

	/**
	 * 设置是否悬停
	 * @param isHover 是否悬停
	 */
	setIsHover(isHover: boolean) {
		this.isHover = isHover
	}

	/**
	 * 调整卡片位置
	 */
	adjustPosition() {
		// 调整位置, 防止超出屏幕
		if (typeof window !== "undefined") {
			const windowWidth = window.innerWidth - this.marginSize * 2
			const windowHeight = window.innerHeight - this.marginSize * 2

			// 确保卡片右边界不超出屏幕
			if (this.position.x + this.size.width + this.marginSize > windowWidth) {
				this.position.x = windowWidth - this.size.width - this.marginSize
			}

			// 确保卡片不超出左边界
			if (this.position.x < 0) {
				this.position.x = this.marginSize
			}

			// 确保卡片底部不超出屏幕
			if (this.position.y + this.size.height > windowHeight) {
				this.position.y = windowHeight - this.size.height - this.marginSize
			}

			// 确保卡片不超出顶部边界
			if (this.position.y < 0) {
				this.position.y = this.marginSize
			}
		}
	}
}

export default new GroupSeenPanelStore()
