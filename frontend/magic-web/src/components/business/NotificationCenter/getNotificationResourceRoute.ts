import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"
import { fillRoute, getRoutePath } from "@/routes/history/helpers"
import { logger as Logger } from "@/infrastructure/logger"
import type { NotificationItemData } from "./types"

const logger = Logger.createLogger("NotificationRoute")

const RESOURCE_NAME_FIELDS = ["resource_name"]
const PROJECT_NAME_FIELDS = ["resource_name", "project_name"]

function routeValue(value: unknown): string | undefined {
	if (typeof value === "string") {
		const text = value.trim()
		return text && text !== "0" ? text : undefined
	}
	if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value)
	return undefined
}

function resourceTypeValue(payload: Record<string, unknown>): string | undefined {
	const type = routeValue(payload.resource_type)
	return type?.toLowerCase()
}

function buildRoute(name: RouteName, params: Record<string, string>) {
	return getRoutePath({
		name,
		params: Object.fromEntries(
			Object.entries(params).map(([key, value]) => [key, encodeURIComponent(value)]),
		),
	})
}

function isTaskNotification(message: NotificationItemData) {
	const payload = message.payload
	return (
		message.type === "task_finished" ||
		message.type === "task_failed" ||
		message.type.startsWith("task.") ||
		(typeof payload.event_type === "string" && payload.event_type.startsWith("task."))
	)
}

function isShareNotification(message: NotificationItemData) {
	const payload = message.payload
	return (
		message.type === "project_shared" ||
		message.type === "file_shared" ||
		[message.type, payload.event_type].some(
			(value) =>
				typeof value === "string" &&
				(value.startsWith("share.project.") || value.startsWith("share.file.")),
		)
	)
}

function taskTopicRoute(projectId: string, topicId: string) {
	return {
		path: buildRoute(RouteName.SuperWorkspaceProjectTopicState, { projectId, topicId }),
		nameFields: PROJECT_NAME_FIELDS,
	}
}

function projectWorkspaceRoute(payload: Record<string, unknown>, projectId: string) {
	if (payload.project_mode === "magiclaw") {
		const code = routeValue(payload.resource_code)
		if (!code) return undefined
		return {
			path: buildRoute(RouteName.ClawPlayground, { code }),
			nameFields: PROJECT_NAME_FIELDS,
		}
	}
	return {
		path: buildRoute(RouteName.SuperWorkspaceProjectState, { projectId }),
		nameFields: PROJECT_NAME_FIELDS,
	}
}

/** Share access is keyed only by share_code; never share_id or resource_id. */
function shareRoute(shareCode: string) {
	return {
		path: fillRoute(RoutePath.SuperMagicFilesShare, {
			resourceId: encodeURIComponent(shareCode),
		}),
		nameFields: RESOURCE_NAME_FIELDS,
	}
}

function resolveShareRoute(message: NotificationItemData) {
	if (!isShareNotification(message)) return undefined
	const shareCode = routeValue(message.payload.share_code)
	if (!shareCode) return undefined
	return shareRoute(shareCode)
}

function resolveApprovalRoute(message: NotificationItemData) {
	const payload = message.payload
	const resourceType = resourceTypeValue(payload)
	const code = routeValue(payload.resource_code)

	if (message.type === "skill_approved") {
		if (resourceType !== "skill" || !code) return undefined
		return {
			path: buildRoute(RouteName.SkillEdit, { code }),
			nameFields: RESOURCE_NAME_FIELDS,
		}
	}
	if (message.type === "agent_approved") {
		if (resourceType !== "agent" || !code) return undefined
		return {
			path: buildRoute(RouteName.CrewEdit, { id: code }),
			nameFields: RESOURCE_NAME_FIELDS,
		}
	}
	return undefined
}

/** Each notification type owns its jump contract. */
function resolvePathByNotificationType(message: NotificationItemData) {
	const share = resolveShareRoute(message)
	if (share) return share

	const approval = resolveApprovalRoute(message)
	if (approval) return approval

	const payload = message.payload
	const id = routeValue(payload.resource_id)
	const code = routeValue(payload.resource_code)
	const projectId = routeValue(payload.project_id)
	const topicId = routeValue(payload.topic_id)

	switch (message.type) {
		case "task_finished":
		case "task_failed":
			if (projectId && topicId) return taskTopicRoute(projectId, topicId)
			return undefined
		case "skill_invitation":
			if (code) {
				return {
					path: buildRoute(RouteName.SkillEdit, { code }),
					nameFields: RESOURCE_NAME_FIELDS,
				}
			}
			return undefined
		case "agent_invitation":
			if (code) {
				return {
					path: buildRoute(RouteName.CrewConversation, { code }),
					nameFields: RESOURCE_NAME_FIELDS,
				}
			}
			return undefined
		case "micro_app_invitation":
			if (id) {
				return {
					path: buildRoute(RouteName.MicroApp, { appId: id }),
					nameFields: RESOURCE_NAME_FIELDS,
				}
			}
			return undefined
		case "project_invitation":
			if (id) return projectWorkspaceRoute(payload, id)
			return undefined
		case "project_shared":
		case "file_shared":
			return undefined
		default:
			return undefined
	}
}

function resolveLegacyPath(message: NotificationItemData) {
	const share = resolveShareRoute(message)
	if (share) return share

	const payload = message.payload
	const projectId = routeValue(payload.project_id)
	const topicId = routeValue(payload.topic_id)

	if (isTaskNotification(message) && projectId && topicId) {
		return taskTopicRoute(projectId, topicId)
	}
	return undefined
}

export function getNotificationResourceRoute(message: NotificationItemData) {
	// Only an accepted, still-valid invitation grants entry. Revocation notices
	// describe lost access and must never offer a link back to the resource.
	if (
		message.message_status === "withdrawn" ||
		message.type.endsWith("_access_revoked") ||
		((message.category === "auth" || message.type.endsWith("_invitation")) &&
			(message.auth_status !== "accepted" || message.business_result === "expired"))
	) {
		return undefined
	}
	const resolved = resolvePathByNotificationType(message) ?? resolveLegacyPath(message)
	if (!resolved) {
		logger.warn({
			eventKey: "inbox_route_unavailable",
			message: "Notification resource is missing required route parameters",
			context: { notificationId: message.id, type: message.type },
		})
		return undefined
	}
	return resolved
}
