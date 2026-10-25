import { useLayoutEffect, useState } from "react"
import { getNativePort } from "@/platform/native"
import type { NativeSafeArea } from "@/platform/native/contracts/types"
import {
	getNativeSafeAreaInsetValue,
	safeAreaFallbackTokens,
	syncSafeAreaCssVars,
} from "@/utils/safeArea"
import { useDeepCompareEffect } from "ahooks"
import { logger as Logger } from "@/infrastructure/logger"

interface SafeAreaTokens {
	appEnv: boolean
	safeAreaInsetTop: string
	safeAreaInsetBottom: string
	safeAreaInsetLeft: string
	safeAreaInsetRight: string
}

const logger = Logger.createLogger("useSafeArea")

export function useSafeArea(): SafeAreaTokens {
	const [magicSafeTokens, setMagicSafeAreaTokens] = useState<SafeAreaTokens>({
		appEnv: false,
		...safeAreaFallbackTokens,
	})

	// Apply the Tailwind rule at document scope because popups can render in portals.
	useDeepCompareEffect(() => {
		const root = document.documentElement
		root.classList.add(
			"[&_.adm-popup-body-position-bottom]:pb-[var(--magic-popup-safe-area-bottom)]",
		)
		// Preserve an explicit native zero instead of falling back to the device inset.
		root.style.setProperty(
			"--magic-popup-safe-area-bottom",
			magicSafeTokens.safeAreaInsetBottom,
		)
		// Keep the shared rule available when another useSafeArea consumer unmounts.
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
					eventKey: "get_safe_area_failed",
					errorKind: "unknown",
					error,
					message: "Failed to get native safe area",
				})
			})
	}, [])

	return magicSafeTokens
}
