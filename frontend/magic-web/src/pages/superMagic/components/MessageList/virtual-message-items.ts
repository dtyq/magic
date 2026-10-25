import type { SuperMagicMessageItem } from "./type"
import type { TaskStatus } from "../../pages/Workspace/types"
import { getMessageNodeKey } from "./helpers"
import { canRenderFinalAttachments, canToolMessageRender } from "./message-render-contract"
import {
	buildMessageKeysAndTurnGroups,
	isToolRoleMessage,
	isUserRoleMessage,
	type MessageTurnGroup,
} from "./message-turn-groups"

export interface VirtualMessageRowItem {
	kind: "message"
	contentMode?: "full" | "answer" | "process"
	viewStateKey?: string
	suppressHeader?: boolean
	key: string
	node: SuperMagicMessageItem
	/** Position in the composed virtual sequence. */
	index: number
	/** Position in the source converted-message array used by the existing renderer. */
	sourceIndex: number
	role: SuperMagicMessageItem["role"]
	turnKey: string
	isUser: boolean
	isTool: boolean
	stickyCandidate: boolean
	renderMode: "message" | "revoked-editable" | "revoked-preview"
	exportSelectable: boolean
}

export interface VirtualProcessToggleItem {
	kind: "process-toggle"
	key: string
	index: number
	sourceIndex: number
	turnKey: string
	groupKey: string
	status: TaskStatus.FINISHED | TaskStatus.SUSPENDED | TaskStatus.ERROR
	showStatus: boolean
	hasRetainedContent: boolean
	count: number
	expanded: boolean
	showHeader: boolean
	sendTime?: number
	role: "assistant"
	isUser: false
	isTool: false
	stickyCandidate: false
	renderMode: "message"
	exportSelectable: false
}
export type VirtualMessageItem = VirtualMessageRowItem | VirtualProcessToggleItem

export interface VirtualMessageProjection {
	items: Array<VirtualMessageRowItem>
	messageKeys: Array<string>
	messageTurnGroups: Array<MessageTurnGroup>
	userIndices: Array<number>
}

function areShallowRecordsEqual(left: Record<string, unknown>, right: Record<string, unknown>) {
	if (left === right) return true
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)
	if (leftKeys.length !== rightKeys.length) return false
	return leftKeys.every((key) => Object.is(left[key], right[key]))
}

/**
 * Reuses unchanged rows after a projection pass rebuilt its outer array. The comparison stays
 * shallow so large message payloads are not deep-cloned or deep-compared in a render path.
 */
export function stabilizeVirtualMessageItems(
	previousItems: ReadonlyArray<VirtualMessageRowItem>,
	nextItems: Array<VirtualMessageRowItem>,
): Array<VirtualMessageRowItem> {
	if (previousItems.length === 0 || nextItems.length === 0) return nextItems

	const previousByIdentity = new Map(
		previousItems.map((item) => [`${item.key}\u0000${item.sourceIndex}`, item]),
	)
	let reusedAny = false
	const stableItems = nextItems.map((item) => {
		const previous = previousByIdentity.get(`${item.key}\u0000${item.sourceIndex}`)
		if (
			previous?.kind === "message" &&
			item.kind === "message" &&
			previous.contentMode === item.contentMode &&
			previous.suppressHeader === item.suppressHeader &&
			previous.role === item.role &&
			previous.turnKey === item.turnKey &&
			previous.isUser === item.isUser &&
			previous.isTool === item.isTool &&
			previous.stickyCandidate === item.stickyCandidate &&
			previous.renderMode === item.renderMode &&
			previous.exportSelectable === item.exportSelectable &&
			areShallowRecordsEqual(
				previous.node as unknown as Record<string, unknown>,
				item.node as unknown as Record<string, unknown>,
			)
		) {
			reusedAny = true
			return previous
		}
		return item
	})

	return reusedAny ? stableItems : nextItems
}

/**
 * Detects an inverse-pagination update without relying on raw page counts. The previous
 * projection must remain a contiguous sequence after a positive offset; a concurrent tail
 * append is valid, while middle inserts, replacements, and filtered/reordered updates are not.
 */
export function getPrependedVirtualItemCount(
	previousItems: ReadonlyArray<Pick<VirtualMessageItem, "key">>,
	nextItems: ReadonlyArray<Pick<VirtualMessageItem, "key">>,
) {
	if (previousItems.length === 0 || nextItems.length <= previousItems.length) return 0

	for (let offset = 1; offset <= nextItems.length - previousItems.length; offset += 1) {
		let matchesPreviousSequence = true
		for (let index = 0; index < previousItems.length; index += 1) {
			if (nextItems[offset + index]?.key !== previousItems[index]?.key) {
				matchesPreviousSequence = false
				break
			}
		}
		if (matchesPreviousSequence) return offset
	}
	return 0
}

