import { makeAutoObservable } from "mobx"

class AiCompletionTip {
	/** 是否显示 */
	visible: boolean = false
	/** 位置 */
	position: { top: number; left: number } = { top: -100, left: -100 }

	marginSize: number = 0

	size: { width: number; height: number } = { width: 70, height: 20 }

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	tip: string = ""

	/**
	 * 显示
	 * @param position 位置
	 */
	show(position: { top: number; left: number }) {
		this.position = position
		this.visible = true
		this.adjustPosition()
	}

	adjustPosition() {
		// 调整位置, 防止超出屏幕
		if (typeof window !== "undefined") {
			const windowWidth = window.innerWidth - this.marginSize * 2
			const windowHeight = window.innerHeight - this.marginSize * 2

			// 确保卡片右边界不超出屏幕
			if (this.position.top + this.size.height + this.marginSize > windowHeight) {
				this.position.top = windowHeight - this.size.height - this.marginSize
			}

			// 确保卡片不超出左边界
			if (this.position.top < 0) {
				this.position.top = this.marginSize
			}

			// 确保卡片底部不超出屏幕
			if (this.position.left + this.size.width + this.marginSize > windowWidth) {
				this.position.left = windowWidth - this.size.width - this.marginSize
			}

			// 确保卡片不超出顶部边界
			if (this.position.left < 0) {
				this.position.left = this.marginSize
			}
		}
	}

	/**
	 * 隐藏
	 */
	hide() {
		this.visible = false
		this.position = { top: -100, left: -100 }
	}
}

export default new AiCompletionTip()
