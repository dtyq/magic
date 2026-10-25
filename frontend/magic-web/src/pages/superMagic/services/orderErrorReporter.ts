import { StringUtils } from "@/apis/utils"
import { logger as Logger } from "@/infrastructure/logger"

const logger = Logger.createLogger("sidebar-order")

export function createOrderRequestOptions() {
	const requestId = StringUtils.createRequestId()
	return {
		requestId,
		options: {
			headers: (headers: Headers) => {
				headers.set("request-id", requestId)
				return headers
			},
		},
	}
}

/** Reports a failed ordering request with the exact request identity and payload. */
export function reportOrderApiError({
	endpoint,
	params,
	requestId,
	error,
}: {
	endpoint: string
	params: Record<string, unknown>
	requestId: string
	error: unknown
}) {
	logger.error({
		namespace: "sidebar_order_api_error",
		data: {
			endpoint,
			params,
			"request-id": requestId,
			error: error instanceof Error ? { name: error.name, message: error.message } : error,
		},
	})
}
