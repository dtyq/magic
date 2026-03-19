import type { AIResolutionRequest } from "../types"

/**
 * Build AI prompt for intelligent merge conflict resolution
 * 构建 AI 提示词，用于智能合并冲突解决
 */
export function buildAIPrompt(request: AIResolutionRequest): string {
	const { conflicts, changes } = request

	const prompt = `你是一个专业的代码合并助手。现在需要你分析文件内容的冲突和变更，并提供智能的解决方案。

## 任务说明

分析以下冲突和变更，为每一项提供最佳的解决方案。你需要：
1. 理解内容的语义和上下文
2. 判断哪个版本更合理、更完整
3. 必要时合并两个版本的内容
4. 提供清晰的决策理由

## 决策原则

### 对于冲突（Conflicts）：
- 优先选择内容更完整、更详细的版本
- 如果一个版本是另一个版本的扩展，选择扩展版本
- 如果两个版本都有价值，可以生成合并后的自定义内容
- 注意保持代码的语法正确性和逻辑一致性
- 对于配置文件，保留更新的配置项

### 对于新增（Additions）：
- 默认建议保留（keep），除非内容明显过时或错误
- 评估新增内容是否有价值

### 对于删除（Deletions）：
- 默认建议确认删除（remove），除非删除的内容仍然重要
- 评估被删除的内容是否还需要保留

## 输入数据

### 冲突列表（Conflicts）：
${conflicts
	.map(
		(conflict, index) => `
**冲突 ${index + 1}** (ID: ${conflict.id})
- 当前内容（Current）：
\`\`\`
${conflict.currentLines.join("\n")}
\`\`\`

- 服务器内容（Server）：
\`\`\`
${conflict.serverLines.join("\n")}
\`\`\`
`,
	)
	.join("\n")}

### 变更列表（Changes）：
${changes
	.map(
		(change, index) => `
**${change.type === "addition" ? "新增" : "删除"} ${index + 1}** (ID: ${change.id})
- 类型：${change.type === "addition" ? "Addition" : "Deletion"}
- 内容：
\`\`\`
${change.lines.join("\n")}
\`\`\`
`,
	)
	.join("\n")}

## 输出要求

请以 **严格的 JSON 格式** 输出你的分析结果，不要包含任何其他文字说明。JSON 结构如下：

\`\`\`json
{
  "conflictResolutions": [
    {
      "id": "冲突的ID",
      "resolution": "current 或 server 或 custom",
      "customContent": "仅当 resolution 为 custom 时需要提供合并后的内容",
      "reason": "用中文简要说明选择理由（不超过30字）"
    }
  ],
  "changeResolutions": [
    {
      "id": "变更的ID",
      "resolution": "keep 或 remove",
      "reason": "用中文简要说明选择理由（不超过30字）"
    }
  ]
}
\`\`\`

## 注意事项

1. 每个冲突必须有一个解决方案（对应 conflicts 中的每一项）
2. 每个变更必须有一个解决方案（对应 changes 中的每一项）
3. ID 必须与输入数据中的 ID 完全匹配
4. resolution 只能是指定的枚举值
5. 理由要简明扼要，帮助用户理解你的决策
6. 如果选择 custom，必须提供 customContent 字段
7. **只输出 JSON，不要有任何其他内容**

请开始分析并输出 JSON 结果：`

	return prompt
}

/**
 * Parse AI response and extract JSON
 * 解析 AI 响应，提取 JSON 数据
 */
export function parseAIResponse(aiResponse: string): {
	conflictResolutions: unknown[]
	changeResolutions: unknown[]
} {
	// Try to extract JSON from response
	// Sometimes AI may wrap JSON in code blocks
	const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
	const jsonStr = jsonMatch ? jsonMatch[1] : aiResponse

	try {
		return JSON.parse(jsonStr.trim())
	} catch (error) {
		// Try to find JSON object directly
		const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
		if (objectMatch) {
			return JSON.parse(objectMatch[0])
		}
		throw new Error("Failed to parse AI response as JSON")
	}
}
