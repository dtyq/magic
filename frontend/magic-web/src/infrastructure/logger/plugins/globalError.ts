import type { LoggerPlugin } from "../types"

export function createGlobalErrorPlugin(): LoggerPlugin {
	return {
		name: "globalError",
		scope: "page",
		setup({ logger, onDispose }) {
			const error = (event: ErrorEvent) =>
				logger.error(
					{
						namespace: "globalError",
						data: {
							eventKey: "global_javascript_error",
							errorKind: "unknown",
							error: event.error,
							message: event.message,
							context: {
								errorInfo: {
									type: "globalError",
									stack:
										event.error instanceof Error
											? event.error.stack
											: undefined,
									error: event.error,
									message: event.message,
									filename: event.filename,
									lineno: event.lineno,
									colno: event.colno,
									timestamp: Date.now(),
								},
							},
						},
					},
					undefined,
					{ captureSource: "global" },
				)
			const rejection = (event: PromiseRejectionEvent) =>
				logger.error(
					{
						namespace: "unhandledRejection",
						data: {
							eventKey: "unhandled_promise_rejection",
							errorKind: "unknown",
							error: event.reason,
							context: {
								errorInfo: { type: "unhandledRejection", timestamp: Date.now() },
							},
						},
					},
					undefined,
					{ captureSource: "global" },
				)
			onDispose(() => {
				window.removeEventListener("error", error)
				window.removeEventListener("unhandledrejection", rejection)
			})
			window.addEventListener("error", error)
			window.addEventListener("unhandledrejection", rejection)
		},
	}
}
