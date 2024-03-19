/**
 * 判断changeValues是否只包含knowledge_config.knowledge_list[index].knowledge_type
 * 用于检测是否仅有知识库类型发生变化
 * @param changeValues Form变更值
 * @returns [是否满足条件, 索引值(可选)]
 */
export function isOnlyKnowledgeTypeChange(changeValues: any): [boolean, number?] {
	// 1. 检查是否只包含knowledge_config属性
	const keys = Object.keys(changeValues)
	if (keys.length !== 1 || keys[0] !== "knowledge_config") {
		return [false]
	}

	const { knowledge_config } = changeValues

	// 2. 检查knowledge_config是否只包含knowledge_list属性
	const configKeys = Object.keys(knowledge_config)
	if (configKeys.length !== 1 || configKeys[0] !== "knowledge_list") {
		return [false]
	}

	const { knowledge_list } = knowledge_config

	// 3. 检查knowledge_list是否是数组
	if (!Array.isArray(knowledge_list)) {
		return [false]
	}

	// 4. 找到只包含knowledge_type属性的对象及其索引
	let foundIndex = -1
	let foundCount = 0

	knowledge_list.forEach((item, index) => {
		// 跳过空项
		if (!item) return

		// 检查项是否是对象
		if (typeof item !== "object") return

		const itemKeys = Object.keys(item)
		// 检查项是否只有一个属性且为knowledge_type
		if (itemKeys.length === 1 && itemKeys[0] === "knowledge_type") {
			foundIndex = index
			foundCount++
		}
	})

	// 5. 确保只有一个满足条件的项
	if (foundCount === 1 && foundIndex !== -1) {
		return [true, foundIndex]
	}

	return [false]
}
