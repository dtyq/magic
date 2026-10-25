import { ErrorBoundary } from "react-error-boundary"
import { useEffect, useState } from "react"
import type { PropsWithChildren } from "react"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { useCountDown } from "ahooks"
import { logger as Logger } from "@/infrastructure/logger"
import { isDev } from "@/utils/env"
import UpdateBg from "@/assets/resources/defaultImages/update_bg.svg"
import { getNativePort } from "@/platform/native"
import { useMainTranslation } from "@/hooks/i18n/useMainTranslation"
import { Button } from "../shadcn-ui/button"

const logger = Logger.createLogger("errorBoundary")

// Dev-only UI debug switch: append `?debug-global-boundary=1` to force this
// boundary into its fallback page without affecting production behavior.
function shouldDebugGlobalBoundary() {
	if (!isDev) return false
	if (typeof window === "undefined") return false

	return new URLSearchParams(window.location.search).get("debug-global-boundary") === "1"
}

function GlobalBoundaryDebugTrigger() {
	// Throw during render so `react-error-boundary` enters the real fallback flow.
	if (shouldDebugGlobalBoundary()) {
		throw new Error("debug global error boundary")
	}

	return null
}

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			height: 100vh;
			background-color: ${isDarkMode ? "#141414" : "#fff"};
			display: flex;
			align-items: center;
			padding: 0 20px;
		`,
		wrapper: css`
			width: 420px;
			display: flex;
			flex-direction: column;
			align-items: center;
			margin: auto;
			gap: 40px;
		`,
		bg: css``,
		title: css`
			color: ${token.magicColorUsages.text[0]};
			text-align: center;
			font-size: 32px;
			font-style: normal;
			font-weight: 600;
			line-height: 44px; /* 137.5% */
		`,
		desc: css`
			color: ${token.magicColorUsages.text[2]};
			text-align: center;
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */
		`,
		tip: css`
			color: ${token.magicColorUsages.text[2]};
			text-align: center;
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */
		`,
	}
})

/**
 * Check whether the current browser environment is offline.
 * When offline, static asset or chunk load failures should not be treated as a system update.
 */
function isNetworkOffline(): boolean {
	return typeof window !== "undefined" && !window.navigator.onLine
}

const OFFLINE_RELOAD_KEY = "magic:global-error-boundary:offline-reload-at"
const OFFLINE_RELOAD_GUARD_MS = 10_000

/**
 * Allow at most one automatic offline reload within the guard window.
 * If the reloaded document is still served (e.g. from HTTP cache) and the same
 * error happens again, reloading again would loop forever, so the caller shows
 * a manual refresh screen instead. When sessionStorage is unavailable the guard
 * cannot be tracked, so it also falls back to the manual screen.
 */
function claimOfflineReload(): boolean {
	try {
		const now = Date.now()
		const lastReloadAt = Number(window.sessionStorage.getItem(OFFLINE_RELOAD_KEY))
		if (lastReloadAt && now - lastReloadAt < OFFLINE_RELOAD_GUARD_MS) return false
		window.sessionStorage.setItem(OFFLINE_RELOAD_KEY, String(now))
		return true
	} catch {
		return false
	}
}

function GlobalErrorBoundary({ children }: PropsWithChildren) {
	const { t } = useMainTranslation("interface")

	const { styles } = useStyles()
	const [targetDate, setTargetDate] = useState<number>()
	// Set when an offline reload was skipped by the guard; the fallback then
	// shows a manual refresh screen instead of the blank pre-reload state.
	const [offlineReloadBlocked, setOfflineReloadBlocked] = useState(false)

	// While the manual offline screen is shown, reload as soon as the browser reports
	// the network is back so the page can fetch the latest resources (e.g. after a release).
	useEffect(() => {
		if (!offlineReloadBlocked) return
		const handleOnline = () => window.location.reload()
		window.addEventListener("online", handleOnline)
		return () => window.removeEventListener("online", handleOnline)
	}, [offlineReloadBlocked])

	const [countdown] = useCountDown({
		targetDate,
		onEnd: () => {
			if (!isDev) {
				window.location.reload()
			}
		},
	})

	return (
		<ErrorBoundary
			onError={(error, errorInfo) => {
				logger.error({
					eventKey: "app_root_render_failed",
					errorKind: "render",
					error: error,
					message: "Global Error Boundary caught an error:",
					// networkOffline separates offline resource failures from release-related ones in logs.
					context: {
						componentStack: errorInfo.componentStack,
						networkOffline: isNetworkOffline(),
					},
				})

				// If an error occurs while offline (e.g., dynamic chunk loading failure),
				// immediately reload to let the browser navigate and present its native offline page.
				if (isNetworkOffline()) {
					if (claimOfflineReload()) {
						window.location.reload()
					} else {
						setOfflineReloadBlocked(true)
					}
					return
				}

				setTargetDate(Date.now() + 3000)
				getNativePort().environment.webHasNewVersionToUpdate()
			}}
			fallbackRender={() => {
				if (offlineReloadBlocked) {
					// Offline and already reloaded once: no update countdown, only a manual refresh.
					return (
						<div className={styles.container}>
							<div className={styles.wrapper}>
								<Flex vertical align="center" gap={16}>
									<span className={styles.title}>{t("networkTip.offline")}</span>
									<span className={styles.desc}>{t("global.offlineDesc")}</span>
									<Button
										style={{ width: "fit-content" }}
										onClick={() => window.location.reload()}
									>
										{t("global.refresh")}
									</Button>
								</Flex>
							</div>
						</div>
					)
				}

				// Suppress the update fallback screen while offline to prevent UI flickering before reload
				if (isNetworkOffline()) {
					return null
				}

				return (
					<div className={styles.container}>
						<div className={styles.wrapper}>
							<div className={styles.bg}>
								<img src={UpdateBg} alt="" />
							</div>
							<Flex vertical align="center" gap={16}>
								<span className={styles.title}>{t("global.boundaryTitle")}</span>
								<span className={styles.desc}>{t("global.boundaryDesc")}</span>
								<Button
									style={{ width: "fit-content" }}
									onClick={() => window.location.reload()}
								>
									{t("global.refresh")}
								</Button>
								<span className={styles.tip}>
									{t("global.boundaryTip", {
										second: Math.round(countdown / 1000),
									})}
								</span>
							</Flex>
						</div>
					</div>
				)
			}}
		>
			<GlobalBoundaryDebugTrigger />
			{children}
		</ErrorBoundary>
	)
}

export default GlobalErrorBoundary
