import { cloneDeep } from "lodash-es"
import fontConfig from "./fontSchema.json"
import type { FontUsages } from "./types"
import { isSmallViewport } from "@/utils/devices"
export const DefaultFontScale = (() => {
	const min = 0.8
	const max = 1.2
	const value = window.innerWidth / 375

	return Math.round(Math.min(Math.max(value, min), max) * 100) / 100
})()

// 字体配置生成函数 - 直接从JSON文件读取
const genFontUsages = (scaleRatio: number = DefaultFontScale): FontUsages => {
	const fontConfigClone = cloneDeep(fontConfig)
	try {
		if (isSmallViewport()) {
			document.documentElement.style.setProperty("--scale-radio", scaleRatio.toString())
			Object.keys(fontConfigClone.response).forEach((key) => {
				const k = key as keyof typeof fontConfigClone.response
				const value = Number(fontConfigClone.response[k].replace("px", ""))
				if (isNaN(value)) return
				fontConfigClone.response[k] = `${(value * scaleRatio).toFixed(2)}px`
			})
		}
		return fontConfigClone as FontUsages
	} catch (error) {
		console.error(error)
		return fontConfigClone as FontUsages
	}
}

// 导出字体配置生成函数供外部使用
export { genFontUsages }
