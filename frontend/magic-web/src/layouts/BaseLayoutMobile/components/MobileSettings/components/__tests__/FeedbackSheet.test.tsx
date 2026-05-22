import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { resetOverlayStackForTest } from "@/utils/overlayZIndex/overlayStackManager"
import { MobileSettingsFeedbackSheet } from "../FeedbackSheet"

const submitMobileSettingsFeedbackMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		info: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
	},
}))

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({
		userInfo: {
			email: "kevent@magicrew.ai",
		},
	}),
}))

vi.mock("../../utils", () => ({
	submitMobileSettingsFeedback: submitMobileSettingsFeedbackMock,
	uploadMobileSettingsFeedbackImages: vi.fn().mockResolvedValue([]),
}))

/** 反馈创建 Sheet 只覆盖当前阶段真实支持的 create 流，避免把列表/详情假能力混进设置页。 */
describe("MobileSettingsFeedbackSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetOverlayStackForTest()
	})

	test("未选择分类和未填写描述时禁用确认按钮", () => {
		render(<MobileSettingsFeedbackSheet open onClose={vi.fn()} />)

		expect((screen.getByLabelText("button.confirm") as HTMLButtonElement).disabled).toBe(true)
	})

	test("选择分类但描述不足 10 字时仍禁用确认按钮", () => {
		render(<MobileSettingsFeedbackSheet open onClose={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mobile-settings-feedback-category-trigger"))
		fireEvent.click(
			screen.getByTestId("mobile-settings-feedback-category-functionUsageFeedback"),
		)
		fireEvent.change(screen.getByTestId("mobile-settings-feedback-description-input"), {
			target: { value: "太短了" },
		})

		expect((screen.getByLabelText("button.confirm") as HTMLButtonElement).disabled).toBe(true)
	})

	test("选择分类并填写至少 10 字描述后启用确认按钮", () => {
		render(<MobileSettingsFeedbackSheet open onClose={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mobile-settings-feedback-category-trigger"))
		fireEvent.click(
			screen.getByTestId("mobile-settings-feedback-category-functionUsageFeedback"),
		)
		fireEvent.change(screen.getByTestId("mobile-settings-feedback-description-input"), {
			target: { value: "这是一段足够长的反馈描述内容" },
		})

		expect((screen.getByLabelText("button.confirm") as HTMLButtonElement).disabled).toBe(false)
	})

	test("带 prefill 打开时预填分类、标题与描述", () => {
		render(
			<MobileSettingsFeedbackSheet
				open
				onClose={vi.fn()}
				prefill={{
					categoryId: "functionUsageFeedback",
					title: "对话「Brand Strategy Review」反馈",
					description: "对话ID：topic-1\n请描述对话中遇到的问题或希望改进的地方：",
				}}
			/>,
		)

		expect(screen.getByTestId("mobile-settings-feedback-category-trigger")).toHaveTextContent(
			"onlineFeedback.functionUsageFeedback",
		)
		expect(screen.getByTestId("mobile-settings-feedback-title-input")).toHaveValue(
			"对话「Brand Strategy Review」反馈",
		)
		expect(screen.getByTestId("mobile-settings-feedback-description-input")).toHaveValue(
			"对话ID：topic-1\n请描述对话中遇到的问题或希望改进的地方：",
		)
	})

	test("提交时将标题并入描述并关闭 Sheet", async () => {
		const handleClose = vi.fn()
		render(<MobileSettingsFeedbackSheet open onClose={handleClose} />)

		fireEvent.click(screen.getByTestId("mobile-settings-feedback-category-trigger"))
		fireEvent.click(screen.getByTestId("mobile-settings-feedback-category-orderRelated"))
		fireEvent.change(screen.getByTestId("mobile-settings-feedback-title-input"), {
			target: { value: "一句话标题" },
		})
		fireEvent.change(screen.getByTestId("mobile-settings-feedback-description-input"), {
			target: { value: "详细问题描述内容补充说明" },
		})
		fireEvent.click(screen.getByLabelText("button.confirm"))

		await waitFor(() => {
			expect(submitMobileSettingsFeedbackMock).toHaveBeenCalledWith({
				type: "订单问题",
				description:
					"setting.feedbackSheet.titleLabelPlain: 一句话标题\n\n详细问题描述内容补充说明",
				contactEmail: "kevent@magicrew.ai",
				images: [],
			})
		})
		expect(handleClose).toHaveBeenCalledTimes(1)
	})
})
