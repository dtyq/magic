import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ParsedQuestion } from "../parse"
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
		const onSubmit = vi.fn<(answers: AskUserAnswers, remark: string) => void>()

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

		expect(onSubmit).toHaveBeenCalledWith(
			{
				"q-1": "自定义答案",
			},
			"",
		)
	})

	it("submits custom text for multi-select questions through the frontend other option", () => {
		const onSubmit = vi.fn<(answers: AskUserAnswers, remark: string) => void>()

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

		expect(onSubmit).toHaveBeenCalledWith(
			{
				"q-2": ["A", "补充项"],
			},
			"",
		)
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
	it("keeps entity-equivalent preview input and submits it after the cache key arrives", () => {
		const onSubmit = vi.fn()
		const input: ParsedQuestion = {
			id: "q-0",
			type: "input",
			label: "A &amp; B",
			options: [],
			isComplete: true,
			placeholder: "Mock value",
		}
		const { rerender } = render(
			<AskUserForm locale="en_US" questions={[input]} onSubmit={onSubmit} />,
		)
		const element = screen.getByPlaceholderText("Mock value")
		fireEvent.change(element, { target: { value: "Draft text" } })
		rerender(
			<AskUserForm
				locale="en_US"
				questions={[{ ...input, label: "A & B" }]}
				draftCacheKey="mock-entity-key"
				onSubmit={onSubmit}
			/>,
		)
		expect(screen.getByPlaceholderText("Mock value")).toBe(element)
		expect(element).toHaveValue("Draft text")
		fireEvent.click(screen.getByTestId("ask-user-v2-card-submit-button"))
		expect(onSubmit).toHaveBeenCalledWith({ "q-0": "Draft text" }, "")
	})

	it("clears a draft when the authoritative question changes", () => {
		const input: ParsedQuestion = {
			id: "q-0",
			type: "input",
			label: "Preview label",
			options: [],
			isComplete: true,
			placeholder: "Mock new value",
		}
		const { rerender } = render(<AskUserForm locale="en_US" questions={[input]} />)
		fireEvent.change(screen.getByPlaceholderText("Mock new value"), {
			target: { value: "Old answer" },
		})
		rerender(
			<AskUserForm locale="en_US" questions={[{ ...input, label: "Different question" }]} />,
		)
		expect(screen.getByPlaceholderText("Mock new value")).toHaveValue("")
	})

	it("clears a removed choice without treating it as custom input", () => {
		const choice: ParsedQuestion = {
			id: "q-0",
			type: "select",
			label: "Mock choice",
			options: ["A", "B"],
			isComplete: true,
		}
		const { rerender } = render(<AskUserForm locale="en_US" questions={[choice]} />)
		fireEvent.click(screen.getByText("B"))
		rerender(<AskUserForm locale="en_US" questions={[{ ...choice, options: ["A"] }]} />)
		expect(screen.getByTestId("ask-user-v2-card-select-other-input-q-0")).toHaveValue("")
		expect(
			screen
				.getAllByRole("radio")
				.every((radio) => radio.getAttribute("data-state") === "unchecked"),
		).toBe(true)
	})
})
