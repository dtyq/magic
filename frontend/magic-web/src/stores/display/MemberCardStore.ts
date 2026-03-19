import { DomClassName } from "@/constants/dom"
import userInfoStore from "@/stores/userInfo"
import type { StructureUserItem } from "@/types/organization"
import { makeAutoObservable } from "mobx"
import userInfoService from "@/services/userInfo"

/**
 * 成员卡片
 */
class MemberCardStore {
	/**
	 * 是否悬停
	 */
	isHover = false

	/**
	 * 是否打开
	 */
	open = false

	/**
	 * 卡片大小
	 */
	size: { width: number; height: number } = { width: 320, height: 500 }

	/**
	 * 卡片外边距
	 */
	marginSize: number = 10

	/**
	 * 卡片位置
	 */
	position: { x: number; y: number } = { x: 0, y: 0 }

	/**
	 * 用户ID
	 */
	uid: string | null = null

	/**
	 * 用户信息
	 */
	userInfo: StructureUserItem | undefined = undefined

	/**
	 * 卡片类名
	 */
	domClassName = DomClassName.MEMBER_CARD

	/**
	 * 卡片动画
	 */
	animationDuration = 100

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 设置用户信息
	 * @param userInfo 用户信息
	 */
	setUserInfo(userInfo: StructureUserItem | undefined) {
		this.userInfo = userInfo
	}

	/**
	 * 打开卡片
	 * @param uid 用户ID
	 * @param position 卡片位置
	 */
	openCard(uid: string, position: { x: number; y: number }) {
		this.open = true
		this.setPosition(position)
		this.uid = uid

		// 调整位置
		this.adjustPosition()

		// 获取用户信息
		this.setUserInfo(userInfoStore.get(uid))

		// 更新用户信息
		userInfoService.fetchUserInfos([uid], 2).then(() => {
			this.setUserInfo(userInfoStore.get(uid))
		})
	}

	/**
	 * 关闭卡片
	 */
	closeCard(force = false) {
		if (this.isHover && !force) return
		this.open = false
		this.isHover = false
		// 延迟重置位置，等待动画完成
		setTimeout(() => {
			this.position = { x: 0, y: 0 }
			this.uid = null
			this.setUserInfo(undefined)
		}, this.animationDuration)
	}

	/**
	 * 设置卡片位置
	 * @param position 卡片位置
	 */
	setPosition(position: { x: number; y: number }) {
		this.position.x = position.x + 10
		this.position.y = position.y + 10
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

	/**
	 * 从元素获取用户ID
	 * @param element 元素
	 * @returns 用户ID
	 */
	getUidFromElement(element: HTMLElement) {
		return element.getAttribute("data-user-id")
	}

	/**
	 * 设置是否悬停
	 * @param isHover 是否悬停
	 */
	setIsHover(isHover: boolean) {
		this.isHover = isHover
	}
}

export default new MemberCardStore()
