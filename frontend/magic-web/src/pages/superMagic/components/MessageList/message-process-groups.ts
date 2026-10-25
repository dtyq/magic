import { isRenderableToolCall } from "./components/Nodes/MessageNode/tool-call/types"
import { TaskStatus } from "../../pages/Workspace/types"
import type { SuperMagicMessageItem } from "./type"
import type { VirtualMessageItem, VirtualMessageRowItem } from "./virtual-message-items"

export interface ProcessNode {
	role?: string
	task_id?: string
	content?: string
	reasoning_content?: string
	tool_calls?: unknown[]
	status?: string
	event?: string
	tool?: { name?: string; status?: string }
}
export interface MessageProcessGroup {
	key: string
	endIndex: number
	answerIndex: number | null
	status: TaskStatus.FINISHED | TaskStatus.SUSPENDED | TaskStatus.ERROR
	retainedContentMode: "answer" | "full"
	processIndices: ReadonlySet<number>
}

/**
 * 中断／失败保留最后进展，不把阶段性正文当成最终交付。
 * 例：3 次工具调用后中断，保留最近正文；没有正文则保留最近工具卡。
 * 普通工具的失败只结束该步骤，不能据此折叠仍在执行的任务。
 */
function buildStoppedProcessGroup(
	messages: ReadonlyArray<SuperMagicMessageItem>,
	taskId: string,
	indices: ReadonlyArray<number>,
	resolveNode: (message: SuperMagicMessageItem) => ProcessNode,
	visibleSourceIndices: ReadonlySet<number>,
): MessageProcessGroup | undefined {
	const endIndex = indices[indices.length - 1]
	const end = resolveNode(messages[endIndex])
	if (end.status !== TaskStatus.SUSPENDED && end.status !== TaskStatus.ERROR) return
	if (
		end.role !== "assistant" &&
		end.event !== "agent_suspended" &&
		end.tool?.name !== "finish_task"
	)
		return
	const hasVisibleTools = (node: ProcessNode) =>
		node.tool_calls?.some(
			(call) => isRenderableToolCall(call) && call.function.name !== "run_sdk_snippet",
		)
	const assistantIndices = indices.filter(
		(index) =>
			visibleSourceIndices.has(index) && resolveNode(messages[index]).role === "assistant",
	)
	const contentIndex = [...assistantIndices]
		.reverse()
		.find((index) => resolveNode(messages[index]).content?.trim())
	const toolIndex = [...assistantIndices]
		.reverse()
		.find((index) => hasVisibleTools(resolveNode(messages[index])))
	const answerIndex = contentIndex ?? toolIndex ?? null
	const retainedContentMode = contentIndex === undefined ? "full" : "answer"
	const processIndices = new Set(
		indices.filter((index) => {
			if (!visibleSourceIndices.has(index)) return false
			const node = resolveNode(messages[index])
			if (index === answerIndex)
				return (
					retainedContentMode === "answer" &&
					Boolean(node.reasoning_content?.trim() || hasVisibleTools(node))
				)
			// 终止记录的原因和状态继续由原卡片展示，不藏进执行过程。
			return index !== endIndex && (node.role === "assistant" || node.role === "tool")
		}),
	)
	if (!processIndices.size) return
	return {
		key: `${taskId}:${String(messages[endIndex].super_message_id || messages[endIndex].app_message_id)}`,
		endIndex,
		answerIndex,
		status: end.status,
		retainedContentMode,
		processIndices,
	}
}

/**
 * 成功的 finish_task 是折叠边界，用户消息不是任务边界（Ask User 可跨多条用户消息）。
 * 缺少开头、task_id、最终正文或仍在逐字显示时保留全文，不能把阶段性回复当作交付。
 */
