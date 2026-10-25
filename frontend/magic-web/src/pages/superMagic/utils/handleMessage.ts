import { isEmpty } from "lodash-es"
import { DisabledDetailToolTypes } from "../components/Detail/constants"
import { MessageStatus } from "../pages/Workspace/types"
import { isInlineToolDetail } from "./toolDetailDisplay"

export const messageFilter = (item: any) => {
	if (item?.event === "before_main_agent_run" || item?.event === "before_agent_reply") {
		return true
	}
	if (item?.event === "after_main_agent_run" && item?.attachments?.length === 0) {
		return true
	}
	if (item?.event === "before_tool_call") {
		return true
	}
	if (item?.event === "before_llm_request") {
		return true
	}
	if (item?.event === "after_llm_request" && isEmpty(item?.content) && isEmpty(item?.tool)) {
		return true
	}
	if (!item?.content && /** !item?.[item?.type]?.content && */ isEmpty(item?.tool)) {
		return true
	}
	return false
}

/**
 * @description 过滤出可以点击的工具卡片消息(注意，在调用该方法时如参需要明确参数是否合理，在超麦分享路由下可直接使用 message 原数据，在运行页下需要使用 getMessageNode 来转换)
 * @param node
 */
export const filterClickableMessage = (node: any) => {
	return (
		!messageFilter(node) &&
		!isEmpty(node?.tool?.detail) &&
		!DisabledDetailToolTypes.includes(node?.tool?.name)
	)
}

type ImStatusSource = {
	imStatus?: unknown
	status?: unknown
	[key: string]: unknown
}

function getImStatus(node: ImStatusSource | undefined, message?: ImStatusSource) {
	const explicitImStatus = message?.imStatus ?? node?.imStatus
	if (typeof explicitImStatus === "string") return explicitImStatus

	// Raw SuperMessage nodes predate the split and may still contain a revoked tombstone.
	// Do not treat ordinary node execution states (running/finished/...) as IM visibility.
	return node?.status === MessageStatus.REVOKED ? MessageStatus.REVOKED : undefined
}

// 过滤出可以点击的工具卡片消息，且消息未撤回
export const filterClickableMessageWithoutRevoked = (node: any, message?: ImStatusSource) => {
	return filterClickableMessage(node) && getImStatus(node, message) !== MessageStatus.REVOKED
}

/** 卡片内可展开的结果保留在聊天中，不参与中间详情的自动选择和回放。 */
export const filterPanelMessage = (node: unknown): boolean => {
	if (!filterClickableMessage(node)) return false
	const message = node as { tool: { detail: unknown } }
	return !isInlineToolDetail(message.tool.detail)
}

export const filterPanelMessageWithoutRevoked = (
	node: unknown,
	message?: ImStatusSource,
): boolean => {
	return (
		filterPanelMessage(node) &&
		getImStatus(node as ImStatusSource, message) !== MessageStatus.REVOKED
	)
}

export const filterMessagesWithAttachments = (node: any, message?: ImStatusSource) => {
	return (
		!messageFilter(node) &&
		!DisabledDetailToolTypes.includes(node?.tool?.name) &&
		getImStatus(node, message) !== MessageStatus.REVOKED
	)
}
