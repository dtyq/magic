import {
	BusinessResponseCode,
	HttpStatusCode,
} from "@/infrastructure/network/http/clients/magicResponse"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"

export type RestartSandboxErrorType =
	"notFound" | "permissionDenied" | "busy" | "network" | "unknown"

interface ErrorShape {
	code?: unknown
	data?: unknown
	message?: unknown
	name?: unknown
	response?: unknown
	status?: unknown
}

function asErrorShape(value: unknown): ErrorShape | undefined {
	return value && typeof value === "object" ? (value as ErrorShape) : undefined
}

function getErrorShapes(error: unknown): ErrorShape[] {
	if (typeof error === "string") return [{ message: error }]

	const root = asErrorShape(error)
	if (!root) return []

	const shapes = [root]
	const response = asErrorShape(root.response)
	if (response) {
		shapes.push(response)
		const responseData = asErrorShape(response.data)
		if (responseData) shapes.push(responseData)
	}

	const data = asErrorShape(root.data)
	if (data) shapes.push(data)

	return shapes
}

function getNumericField(shapes: ErrorShape[], field: "code" | "status"): number | undefined {
	for (const shape of shapes) {
		const value = shape[field]
		if (typeof value === "number" && Number.isFinite(value)) return value
		if (typeof value === "string" && value.trim() !== "") {
			const parsed = Number(value)
			if (Number.isFinite(parsed)) return parsed
		}
	}

	return undefined
}

function getMessage(shapes: ErrorShape[]): string {
	return (
		shapes
			.map((shape) => shape.message)
			.find(
				(message): message is string =>
					typeof message === "string" && message.trim() !== "",
			)
			?.trim()
			.toLowerCase() ?? ""
	)
}

function isNetworkError(shapes: ErrorShape[]): boolean {
	const name = shapes.find((shape) => typeof shape.name === "string")?.name
	if (typeof name === "string" && ["AbortError", "NetworkError", "TimeoutError"].includes(name))
		return true

	const message = getMessage(shapes)
	return /failed to fetch|network error|network request failed|timeout|timed out|load failed/.test(
		message,
	)
}

export function classifyRestartSandboxError(error: unknown): RestartSandboxErrorType {
	const shapes = getErrorShapes(error)
	const code = getNumericField(shapes, "code")
	const status = getNumericField(shapes, "status")

	// 先按后端错误码和 HTTP 状态判断，只有旧路径未返回稳定错误码时才读取错误消息。
	// 消息仅用于分类，不直接展示，避免把内部异常内容暴露给用户。
	if (
		code === SuperMagicApiErrorCode.TopicNotFound ||
		code === SuperMagicApiErrorCode.SandboxNotFound
	) {
		return "notFound"
	}

	if (
		code === SuperMagicApiErrorCode.TopicAccessDenied ||
		code === HttpStatusCode.Unauthorized ||
		code === HttpStatusCode.Forbidden ||
		code === BusinessResponseCode.PlatformUnauthorized ||
		status === HttpStatusCode.Unauthorized ||
		status === HttpStatusCode.Forbidden
	) {
		return "permissionDenied"
	}

	if (
		code === SuperMagicApiErrorCode.TopicOperationBusy ||
		status === HttpStatusCode.Conflict ||
		status === HttpStatusCode.TooManyRequests
	) {
		return "busy"
	}

	if (isNetworkError(shapes)) return "network"

	const message = getMessage(shapes)
	if (
		/topic[\s_.-]*(not[\s_.-]*)?(found|exist)|sandbox[\s_.-]*(not[\s_.-]*)?(found|exist)/.test(
			message,
		)
	) {
		return "notFound"
	}
	if (/access[\s_-]*denied|permission[\s_-]*denied|unauthorized|forbidden/.test(message)) {
		return "permissionDenied"
	}
	if (/already running|in progress|busy|concurrent|lock|too many requests/.test(message)) {
		return "busy"
	}

	return "unknown"
}