export function buildMessageProcessGroups(
	messages: ReadonlyArray<SuperMagicMessageItem>,
	resolveNode: (message: SuperMagicMessageItem) => ProcessNode,
	isRendering: (message: SuperMagicMessageItem) => boolean,
	visibleSourceIndices: ReadonlySet<number>,
): MessageProcessGroup[] {
	const tasks = new Map<string, { indices: number[]; hasUser: boolean }>()
	let previousUserIndex = -1
	messages.forEach((message, index) => {
		if (message.role === "user") previousUserIndex = index
		const node = resolveNode(message)
		if (!node.task_id) return
		let task = tasks.get(node.task_id)
		if (!task) {
			task = { indices: [], hasUser: previousUserIndex >= 0 }
			tasks.set(node.task_id, task)
		}
		task.indices.push(index)
	})
	const groups: MessageProcessGroup[] = []
	for (const [taskId, task] of tasks) {
		if (!task.hasUser) continue
		if (task.indices.some((index) => isRendering(messages[index]))) continue
		const stoppedGroup = buildStoppedProcessGroup(
			messages,
			taskId,
			task.indices,
			resolveNode,
			visibleSourceIndices,
		)
		if (stoppedGroup) {
			groups.push(stoppedGroup)
			continue
		}
		const finishIndex = task.indices[task.indices.length - 1]
		const finish = resolveNode(messages[finishIndex])
		// 等待回答时也会发送 tool.status=finished 的收尾消息；只有节点任务状态
		// finished 才表示整轮成功，不能把 waiting_for_user 当作折叠边界。
		if (
			finish.role !== "tool" ||
			finish.tool?.name !== "finish_task" ||
			finish.status !== TaskStatus.FINISHED ||
			finish.tool.status !== TaskStatus.FINISHED
		)
			continue
		if (
			task.indices.some((index) => {
				const node = resolveNode(messages[index])
				// 同任务可经过多次等待再完成；仅放行明确的等待收尾记录，
				// 较早的成功终态或未知收尾仍保留完整展示，避免混合不同执行阶段。
				return (
					(index !== finishIndex &&
						node.tool?.name === "finish_task" &&
						(node.role !== "tool" ||
							node.tool.status !== TaskStatus.FINISHED ||
							node.status !== TaskStatus.WAITING_FOR_USER)) ||
					node.status === TaskStatus.ERROR ||
					node.status === TaskStatus.SUSPENDED ||
					isRendering(messages[index])
				)
			})
		)
			continue
		const answerIndex = [...task.indices]
			.reverse()
			.find((index) => resolveNode(messages[index]).role === "assistant")
		if (answerIndex === undefined || !resolveNode(messages[answerIndex]).content?.trim())
			continue
		const processIndices = new Set(
			task.indices.filter((index) => {
				const node = resolveNode(messages[index])
				if (
					!visibleSourceIndices.has(index) ||
					index === finishIndex ||
					node.role === "user"
				)
					return false
				if (index === answerIndex)
					return Boolean(
						node.reasoning_content?.trim() ||
						node.tool_calls?.some(
							(call) =>
								isRenderableToolCall(call) &&
								call.function.name !== "run_sdk_snippet",
						),
					)
				return node.role === "assistant" || node.role === "tool"
			}),
		)
		if (!processIndices.size) continue
		groups.push({
			key: `${taskId}:${String(messages[finishIndex].super_message_id || messages[finishIndex].app_message_id)}`,
			endIndex: finishIndex,
			answerIndex,
			status: TaskStatus.FINISHED,
			retainedContentMode: "answer",
			processIndices,
		})
	}
	return groups
}

/** 原始 sourceIndex 和正文状态标识不变；展开的过程仍是一条消息一个虚拟行。 */
export function projectMessageProcesses(
	items: ReadonlyArray<VirtualMessageRowItem>,
	groups: ReadonlyArray<MessageProcessGroup>,
	isExpanded: (key: string) => boolean,
	messages: ReadonlyArray<SuperMagicMessageItem>,
): VirtualMessageItem[] {
	const membership = new Map<number, MessageProcessGroup>()
	const visibleSourceIndices = new Set(items.map((item) => item.sourceIndex))
	for (const group of groups) {
		for (const index of group.processIndices) membership.set(index, group)
		if (group.answerIndex !== null) membership.set(group.answerIndex, group)
	}
	const inserted = new Set<string>()
	const result: VirtualMessageItem[] = []
	for (const item of items) {
		const group = membership.get(item.sourceIndex)
		if (!group) {
			result.push(item)
			continue
		}
		const expanded = isExpanded(group.key)
		const isFirstProcessRow = !inserted.has(group.key)
		if (!inserted.has(group.key)) {
			inserted.add(group.key)
			const showHeader = messages[item.sourceIndex - 1]?.role === "user"
			result.push({
				kind: "process-toggle",
				key: `process:${group.key}`,
				groupKey: group.key,
				status: group.status,
				showStatus: !visibleSourceIndices.has(group.endIndex),
				hasRetainedContent: group.answerIndex !== null,
				index: result.length,
				sourceIndex: item.sourceIndex,
				turnKey: item.turnKey,
				count: group.processIndices.size,
				expanded,
				showHeader,
				sendTime: typeof item.node.send_time === "number" ? item.node.send_time : undefined,
				role: "assistant",
				isUser: false,
				isTool: false,
				stickyCandidate: false,
				renderMode: "message",
				exportSelectable: false,
			})
		}
		if (item.sourceIndex === group.answerIndex) {
			if (expanded && group.processIndices.has(item.sourceIndex))
				result.push({
					...item,
					key: `${item.key}:process`,
					viewStateKey: item.key,
					contentMode: "process",
					suppressHeader: isFirstProcessRow,
				})
			result.push({
				...item,
				contentMode: group.retainedContentMode,
				suppressHeader: isFirstProcessRow,
			})
		} else if (expanded) {
			result.push({ ...item, suppressHeader: isFirstProcessRow })
		}
	}
	return result.map((item, index) => (item.index === index ? item : { ...item, index }))
}
