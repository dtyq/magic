// src/theme.d.ts
import type { ColorScales, ColorUsages } from "@/common/utils/palettes"

// 扩展 antd 的主题类型
declare module 'antdg-provider/context' {
	export interface Theme {
		token?: CustomToken;
		components?: ComponentsToken;
	}
}

export interface CustomToken {
	/** 顶部菜单栏高度 */
	titleBarHeight?: number
	magicColorScales: ColorScales
	magicColorUsages: ColorUsages
	[key: string]: any
}
