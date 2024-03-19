import { makeAutoObservable, runInAction, action } from "mobx"
import { SIZES as RecordingSummarySIZES } from "@/opensource/components/business/RecordingSummary/constants"
import { getExpandedSize } from "./getExpandedSize"
import { isMobile } from "@/opensource/utils/devices"

/**
 * 浮动面板存储状态接口
 */
interface FloatPanelStorageState {
	pcPosition: { x: number; y: number }
	mobilePosition: { x: number; y: number }
	userPreferredPosition: { x: number; y: number }
	isExpanded: boolean
	expandedAiChat: boolean
}

/**
 * 浮动面板状态管理
 * 负责管理浮动面板的位置、尺寸、展开状态等
 */
class FloatPanelStore {
	/**
	 * 是否展开
	 */
	isExpanded = true

	/**
	 * 组件位置
	 */
	pcPosition: { x: number; y: number } = { x: 0, y: 0 }

	/**
	 * 移动端组件位置
	 */
	mobilePosition: { x: number; y: number } = { x: 0, y: 0 }

	/**
	 * 是否是移动端
	 */
	isMobile = false

	/**
	 * 是否启用进入动画
	 */
	enableEnterAnimation = false

	/**
	 * AI 聊天面板是否展开
	 */
	expandedAiChat = false

	/**
	 * 用户偏好位置（拖动后的位置）
	 */
	private userPreferredPosition: { x: number; y: number } = { x: 0, y: 0 }

	/**
	 * 是否正在拖拽（防止自动调整干扰）
	 */
	private isDragging = false

	/**
	 * 是否正在调整位置（防止循环调整）
	 */
	private isAdjusting = false

	/**
	 * 获取是否正在调整位置状态（只读）
	 */
	get isPositionAdjusting() {
		return this.isAdjusting
	}

	/**
	 * 位置调整防抖定时器
	 */
	private adjustTimer: NodeJS.Timeout | null = null

	/**
	 * localStorage 存储键
	 */
	private storageKey = "float-panel-state"

	/**
	 * 获取用户偏好位置（用于显示）
	 */
	get userPreferredPositionDisplay() {
		return this.userPreferredPosition
	}

	/**
	 * 获取当前状态下的组件尺寸
	 */
	get currentSize() {
		const sizes = this.isMobile ? RecordingSummarySIZES.MOBILE : RecordingSummarySIZES.PC
		if (this.isExpanded) {
			const maxWidth =
				"maxWidth" in sizes.EXPANDED
					? getExpandedSize(sizes.EXPANDED.maxWidth)
					: window.innerWidth

			return {
				width: Math.min(getExpandedSize(sizes.EXPANDED.width), maxWidth),
				height: getExpandedSize(sizes.EXPANDED.height),
			}
		}
		return sizes.COLLAPSED
	}

	/**
	 * 计算展开时的中央位置
	 */
	get expandedCenterBottomPosition() {
		if (typeof window !== "undefined") {
			const sizes = this.isMobile ? RecordingSummarySIZES.MOBILE : RecordingSummarySIZES.PC
			const expandedSize = sizes.EXPANDED
			const margin = sizes.SAFE_MARGIN

			const height = getExpandedSize(expandedSize.height)
			const maxWidth =
				"maxWidth" in expandedSize
					? getExpandedSize(expandedSize.maxWidth)
					: window.innerWidth
			const width = Math.min(getExpandedSize(expandedSize.width), maxWidth)

			return {
				x: Math.max(margin, (window.innerWidth - width) / 2),
				y: window.innerHeight - height,
			}
		}
		return { x: 200, y: 200 } // fallback: 左上区域
	}

	/**
	 * 计算收起时的默认位置（用户偏好位置）
	 */
	get collapsedPosition() {
		return this.userPreferredPosition
	}

