import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AskUserForm, type AskUserAnswers } from "../AskUserForm"
import { ASK_USER_OTHER_SENTINEL, getAskUserRenderableOptions } from "../otherOption"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: {
			getFixedT: () => (key: string, options?: Record<string, unknown>) => {
				if (key === "askUser.validation.multiSelectRange") {
					return `${String(options?.min)}-${String(options?.max)}`
				}
				return key
			},
		},
	}),
}))

describe("AskUserForm", () => {
	it("appends a frontend other option", () => {
		expect(getAskUserRenderableOptions(["A", "B"])).toEqual(["A", "B", ASK_USER_OTHER_SENTINEL])
	})

	it("submits custom text for select questions through the frontend other option", () => {
		const onSubmit = vi.fn<(answers: AskUserAnswers) => void>()

		render(
			<AskUserForm
				locale="zh_CN"
				questions={[
					{
						id: "q-1",
						type: "select",
						label: "请选择",
						options: ["A", "B"],
						isComplete: true,
					},
				]}
				onSubmit={onSubmit}
			/>,
		)

		const otherInput = screen.getByTestId("ask-user-v2-card-select-other-input-q-1")
		expect(otherInput).toHaveAttribute("placeholder", "其它")
		fireEvent.focus(otherInput)
		fireEvent.change(otherInput, { target: { value: "自定义答案" } })
		fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))

		expect(onSubmit).toHaveBeenCalledWith({
			"q-1": "自定义答案",
		})
	})

	it("submits custom text for multi-select questions through the frontend other option", () => {
		const onSubmit = vi.fn<(answers: AskUserAnswers) => void>()

		render(
			<AskUserForm
				locale="en_US"
				questions={[
					{
						id: "q-2",
						type: "multi_select",
						label: "请选择",
						options: ["A", "B"],
						min: 1,
						max: 3,
						isComplete: true,
					},
				]}
				onSubmit={onSubmit}
			/>,
		)

		fireEvent.click(screen.getByText("A"))
		const otherInput = screen.getByTestId("ask-user-v2-card-multi-select-other-input-q-2")
		expect(otherInput).toHaveAttribute("placeholder", "other")
		fireEvent.focus(otherInput)
		fireEvent.change(otherInput, { target: { value: "补充项" } })
		fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))

		expect(onSubmit).toHaveBeenCalledWith({
			"q-2": ["A", "补充项"],
		})
	})

	it("maps submitted custom select answers back to the frontend other input", () => {
		render(
			<AskUserForm
				locale="zh_CN"
				questions={[
					{
						id: "q-3",
						type: "select",
						label: "请选择",
						options: ["A", "B"],
						isComplete: true,
					},
				]}
				submittedAnswers={{ "q-3": "已回填答案" }}
				status="answered"
				disabled
			/>,
		)

		expect(screen.getByTestId("ask-user-v2-card-select-other-input-q-3")).toHaveValue(
			"已回填答案",
		)
	})
})