function hasRenderableMessageValue(value: unknown) {
	if (value == null) return false
	if (typeof value === "string") return value.trim().length > 0
	if (Array.isArray(value)) return value.length > 0
	if (typeof value === "object") return Object.keys(value).length > 0
	return true
}

const terminalMessageStatuses = new Set([
	"completed",
	"finished",
	"failed",
	"error",
	"suspended",
	"response_missing",
])

function hasTerminalMessageStatus(node: SuperMagicMessageItem) {
	const debug = node?.debug as Record<string, unknown> | undefined
	const tool = node?.tool as Record<string, unknown> | undefined
	const debugTool = debug?.tool as Record<string, unknown> | undefined
	return [node?.status, debug?.status, tool?.status, debugTool?.status].some(
		(status) => typeof status === "string" && terminalMessageStatuses.has(status),
	)
}

const taskLifecycleToolNames = new Set(["finish_task"])

function isTaskLifecycleToolMessage(node: SuperMagicMessageItem) {
	const debug = node?.debug as Record<string, unknown> | undefined
	const tool = node?.tool as Record<string, unknown> | undefined
	const debugTool = debug?.tool as Record<string, unknown> | undefined
	return [tool?.name, tool?.tool_name, debugTool?.name, debugTool?.tool_name].some(
		(name) => typeof name === "string" && taskLifecycleToolNames.has(name),
	)
}

/**
 * A message may render through Store-backed business sidecars even when its streaming payload
 * is empty. Ordinary tool responses are different: their visible branch is AttachmentSection,
 * while tool-call cards are rendered from the Assistant's tool_calls. Keeping one merely because
 * it reached a terminal status would project an empty measured row.
 */
function shouldIncludeVirtualMessage(
	node: SuperMagicMessageItem,
	previousNode?: SuperMagicMessageItem,
) {
	if (node?.role === "user") return true
	const payloads = [node?.content, node?.reasoning_content, node?.tool_calls]
	const debug = node?.debug as Record<string, unknown> | undefined
	const tool = node?.tool as Record<string, unknown> | undefined
	const debugTool = debug?.tool as Record<string, unknown> | undefined
	const attachmentPayloads = [
		node?.attachments,
		debug?.attachments,
		tool?.attachments,
		debugTool?.attachments,
	]

	if (isToolRoleMessage(node)) {
		// finish_task projects the task lifecycle rather than a tool result, and it is the row that
		// carries the terminal status badge plus the follow-up suggestions. A conversational turn
		// ends with an attachment-free, content-free finish_task, so payload emptiness must not
		// drop it. Rows that reach here before their terminal status still render as a measured
		// placeholder instead of an empty gap.
		if (isTaskLifecycleToolMessage(node)) return true
		// A Tool's own payload is deliberately excluded: MessageNode renders AttachmentSection
		// and nothing else for this role, so text-only results would project an empty row.
		return canToolMessageRender({
			node: node as unknown as Record<string, unknown>,
			fallbackNode: node,
			previousContent: previousNode?.content,
		})
	}

	if (payloads.some(hasRenderableMessageValue)) return true

	// Assistant sidecar UI can be rendered from fields outside the streaming payload trio.
	// Terminal status is retained here because the Store may fill the final Assistant projection
	// after the historical message enters the list.
	return (
		(canRenderFinalAttachments(node) && attachmentPayloads.some(hasRenderableMessageValue)) ||
		hasTerminalMessageStatus(node)
	)
}

/**
 * Builds the shared data projection for both the virtual DOM and turn-based export logic.
 * Keeping both products in one pass prevents DOM virtualization from changing business ownership.
 */
