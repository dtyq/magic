import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { useImagePromptCompletion } from "../useImagePromptCompletion"

const { completeImagePrompt, completeTextContent } = vi.hoisted(() => ({
	completeImagePrompt: vi.fn(),
	completeTextContent: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		completeImagePrompt,
		completeTextContent,
	},
}))

describe("useImagePromptCompletion", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		completeImagePrompt.mockResolvedValue({
			prompt: "浅色无缝背景纸延展成柔和摄影棚空间",
		})
		completeTextContent.mockResolvedValue({
			text: "夏日新品\n限时上市",
		})
	})

	it("injects project_id and resolves reference image paths", async () => {
		const { result } = renderHook(() =>
			useImagePromptCompletion({
				projectId: "project-1",
				designProjectBasePath: "design",
				flatAttachments: [],
			}),
		)

		await act(async () => {
			await result.current.completeImagePrompt({
				user_prompt: "请根据商品图补全文生背景提示词",
				reference_images: ["./product-a.png"],
				reference_image_options: [
					{
						path: "./product-a.png",
						crop: { x: 1, y: 2, width: 3, height: 4 },
					},
				],
			})
		})

		expect(completeImagePrompt).toHaveBeenCalledWith({
			project_id: "project-1",
			user_prompt: "请根据商品图补全文生背景提示词",
			reference_images: ["/design/product-a.png"],
			reference_image_options: [
				{
					path: "/design/product-a.png",
					crop: { x: 1, y: 2, width: 3, height: 4 },
				},
			],
		})
	})

	it("omits model_id when caller does not provide it", async () => {
		const { result } = renderHook(() =>
			useImagePromptCompletion({
				projectId: "project-1",
			}),
		)

		await act(async () => {
			await result.current.completeImagePrompt({
				user_prompt: "生成背景提示词",
			})
		})

		expect(completeImagePrompt).toHaveBeenLastCalledWith({
			project_id: "project-1",
			user_prompt: "生成背景提示词",
			reference_images: undefined,
			reference_image_options: undefined,
		})
		expect(completeImagePrompt.mock.calls.at(-1)?.[0]).not.toHaveProperty("model_id")
	})

	it("exposes text content completion through the canvas methods contract", async () => {
		const { result } = renderHook(() =>
			useImagePromptCompletion({
				projectId: "project-1",
			}),
		)

		let response: Awaited<ReturnType<typeof result.current.completeTextContent>> | undefined
		await act(async () => {
			response = await result.current.completeTextContent({
				user_prompt: "优化文本内容",
			})
		})

		expect(completeTextContent).toHaveBeenLastCalledWith({
			project_id: "project-1",
			user_prompt: "优化文本内容",
		})
		expect(completeImagePrompt).not.toHaveBeenCalled()
		expect(response).toEqual({
			text: "夏日新品\n限时上市",
		})
	})
})