	/**
	 * 默认位置计算（初始化时使用）- 底部居中
	 */
	get defaultPosition() {
		if (typeof window !== "undefined") {
			const sizes = this.isMobile ? RecordingSummarySIZES.MOBILE : RecordingSummarySIZES.PC
			const collapsedSize = sizes.COLLAPSED
			const margin = sizes.SAFE_MARGIN

			// 移动端默认位置：右下角
			if (this.isMobile) {
				return {
					x: window.innerWidth - collapsedSize.width, // 贴右边
					y: Math.max(margin, window.innerHeight - collapsedSize.height - 100), // 距离底部100px
				}
			}

			// PC端默认位置：居中底部
			return {
				x: Math.max(margin, (window.innerWidth - collapsedSize.width) / 2), // 水平居中
				y: Math.max(margin, window.innerHeight - collapsedSize.height - margin), // 底部
			}
		}
		return { x: 200, y: 500 } // fallback: 左侧偏下位置
	}

	/**
	 * 检测位置是否超出视窗边界
	 */
	get isPositionOverflowing() {
		if (typeof window === "undefined") {
			return {
				right: false,
				bottom: false,
				left: false,
				top: false,
			}
		}

		const { width, height } = this.currentSize
		const sizes = this.isMobile ? RecordingSummarySIZES.MOBILE : RecordingSummarySIZES.PC
		const margin = sizes.SAFE_MARGIN
		const windowWidth = window.innerWidth
		const windowHeight = window.innerHeight

		// 获取正确的位置（移动端或PC端）
		const position = this.isMobile ? this.mobilePosition : this.pcPosition

		return {
			right: position.x + width > windowWidth - margin,
			bottom: position.y + height > windowHeight - margin,
			left: position.x < margin,
			top: position.y < margin,
		}
	}

	constructor(storageKey = "float-panel-state") {
		this.storageKey = storageKey
		makeAutoObservable(this, {}, { autoBind: true })
		this.loadFromStorage()
		// 初始化默认位置将在设置isMobile后进行
	}

