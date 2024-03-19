import type { ColorScales, ColorUsages } from "@/common/utils/palettes"
import { merge } from "lodash"
import type { ThemeAppearance } from "./utils"

// antd4 主题配置类型
export interface AntdToken {
	colorPrimary: string
	colorPrimaryActive: string
	colorPrimaryHover: string
	colorBgContainer: string
	colorLink: string
	colorLinkHover: string
	colorLinkActive: string
	colorBorder: string
	colorText: string
	colorTextSecondary: string
	colorTextTertiary: string
	colorTextQuaternary: string
	colorTextDisabled: string
	colorBgElevated: string
	[key: string]: any
}

// antd4 组件主题配置类型
export interface ComponentsToken {
	[key: string]: any
}

export const genTokenMap = (
	colorScales: ColorScales,
	colorUsages: ColorUsages,
	themeAppearance: ThemeAppearance = "light",
): AntdToken => {
	switch (themeAppearance) {
		case "dark":
			return {
				colorPrimary: colorUsages.primary.default,
				colorPrimaryActive: colorUsages.primaryLight.default,
				colorPrimaryHover: colorUsages.primaryLight.hover,
				colorBgContainer: colorScales.grey[1],
				colorLink: colorUsages.primaryLight.active,
				colorLinkHover: colorUsages.primaryLight.hover,
				colorLinkActive: colorUsages.primaryLight.default,
				colorBorder: colorUsages.border,
				colorText: colorScales.grey[9],
				colorTextSecondary: colorScales.grey[8],
				colorTextTertiary: colorScales.grey[7],
				colorTextQuaternary: colorScales.grey[6],
				colorTextDisabled: colorScales.grey[5],
				colorBgElevated: colorUsages.bg[2],
				// 添加自定义主题变量
				magicColorScales: colorScales,
				magicColorUsages: colorUsages,
				titleBarHeight: 44,
			}
		case "auto":
			const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
			return genTokenMap(colorScales, colorUsages, isDarkMode ? "dark" : "light")
		case "light":
		default:
			return {
				colorPrimary: colorUsages.primary.default,
				colorPrimaryActive: colorUsages.primary.active,
				colorPrimaryHover: colorUsages.primary.hover,
				colorBgContainer: colorUsages.white,
				colorLink: colorUsages.primary.default,
				colorLinkHover: colorUsages.primary.hover,
				colorLinkActive: colorUsages.primary.active,
				colorBorder: colorUsages.border,
				colorText: colorUsages.text[0],
				colorTextSecondary: colorUsages.text[1],
				colorTextTertiary: colorUsages.text[2],
				colorTextQuaternary: colorUsages.text[3],
				colorTextDisabled: colorScales.grey[5],
				colorBgElevated: colorUsages.bg[2],
				// 添加自定义主题变量
				magicColorScales: colorScales,
				magicColorUsages: colorUsages,
				titleBarHeight: 44,
			}
	}
}

const commonComponentsToken: Partial<ComponentsToken> = {
	Collapse: {
		motionDurationMid: "0.05s",
		motionDurationSlow: "0.1s",
	},
}

export const genComponentTokenMap = (
	colorScales: ColorScales,
	colorUsages: ColorUsages,
	themeAppearance: ThemeAppearance = "light",
): Partial<ComponentsToken> => {
	switch (themeAppearance) {
		case "dark":
			return merge({}, commonComponentsToken, {
				Table: {
					colorBgContainer: "transparent",
					headerBg: "transparent",
					rowHoverBg: colorScales.grey[8],
					cellPaddingBlock: 16,
					cellPaddingInline: 12,
					headerSplitColor: "transparent",
					lineHeight: 1,
				},
				Button: {
					defaultBg: colorScales.grey[8],
					defaultHoverBg: colorScales.grey[7],
					defaultColor: colorUsages.primaryLight.active,
				},
			})
		case "auto":
			const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
			return genComponentTokenMap(colorScales, colorUsages, isDarkMode ? "dark" : "light")
		case "light":
		default:
			return merge({}, commonComponentsToken, {
				Table: {
					headerBg: colorUsages.white,
					cellPaddingBlock: 16,
					cellPaddingInline: 12,
					headerSplitColor: "transparent",
					lineHeight: 1,
				},
				Button: {
					defaultBg: colorUsages.fill[0],
					defaultHoverBg: colorUsages.fill[1],
					defaultColor: colorUsages.primary.default,
				},
			})
	}
}
