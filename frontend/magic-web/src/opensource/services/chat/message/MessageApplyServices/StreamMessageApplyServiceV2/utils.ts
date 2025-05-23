import {
	AggregateAISearchCardContentV2,
	AggregateAISearchCardV2Status,
} from "@/types/chat/conversation_message"

/**
 * 向对象特定路径追加值
 * @param object 目标对象
 * @param keyPath 键路径数组
 * @param appendValue 要追加的值
 * @returns 更新后的对象
 */
export function appendObject(
	object: Record<string, any> | null | undefined,
	keyPath: string[],
	appendValue: any,
) {
	if (!object || !keyPath || keyPath.length === 0) {
		return object
	}

	let current = object

	// 遍历路径直到倒数第二个键
	for (let i = 0; i < keyPath.length - 1; i++) {
		const key = keyPath[i]
		// 如果当前键不存在或为null，则初始化为对象或数组
		if (current[key] === undefined || current[key] === null) {
			// 检查下一个键是否为数字，如果是则创建数组，否则创建对象
			const nextKey = keyPath[i + 1]
			current[key] = !isNaN(Number(nextKey)) ? [] : {}
		}
		current = current[key]
	}

	// 获取最后一个键
	const finalKey = keyPath[keyPath.length - 1]

	// 处理最后一个键的值
	if (current[finalKey] === undefined || current[finalKey] === null) {
		current[finalKey] = appendValue
	} else if (Array.isArray(current[finalKey]) && Array.isArray(appendValue)) {
		// 如果是数组，则添加到数组中
		current[finalKey].push(...appendValue)
	} else if (
		typeof appendValue !== "string" &&
		appendValue !== null &&
		appendValue !== undefined
	) {
		// 如果 appendValue 不是字符串且非空，则直接赋值
		current[finalKey] = appendValue
	} else {
		// 字符串或其他情况执行拼接
		current[finalKey] = current[finalKey] + appendValue
	}

	return object
}

/**
 * 升级 AI 搜索卡片新版本的状态
 * @param currentStatus 当前状态
 * @param targetStatus 目标状态
 * @returns 升级后的状态
 */
function upgradeAggregateAISearchCardV2Status(
	currentStatus: AggregateAISearchCardV2Status | undefined,
	targetStatus: AggregateAISearchCardV2Status,
) {
	if (!currentStatus) {
		return targetStatus
	}

	if (currentStatus > targetStatus) {
		return currentStatus
	}

	return targetStatus
}

/**
 * 更新 AI 搜索卡片新版本的状态
 * @param object 目标对象
 * @param keyPath 键路径
 */
export function updateAggregateAISearchCardV2Status(
	object: AggregateAISearchCardContentV2 | undefined,
	keyPath: string,
	value: any,
) {
	if (!object || !keyPath) {
		return object
	}

	if (keyPath.startsWith("stream_options.steps_finished")) {
		switch (true) {
			// 收到根问题的搜索结果，标记为开始阅读
			case keyPath.endsWith("associate_questions.question_0") && value?.finished_reason === 0:
				object.status = upgradeAggregateAISearchCardV2Status(
					object.status,
					AggregateAISearchCardV2Status.isReading,
				)
				break
			// 收到子问题的搜索结果，标记为继续搜索
			case keyPath.startsWith(
				"stream_options.steps_finished.associate_questions.question_",
			) && value?.finished_reason === 0:
				object.status = upgradeAggregateAISearchCardV2Status(
					object.status,
					AggregateAISearchCardV2Status.isSearching,
				)
				break
			// 收到思考结果，标记为总结
			case keyPath.endsWith("summary.reasoning_content") && value?.finished_reason === 0:
				object.status = upgradeAggregateAISearchCardV2Status(
					object.status,
					AggregateAISearchCardV2Status.isSummarizing,
				)
				break
			// 收到总结结果，标记为结束
			case keyPath.endsWith("summary.content") && value?.finished_reason === 0:
				object.status = upgradeAggregateAISearchCardV2Status(
					object.status,
					AggregateAISearchCardV2Status.isEnd,
				)
				break
			default:
				break
		}
	}
	// 收到思考内容，标记为正在思考
	else if (
		keyPath.startsWith("summary.reasoning_content") &&
		(!object.status || object.status < AggregateAISearchCardV2Status.isReasoning)
	) {
		object.status = upgradeAggregateAISearchCardV2Status(
			object.status,
			AggregateAISearchCardV2Status.isReasoning,
		)
	}
	// 收到总结内容，标记为正在总结
	else if (
		keyPath.startsWith("summary.content") &&
		(!object.status || object.status < AggregateAISearchCardV2Status.isSummarizing)
	) {
		object.status = upgradeAggregateAISearchCardV2Status(
			object.status,
			AggregateAISearchCardV2Status.isSummarizing,
		)
	}

	return object
}