	/**
	 * 从 localStorage 加载状态
	 */
	private loadFromStorage() {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(this.storageKey)
				if (saved) {
					const parsed: FloatPanelStorageState = JSON.parse(saved)
					this.pcPosition = parsed.pcPosition || this.defaultPosition
					this.mobilePosition = parsed.mobilePosition || this.defaultPosition
					this.userPreferredPosition =
						parsed.userPreferredPosition || this.defaultPosition
					this.isExpanded = parsed.isExpanded ?? true
					this.expandedAiChat = isMobile ? false : (parsed.expandedAiChat ?? false)
				}
			} catch (error) {
				console.warn("Failed to load float panel state:", error)
			}
		}
	}

	/**
	 * 保存状态到 localStorage
	 */
	private saveToStorage() {
		if (typeof window !== "undefined") {
			try {
				const state: FloatPanelStorageState = {
					pcPosition: this.pcPosition,
					mobilePosition: this.mobilePosition,
					userPreferredPosition: this.userPreferredPosition,
					isExpanded: this.isExpanded,
					expandedAiChat: this.expandedAiChat,
				}
				localStorage.setItem(this.storageKey, JSON.stringify(state))
			} catch (error) {
				console.warn("Failed to save float panel state:", error)
			}
		}
	}

	/**
	 * 切换展开/收起状态
	 */
	toggleExpanded() {
		if (this.isExpanded) {
			// 收起：回到用户偏好位置
			this.collapseToUserPreferredPosition()
		} else {
			// 展开：移动到中央位置
			this.expandToCenter()
		}
	}

	/**
	 * 设置展开状态
	 */
	setExpanded(expanded: boolean) {
		if (expanded !== this.isExpanded) {
			if (expanded) {
				// 展开：移动到中央位置
				this.expandToCenter()
			} else {
				// 收起：回到用户偏好位置
				this.collapseToUserPreferredPosition()
			}
		}
	}

	/**
	 * 设置进入动画状态
	 */
	setEnterAnimationStatus(enable: boolean) {
		this.enableEnterAnimation = enable
	}

	/**
	 * 收起到用户偏好位置
	 */
	private collapseToUserPreferredPosition() {
		const collapsedPos = this.collapsedPosition
		if (this.isMobile) {
			this.mobilePosition = { ...collapsedPos }
		} else {
			this.pcPosition = { ...collapsedPos }
		}
		this.isExpanded = false
		this.saveToStorage()
		console.log("收起到用户偏好位置:", collapsedPos)
	}

	/**
	 * 展开到中央位置
	 */
	private expandToCenter() {
		const centerPos = this.expandedCenterBottomPosition
		if (this.isMobile) {
			this.mobilePosition = { ...centerPos }
		} else {
			this.pcPosition = { ...centerPos }
		}
		this.isExpanded = true
		this.saveToStorage()
		console.log("展开到中央位置:", centerPos)
		// 展开后稍微调整位置，确保不会溢出
		this.schedulePositionAdjustment(100)
	}

	/**
	 * 计算最佳位置
	 * 根据当前尺寸和溢出情况调整位置
	 */
	private calculateOptimalPosition(targetPosition: { x: number; y: number }) {
		if (typeof window === "undefined") return targetPosition

		const { width, height } = this.currentSize
		const sizes = this.isMobile ? RecordingSummarySIZES.MOBILE : RecordingSummarySIZES.PC
		const margin = sizes.SAFE_MARGIN
		const windowWidth = window.innerWidth
		const windowHeight = window.innerHeight

		let { x, y } = targetPosition

		// 移动端特殊处理：收起状态磁吸到边缘
		if (this.isMobile && !this.isExpanded) {
			// 磁吸逻辑：根据当前位置判断吸附到左边还是右边
			const centerX = windowWidth / 2
			const edgeMargin = 0

			// 判断是否更靠近左边还是右边
			if (x + width / 2 < centerX) {
				// 更靠近左边，吸附到左边
				x = edgeMargin
			} else {
				// 更靠近右边，吸附到右边
				x = windowWidth - width - edgeMargin
			}

			// 垂直边界检查
			if (y + height > windowHeight - margin) {
				y = windowHeight - height - margin
			}
			if (y < margin) {
				y = margin
			}
		} else {
			// PC端或移动端展开状态的正常边界检查
			if (x + width > windowWidth - margin) {
				x = windowWidth - width - margin
			}
			if (x < margin) {
				x = margin
			}

			if (y + height > windowHeight - margin) {
				y = windowHeight - height - margin
			}
			if (y < margin) {
				y = margin
			}
		}

		return { x: Math.max(0, x), y: Math.max(0, y) }
	}

	/**
	 * 设置拖拽状态
	 */
	setDragging = action((dragging: boolean) => {
		this.isDragging = dragging
		if (!dragging) {
			// 拖拽结束后立即进行磁吸调整（移动端）
			if (this.isMobile && !this.isExpanded) {
				const currentPosition = this.mobilePosition
				const adjustedPosition = this.calculateOptimalPosition(currentPosition)

				// 应用磁吸位置
				this.mobilePosition = adjustedPosition
				this.userPreferredPosition = { ...adjustedPosition }
				console.log("移动端磁吸到位置:", adjustedPosition)
				this.saveToStorage()
			} else if (!this.isExpanded) {
				// PC端正常逻辑
				const currentPosition = this.pcPosition
				this.userPreferredPosition = { ...currentPosition }
				console.log("PC端用户偏好位置已更新:", this.userPreferredPosition)
			}

			// 移动端磁吸后不需要额外调整，PC端可能需要
			if (!this.isMobile) {
				this.schedulePositionAdjustment(100)
			}
		}
	})

	/**
	 * 安全地更新定时器（使用 action）
	 */
	private updateAdjustTimer = action((timer: NodeJS.Timeout | null) => {
		this.adjustTimer = timer
	})

	/**
	 * 防抖的位置调整调度
	 */
	schedulePositionAdjustment(delay = 100, isResizeTriggered = false) {
		// 如果正在拖拽，不进行自动调整
		if (this.isDragging) return

		// 清除之前的定时器
		if (this.adjustTimer) {
			clearTimeout(this.adjustTimer)
		}

		// 设置新的定时器
		const timer = setTimeout(() => {
			this.adjustPositionIfOverflowing(isResizeTriggered)
			this.updateAdjustTimer(null)
		}, delay)
		this.updateAdjustTimer(timer)
	}

	/**
	 * 设置调整状态
	 */
	private setAdjusting = action((adjusting: boolean) => {
		this.isAdjusting = adjusting
	})

	/**
	 * 调整计数器，防止死循环
	 */
	private adjustmentCount = 0
	private readonly MAX_ADJUSTMENTS = 3

	/**
	 * 重置调整计数器
	 */
	private resetAdjustmentCount = action(() => {
		this.adjustmentCount = 0
	})

	/**
	 * 智能 resize 处理：保持左右偏好的磁吸
	 */
	private handleMobileResize(currentPosition: { x: number; y: number }) {
		if (typeof window === "undefined") return currentPosition

		const { width, height } = this.currentSize
		const sizes = RecordingSummarySIZES.MOBILE
		const margin = sizes.SAFE_MARGIN
		const windowWidth = window.innerWidth
		const windowHeight = window.innerHeight

		// 保持用户的左右偏好：检查当前是在左边还是右边
		const isOnLeftSide = currentPosition.x <= windowWidth / 4 // 更宽松的左边判断
		const isOnRightSide = currentPosition.x >= (windowWidth * 3) / 4 // 更宽松的右边判断

		let newX = currentPosition.x
		let newY = currentPosition.y

		// 根据当前偏好保持左右位置，但确保不超出边界
		if (isOnLeftSide) {
			// 保持在左边
			newX = 0
		} else if (isOnRightSide) {
			// 保持在右边
			newX = windowWidth - width
		} else {
			// 中间位置，根据距离选择更近的一边
			if (currentPosition.x + width / 2 < windowWidth / 2) {
				newX = 0
			} else {
				newX = windowWidth - width
			}
		}

		// 垂直位置调整
		if (newY + height > windowHeight - margin) {
			newY = windowHeight - height - margin
		}
		if (newY < margin) {
			newY = margin
		}

		return { x: Math.max(0, newX), y: Math.max(0, newY) }
	}

	/**
	 * 自动调整位置以避免溢出
	 */
	adjustPositionIfOverflowing(isResizeTriggered = false) {
		// 拖拽期间或正在调整时不进行重复调整
		if (this.isDragging || this.isAdjusting) return

		// 防止死循环：限制连续调整次数
		if (this.adjustmentCount >= this.MAX_ADJUSTMENTS) {
			console.warn("Position adjustment limit reached, preventing infinite loop")
			// 延迟重置计数器
			setTimeout(() => this.resetAdjustmentCount(), 1000)
			return
		}

		// 设置调整标志，防止循环调用
		this.setAdjusting(true)
		this.adjustmentCount++

		try {
			// 展开状态下保持居中
			if (this.isExpanded) {
				const center = this.expandedCenterBottomPosition
				const currentPosition = this.isMobile ? this.mobilePosition : this.pcPosition
				const deltaXCenter = Math.abs(center.x - currentPosition.x)
				const deltaYCenter = Math.abs(center.y - currentPosition.y)

				if (deltaXCenter > 5 || deltaYCenter > 5) {
					// 增大阈值，减少微调
					// 使用 runInAction 确保原子更新
					runInAction(() => {
						if (this.isMobile) {
							this.mobilePosition = center
						} else {
							this.pcPosition = center
						}
					})
					this.saveToStorage()
					console.log("保持展开居中位置:", center)
				}
				return
			}

			// 收起状态的处理
			const currentPosition = this.isMobile ? this.mobilePosition : this.pcPosition
			let adjustedPosition: { x: number; y: number }

			// 移动端 resize 特殊处理
			if (this.isMobile && isResizeTriggered) {
				// 智能 resize：保持左右偏好的磁吸
				adjustedPosition = this.handleMobileResize(currentPosition)
				console.log("移动端 resize 磁吸调整:", {
					from: currentPosition,
					to: adjustedPosition,
				})
			} else {
				// 常规边界检查
				const overflow = this.isPositionOverflowing
				const hasOverflow =
					overflow.right || overflow.bottom || overflow.left || overflow.top

				if (!hasOverflow) return // 没有溢出就不调整

				adjustedPosition = this.calculateOptimalPosition(currentPosition)
			}

			// 检查位置变化是否足够大，避免微小抖动
			const deltaX = Math.abs(adjustedPosition.x - currentPosition.x)
			const deltaY = Math.abs(adjustedPosition.y - currentPosition.y)

			if (deltaX > 5 || deltaY > 5) {
				// 使用 runInAction 确保原子更新
				runInAction(() => {
					if (this.isMobile) {
						this.mobilePosition = adjustedPosition
					} else {
						this.pcPosition = adjustedPosition
					}
				})
				this.saveToStorage()

				// 更新用户偏好位置（移动端收起状态）
				if (this.isMobile && !this.isExpanded) {
					this.userPreferredPosition = { ...adjustedPosition }
				}

				console.log("Position adjusted:", {
					from: currentPosition,
					to: adjustedPosition,
					reason: isResizeTriggered ? "resize" : "overflow",
				})
			}
		} finally {
			// 确保在任何情况下都重置调整标志
			this.setAdjusting(false)
			// 成功调整后延迟重置计数器
			setTimeout(() => this.resetAdjustmentCount(), 500)
		}
	}

	/**
	 * 更新组件位置
	 * 包含边界检查和溢出处理
	 */
	updatePcPosition(position: { x: number; y: number }, skipAdjustment = false) {
		if (skipAdjustment) {
			// 拖拽过程中直接设置位置，不进行调整，不保存到存储
			this.pcPosition = position
		} else {
			// 非拖拽情况下进行位置调整并保存
			const adjustedPosition = this.calculateOptimalPosition(position)
			this.pcPosition = adjustedPosition
			this.saveToStorage()
		}
	}

	/**
	 * 更新移动端组件位置
	 */
	updateMobilePosition(position: { x: number; y: number }, skipAdjustment = false) {
		if (skipAdjustment) {
			// 拖拽过程中直接设置位置，不进行调整，不保存到存储
			this.mobilePosition = position
		} else {
			// 非拖拽情况下进行位置调整并保存
			const adjustedPosition = this.calculateOptimalPosition(position)
			this.mobilePosition = adjustedPosition
			this.saveToStorage()
		}
	}

	setIsMobile(isMobile: boolean) {
		this.isMobile = isMobile
		// 设置移动端标志后，初始化默认位置
		this.initializePosition()
	}

	/**
	 * 初始化位置
	 */
	initializePosition() {
		const defaultPos = this.defaultPosition
		if (this.isMobile) {
			if (!this.mobilePosition.x && !this.mobilePosition.y) {
				this.mobilePosition = defaultPos
				this.userPreferredPosition = defaultPos
			}
		} else {
			if (!this.pcPosition.x && !this.pcPosition.y) {
				this.pcPosition = defaultPos
				this.userPreferredPosition = defaultPos
			}
		}
	}

	/**
	 * 清理定时器
	 */
	cleanup() {
		if (this.adjustTimer) {
			clearTimeout(this.adjustTimer)
			this.updateAdjustTimer(null)
		}
	}

	/**
	 * 设置 AI 聊天面板展开状态
	 */
	setExpandedAiChat(expanded: boolean) {
		this.expandedAiChat = expanded
		this.saveToStorage()
	}

	/**
	 * 切换 AI 聊天面板展开状态
	 */
	toggleExpandedAiChat() {
		this.expandedAiChat = !this.expandedAiChat
		this.saveToStorage()
	}

	/**
	 * 重置状态
	 */
	reset = action(() => {
		this.cleanup()
		this.isExpanded = true
		const defaultPos = this.defaultPosition

		if (this.isMobile) {
			this.mobilePosition = defaultPos
		} else {
			this.pcPosition = defaultPos
		}

		this.userPreferredPosition = defaultPos
		this.isDragging = false
		this.isAdjusting = false // 重置调整标志
		this.expandedAiChat = false
		this.saveToStorage()
	})

	/**
	 * 更新存储键（用于支持多个实例）
	 */
	updateStorageKey(newKey: string) {
		this.storageKey = newKey
		this.loadFromStorage()
	}

	/**
	 * 手动保存状态（对外接口）
	 */
	save() {
		this.saveToStorage()
	}
}

export default FloatPanelStore
