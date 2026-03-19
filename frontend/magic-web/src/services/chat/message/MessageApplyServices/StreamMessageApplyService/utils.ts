import type { StreamResponse } from "@/types/request"

/**
 * 获取流式消息
 * @param message 消息
 * @returns 流式消息
 */
export function sliceMessage(message: StreamResponse) {
	const { content, reasoning_content, llm_response } = message

	// 定义一个函数来处理字符串分割，将文本分割成更小的单位以实现逐字输出
	const sliceString = (str: string) => {
		// 对于极短的字符串，直接返回
		if (!str || str.length === 0) {
			return []
		}

		if (str.length <= 1) {
			return [str]
		}

		// 将字符串分割成单个字符
		const characters: string[] = []

		// 逐字符分割，确保每个字符单独处理
		for (let i = 0; i < str.length; i++) {
			const char = str.charAt(i)
			characters.push(char)
		}

		return characters
	}

	switch (true) {
		case Boolean(content):
			return sliceString(content).map((item) => ({
				...message,
				content: item,
			}))
		case Boolean(llm_response):
			return sliceString(llm_response).map((item) => ({
				...message,
				llm_response: item,
			}))
		case Boolean(reasoning_content):
			return sliceString(reasoning_content).map((item) => ({
				...message,
				reasoning_content: item,
			}))
		default:
			return []
	}
}
