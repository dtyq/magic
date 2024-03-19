import { useLayoutEffect, useState } from "react"
import { getNativePort } from "@/opensource/platform/native"
import type { NativeSafeArea } from "@/opensource/platform/native/contracts/types"
import { useDeepCompareEffect } from "ahooks"
import { logger as Logger } from "@/opensource/utils/log"

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
		safeAreaInsetTop: "var(--safe-area-inset-top, env(safe-area-inset-top))",
		safeAreaInsetBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom))",
		safeAreaInsetLeft: "var(--safe-area-inset-left, env(safe-area-inset-left))",
		safeAreaInsetRight: "var(--safe-area-inset-right, env(safe-area-inset-right))",
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
				setMagicSafeAreaTokens({
					appEnv: true,
					safeAreaInsetTop: `${safeAreaInsetTop / dpi || 0}px`,
					safeAreaInsetBottom: `${safeAreaInsetBottom / dpi || 0}px`,
					safeAreaInsetLeft: `${safeAreaInsetLeft / dpi || 0}px`,
					safeAreaInsetRight: `${safeAreaInsetRight / dpi || 0}px`,
				})
			})
			.catch((error: any) => {
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
