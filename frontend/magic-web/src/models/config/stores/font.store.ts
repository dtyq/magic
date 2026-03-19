import { DefaultFontScale } from "@/providers/ThemeProvider/font"
import { makeAutoObservable } from "mobx"

/**
 * @description 字体配置Store，负责字体相关的内存状态管理
 */
export class FontStore {
	// 字体大小缩放比例，默认1.0（无缩放）
	fontScale: number = DefaultFontScale

	constructor() {
		makeAutoObservable(this)
	}

	/**
	 * @description 设置字体缩放比例
	 */
	setFontScale(scale: number) {
		this.fontScale = scale
	}
}

export const fontStore = new FontStore()
