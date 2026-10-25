import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import FilterSelectItem from "../FilterSelectItem"
import type { FieldItem } from "../types"
import { ScenePanelVariant } from "../../components/LazyScenePanel/types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => (key === "actionDrawer.confirm" ? "Confirm" : key),
		i18n: { language: "en_US" },
	}),
}))

vi.mock("i18next", () => ({
	default: {
		language: "en_US",
		resolvedLanguage: "en_US",
	},
}))

const pagesFilter: FieldItem = {
	data_key: "pages",
	label: { en_US: "Pages" },
	current_value: "",
	options: [
		{ value: "1-5", label: "1-5" },
		{ value: "6-10", label: "6-10" },
		{ value: "10+", label: "10+" },
	],
	custom_input: {
		type: "number",
		min: 1,
		step: 1,
		integer: true,
		placeholder: { en_US: "Enter pages" },
		unit: { en_US: "pages" },
	},
}

describe("FilterSelectItem", () => {
	it("submits an exact custom page count from the desktop dropdown", () => {
		const handleFilterChange = vi.fn()

		render(<FilterSelectItem filter={pagesFilter} onFilterChange={handleFilterChange} />)

		const trigger = screen.getByRole("combobox", { name: "Pages" })
		expect(trigger).toHaveClass("focus-visible:ring-primary/20")
		fireEvent.click(trigger)
		const customInput = screen.getByLabelText("Enter pages")
		expect(document.querySelector('[data-slot="select-content"]')).toHaveClass("w-[272px]")
		expect(customInput).toHaveClass("h-full")
		expect(customInput.parentElement).toHaveClass("h-8", "flex-1")
		expect(screen.getByText("pages")).toBeInTheDocument()
		fireEvent.change(customInput, { target: { value: "8" } })
		fireEvent.click(screen.getByRole("button", { name: "Confirm" }))

		expect(handleFilterChange).toHaveBeenCalledWith("pages", "8")
	})

	it("caps long desktop option lists and keeps them scrollable", () => {
		const languageFilter: FieldItem = {
			data_key: "language",
			label: { en_US: "Language" },
			current_value: "",
			options: Array.from({ length: 18 }, (_, index) => ({
				value: `language-${index}`,
				label: `Language ${index}`,
			})),
		}

		render(<FilterSelectItem filter={languageFilter} onFilterChange={vi.fn()} />)
		fireEvent.click(screen.getByRole("combobox", { name: "Language" }))

		const content = document.querySelector('[data-slot="select-content"]')
		const viewport = document.querySelector("[data-radix-select-viewport]")
		expect(content).toHaveClass(
			"max-h-[min(520px,var(--radix-select-content-available-height))]",
		)
		expect(viewport).toHaveClass(
			"max-h-[min(520px,var(--radix-select-content-available-height))]",
			"overflow-y-auto",
		)
	})

	it("does not submit a page count below the configured minimum", () => {
		render(<FilterSelectItem filter={pagesFilter} onFilterChange={vi.fn()} />)

		fireEvent.click(screen.getByRole("combobox", { name: "Pages" }))
		fireEvent.change(screen.getByLabelText("Enter pages"), { target: { value: "0" } })

		expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled()
	})

	it("submits zero when the custom input configuration allows it", () => {
		const handleFilterChange = vi.fn()

		render(
			<FilterSelectItem
				filter={{
					...pagesFilter,
					custom_input: { ...pagesFilter.custom_input, type: "number", min: 0 },
				}}
				onFilterChange={handleFilterChange}
			/>,
		)

		fireEvent.click(screen.getByRole("combobox", { name: "Pages" }))
		fireEvent.change(screen.getByLabelText("Enter pages"), { target: { value: "0" } })

		const confirmButton = screen.getByRole("button", { name: "Confirm" })
		expect(confirmButton).toBeEnabled()
		fireEvent.click(confirmButton)

		expect(handleFilterChange).toHaveBeenCalledWith("pages", "0")
	})

	it("shows a previously selected custom page count in the trigger", () => {
		render(
			<FilterSelectItem
				filter={{ ...pagesFilter, current_value: "8" }}
				onFilterChange={vi.fn()}
			/>,
		)

		expect(screen.getByRole("combobox", { name: "Pages" })).toHaveTextContent("8")
	})

	it("keeps the unit in the input layout so its width adapts to the text", () => {
		render(
			<FilterSelectItem
				filter={{
					...pagesFilter,
					custom_input: { ...pagesFilter.custom_input, type: "number", unit: "页" },
				}}
				onFilterChange={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByRole("combobox", { name: "Pages" }))

		const customInput = screen.getByLabelText("Enter pages")
		expect(customInput.parentElement).toHaveClass("flex-1")
		expect(screen.getByText("页")).toBeInTheDocument()
	})

	it("clears a selected value from the compact mobile trigger without opening the popup", () => {
		const handleFilterChange = vi.fn()

		render(
			<FilterSelectItem
				filter={{ ...pagesFilter, current_value: "6-10" }}
				onFilterChange={handleFilterChange}
				variant={ScenePanelVariant.Mobile}
				compact
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "select.clear" }))

		expect(handleFilterChange).toHaveBeenCalledWith("pages", "")
		expect(screen.queryByTestId("mobile-scene-panel-filter-popup")).not.toBeInTheDocument()
	})

	it("adds the mobile label alignment offset only to the full mobile layout", () => {
		render(
			<FilterSelectItem
				filter={pagesFilter}
				onFilterChange={vi.fn()}
				variant={ScenePanelVariant.Mobile}
			/>,
		)

		expect(screen.getByText("Pages")).toHaveClass("ml-3")
	})
})
