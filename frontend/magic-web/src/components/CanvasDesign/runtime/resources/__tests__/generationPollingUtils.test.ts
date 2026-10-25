import { describe, expect, it } from "vitest"
import {
	INVALID_GENERATED_RESOURCE_PATH_ERROR,
	isGenerationTaskNotFoundError,
	resolveGenerationErrorMessage,
} from "../polling/generationPollingUtils"

describe("resolveGenerationErrorMessage", () => {
	it("maps the internal unresolved-path reason to the localized fallback", () => {
		expect(
			resolveGenerationErrorMessage(INVALID_GENERATED_RESOURCE_PATH_ERROR, "图片生成失败"),
		).toBe("图片生成失败")
	})

	it("preserves backend-provided error messages", () => {
		expect(resolveGenerationErrorMessage("内容审核失败", "图片生成失败")).toBe("内容审核失败")
	})
})

describe("isGenerationTaskNotFoundError", () => {
	it("matches only the invalid-argument response that names the current task", () => {
		expect(
			isGenerationTaskNotFoundError(
				{ code: 14000, message: "video-task-1 未找到" },
				"video-task-1",
			),
		).toBe(true)
	})

	it("does not self-heal a different task or a different business error", () => {
		expect(
			isGenerationTaskNotFoundError(
				{ code: 14000, message: "video-task-2 未找到" },
				"video-task-1",
			),
		).toBe(false)
		expect(
			isGenerationTaskNotFoundError(
				{ code: 14001, message: "video-task-1 提交失败" },
				"video-task-1",
			),
		).toBe(false)
	})
})
