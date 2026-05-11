import { appStore } from "@/stores/app"
import { logger } from "@/utils/log"
import { withTimeout } from "@/utils/promise"

const waitLogger = logger.createLogger("waitPublicConfigInit")

const DEFAULT_TIMEOUT_MS = 15000

async function waitForAppInitPromise(
	promise: Promise<void> | null,
	{
		timeoutMs = DEFAULT_TIMEOUT_MS,
		timeoutLabel,
		missingPromiseLog,
		timeoutWarnLog,
		errorWarnLog,
	}: {
		timeoutMs?: number
		timeoutLabel: string
		missingPromiseLog: string
		timeoutWarnLog: string
		errorWarnLog: string
	},
) {
	if (!promise) {
		if (appStore.isInitialing) {
			waitLogger.log(missingPromiseLog)
		}
		return
	}

	await withTimeout(promise, timeoutMs, timeoutLabel).catch((err: unknown) => {
		const message = err instanceof Error ? err.message : String(err)
		if (message.includes(timeoutLabel)) {
			waitLogger.warn(timeoutWarnLog, { timeoutMs })
			return
		}
		waitLogger.warn(errorWarnLog, err)
	})
}

/**
 * Waits only until locale persistence and i18n language sync are ready.
 *
 * No-op when `languageReadyPromise` is null (tests or very early callers). If that
 * happens while the app is still initializing, logs once at info for diagnostics.
 */
export async function waitForLanguageReady(options?: { timeoutMs?: number }) {
	await waitForAppInitPromise(appStore.languageReadyPromise, {
		timeoutMs: options?.timeoutMs,
		timeoutLabel: "waitForLanguageReady timeout",
		missingPromiseLog:
			"languageReadyPromise missing during app init; skip wait (locale header may be stale)",
		timeoutWarnLog: "language ready wait timed out",
		errorWarnLog: "language ready failed before featured request",
	})
}

/**
 * Waits for AppService `initializePublicConfiguration` (settings + global i18n bundles +
 * ConfigService.init / persisted locale). Inner `configService.init` uses a 10s timeout;
 * this outer wait covers the full pipeline, so default is 15s.
 *
 * No-op when `publicConfigInitPromise` is null (tests or very early callers). If that
 * happens while the app is still initializing, logs once at info for diagnostics.
 */
export async function waitForPublicConfigInit(options?: { timeoutMs?: number }) {
	await waitForAppInitPromise(appStore.publicConfigInitPromise, {
		timeoutMs: options?.timeoutMs,
		timeoutLabel: "waitForPublicConfigInit timeout",
		missingPromiseLog:
			"publicConfigInitPromise missing during app init; skip wait (locale header may be stale)",
		timeoutWarnLog: "public config init wait timed out",
		errorWarnLog: "public config init failed before featured request",
	})
}