export function buildVirtualMessageProjection(
	messages: Array<SuperMagicMessageItem>,
	/** Messages folded into an earlier card (see folded-tool-runs); they get no row. */
	hiddenSourceIndices?: ReadonlySet<number>,
): VirtualMessageProjection {
	const { messageKeys, messageTurnGroups } = buildMessageKeysAndTurnGroups(messages)
	const userIndices: Array<number> = []
	const items: Array<VirtualMessageRowItem> = []
	let currentTurnKey = "leading-messages"

	messages.forEach((node, sourceIndex) => {
		const key = getMessageNodeKey(node) || `${node?.role || "message"}-${sourceIndex}`
		const isUser = isUserRoleMessage(node)
		const isTool = isToolRoleMessage(node)

		if (isUser) {
			currentTurnKey = `turn-${key}`
		}
		// AttachmentSection reads file-path mentions from the message before this one, and the
		// renderer resolves that neighbour the same way (`messages[sourceIndex - 1]`).
		if (
			hiddenSourceIndices?.has(sourceIndex) ||
			!shouldIncludeVirtualMessage(node, messages[sourceIndex - 1])
		) {
			return
		}

		items.push({
			kind: "message",
			key,
			node,
			index: items.length,
			sourceIndex,
			role: node?.role,
			turnKey: currentTurnKey,
			isUser,
			isTool,
			stickyCandidate: isUser,
			renderMode: "message",
			exportSelectable: currentTurnKey !== "leading-messages",
		})
		if (isUser) userIndices.push(items.length - 1)
	})

	return { items, messageKeys, messageTurnGroups, userIndices }
}

interface ComposeVirtualMessageItemsOptions {
	normalItems: ReadonlyArray<VirtualMessageItem>
	revokedItems: ReadonlyArray<VirtualMessageRowItem>
	firstRevokedUserKey?: string | null
	includeRevoked: boolean
	showOnlyFirstRevoked?: boolean
	revokedPreviewExpanded: boolean
	collapsedPreviewLimit: number
}

/**
 * Reindexes normal and revoked sections into one TanStack list. Collapsing changes only the
 * projected revoked preview rows; canonical revoked messages remain available to expand again.
 */
export function composeVirtualMessageItems({
	normalItems,
	revokedItems,
	firstRevokedUserKey,
	includeRevoked,
	showOnlyFirstRevoked = false,
	revokedPreviewExpanded,
	collapsedPreviewLimit,
}: ComposeVirtualMessageItemsOptions): {
	items: Array<VirtualMessageItem>
	userIndices: Array<number>
} {
	// Normal projections already use message mode. Reusing those objects prevents an unrelated
	// revoked-preview toggle from invalidating every visible normal row.
	const composed: Array<VirtualMessageItem> = normalItems.map((item) =>
		item.renderMode === "message" ? item : { ...item, renderMode: "message" },
	)

	if (includeRevoked) {
		const editableItem = firstRevokedUserKey
			? revokedItems.find((item) => item.key === firstRevokedUserKey)
			: undefined
		const previewItems = revokedItems.filter((item) => item.key !== firstRevokedUserKey)
		const visiblePreviewItems = showOnlyFirstRevoked
			? []
			: revokedPreviewExpanded
				? previewItems
				: previewItems.slice(0, collapsedPreviewLimit)

		if (editableItem) {
			composed.push({
				...editableItem,
				turnKey: `revoked-${editableItem.turnKey}`,
				renderMode: "revoked-editable",
				exportSelectable: false,
			})
		}
		for (const item of visiblePreviewItems) {
			composed.push({
				...item,
				turnKey: `revoked-${item.turnKey}`,
				renderMode: "revoked-preview",
				exportSelectable: false,
			})
		}
	}

	const userIndices: Array<number> = []
	const items = composed.map((item, index) => {
		if (item.stickyCandidate) userIndices.push(index)
		return item.index === index ? item : { ...item, index }
	})

	return { items, userIndices }
}

/** Binary-searches the ordered User indices without allocating during scroll. */
export function findActiveStickyIndex(
	userIndices: ReadonlyArray<number>,
	visibleStartIndex: number,
): number | undefined {
	let low = 0
	let high = userIndices.length - 1
	let activeIndex: number | undefined

	while (low <= high) {
		const middle = low + Math.floor((high - low) / 2)
		const candidate = userIndices[middle]
		if (candidate <= visibleStartIndex) {
			activeIndex = candidate
			low = middle + 1
		} else {
			high = middle - 1
		}
	}

	return activeIndex
}

/** The User row that will take over from `activeIndex`, used to drive the sticky push-out. */
export function findNextStickyIndex(
	userIndices: ReadonlyArray<number>,
	activeIndex: number,
): number | undefined {
	let low = 0
	let high = userIndices.length - 1
	let nextIndex: number | undefined

	while (low <= high) {
		const middle = low + Math.floor((high - low) / 2)
		const candidate = userIndices[middle]
		if (candidate > activeIndex) {
			nextIndex = candidate
			high = middle - 1
		} else {
			low = middle + 1
		}
	}

	return nextIndex
}
