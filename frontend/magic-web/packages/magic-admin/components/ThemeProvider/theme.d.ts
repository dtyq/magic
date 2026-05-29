// src/theme.d.ts
import "antd-style"
import "antd/es/theme/interface"
import type { ColorScales, ColorUsages } from "./palettes"

export interface CustomToken {
	/** 顶部菜单栏高度 */
	titleBarHeight?: number
	magicColorScales: ColorScales
	magicColorUsages: ColorUsages
}

// 通过声明合并扩展 antd-style 的 `token` 类型
declare module "antd/es/theme/interface" {
	export interface AliasToken extends CustomToken {}
}
