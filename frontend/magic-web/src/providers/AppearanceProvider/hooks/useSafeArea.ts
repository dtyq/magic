import { useLayoutEffect, useState } from "react"
import { getNativePort } from "@/platform/native"
import type { NativeSafeArea } from "@/platform/native/contracts/types"
import {
	getNativeSafeAreaInsetValue,
	safeAreaFallbackTokens,
	syncSafeAreaCssVars,
} from "@/utils/safeArea"
import { useDeepCompareEffect } from "ahooks"
import { logger as Logger } from "@/utils/log"

interface SafeAreaTokens {
	appEnv: boolean
	safeAreaInsetTop: string
	safeAreaInsetBottom: string
	safeAreaInsetLeft: string
	safeAreaInsetRight: string
}

const logger = Logger.createLogger("useSafeArea")

const admPopupBodyPositionBottomStyleId = "magic-custom-adm-popup-body-position-bottom"

export function useSafeArea(): SafeAreaTokens {
	const [magicSafeTokens, setMagicSafeAreaTokens] = useState<SafeAreaTokens>({
		appEnv: false,
		...safeAreaFallbackTokens,
	})

	/**
	 * 设置弹窗底部安全区域样式
	 */
	useDeepCompareEffect(() => {
		const admSafeAreaStylesContent = `
			.adm-popup-body-position-bottom {
				padding-bottom: ${magicSafeTokens.safeAreaInsetBottom};
			}
		`
		const styleElement = document.getElementById(admPopupBodyPositionBottomStyleId)
		if (styleElement) {
			styleElement.innerHTML = admSafeAreaStylesContent
		} else {
			const newStyleElement = document.createElement("style")
			newStyleElement.id = admPopupBodyPositionBottomStyleId
			newStyleElement.innerHTML = admSafeAreaStylesContent
			document.head.appendChild(newStyleElement)
		}
	}, [magicSafeTokens])

	useLayoutEffect(() => {
		getNativePort()
			.ui.getSafeArea()
			.then((response: NativeSafeArea) => {
				logger.report({
					namespace: "useSafeArea:getSafeArea",
					data: {
						response,
						typeofResponse: typeof response,
					},
				})
				const {
					dpi = 1,
					safeAreaInsetTop = 0,
					safeAreaInsetBottom = 0,
					safeAreaInsetLeft = 0,
					safeAreaInsetRight = 0,
				} = response
				const nextSafeAreaTokens = {
					appEnv: true,
					safeAreaInsetTop: getNativeSafeAreaInsetValue(safeAreaInsetTop, dpi),
					safeAreaInsetBottom: getNativeSafeAreaInsetValue(safeAreaInsetBottom, dpi),
					safeAreaInsetLeft: getNativeSafeAreaInsetValue(safeAreaInsetLeft, dpi),
					safeAreaInsetRight: getNativeSafeAreaInsetValue(safeAreaInsetRight, dpi),
				}
				syncSafeAreaCssVars(nextSafeAreaTokens)
				setMagicSafeAreaTokens(nextSafeAreaTokens)
			})
			.catch((error: unknown) => {
				logger.error({
					namespace: "useSafeArea:getSafeArea",
					data: {
						error,
					},
				})
			})
	}, [])

	return magicSafeTokens
}
