import type { TiptapJSONContent } from "../iframe-api/types"

export interface MicroAppMessageContext {
	microAppId?: string
	microAppName?: string
}

function isMicroAppMention(node: TiptapJSONContent, appId: string): boolean {
	if (node.type !== "mention") return false

	const attrs = node.attrs
	if (!attrs || attrs["type"] !== "micro_app") return false

	const data = attrs["data"]
	return Boolean(
		data && typeof data === "object" && (data as Record<string, unknown>)["app_id"] === appId,
	)
}

function containsMicroAppMention(node: TiptapJSONContent, appId: string): boolean {
	if (isMicroAppMention(node, appId)) return true
	return node.content?.some((child) => containsMicroAppMention(child, appId)) ?? false
}

function removeUntrustedMicroAppMentions(
	node: TiptapJSONContent,
	appId: string,
	appName: string,
): TiptapJSONContent | null {
	if (node.type === "mention" && node.attrs?.["type"] === "micro_app") {
		if (!isMicroAppMention(node, appId)) return null
		return {
			...node,
			attrs: {
				type: "micro_app",
				data: { app_id: appId, app_name: appName },
			},
		}
	}

	if (!node.content) return node

	let changed = false
	const content = node.content.flatMap((child) => {
		const nextChild = removeUntrustedMicroAppMentions(child, appId, appName)
		if (nextChild !== child) changed = true
		return nextChild ? [nextChild] : []
	})

	return changed ? { ...node, content } : node
}

/**
 * Add the trusted micro-app mention used by the server to resolve the source
 * project. The iframe only supplies message content; identity comes from the
 * host preview context.
 */
export function prependMicroAppMention(
	content: TiptapJSONContent,
	context?: MicroAppMessageContext,
): TiptapJSONContent {
	const appId = context?.microAppId?.trim()
	if (!appId) return content
	const appName = context?.microAppName?.trim() || appId

	const sanitizedContent = removeUntrustedMicroAppMentions(content, appId, appName) ?? {
		type: "doc",
		content: [],
	}
	if (containsMicroAppMention(sanitizedContent, appId)) return sanitizedContent

	const mention: TiptapJSONContent = {
		type: "mention",
		attrs: {
			type: "micro_app",
			data: {
				app_id: appId,
				app_name: appName,
			},
		},
	}

	const children = sanitizedContent.content ?? []
	const paragraphIndex = children.findIndex((child) => child.type === "paragraph")
	if (paragraphIndex >= 0) {
		const paragraph = children[paragraphIndex]
		return {
			...sanitizedContent,
			content: children.map((child, index) =>
				index === paragraphIndex
					? { ...paragraph, content: [mention, ...(paragraph.content ?? [])] }
					: child,
			),
		}
	}

	return {
		...sanitizedContent,
		content: [{ type: "paragraph", content: [mention] }, ...children],
	}
}
